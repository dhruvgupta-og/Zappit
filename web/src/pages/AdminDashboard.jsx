import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { auth, storage } from '../firebase';
import {
  BarChart3, Users, Store, ShoppingBag, IndianRupee,
  Plus, Trash2, Edit2, School, Package, TrendingUp, Menu as MenuIcon, Tag, Image as ImageIcon, Download
} from 'lucide-react';
import * as XLSX from 'xlsx';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [orders, setOrders] = useState([]);
  const [isExporting, setIsExporting] = useState(false);
  const [stores, setStores] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [banners, setBanners] = useState([]);
  const [localFees, setLocalFees] = useState([
    { name: 'Delivery Fee', value: 20 },
    { name: 'Platform Fee', value: 5 }
  ]);

  const addLocalFee = () => {
    setLocalFees(p => [...p, { name: '', value: 0 }]);
  };

  const removeLocalFee = (index) => {
    setLocalFees(p => p.filter((_, i) => i !== index));
  };

  const updateLocalFee = (index, field, val) => {
    setLocalFees(p => p.map((f, i) => {
      if (i === index) {
        return { ...f, [field]: field === 'value' ? Number(val) : val };
      }
      return f;
    }));
  };

  const saveFeesToDb = async () => {
    const invalid = localFees.some(f => !f.name.trim());
    if (invalid) {
      alert('Fee names cannot be empty!');
      return;
    }

    try {
      await api.post('/api/admin/config/fees', { list: localFees });
      alert('Fees updated successfully!');
    } catch (err) {
      alert('Failed to save fees: ' + err.message);
    }
  };
  
  // Menu management state
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [menuItems, setMenuItems] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [useUrlMode, setUseUrlMode] = useState({}); // { store: false, menu: false, banner: false }
  
  // Filtering state
  const [timeFilter, setTimeFilter] = useState('all'); // day, week, month, all
  const [collegeFilter, setCollegeFilter] = useState('all');
  const [storeFilter, setStoreFilter] = useState('all');

  const toggleMode = (key) => {
    setUseUrlMode(p => ({ ...p, [key]: !p[key] }));
    setIsUploading(false);
    setUploadProgress(0);
  };

  const resetUpload = () => {
    setIsUploading(false);
    setUploadProgress(0);
  };

  const handleImageUpload = (file, folder) => {
    return new Promise((resolve, reject) => {
      if (!file) return resolve(null);
      setIsUploading(true);
      setUploadProgress(0);
      
      const storageRef = ref(storage, `${folder}/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(Math.round(progress));
        }, 
        (error) => {
          console.error("Upload failed:", error);
          alert("Upload failed! Check your Firebase Storage Rules.");
          setIsUploading(false);
          resolve(null);
        }, 
        () => {
          getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
            setIsUploading(false);
            resolve(downloadURL);
          });
        }
      );
    });
  };

  // ── DATA LOADING (one-time fetch to save Firestore quota) ──────────────────
  const loadAllData = async () => {
    try {
      const [storesRes, collegesRes, bannersRes, feesRes] = await Promise.all([
        api.get('/api/stores'),
        api.get('/api/admin/colleges'),
        api.get('/api/admin/banners'),
        api.get('/api/admin/config/fees').catch(() => ({ data: { data: null } }))
      ]);
      if (storesRes.data.success) setStores(storesRes.data.stores);
      if (collegesRes.data.success) setColleges(collegesRes.data.colleges);
      if (bannersRes.data.success) setBanners(bannersRes.data.banners);
      if (feesRes.data.data?.list) setLocalFees(feesRes.data.data.list);
      
      try {
        const couponsRes = await api.get('/api/get-coupons');
        if (couponsRes.data.success) {
          setCoupons(couponsRes.data.coupons);
        }
      } catch (couponErr) {
        console.error('Failed to load coupons via API:', couponErr);
      }
    } catch (err) {
      console.error('[Admin] Failed to load data:', err.message);
    }
  };

  // ── REAL-TIME DATA (orders only — must be live for admin tracking) ──────────
  const fetchOrders = async () => {
    try {
      const res = await api.get('/api/orders?admin=true');
      if (res.data.success) {
        setOrders(res.data.orders); // Admin sees ALL orders including flagged
      }
    } catch (err) {
      console.warn('[Admin] Orders fetch error:', err.message);
    }
  };

  useEffect(() => {
    let intervalId;
    
    // Wait for Firebase Auth to initialize before fetching
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const tokenResult = await user.getIdTokenResult();
          const res = await api.get(`/api/users/${user.uid}`);
          if (res.data.success && res.data.user?.role === 'admin') {
            loadAllData();
            fetchOrders();
            intervalId = setInterval(fetchOrders, 10000); // 10s polling
          } else {
            alert('Unauthorized: Admins only');
            window.location.href = '/';
          }
        } catch (err) {
          console.error('Auth verification failed', err);
          window.location.href = '/';
        }
      } else {
        // User not logged in, clear data
        setOrders([]);
        if (intervalId) clearInterval(intervalId);
      }
    });

    return () => {
      unsubAuth();
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const loadMenuData = async () => {
    if (!selectedStoreId) { setMenuItems([]); return; }
    try {
      const s = await api.get(`/api/stores/${selectedStoreId}`);
      if (s.data.success) setMenuItems(s.data.menu.map(m => ({ id: m._id, ...m })));
    } catch (err) {
      console.warn('[Admin] Menu fetch error:', err.message);
    }
  };

  // Fetch menu when a store is selected in Menu tab (one-time, not real-time)
  useEffect(() => {
    loadMenuData();
  }, [selectedStoreId]);

  // ── FILTERING LOGIC ──
  const getFilteredOrders = () => {
    return orders.filter(o => {
      const orderDate = new Date(o.created_at);
      const now = new Date();
      
      // Time Filter
      let timeMatch = true;
      if (timeFilter === 'day') {
        timeMatch = orderDate.toDateString() === now.toDateString();
      } else if (timeFilter === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        timeMatch = orderDate >= weekAgo;
      } else if (timeFilter === 'month') {
        timeMatch = orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear();
      }

      // College Filter
      const collegeMatch = collegeFilter === 'all' || o.college_id === collegeFilter;

      // Store Filter
      const storeMatch = storeFilter === 'all' || o.store_id === storeFilter;

      return timeMatch && collegeMatch && storeMatch;
    });
  };

  const filteredOrders = getFilteredOrders();

  // Analytics based on filtered orders
  const totalRevenue = filteredOrders.filter(o => o.order_status === 'delivered').reduce((s, o) => s + (o.total_amount || 0), 0);
  const totalOrdersCount = filteredOrders.length;
  const pendingOrders = filteredOrders.filter(o => ['pending', 'confirmed', 'preparing', 'ready'].includes(o.order_status));
  
  const storeStats = filteredOrders.reduce((acc, o) => {
    const key = o.store_name || 'Unknown';
    if (!acc[key]) acc[key] = { count: 0, revenue: 0 };
    acc[key].count += 1;
    if (o.order_status === 'delivered') acc[key].revenue += (o.total_amount || 0);
    return acc;
  }, {});

  const dishStats = filteredOrders.reduce((acc, o) => {
    if (o.items && Array.isArray(o.items)) {
      o.items.forEach(item => {
        if (item && item.name) {
          if (!acc[item.name]) acc[item.name] = 0;
          acc[item.name] += (item.quantity || 0);
        }
      });
    }
    return acc;
  }, {});

  // ── STORE MANAGEMENT ──
  const [showStoreForm, setShowStoreForm] = useState(false);
  const [editingStoreId, setEditingStoreId] = useState(null);
  const [storeForm, setStoreForm] = useState({ name: '', image: '', rating: '4.5', delivery_time_mins: '15-20', tags: '', college_id: '', email: '', password: '' });
  
  const saveStore = async () => {
    try {
      if (editingStoreId) {
        if (!storeForm.name || !storeForm.college_id) {
          alert('Name and College are required.');
          return;
        }
        const collegeName = colleges.find(c => c.id === storeForm.college_id)?.name || '';
        const storeData = { 
          name: storeForm.name,
          image: storeForm.image,
          college_id: storeForm.college_id,
          rating: Number(storeForm.rating), 
          tags: storeForm.tags ? storeForm.tags.split(',').map(t => t.trim()).filter(t => t) : [], 
          is_open: true,
          college_name: collegeName,
          id: editingStoreId
        };
        await api.post('/api/admin/stores', storeData); 
      } else {
        if (!storeForm.email || !storeForm.password) {
          alert('Email and Password are required.');
          return;
        }
        await api.post('/api/admin/create-store-owner', {
          email: storeForm.email,
          password: storeForm.password
        });
      }

      setStoreForm({ name: '', image: '', rating: '4.5', delivery_time_mins: '15-20', tags: '', college_id: '', email: '', password: '' });
      setShowStoreForm(false);
      setEditingStoreId(null);
      await loadAllData();
    } catch (err) {
      alert('Error saving store: ' + err.message);
    }
  };

  const editStore = (store) => {
    setStoreForm({
      name: store.name || '',
      image: store.image || '',
      rating: String(store.rating || '4.5'),
      delivery_time_mins: store.delivery_time_mins || '',
      tags: store.tags ? store.tags.join(', ') : '',
      college_id: store.college_id || ''
    });
    setEditingStoreId(store.id);
    setShowStoreForm(true);
  };

  // ── COLLEGE MANAGEMENT ──
  const [showCollegeForm, setShowCollegeForm] = useState(false);
  const [editingCollegeId, setEditingCollegeId] = useState(null);
  const [collegeForm, setCollegeForm] = useState({ name: '', city: '' });
  
  const saveCollege = async () => {
    if (!collegeForm.name) return;
    
    try {
      const data = { ...collegeForm, created_at: new Date().toISOString() };
      if (editingCollegeId) data.id = editingCollegeId;

      await api.post('/api/admin/colleges', data);

      setCollegeForm({ name: '', city: '' });
      setShowCollegeForm(false);
      setEditingCollegeId(null);
      await loadAllData();
    } catch (err) {
      alert('Error saving college: ' + err.message);
    }
  };

  const toggleStoreStatus = async (store) => {
    await api.post('/api/admin/stores', { id: store.id, is_open: !store.is_open });
    await loadAllData();
  };

  // ── COLLEGE MANAGEMENT ──
  const [showCouponForm, setShowCouponForm] = useState(false);
  const [editingCouponId, setEditingCouponId] = useState(null);
  const [couponForm, setCouponForm] = useState({ code: '', discount: '', college_id: 'all', once_per_user: true });

  const saveCoupon = async () => {
    if (!couponForm.code || !couponForm.discount) return;

    const data = {
      code: couponForm.code,
      discount_percent: couponForm.discount,
      college_id: couponForm.college_id || 'all',
      once_per_user: couponForm.once_per_user,
      active: true
    };

    if (editingCouponId) {
      data.id = editingCouponId;
    }

    try {
      await api.post('/api/save-coupon', data);

      setCouponForm({ code: '', discount: '', college_id: 'all', once_per_user: true });
      setShowCouponForm(false);
      setEditingCouponId(null);
      await loadAllData();
    } catch (err) {
      alert('Error saving coupon: ' + (err.response?.data?.error || err.message));
    }
  };

  const deleteCoupon = async (id) => {
    if (window.confirm('Delete this coupon?')) {
      try {
        await api.post('/api/delete-coupon', { id });
        await loadAllData();
      } catch (err) {
        alert('Error deleting coupon: ' + (err.response?.data?.error || err.message));
      }
    }
  };

  // ── BANNER MANAGEMENT ──
  const [showBannerForm, setShowBannerForm] = useState(false);
  const [editingBannerId, setEditingBannerId] = useState(null);
  const [bannerForm, setBannerForm] = useState({ image: '', link: '', coupon_code: '' });

  const saveBanner = async () => {
    if (!bannerForm.image) {
      alert("Please upload an image first!");
      return;
    }
    const data = {
      image: bannerForm.image,
      link: bannerForm.link,
      coupon_code: bannerForm.coupon_code || '',
      active: true,
      created_at: new Date().toISOString()
    };
    if (editingBannerId) data.id = editingBannerId;

    try {
      await api.post('/api/admin/banners', data);

      setBannerForm({ image: '', link: '' });
      setShowBannerForm(false);
      setEditingBannerId(null);
      await loadAllData();
    } catch (err) {
      alert('Error saving banner: ' + err.message);
    }
  };

  const editCollege = (college) => {
    setCollegeForm({ name: college.name || '', city: college.city || '' });
    setEditingCollegeId(college.id);
    setShowCollegeForm(true);
  };

  // ── MENU MANAGEMENT ──
  const [showMenuForm, setShowMenuForm] = useState(false);
  const [editingMenuId, setEditingMenuId] = useState(null);
  const [menuForm, setMenuForm] = useState({ name: '', price: '', desc: '', category: 'Snacks', isVeg: true, image: '' });

  const saveMenuItem = async () => {
    if (!selectedStoreId || !menuForm.name || !menuForm.price) return;
    
    const menuData = { 
      ...menuForm, 
      price: Number(menuForm.price), 
      is_available: true,
      store_id: selectedStoreId
    };
    if (editingMenuId) menuData.id = editingMenuId;

    try {
      await api.post('/api/admin/menu', menuData);

      setMenuForm({ name: '', price: '', desc: '', category: 'Snacks', isVeg: true, image: '' });
      setShowMenuForm(false);
      setEditingMenuId(null);
      await loadMenuData();
    } catch (err) {
      alert('Error saving menu item: ' + err.message);
    }
  };

  const editMenuItem = (item) => {
    setMenuForm({
      name: item.name || '',
      price: String(item.price || ''),
      desc: item.desc || '',
      category: item.category || 'Snacks',
      isVeg: item.isVeg !== false,
      image: item.image || ''
    });
    setEditingMenuId(item.id);
    setShowMenuForm(true);
  };

  const deleteItem = async (col, id) => {
    if (window.confirm('Delete?')) {
      await api.post('/api/admin/delete', { collection: col, id });
      await loadAllData();
    }
  };

  const deleteMenuItem = async (id) => {
    if (window.confirm('Delete menu item?')) {
      await api.post('/api/admin/delete', { collection: 'menu', id });
      await loadMenuData();
    }
  };

  const toggleMenuAvailability = async (item) => {
    await api.post('/api/admin/menu', { id: item.id, is_available: !item.is_available });
    await loadMenuData();
  };

  const updateOrderStatus = async (orderId, status) => {
    try {
      await api.patch(`/api/orders/${orderId}/status`, { order_status: status });
      // Call status notification endpoint
      await api.post('/api/send-status-notification', { orderId, status });
      fetchOrders();
    } catch (err) {
      console.error('Failed to update order status or send push notification:', err);
    }
  };

  const topStoresByRevenue = Object.entries(storeStats).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 5);
  const topDishes = Object.entries(dishStats).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const statCards = [
    { label: 'Revenue',        value: `₹${totalRevenue}`,   icon: <IndianRupee size={20} />,  color: '#F59E0B', bg: '#FEF3C7' },
    { label: 'Total Orders',   value: totalOrdersCount,      icon: <ShoppingBag size={20} />, color: '#3B82F6', bg: '#EFF6FF' },
    { label: 'Active Orders',  value: pendingOrders.length,  icon: <Package size={20} />,     color: '#EF4444', bg: '#FEE2E2' },
    { label: 'Stores',         value: stores.length,         icon: <Store size={20} />,       color: '#8B5CF6', bg: '#EDE9FE' },
    { label: 'Colleges',       value: colleges.length,       icon: <School size={20} />,      color: '#EC4899', bg: '#FCE7F3' },
    { label: 'Coupons',        value: coupons.length,        icon: <Tag size={20} />,         color: '#065F46', bg: '#D1FAE5' },
    { label: 'Banners',        value: banners.length,        icon: <ImageIcon size={20} />,   color: '#F59E0B', bg: '#FEF3C7' },
  ];

  const tabs = [
    { key: 'overview',  label: '📊 Overview' },
    { key: 'orders',    label: '📦 Orders' },
    { key: 'stores',    label: '🏪 Stores' },
    { key: 'colleges',  label: '🎓 Colleges' },
    { key: 'menu',      label: '🍕 Menu' },
    { key: 'coupons',   label: '🎟️ Coupons' },
    { key: 'banners',   label: '🖼️ Banners' },
    { key: 'fees',      label: '⚙️ Fees' },
  ];

  const handleExportData = async () => {
    try {
      setIsExporting(true);
      const ordersRes = await api.get('/api/orders?admin=true');
      const storesRes = await api.get('/api/stores');
      const collegesRes = await api.get('/api/admin/colleges');
      
      const ordersArr = ordersRes.data.orders || [];
      const storesArr = storesRes.data.stores || [];
      const collegesArr = collegesRes.data.colleges || [];

      const storesDict = {};
      storesArr.forEach(d => { storesDict[d.id] = d; });
      const collegesDict = {};
      collegesArr.forEach(d => { collegesDict[d.id] = d; });

      const exportData = [];
      ordersArr.forEach(order => {
        // Fallback for timestamps
        let dateObj = new Date();
        if (order.created_at) {
          dateObj = new Date(order.created_at);
        } else if (order.createdAt && order.createdAt.toDate) {
          dateObj = order.createdAt.toDate();
        }

        const store = storesDict[order.store_id || order.storeId] || {};
        const collegeId = store.college_id || store.collegeId || order.college_id;
        const college = collegeId ? (collegesDict[collegeId] || {}) : {};
        
        exportData.push({
          'Order ID': order.id || order._id,
          'Date': dateObj.toLocaleDateString(),
          'Time': dateObj.toLocaleTimeString(),
          'College': college.name || order.college_name || 'Unknown',
          'Store Name': store.name || order.store_name || order.storeName || 'Unknown',
          'Amount': order.total_amount || order.totalAmount || 0,
          'Status': order.order_status || order.status || 'Unknown',
          'Customer ID': order.user_id || order.userId || 'Unknown',
          'Items': Array.isArray(order.items) ? order.items.map(i => `${i.quantity || i.qty || 1}x ${i.name}`).join(', ') : '',
        });
      });
      
      exportData.sort((a, b) => new Date(`${b.Date} ${b.Time}`) - new Date(`${a.Date} ${a.Time}`));
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Orders Data");
      XLSX.writeFile(wb, `Zappit_Data_Export_${new Date().toLocaleDateString().replace(/[\/\\]/g, '-')}.xlsx`);
    } catch (err) {
      console.error('Export failed', err);
      alert('Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9', paddingBottom: 40 }}>
      {/* ── HEADER ── */}
      <div style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', padding: '24px 20px 32px', color: 'white' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '0.72rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Admin Panel</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h1 style={{ margin: '4px 0 0', fontSize: '1.75rem', fontWeight: 900 }}>Zappit Admin</h1>
              <button onClick={handleExportData} disabled={isExporting} style={{ marginTop: '8px', padding: '6px 12px', borderRadius: '8px', border: 'none', background: '#10B981', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', cursor: isExporting ? 'not-allowed' : 'pointer', fontSize: '0.8rem' }}>
                <Download size={14} /> {isExporting ? 'Exporting...' : 'Export All Data'}
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={timeFilter} onChange={e => setTimeFilter(e.target.value)} style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.1)', color: 'white', fontSize: '0.75rem', fontWeight: 600 }}>
                <option value="all" style={{ color: '#0F172A' }}>📅 All Time</option>
                <option value="day" style={{ color: '#0F172A' }}>Today</option>
                <option value="week" style={{ color: '#0F172A' }}>This Week</option>
                <option value="month" style={{ color: '#0F172A' }}>This Month</option>
              </select>
              <select value={collegeFilter} onChange={e => setCollegeFilter(e.target.value)} style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.1)', color: 'white', fontSize: '0.75rem', fontWeight: 600 }}>
                <option value="all" style={{ color: '#0F172A' }}>🎓 All Colleges</option>
                {colleges.map(c => <option key={c.id} value={c.id} style={{ color: '#0F172A' }}>{c.name}</option>)}
              </select>
            </div>
            <select value={storeFilter} onChange={e => setStoreFilter(e.target.value)} style={{ width: '100%', padding: '6px 10px', borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.1)', color: 'white', fontSize: '0.75rem', fontWeight: 600 }}>
              <option value="all" style={{ color: '#0F172A' }}>🏪 All Stores</option>
              {stores.map(s => <option key={s.id} value={s.id} style={{ color: '#0F172A' }}>{s.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ padding: '0 16px', marginTop: -20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {statCards.map(s => (
            <div key={s.label} style={{ background: 'white', borderRadius: 14, padding: '14px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: s.bg, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.icon}</div>
              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A' }}>{s.value}</div>
                <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={{ display: 'flex', gap: 0, background: 'white', margin: '16px 0 0', borderBottom: '2px solid #E2E8F0', overflowX: 'auto' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{ flexShrink: 0, padding: '14px 16px', border: 'none', background: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', color: activeTab === t.key ? '#0F172A' : '#94A3B8', borderBottom: activeTab === t.key ? '3px solid #0F172A' : '3px solid transparent', marginBottom: -2, whiteSpace: 'nowrap' }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: 16 }}>
        {/* ════ OVERVIEW ════ */}
        {activeTab === 'overview' && (
          <div>
            <h3 style={{ margin: '0 0 12px', fontSize: '1rem', fontWeight: 800 }}>Top Stores by Revenue</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {topStoresByRevenue.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20, color: '#94A3B8' }}>No revenue data for this filter</div>
              ) : topStoresByRevenue.map(([name, stats], i) => (
                <div key={name} style={{ background: 'white', borderRadius: 12, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontWeight: 800, color: '#94A3B8', fontSize: '0.875rem' }}>#{i + 1}</span>
                    <span style={{ fontWeight: 600 }}>{name}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: '#0F172A' }}>₹{stats.revenue}</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748B' }}>{stats.count} orders</div>
                  </div>
                </div>
              ))}
            </div>

            <h3 style={{ margin: '24px 0 12px', fontSize: '1rem', fontWeight: 800 }}>Top Selling Dishes</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {topDishes.length === 0 ? (
                <div style={{ gridColumn: 'span 2', textAlign: 'center', padding: 20, color: '#94A3B8', background: 'white', borderRadius: 12 }}>No dish data available</div>
              ) : topDishes.map(([name, count], i) => (
                <div key={name} style={{ background: 'white', borderRadius: 12, padding: '10px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                   <div style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 600 }}>#{i+1} Best Seller</div>
                   <div style={{ fontWeight: 700, margin: '2px 0' }}>{name}</div>
                   <div style={{ color: '#10B981', fontWeight: 800, fontSize: '0.9rem' }}>{count} sold</div>
                </div>
              ))}
            </div>

            <h3 style={{ margin: '24px 0 12px', fontSize: '1rem', fontWeight: 800 }}>Recent Orders</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[...filteredOrders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5).map(o => (
                <div key={o.id} style={{ background: 'white', borderRadius: 12, padding: '12px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>#{o.id.slice(-6).toUpperCase()}</div>
                      <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{o.store_name} · {o.address}</div>
                      <div style={{ fontSize: '0.65rem', color: '#64748B', marginTop: 2 }}>
                        📅 {o.created_at ? new Date(o.created_at).toLocaleDateString() : ''} · 🕒 {o.created_at ? new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: '#0F172A' }}>₹{o.total_amount}</div>
                      <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: o.order_status === 'delivered' ? '#D1FAE5' : o.order_status === 'cancelled' ? '#FEE2E2' : '#FEF3C7', color: o.order_status === 'delivered' ? '#065F46' : o.order_status === 'cancelled' ? '#991B1B' : '#92400E' }}>
                        {o.order_status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ════ ORDERS ════ */}
        {activeTab === 'orders' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...orders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(o => (
              <div key={o.id} style={{
                background: 'white',
                borderRadius: 12,
                padding: 14,
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                border: o.payment_status === 'flagged' ? '2px solid #DC2626' : '1px solid transparent'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ fontWeight: 700 }}>#{o.id.slice(-6).toUpperCase()}</div>
                      {o.payment_status === 'flagged' && (
                        <span style={{ background: '#FEE2E2', color: '#DC2626', fontSize: '0.65rem', fontWeight: 800, padding: '2px 8px', borderRadius: 8, letterSpacing: '0.05em' }}>🚩 FLAGGED PAYMENT</span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{o.store_name} · {o.address}</div>
                    <div style={{ fontSize: '0.65rem', color: '#64748B', marginTop: 2 }}>
                      📅 {o.created_at ? new Date(o.created_at).toLocaleDateString() : ''} · 🕒 {o.created_at ? new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </div>
                    {o.payment_status === 'flagged' && (
                      <div style={{ fontSize: '0.65rem', color: '#DC2626', marginTop: 3, fontWeight: 600 }}>⚠️ Payment not captured by Razorpay — manual review needed</div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: '#0F172A' }}>₹{o.total_amount}</div>
                    <div style={{ fontSize: '0.7rem', marginTop: 2, color: o.payment_status === 'paid' || o.payment_status === 'completed' ? '#059669' : o.payment_status === 'flagged' ? '#DC2626' : '#94A3B8', fontWeight: 600 }}>
                      {o.payment_status}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {['confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'].map(status => (
                    <button key={status} onClick={() => updateOrderStatus(o.id, status)}
                      style={{ padding: '4px 8px', borderRadius: 6, border: o.order_status === status ? '2px solid #0F172A' : '1px solid #E2E8F0', background: o.order_status === status ? '#0F172A' : 'white', color: o.order_status === status ? 'white' : '#64748B', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}>
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ════ STORES ════ */}
        {activeTab === 'stores' && (
          <>
            <button onClick={() => { setEditingStoreId(null); setStoreForm({ name: '', image: '', rating: '4.5', delivery_time_mins: '15-20', tags: '', college_id: '', email: '', password: '' }); setShowStoreForm(true); }} style={{ width: '100%', padding: '13px', borderRadius: 12, border: '2px dashed #94A3B8', background: 'rgba(0,0,0,0.02)', color: '#475569', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 14 }}>
              <Plus size={18} /> Add New Store
            </button>
            {showStoreForm && (
              <div style={{ background: 'white', borderRadius: 12, padding: 16, marginBottom: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                <h3 style={{ margin: '0 0 12px 0' }}>{editingStoreId ? 'Edit Store Config' : 'Create New Store Owner'}</h3>
                
                {!editingStoreId ? (
                  <>
                    <input type="email" placeholder="Store Owner Email (e.g. store@gmail.com)" value={storeForm.email} onChange={e => setStoreForm(p => ({ ...p, email: e.target.value }))}
                      style={{ width: '100%', padding: '10px 12px', marginBottom: 8, borderRadius: 8, border: '1px solid #E2E8F0', outline: 'none', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                    <input type="password" placeholder="Password" value={storeForm.password} onChange={e => setStoreForm(p => ({ ...p, password: e.target.value }))}
                      style={{ width: '100%', padding: '10px 12px', marginBottom: 12, borderRadius: 8, border: '1px solid #E2E8F0', outline: 'none', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                  </>
                ) : (
                  <>
                    <input placeholder="Store Name" value={storeForm.name} onChange={e => setStoreForm(p => ({ ...p, name: e.target.value }))}
                      style={{ width: '100%', padding: '10px 12px', marginBottom: 8, borderRadius: 8, border: '1px solid #E2E8F0', outline: 'none', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                    
                    <div style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'center' }}>
                      {useUrlMode.store ? (
                        <input placeholder="Image URL" value={storeForm.image} onChange={e => setStoreForm(p => ({ ...p, image: e.target.value }))}
                          style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #E2E8F0', outline: 'none', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                      ) : (
                        <>
                          <input type="file" accept="image/*" onChange={async (e) => {
                            const url = await handleImageUpload(e.target.files[0], 'stores');
                            if (url) setStoreForm(p => ({ ...p, image: url }));
                          }} style={{ fontSize: '0.8rem' }} />
                          {storeForm.image && <div style={{ fontSize: '0.7rem', color: '#10B981', marginTop: 4 }}>✓ Image ready</div>}
                        </>
                      )}
                    </div>

                    {[{ key: 'rating', label: 'Rating (1-5)' }, { key: 'delivery_time_mins', label: 'Delivery Time (e.g. 15-20)' }, { key: 'tags', label: 'Tags (comma separated)' }].map(f => (
                      <input key={f.key} placeholder={f.label} value={storeForm[f.key]} onChange={e => setStoreForm(p => ({ ...p, [f.key]: e.target.value }))}
                        style={{ width: '100%', padding: '10px 12px', marginBottom: 8, borderRadius: 8, border: '1px solid #E2E8F0', outline: 'none', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                    ))}
                    
                    <select 
                      value={storeForm.college_id} 
                      onChange={e => setStoreForm(p => ({ ...p, college_id: e.target.value }))}
                      style={{ width: '100%', padding: '10px 12px', marginBottom: 12, borderRadius: 8, border: '1px solid #E2E8F0', outline: 'none', fontSize: '0.9rem', boxSizing: 'border-box' }}
                    >
                      <option value="">-- Select College Campus --</option>
                      {colleges.map(c => (
                        <option key={c.id} value={c.id}>{c.name} {c.city ? `(${c.city})` : ''}</option>
                      ))}
                    </select>
                  </>
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                  <button 
                    onClick={saveStore} 
                    disabled={isUploading && !useUrlMode.store}
                    style={{ flex: 2, padding: 12, borderRadius: 10, border: 'none', background: (isUploading && !useUrlMode.store) ? '#64748B' : '#0F172A', color: 'white', fontWeight: 700, cursor: (isUploading && !useUrlMode.store) ? 'not-allowed' : 'pointer' }}
                  >
                    {(isUploading && !useUrlMode.store) ? `Uploading ${uploadProgress}%...` : 'Save Store'}
                  </button>
                  <button onClick={() => { setShowStoreForm(false); setEditingStoreId(null); }} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid #E2E8F0', background: 'white', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {stores.map(s => (
                <div key={s.id} style={{ background: 'white', borderRadius: 12, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{s.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>⭐ {s.rating} · {s.delivery_time_mins} mins</div>
                    {s.college_name && <div style={{ fontSize: '0.75rem', color: '#3B82F6', marginTop: 2 }}>🎓 {s.college_name}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button 
                      onClick={() => toggleStoreStatus(s)}
                      style={{ 
                        background: s.is_open !== false ? '#D1FAE5' : '#F1F5F9', 
                        color: s.is_open !== false ? '#065F46' : '#64748B', 
                        border: 'none', 
                        borderRadius: 8, 
                        padding: '6px 10px', 
                        cursor: 'pointer', 
                        fontWeight: 800, 
                        fontSize: '0.7rem' 
                      }}
                    >
                      {s.is_open !== false ? 'OPEN' : 'CLOSED'}
                    </button>
                    <button onClick={() => editStore(s)} style={{ background: '#EFF6FF', color: '#2563EB', border: 'none', borderRadius: 8, padding: '7px 10px', cursor: 'pointer' }}>
                      <Edit2 size={15} />
                    </button>
                    <button onClick={() => deleteItem('stores', s.id)} style={{ background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: 8, padding: '7px 10px', cursor: 'pointer' }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ════ COLLEGES ════ */}
        {activeTab === 'colleges' && (
          <>
            <button onClick={() => { setEditingCollegeId(null); setCollegeForm({ name: '', city: '' }); setShowCollegeForm(true); }} style={{ width: '100%', padding: '13px', borderRadius: 12, border: '2px dashed #94A3B8', background: 'rgba(0,0,0,0.02)', color: '#475569', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 14 }}>
              <Plus size={18} /> Add College
            </button>
            {showCollegeForm && (
              <div style={{ background: 'white', borderRadius: 12, padding: 16, marginBottom: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                <h3 style={{ margin: '0 0 12px 0' }}>{editingCollegeId ? 'Edit College' : 'Add College'}</h3>
                {[{ key: 'name', label: 'College Name' }, { key: 'city', label: 'City' }].map(f => (
                  <input key={f.key} placeholder={f.label} value={collegeForm[f.key]} onChange={e => setCollegeForm(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{ width: '100%', padding: '10px 12px', marginBottom: 8, borderRadius: 8, border: '1px solid #E2E8F0', outline: 'none', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                ))}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={saveCollege} style={{ flex: 2, padding: 12, borderRadius: 10, border: 'none', background: '#0F172A', color: 'white', fontWeight: 700, cursor: 'pointer' }}>Save</button>
                  <button onClick={() => { setShowCollegeForm(false); setEditingCollegeId(null); }} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid #E2E8F0', background: 'white', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {colleges.map(c => (
                <div key={c.id} style={{ background: 'white', borderRadius: 12, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{c.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{c.city}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => editCollege(c)} style={{ background: '#EFF6FF', color: '#2563EB', border: 'none', borderRadius: 8, padding: '7px 10px', cursor: 'pointer' }}>
                      <Edit2 size={15} />
                    </button>
                    <button onClick={() => deleteItem('colleges', c.id)} style={{ background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: 8, padding: '7px 10px', cursor: 'pointer' }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ════ MENU ════ */}
        {activeTab === 'menu' && (
          <>
            <div style={{ marginBottom: 16 }}>
              <select 
                value={selectedStoreId} 
                onChange={e => setSelectedStoreId(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #E2E8F0', outline: 'none', fontSize: '0.95rem', fontWeight: 600, color: '#0F172A' }}
              >
                <option value="">-- Select Store to Manage Menu --</option>
                {stores.map(s => (
                  <option key={s.id} value={s.id}>{s.name} {s.college_name ? `(${s.college_name})` : ''}</option>
                ))}
              </select>
            </div>

            {selectedStoreId ? (
              <>
                <button onClick={() => { setEditingMenuId(null); setMenuForm({ name: '', price: '', desc: '', category: 'Snacks', isVeg: true, image: '' }); setShowMenuForm(true); }} style={{ width: '100%', padding: '13px', borderRadius: 12, border: '2px dashed #94A3B8', background: 'rgba(0,0,0,0.02)', color: '#475569', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 14 }}>
                  <Plus size={18} /> Add Menu Item
                </button>

                {showMenuForm && (
                  <div style={{ background: 'white', borderRadius: 12, padding: 16, marginBottom: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                    <h3 style={{ margin: '0 0 12px 0' }}>{editingMenuId ? 'Edit Menu Item' : 'New Menu Item'}</h3>
                    {[
                      { key: 'name', label: 'Item Name', type: 'text' },
                      { key: 'price', label: 'Price (₹)', type: 'number' },
                      { key: 'desc', label: 'Description', type: 'text' },
                      { key: 'category', label: 'Category', type: 'text' },
                    ].map(f => (
                      <input key={f.key} type={f.type} placeholder={f.label} value={menuForm[f.key]} onChange={e => setMenuForm(p => ({ ...p, [f.key]: e.target.value }))}
                        style={{ width: '100%', padding: '10px 12px', marginBottom: 8, borderRadius: 8, border: '1px solid #E2E8F0', outline: 'none', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                    ))}

                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B' }}>Item Image</label>
                        <button onClick={() => toggleMode('menu')} style={{ border: 'none', background: 'none', color: '#3B82F6', fontSize: '0.65rem', cursor: 'pointer', fontWeight: 600 }}>
                          {useUrlMode.menu ? '📷 Use File Upload' : '🔗 Use Image Link'}
                        </button>
                      </div>

                      {useUrlMode.menu ? (
                        <input placeholder="Paste Image URL" value={menuForm.image} onChange={e => setMenuForm(p => ({ ...p, image: e.target.value }))}
                          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #E2E8F0', outline: 'none', fontSize: '0.8rem', boxSizing: 'border-box' }} />
                      ) : (
                        <>
                          <input type="file" accept="image/*" onChange={async (e) => {
                            const url = await handleImageUpload(e.target.files[0], 'menu');
                            if (url) setMenuForm(p => ({ ...p, image: url }));
                          }} style={{ fontSize: '0.8rem' }} />
                          {menuForm.image && <div style={{ fontSize: '0.7rem', color: '#10B981', marginTop: 4 }}>✓ Image ready</div>}
                        </>
                      )}
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <button onClick={() => setMenuForm(p => ({ ...p, isVeg: !p.isVeg }))} style={{ padding: '8px 14px', borderRadius: 8, border: `2px solid ${menuForm.isVeg ? '#10B981' : '#EF4444'}`, background: menuForm.isVeg ? '#D1FAE5' : '#FEE2E2', color: menuForm.isVeg ? '#065F46' : '#991B1B', fontWeight: 700, cursor: 'pointer' }}>
                        {menuForm.isVeg ? '🟢 Veg' : '🔴 Non-Veg'}
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button 
                        onClick={saveMenuItem} 
                        disabled={isUploading && !useUrlMode.menu}
                        style={{ flex: 2, padding: 12, borderRadius: 10, border: 'none', background: (isUploading && !useUrlMode.menu) ? '#64748B' : '#0F172A', color: 'white', fontWeight: 700, cursor: (isUploading && !useUrlMode.menu) ? 'not-allowed' : 'pointer' }}
                      >
                        {(isUploading && !useUrlMode.menu) ? `Uploading ${uploadProgress}%...` : 'Save Item'}
                      </button>
                      <button onClick={() => { setShowMenuForm(false); setEditingMenuId(null); }} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid #E2E8F0', background: 'white', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {menuItems.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94A3B8' }}>No menu items in this store.</div>
                  ) : menuItems.map(item => (
                    <div key={item.id} style={{ background: 'white', borderRadius: 12, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', opacity: item.is_available === false ? 0.6 : 1 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: '0.7rem' }}>{item.isVeg ? '🟢' : '🔴'}</span>
                          <div style={{ fontWeight: 700 }}>{item.name}</div>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: 2 }}>{item.category} · ₹{item.price}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button onClick={() => toggleMenuAvailability(item)} title={item.is_available !== false ? 'Disable' : 'Enable'} style={{ background: item.is_available !== false ? '#D1FAE5' : '#F1F5F9', color: item.is_available !== false ? '#065F46' : '#64748B', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem' }}>
                          {item.is_available !== false ? 'ON' : 'OFF'}
                        </button>
                        <button onClick={() => editMenuItem(item)} style={{ background: '#EFF6FF', color: '#2563EB', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => deleteMenuItem(item.id)} style={{ background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94A3B8' }}>
                <MenuIcon size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                <h3>Select a Store</h3>
                <p>Choose a store from the dropdown above to manage its menu items.</p>
              </div>
            )}
          </>
        )}

        {/* ════ COUPONS ════ */}
        {activeTab === 'coupons' && (
          <>
            <button onClick={() => { setEditingCouponId(null); setCouponForm({ code: '', discount: '', college_id: 'all', once_per_user: true }); setShowCouponForm(true); }} style={{ width: '100%', padding: '13px', borderRadius: 12, border: '2px dashed #065F46', background: 'rgba(6,95,70,0.05)', color: '#065F46', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 14 }}>
              <Plus size={18} /> Create New Coupon
            </button>

            {showCouponForm && (
              <div style={{ background: 'white', borderRadius: 12, padding: 16, marginBottom: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                <h3 style={{ margin: '0 0 12px 0' }}>{editingCouponId ? 'Edit Coupon' : 'New Coupon'}</h3>
                <input placeholder="COUPON CODE (e.g. WELCOME10)" value={couponForm.code} onChange={e => setCouponForm(p => ({ ...p, code: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', marginBottom: 8, borderRadius: 8, border: '1px solid #E2E8F0', outline: 'none', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                
                <input type="number" placeholder="Discount Percentage (%)" value={couponForm.discount} onChange={e => setCouponForm(p => ({ ...p, discount: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', marginBottom: 8, borderRadius: 8, border: '1px solid #E2E8F0', outline: 'none', fontSize: '0.9rem', boxSizing: 'border-box' }} />

                <select value={couponForm.college_id} onChange={e => setCouponForm(p => ({ ...p, college_id: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', marginBottom: 12, borderRadius: 8, border: '1px solid #E2E8F0', outline: 'none', fontSize: '0.9rem' }}>
                  <option value="all">All Colleges</option>
                  {colleges.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, padding: '0 4px' }}>
                  <input 
                    type="checkbox" 
                    id="once_per_user" 
                    checked={couponForm.once_per_user} 
                    onChange={e => setCouponForm(p => ({ ...p, once_per_user: e.target.checked }))}
                    style={{ width: 18, height: 18, cursor: 'pointer' }}
                  />
                  <label htmlFor="once_per_user" style={{ fontSize: '0.9rem', fontWeight: 600, color: '#065F46', cursor: 'pointer' }}>
                    Single use per user (One time only)
                  </label>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={saveCoupon} style={{ flex: 2, padding: 12, borderRadius: 10, border: 'none', background: '#0F172A', color: 'white', fontWeight: 700, cursor: 'pointer' }}>Save Coupon</button>
                  <button onClick={() => { setShowCouponForm(false); setEditingCouponId(null); }} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid #E2E8F0', background: 'white', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {coupons.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94A3B8' }}>No coupons created yet.</div>
              ) : coupons.map(c => (
                <div key={c.id} style={{ background: 'white', borderRadius: 12, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ background: '#D1FAE5', color: '#065F46', padding: '2px 8px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 800 }}>{c.code}</span>
                      <span style={{ fontWeight: 700 }}>{c.discount_percent}% OFF</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: 4 }}>
                      📍 {c.college_id === 'all' ? 'All Colleges' : (colleges.find(col => col.id === c.college_id)?.name || 'Unknown')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { setEditingCouponId(c.id); setCouponForm({ code: c.code, discount: String(c.discount_percent), college_id: c.college_id, once_per_user: c.once_per_user !== false }); setShowCouponForm(true); }} style={{ background: '#EFF6FF', color: '#2563EB', border: 'none', borderRadius: 8, padding: '7px 10px', cursor: 'pointer' }}>
                      <Edit2 size={15} />
                    </button>
                    <button onClick={() => deleteCoupon(c.id)} style={{ background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: 8, padding: '7px 10px', cursor: 'pointer' }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ════ BANNERS ════ */}
        {activeTab === 'banners' && (
          <>
            <button onClick={() => { setEditingBannerId(null); setBannerForm({ image: '', link: '' }); setShowBannerForm(true); }} style={{ width: '100%', padding: '13px', borderRadius: 12, border: '2px dashed #F59E0B', background: 'rgba(245,158,11,0.05)', color: '#D97706', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 14 }}>
              <Plus size={18} /> Add New Promotion Banner
            </button>

            {showBannerForm && (
              <div style={{ background: 'white', borderRadius: 12, padding: 16, marginBottom: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                <h3 style={{ margin: '0 0 12px 0' }}>{editingBannerId ? 'Edit Banner' : 'New Banner'}</h3>
                
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B' }}>Banner Image</label>
                    <button onClick={() => toggleMode('banner')} style={{ border: 'none', background: 'none', color: '#3B82F6', fontSize: '0.65rem', cursor: 'pointer', fontWeight: 600 }}>
                      {useUrlMode.banner ? '📷 Use File Upload' : '🔗 Use Image Link'}
                    </button>
                  </div>
                  
                  {useUrlMode.banner ? (
                    <input placeholder="Paste Image URL" value={bannerForm.image} onChange={e => setBannerForm(p => ({ ...p, image: e.target.value }))}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #E2E8F0', outline: 'none', fontSize: '0.8rem', boxSizing: 'border-box' }} />
                  ) : (
                    <>
                      <input type="file" accept="image/*" onChange={async (e) => {
                        const url = await handleImageUpload(e.target.files[0], 'banners');
                        if (url) setBannerForm(p => ({ ...p, image: url }));
                      }} style={{ fontSize: '0.8rem' }} />
                      {bannerForm.image && <div style={{ fontSize: '0.7rem', color: '#10B981', marginTop: 4 }}>✓ Image ready</div>}
                    </>
                  )}
                </div>
                
                <input placeholder="Redirect Link (e.g. /store/id or full URL)" value={bannerForm.link} onChange={e => setBannerForm(p => ({ ...p, link: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', marginBottom: 8, borderRadius: 8, border: '1px solid #E2E8F0', outline: 'none', fontSize: '0.9rem', boxSizing: 'border-box' }} />

                <select 
                  value={bannerForm.coupon_code} 
                  onChange={e => setBannerForm(p => ({ ...p, coupon_code: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', marginBottom: 12, borderRadius: 8, border: '1px solid #E2E8F0', outline: 'none', fontSize: '0.9rem', boxSizing: 'border-box' }}
                >
                  <option value="">-- No Coupon Attached --</option>
                  {coupons.map(c => (
                    <option key={c.id} value={c.code}>Attach Coupon: {c.code} ({c.discount_percent}%)</option>
                  ))}
                </select>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button 
                    onClick={saveBanner} 
                    disabled={isUploading && !useUrlMode.banner}
                    style={{ flex: 2, padding: 12, borderRadius: 10, border: 'none', background: (isUploading && !useUrlMode.banner) ? '#64748B' : '#0F172A', color: 'white', fontWeight: 700, cursor: (isUploading && !useUrlMode.banner) ? 'not-allowed' : 'pointer' }}
                  >
                    {(isUploading && !useUrlMode.banner) ? `Uploading ${uploadProgress}%...` : 'Save Banner'}
                  </button>
                  <button onClick={() => { setShowBannerForm(false); setEditingBannerId(null); }} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid #E2E8F0', background: 'white', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
              {banners.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94A3B8' }}>No banners created yet.</div>
              ) : banners.map(b => (
                <div key={b.id} style={{ background: 'white', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <img src={b.image} style={{ width: '100%', height: '100px', objectFit: 'cover' }} alt="Preview" />
                  <div style={{ padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                      🔗 {b.link || 'No link'} {b.coupon_code && <span style={{ color: '#10B981', fontWeight: 700 }}> · 🎟️ {b.coupon_code}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => { setEditingBannerId(b.id); setBannerForm({ image: b.image, link: b.link, coupon_code: b.coupon_code || '' }); setShowBannerForm(true); }} style={{ background: '#EFF6FF', color: '#2563EB', border: 'none', borderRadius: 8, padding: '7px 10px', cursor: 'pointer' }}>
                        <Edit2 size={15} />
                      </button>
                      <button onClick={() => deleteDoc(doc(db, 'banners', b.id))} style={{ background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: 8, padding: '7px 10px', cursor: 'pointer' }}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ════ FEES ════ */}
        {activeTab === 'fees' && (
          <div style={{ background: 'white', borderRadius: 12, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <h3 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              ⚙️ Manage Application Fees
            </h3>
            
            <p style={{ fontSize: '0.85rem', color: '#64748B', marginBottom: 20 }}>
              Adjust or add fees that are charged at checkout. All values are in INR (₹).
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              {localFees.map((fee, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 10, alignItems: 'center', background: '#F8FAFC', padding: 10, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                  <input 
                    type="text" 
                    placeholder="Fee Name (e.g. Service Fee)" 
                    value={fee.name} 
                    onChange={e => updateLocalFee(idx, 'name', e.target.value)}
                    style={{ flex: 2, padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', outline: 'none', fontSize: '0.9rem' }} 
                  />
                  <input 
                    type="number" 
                    placeholder="Value (₹)" 
                    value={fee.value} 
                    onChange={e => updateLocalFee(idx, 'value', e.target.value)}
                    style={{ flex: 1, padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', outline: 'none', fontSize: '0.9rem' }} 
                  />
                  <button 
                    onClick={() => removeLocalFee(idx)}
                    style={{ background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: 6, padding: '8px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Remove Fee"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button 
                onClick={addLocalFee}
                style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid #CBD5E1', background: 'white', color: '#0F172A', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <Plus size={16} /> Add Fee
              </button>
              
              <button 
                onClick={saveFeesToDb}
                style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: '#10B981', color: 'white', fontWeight: 700, cursor: 'pointer' }}
              >
                Save Changes
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
