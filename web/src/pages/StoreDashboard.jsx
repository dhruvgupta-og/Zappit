import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, addDoc, query, deleteDoc } from 'firebase/firestore';
import { Package, Clock, IndianRupee, ShoppingBag, Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Bell, Store } from 'lucide-react';

const TAB_ORDERS = 'orders';
const TAB_MENU = 'menu';
const TAB_ANALYTICS = 'analytics';

const StoreDashboard = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [activeTab, setActiveTab] = useState(TAB_ORDERS);
  const [orderSubTab, setOrderSubTab] = useState('new');
  const [notification, setNotification] = useState(null);
  const [timeFilter, setTimeFilter] = useState('all'); // day, week, month, all
  const prevOrderCount = useRef(0);

  // ── AUTH-BASED STORE IDP ──
  // Store identity comes from sessionStorage set by /staff-login
  const storeId   = sessionStorage.getItem('staff_store_id');
  const storeName = sessionStorage.getItem('staff_store_name') || 'My Store';
  const isLoggedIn = sessionStorage.getItem('staff_role') === 'store_owner' && !!storeId;

  // Build a fake "selectedStore" object for compatibility with rest of the component
  const selectedStore = isLoggedIn ? { id: storeId, name: storeName } : null;

  // ── REAL-TIME ORDERS ──
  useEffect(() => {
    if (!selectedStore) return;
    const unsubscribe = onSnapshot(query(collection(db, 'orders')), (snapshot) => {
      const ordersData = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(o => o.store_id === selectedStore.id);
        
      const newCount = ordersData.filter(o => o.order_status === 'pending' || o.order_status === 'confirmed').length;
      
      // Alert on new order
      if (newCount > prevOrderCount.current && prevOrderCount.current >= 0) {
        setNotification('🔔 New Order Received!');
        setTimeout(() => setNotification(null), 4000);
        // Play notification sound via Web Audio API
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.frequency.setValueAtTime(880, ctx.currentTime);
          osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
          osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.5);
        } catch (e) { /* audio blocked */ }
      }
      prevOrderCount.current = newCount;
      setOrders(ordersData);
    });
    return () => unsubscribe();
  }, [selectedStore]);

  // ── REAL-TIME MENU ──
  useEffect(() => {
    if (!selectedStore) return;
    const unsubscribe = onSnapshot(collection(db, 'stores', selectedStore.id, 'menu'), (snapshot) => {
      setMenuItems(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, [selectedStore]);

  // ── ANALYTICS LOGIC ──
  const getFilteredOrders = () => {
    return orders.filter(o => {
      const orderDate = new Date(o.created_at);
      const now = new Date();
      if (timeFilter === 'day') return orderDate.toDateString() === now.toDateString();
      if (timeFilter === 'week') {
        const weekAgo = new Date(); weekAgo.setDate(now.getDate() - 7);
        return orderDate >= weekAgo;
      }
      if (timeFilter === 'month') return orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear();
      return true;
    });
  };

  const filteredOrders = getFilteredOrders();
  const totalRevenue = filteredOrders.filter(o => o.order_status === 'delivered').reduce((s, o) => s + (o.total_amount || 0), 0);
  
  const dishStats = filteredOrders.reduce((acc, o) => {
    if (o.items && Array.isArray(o.items)) {
      o.items.forEach(item => {
        if (item && item.name) {
          if (!acc[item.name]) acc[item.name] = { count: 0, revenue: 0 };
          acc[item.name].count += (item.quantity || 1);
          acc[item.name].revenue += (item.price || 0) * (item.quantity || 1);
        }
      });
    }
    return acc;
  }, {});

  const topDishes = Object.entries(dishStats).sort((a, b) => b[1].count - a[1].count);
  
  // Status Counters
  const newOrders       = orders.filter(o => o.order_status === 'pending' || o.order_status === 'confirmed');
  const preparingOrders = orders.filter(o => o.order_status === 'preparing');
  const readyOrders     = orders.filter(o => o.order_status === 'ready' || o.order_status === 'out_for_delivery');
  const completedOrders = orders.filter(o => o.order_status === 'delivered');
  const cancelledOrders = orders.filter(o => o.order_status === 'cancelled');
  
  const todayRevenue = completedOrders.filter(o => new Date(o.created_at).toDateString() === new Date().toDateString()).reduce((s, o) => s + (o.total_amount || 0), 0);

  const updateOrderStatus = async (orderId, status) => {
    await updateDoc(doc(db, 'orders', orderId), { order_status: status });
  };

  const getItems = (items) => {
    if (!items) return [];
    if (Array.isArray(items)) return items;
    return Object.entries(items).map(([id, qty]) => ({ id, name: id, qty, price: 0 }));
  };

  const statusColors = {
    pending:          { bg: '#FEF3C7', text: '#92400E', label: 'Pending' },
    confirmed:        { bg: '#DBEAFE', text: '#1E40AF', label: 'Confirmed' },
    preparing:        { bg: '#FEF9C3', text: '#854D0E', label: 'Preparing' },
    ready:            { bg: '#E0F2FE', text: '#075985', label: 'Ready' },
    out_for_delivery: { bg: '#D1FAE5', text: '#065F46', label: 'Out for Delivery' },
    delivered:        { bg: '#D1FAE5', text: '#065F46', label: 'Delivered' },
    cancelled:        { bg: '#FEE2E2', text: '#991B1B', label: 'Cancelled' },
  };

  const orderTabs = [
    { key: 'new',       label: 'New',       count: newOrders.length },
    { key: 'preparing', label: 'Preparing', count: preparingOrders.length },
    { key: 'ready',     label: 'Ready',     count: readyOrders.length },
    { key: 'completed', label: 'Done',      count: completedOrders.length },
  ];

  const tabOrders = orderSubTab === 'new' ? newOrders
    : orderSubTab === 'preparing' ? preparingOrders
    : orderSubTab === 'ready' ? readyOrders
    : completedOrders;

  // ── MENU MANAGEMENT ──
  const [showMenuForm, setShowMenuForm] = useState(false);
  const [menuForm, setMenuForm] = useState({ name: '', price: '', desc: '', category: 'Snacks', isVeg: true });
  const [editingMenuId, setEditingMenuId] = useState(null);

  const saveMenuItem = async () => {
    if (!menuForm.name || !menuForm.price || !selectedStore) return;
    const data = { ...menuForm, price: Number(menuForm.price), is_available: true };
    if (editingMenuId) {
      await updateDoc(doc(db, 'stores', selectedStore.id, 'menu', editingMenuId), data);
    } else {
      await addDoc(collection(db, 'stores', selectedStore.id, 'menu'), data);
    }
    setMenuForm({ name: '', price: '', desc: '', category: 'Snacks', isVeg: true });
    setEditingMenuId(null);
    setShowMenuForm(false);
  };

  const deleteMenuItem = async (id) => {
    if (window.confirm('Delete this item?')) await deleteDoc(doc(db, 'stores', selectedStore.id, 'menu', id));
  };

  const toggleAvailability = async (item) => {
    await updateDoc(doc(db, 'stores', selectedStore.id, 'menu', item.id), { is_available: !item.is_available });
  };

  if (!selectedStore) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #0B132B 0%, #1E293B 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: 12 }}>🔒</div>
        <h2 style={{ color: 'white', margin: '0 0 8px' }}>Store Access Required</h2>
        <p style={{ color: '#94A3B8', margin: '0 0 24px', fontSize: '0.9rem', maxWidth: 300 }}>You must log in through the Store Portal to access this dashboard.</p>
        <a href="/staff-login?type=store" style={{ background: 'linear-gradient(135deg, #FFC107, #FF8F00)', color: '#0B132B', padding: '14px 28px', borderRadius: 12, fontWeight: 800, textDecoration: 'none', fontSize: '1rem' }}>
          🏪 Go to Store Login
        </a>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-color)', paddingBottom: 80 }}>

      {/* ── NOTIFICATION TOAST ── */}
      {notification && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: '#1E293B', color: 'white', padding: '12px 24px', borderRadius: 12, fontWeight: 700, fontSize: '1rem', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bell size={18} /> {notification}
        </div>
      )}

      {/* ── TOP BAR ── */}
      <div style={{ background: 'var(--primary-gradient)', padding: '20px', color: 'white' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ margin: 0, fontSize: '0.7rem', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Store Dashboard</p>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>{selectedStore.name}</h1>
          </div>
          <button onClick={() => setIsOpen(v => !v)} style={{ background: isOpen ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.3)', border: 'none', borderRadius: 20, padding: '8px 16px', color: 'white', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: isOpen ? '#86EFAC' : '#FCA5A5', display: 'inline-block' }} />
            {isOpen ? 'OPEN' : 'CLOSED'}
          </button>
        </div>

        {activeTab === TAB_ANALYTICS && (
          <div style={{ marginTop: 16 }}>
            <select value={timeFilter} onChange={e => setTimeFilter(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: 12, border: 'none', background: 'rgba(255,255,255,0.15)', color: 'white', fontSize: '0.85rem', fontWeight: 700, outline: 'none' }}>
              <option value="all" style={{ color: '#0F172A' }}>📅 All Time Stats</option>
              <option value="day" style={{ color: '#0F172A' }}>Today</option>
              <option value="week" style={{ color: '#0F172A' }}>This Week</option>
              <option value="month" style={{ color: '#0F172A' }}>This Month</option>
            </select>
          </div>
        )}

        {/* Stats Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginTop: 20 }}>
          {[
            { label: 'Orders',   value: activeTab === TAB_ANALYTICS ? filteredOrders.length : orders.length, icon: <ShoppingBag size={14} /> },
            { label: 'Revenue',  value: `₹${activeTab === TAB_ANALYTICS ? totalRevenue : todayRevenue}`, icon: <IndianRupee size={14} /> },
            { label: 'Active',   value: newOrders.length, icon: <Clock size={14} /> },
            { label: 'Menu',     value: menuItems.length, icon: <Package size={14} /> },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '10px 6px', textAlign: 'center' }}>
              <div style={{ opacity: 0.85, marginBottom: 2 }}>{s.icon}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{s.value}</div>
              <div style={{ fontSize: '0.6rem', opacity: 0.8, textTransform: 'uppercase' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── MAIN TABS ── */}
      <div style={{ display: 'flex', gap: 0, background: 'white', borderBottom: '2px solid var(--border-color)' }}>
        {[
          { key: TAB_ORDERS, label: '📦 Orders' }, 
          { key: TAB_ANALYTICS, label: '📈 Stats' },
          { key: TAB_MENU, label: '🍽️ Menu' }
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{ flex: 1, padding: '14px', border: 'none', background: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', color: activeTab === t.key ? 'var(--primary)' : 'var(--text-muted)', borderBottom: activeTab === t.key ? '3px solid var(--primary)' : '3px solid transparent', marginBottom: -2, transition: 'all 0.2s' }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: 16 }}>
        {/* ════ ORDERS TAB ════ */}
        {activeTab === TAB_ORDERS && (
          <>
            {/* Sub-tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, background: 'white', padding: 6, borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              {orderTabs.map(tab => (
                <button key={tab.key} onClick={() => setOrderSubTab(tab.key)} style={{ flex: 1, padding: '9px 4px', borderRadius: 8, border: 'none', background: orderSubTab === tab.key ? 'var(--primary-gradient)' : 'transparent', color: orderSubTab === tab.key ? 'white' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, transition: 'all 0.2s ease' }}>
                  {tab.label}
                  {tab.count > 0 && <span style={{ background: orderSubTab === tab.key ? 'rgba(255,255,255,0.3)' : 'var(--primary)', color: 'white', borderRadius: 10, padding: '1px 6px', fontSize: '0.7rem', fontWeight: 700 }}>{tab.count}</span>}
                </button>
              ))}
            </div>

            {/* Order Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {tabOrders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                  <Package size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                  <p style={{ margin: 0 }}>No orders here</p>
                </div>
              ) : tabOrders.map(order => {
                const items = getItems(order.items);
                const sc = statusColors[order.order_status] || { bg: '#F3F4F6', text: '#374151', label: order.order_status };
                return (
                  <div key={order.id} className="card" style={{ padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>ORDER</div>
                        <h4 style={{ margin: '2px 0 0', fontWeight: 800 }}>#{order.id.slice(-6).toUpperCase()}</h4>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                          {order.created_at ? new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </div>
                      </div>
                      <span style={{ background: sc.bg, color: sc.text, padding: '4px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700 }}>{sc.label}</span>
                    </div>

                    <div style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px dashed var(--border-color)' }}>
                      {items.length > 0 ? items.map((item, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: 3 }}>
                          <span style={{ color: 'var(--text-muted)' }}>{item.qty}× {item.name}</span>
                          <span style={{ fontWeight: 600 }}>₹{(item.price || 0) * (item.qty || 1)}</span>
                        </div>
                      )) : <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>📍 {order.address || 'N/A'}</span>
                      <span style={{ fontWeight: 800, color: 'var(--primary)' }}>₹{order.total_amount}</span>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      {(order.order_status === 'pending' || order.order_status === 'confirmed') && (
                        <>
                          <button onClick={() => updateOrderStatus(order.id, 'preparing')} style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: '#DBEAFE', color: '#1E40AF', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>
                            ✅ Accept
                          </button>
                          <button onClick={() => updateOrderStatus(order.id, 'cancelled')} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: '#FEE2E2', color: '#991B1B', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>
                            ✕ Reject
                          </button>
                        </>
                      )}
                      {order.order_status === 'preparing' && (
                        <button onClick={() => updateOrderStatus(order.id, 'ready')} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: '#D1FAE5', color: '#065F46', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>
                          🍱 Mark Ready
                        </button>
                      )}
                      {order.order_status === 'ready' && (
                        <button onClick={() => updateOrderStatus(order.id, 'out_for_delivery')} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: '#EDE9FE', color: '#5B21B6', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>
                          🛵 Handed to Delivery
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ════ ANALYTICS TAB ════ */}
        {activeTab === TAB_ANALYTICS && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
             <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem', fontWeight: 800 }}>Best Selling Dishes</h3>
             <p style={{ margin: '0 0 12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Top dishes by quantity sold in the selected period.</p>

             <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
               {topDishes.length === 0 ? (
                 <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>No sales data for this period</div>
               ) : topDishes.map(([name, stats], i) => (
                 <div key={name} className="card" style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: i === 0 ? '#FEF3C7' : '#F1F5F9', color: i === 0 ? '#92400E' : '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem' }}>
                        {i + 1}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700 }}>{name}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{stats.count} sold</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, color: 'var(--primary)' }}>₹{stats.revenue}</div>
                      <div style={{ fontSize: '0.65rem', color: '#10B981', fontWeight: 700 }}>Earned</div>
                    </div>
                 </div>
               ))}
             </div>
          </div>
        )}

        {/* ════ MENU TAB ════ */}
        {activeTab === TAB_MENU && (
          <>
            <button onClick={() => { setShowMenuForm(true); setEditingMenuId(null); setMenuForm({ name: '', price: '', desc: '', category: 'Snacks', isVeg: true }); }} style={{ width: '100%', padding: '14px', borderRadius: 12, border: '2px dashed var(--primary)', background: 'rgba(255,81,47,0.05)', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
              <Plus size={18} /> Add New Menu Item
            </button>

            {/* Menu Form */}
            {showMenuForm && (
              <div className="card" style={{ padding: 16, marginBottom: 16, border: '2px solid var(--primary)' }}>
                <h4 style={{ margin: '0 0 12px', color: 'var(--primary)' }}>{editingMenuId ? 'Edit' : 'New'} Menu Item</h4>
                {[
                  { key: 'name', label: 'Item Name', type: 'text' },
                  { key: 'price', label: 'Price (₹)', type: 'number' },
                  { key: 'desc', label: 'Description', type: 'text' },
                  { key: 'category', label: 'Category', type: 'text' },
                ].map(f => (
                  <input key={f.key} type={f.type} placeholder={f.label} value={menuForm[f.key]} onChange={e => setMenuForm(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{ width: '100%', padding: '10px 12px', marginBottom: 8, borderRadius: 8, border: '1px solid var(--border-color)', outline: 'none', fontSize: '0.9rem' }} />
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <button onClick={() => setMenuForm(p => ({ ...p, isVeg: !p.isVeg }))} style={{ padding: '8px 14px', borderRadius: 8, border: `2px solid ${menuForm.isVeg ? '#10B981' : '#EF4444'}`, background: menuForm.isVeg ? '#D1FAE5' : '#FEE2E2', color: menuForm.isVeg ? '#065F46' : '#991B1B', fontWeight: 700, cursor: 'pointer' }}>
                    {menuForm.isVeg ? '🟢 Veg' : '🔴 Non-Veg'}
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={saveMenuItem} style={{ flex: 2, padding: '12px', borderRadius: 10, border: 'none', background: 'var(--primary-gradient)', color: 'white', fontWeight: 700, cursor: 'pointer' }}>Save Item</button>
                  <button onClick={() => setShowMenuForm(false)} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'white', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}

            {/* Menu List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {menuItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>No menu items yet</div>
              ) : menuItems.map(item => (
                <div key={item.id} className="card" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: item.is_available === false ? 0.5 : 1 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '0.7rem', color: item.isVeg ? '#10B981' : '#EF4444' }}>{item.isVeg ? '🟢' : '🔴'}</span>
                      <h4 style={{ margin: 0, fontSize: '0.95rem' }}>{item.name}</h4>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>{item.category} · ₹{item.price}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button onClick={() => toggleAvailability(item)} title={item.is_available !== false ? 'Disable' : 'Enable'} style={{ background: item.is_available !== false ? '#D1FAE5' : '#F3F4F6', color: item.is_available !== false ? '#065F46' : '#6B7280', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem' }}>
                      {item.is_available !== false ? 'ON' : 'OFF'}
                    </button>
                    <button onClick={() => { setEditingMenuId(item.id); setMenuForm({ name: item.name, price: String(item.price), desc: item.desc || '', category: item.category || 'Snacks', isVeg: item.isVeg !== false }); setShowMenuForm(true); }} style={{ background: '#EFF6FF', color: '#2563EB', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>
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
        )}
      </div>
    </div>
  );
};

export default StoreDashboard;
