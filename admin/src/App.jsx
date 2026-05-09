import React, { createContext, useContext, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Store, ShoppingBag, Users, Building2, LogOut, Bike, Plus, Trash2, Edit2, X, Check, RefreshCw, Image as ImageIcon, Ticket, Tag } from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, BarElement } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { db, collection, onSnapshot, query, updateDoc, doc, addDoc, deleteDoc, setDoc } from './firebase';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

// ─── Auth Context ────────────────────────────────────────────────────────────
const AuthContext = createContext();
const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const login = (email, password) => {
    if (email === 'admin@zappit.com' && password === 'password') { setIsAuthenticated(true); return true; }
    return false;
  };
  return <AuthContext.Provider value={{ isAuthenticated, login, logout: () => setIsAuthenticated(false) }}>{children}</AuthContext.Provider>;
};

// ─── Modal Component ─────────────────────────────────────────────────────────
const Modal = ({ title, onClose, children }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
    <div className="card" style={{ width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <button onClick={onClose} style={{ background: 'transparent', padding: '4px', color: 'var(--text-secondary)' }}><X size={20} /></button>
      </div>
      {children}
    </div>
  </div>
);

// ─── Layout ──────────────────────────────────────────────────────────────────
const Layout = () => {
  const { logout } = useContext(AuthContext);
  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <div className="sidebar-header"><Store size={28} /> ZAPPIT ADMIN</div>
        <nav className="nav-links">
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end><LayoutDashboard size={20} /> Dashboard</NavLink>
          <NavLink to="/colleges" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Building2 size={20} /> Colleges</NavLink>
          <NavLink to="/stores" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Store size={20} /> Stores</NavLink>
          <NavLink to="/banners" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><ImageIcon size={20} /> Banners</NavLink>
          <NavLink to="/coupons" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Ticket size={20} /> Coupons</NavLink>
          <NavLink to="/orders" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><ShoppingBag size={20} /> Orders</NavLink>
          <NavLink to="/users" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Users size={20} /> Users</NavLink>
          <NavLink to="/riders" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Bike size={20} /> Riders</NavLink>
        </nav>
        <div className="nav-links" style={{ flex: 0 }}>
          <button className="nav-link" style={{ background: 'transparent', width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer' }} onClick={logout}><LogOut size={20} /> Logout</button>
        </div>
      </aside>
      <main className="main-content"><Outlet /></main>
    </div>
  );
};

// ─── Login ───────────────────────────────────────────────────────────────────
const Login = () => {
  const [email, setEmail] = useState('admin@zappit.com');
  const [password, setPassword] = useState('password');
  const { login, isAuthenticated } = useContext(AuthContext);
  const [error, setError] = useState('');
  if (isAuthenticated) return <Navigate to="/" replace />;
  const handleLogin = (e) => { e.preventDefault(); if (!login(email, password)) setError('Invalid credentials'); };
  return (
    <div className="login-container">
      <div className="login-card">
        <div style={{ color: 'var(--primary)', marginBottom: '16px' }}><Store size={64} /></div>
        <h2>Admin Login</h2>
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '16px' }}><input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input-field" placeholder="Email" /></div>
          <div style={{ marginBottom: '24px' }}><input type="password" value={password} onChange={e => setPassword(e.target.value)} className="input-field" placeholder="Password" /></div>
          {error && <p style={{ color: 'var(--error)', marginBottom: '16px' }}>{error}</p>}
          <button type="submit" style={{ width: '100%', justifyContent: 'center' }}>Login</button>
        </form>
      </div>
    </div>
  );
};

// ─── Dashboard ───────────────────────────────────────────────────────────────
const Dashboard = () => {
  const [stats, setStats] = useState({ orders: 0, revenue: 0, users: 0, stores: 0 });
  const [recentOrders, setRecentOrders] = useState([]);

  useEffect(() => {
    const unsub1 = onSnapshot(query(collection(db, 'orders')), snap => {
      let revenue = 0;
      const recent = [];
      snap.docs.forEach(d => {
        revenue += d.data().totalAmount || 0;
        recent.push({ id: d.id, ...d.data() });
      });
      recent.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setStats(s => ({ ...s, orders: snap.size, revenue: revenue.toFixed(2) }));
      setRecentOrders(recent.slice(0, 5));
    });
    const unsub2 = onSnapshot(collection(db, 'users'), snap => setStats(s => ({ ...s, users: snap.size })));
    const unsub3 = onSnapshot(collection(db, 'stores'), snap => setStats(s => ({ ...s, stores: snap.size })));
    return () => { unsub1(); unsub2(); unsub3(); };
  }, []);

  const chartData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [{ label: 'Orders', data: [30, 45, 60, 40, 80, 120, stats.orders], borderColor: '#FFC107', backgroundColor: 'rgba(255,193,7,0.15)', tension: 0.4, fill: true }]
  };

  const statusColor = s => s === 'delivered' ? 'success' : ['preparing', 'on_the_way', 'picked_up'].includes(s) ? 'primary' : 'secondary';

  return (
    <div>
      <h1 className="page-title">Dashboard Overview</h1>
      <div className="stats-grid">
        {[
          { label: 'Total Orders', val: stats.orders, icon: <ShoppingBag size={24} />, color: '' },
          { label: 'Total Revenue', val: `₹${stats.revenue}`, icon: <Store size={24} />, color: '' },
          { label: 'Registered Users', val: stats.users, icon: <Users size={24} />, color: '#4CAF50', bg: '#E8F5E9' },
          { label: 'Active Stores', val: stats.stores, icon: <Building2 size={24} />, color: '#2196F3', bg: '#E3F2FD' },
        ].map(s => (
          <div key={s.label} className="card stat-card">
            <div className="stat-icon" style={s.color ? { color: s.color, background: s.bg } : {}}>{s.icon}</div>
            <div className="stat-info"><h3>{s.label}</h3><p>{s.val}</p></div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginTop: '8px' }}>
        <div className="card" style={{ height: '340px' }}>
          <h3 style={{ marginBottom: '16px' }}>Orders This Week</h3>
          <Line data={chartData} options={{ responsive: true, maintainAspectRatio: false }} />
        </div>
        <div className="card">
          <h3 style={{ marginBottom: '16px' }}>Recent Orders</h3>
          {recentOrders.map(o => (
            <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '13px' }}>#{o.id.substring(0, 6)}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{o.storeName}</div>
              </div>
              <span className={`badge ${statusColor(o.status)}`}>{o.status?.toUpperCase()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Colleges ────────────────────────────────────────────────────────────────
const Colleges = () => {
  const [colleges, setColleges] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', city: '', pincode: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'colleges'), snap => {
      setColleges(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setLoading(true);
    await addDoc(collection(db, 'colleges'), { ...form, createdAt: new Date() });
    setForm({ name: '', city: '', pincode: '' });
    setShowModal(false);
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this college?')) await deleteDoc(doc(db, 'colleges', id));
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Manage Colleges</h1>
        <button onClick={() => setShowModal(true)}><Plus size={16} /> Add College</button>
      </div>
      <div className="card">
        <div className="table-responsive">
          <table>
            <thead><tr><th>#</th><th>College Name</th><th>City</th><th>Pincode</th><th>Actions</th></tr></thead>
            <tbody>
              {colleges.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '32px' }}>No colleges added yet.</td></tr>}
              {colleges.map((c, i) => (
                <tr key={c.id}>
                  <td>{i + 1}</td>
                  <td style={{ fontWeight: 'bold' }}>{c.name}</td>
                  <td>{c.city}</td>
                  <td>{c.pincode}</td>
                  <td><button onClick={() => handleDelete(c.id)} style={{ background: '#FEE2E2', color: 'var(--error)', padding: '6px 12px' }}><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {showModal && (
        <Modal title="Add College" onClose={() => setShowModal(false)}>
          <form onSubmit={handleAdd}>
            <div style={{ marginBottom: '16px' }}><label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>College Name</label><input required className="input-field" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. IIT Delhi" /></div>
            <div style={{ marginBottom: '16px' }}><label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>City</label><input required className="input-field" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="e.g. New Delhi" /></div>
            <div style={{ marginBottom: '24px' }}><label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>Pincode</label><input className="input-field" value={form.pincode} onChange={e => setForm({ ...form, pincode: e.target.value })} placeholder="e.g. 110016" /></div>
            <button type="submit" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>{loading ? 'Saving...' : 'Add College'}</button>
          </form>
        </Modal>
      )}
    </div>
  );
};

// ─── Banners ─────────────────────────────────────────────────────────────────
const Banners = () => {
  const [banners, setBanners] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', imageUrl: '', link: '', isActive: true });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'banners'), snap => setBanners(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, 'banners'), { ...form, createdAt: new Date() });
    setForm({ title: '', imageUrl: '', link: '', isActive: true });
    setShowModal(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 className="page-title">Manage Banners</h1>
        <button onClick={() => setShowModal(true)}><Plus size={16} /> Add Banner</button>
      </div>
      <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
        {banners.map(b => (
          <div key={b.id} className="card" style={{ padding: '0', overflow: 'hidden' }}>
            <img src={b.imageUrl} alt={b.title} style={{ width: '100%', height: '150px', objectFit: 'cover' }} />
            <div style={{ padding: '16px' }}>
              <h3 style={{ marginBottom: '8px' }}>{b.title}</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className={`badge ${b.isActive ? 'success' : 'secondary'}`}>{b.isActive ? 'Active' : 'Inactive'}</span>
                <button onClick={() => deleteDoc(doc(db, 'banners', b.id))} style={{ background: 'transparent', color: 'var(--error)' }}><Trash2 size={16} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {showModal && (
        <Modal title="Add Promotional Banner" onClose={() => setShowModal(false)}>
          <form onSubmit={handleAdd}>
            <input required className="input-field" style={{marginBottom: '12px'}} placeholder="Banner Title" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
            <input required className="input-field" style={{marginBottom: '12px'}} placeholder="Image URL (use high quality landscape)" value={form.imageUrl} onChange={e => setForm({...form, imageUrl: e.target.value})} />
            <input className="input-field" style={{marginBottom: '20px'}} placeholder="Action Link (Optional)" value={form.link} onChange={e => setForm({...form, link: e.target.value})} />
            <button type="submit" style={{width: '100%', justifyContent: 'center'}}>Save Banner</button>
          </form>
        </Modal>
      )}
    </div>
  );
};

// ─── Coupons ─────────────────────────────────────────────────────────────────
const Coupons = () => {
  const [coupons, setCoupons] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ code: '', discount: '', minOrder: '', description: '', isActive: true });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'coupons'), snap => setCoupons(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, 'coupons'), { ...form, createdAt: new Date() });
    setForm({ code: '', discount: '', minOrder: '', description: '', isActive: true });
    setShowModal(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 className="page-title">Manage Coupons</h1>
        <button onClick={() => setShowModal(true)}><Plus size={16} /> Create Coupon</button>
      </div>
      <div className="card">
        <div className="table-responsive">
          <table>
            <thead><tr><th>Code</th><th>Discount</th><th>Min. Order</th><th>Description</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {coupons.map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{c.code}</td>
                  <td>₹{c.discount}</td>
                  <td>₹{c.minOrder}</td>
                  <td style={{ fontSize: '12px' }}>{c.description}</td>
                  <td><span className={`badge ${c.isActive ? 'success' : 'secondary'}`}>{c.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td><button onClick={() => deleteDoc(doc(db, 'coupons', c.id))} style={{ background: 'transparent', color: 'var(--error)' }}><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {showModal && (
        <Modal title="Create New Coupon" onClose={() => setShowModal(false)}>
          <form onSubmit={handleAdd}>
            <input required className="input-field" style={{marginBottom: '12px', textTransform: 'uppercase'}} placeholder="COUPON CODE" value={form.code} onChange={e => setForm({...form, code: e.target.value.toUpperCase()})} />
            <input required type="number" className="input-field" style={{marginBottom: '12px'}} placeholder="Discount Amount (₹)" value={form.discount} onChange={e => setForm({...form, discount: e.target.value})} />
            <input required type="number" className="input-field" style={{marginBottom: '12px'}} placeholder="Min Order Amount (₹)" value={form.minOrder} onChange={e => setForm({...form, minOrder: e.target.value})} />
            <textarea className="input-field" style={{marginBottom: '20px', height: '80px'}} placeholder="Coupon Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
            <button type="submit" style={{width: '100%', justifyContent: 'center'}}>Save Coupon</button>
          </form>
        </Modal>
      )}
    </div>
  );
};

// ─── Menu Editor Component ──────────────────────────────────────────────────
const MenuEditor = ({ storeId, storeName, onClose }) => {
  const [menuItems, setMenuItems] = useState([]);
  const [showItemModal, setShowItemModal] = useState(false);
  const [itemForm, setItemForm] = useState({ name: '', description: '', price: '', isAvailable: true });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'stores', storeId, 'menu'), snap => {
      setMenuItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [storeId]);

  const handleAddItem = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, 'stores', storeId, 'menu'), {
      ...itemForm,
      price: parseFloat(itemForm.price)
    });
    setItemForm({ name: '', description: '', price: '', isAvailable: true });
    setShowItemModal(false);
  };

  const handleDeleteItem = async (itemId) => {
    await deleteDoc(doc(db, 'stores', storeId, 'menu', itemId));
  };

  const handleToggleAvailable = async (itemId, current) => {
    await updateDoc(doc(db, 'stores', storeId, 'menu', itemId), { isAvailable: !current });
  };

  return (
    <Modal title={`Menu: ${storeName}`} onClose={onClose}>
      <button onClick={() => setShowItemModal(true)} style={{ marginBottom: '16px' }}><Plus size={16} /> Add Item</button>
      <div className="table-responsive">
        <table>
          <thead><tr><th>Item</th><th>Price</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {menuItems.map(item => (
              <tr key={item.id}>
                <td>
                  <div style={{ fontWeight: 'bold' }}>{item.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{item.description}</div>
                </td>
                <td>₹{item.price}</td>
                <td>
                  <span className={`badge ${item.isAvailable ? 'success' : 'secondary'}`} onClick={() => handleToggleAvailable(item.id, item.isAvailable)} style={{ cursor: 'pointer' }}>
                    {item.isAvailable ? 'Available' : 'Sold Out'}
                  </span>
                </td>
                <td><button onClick={() => handleDeleteItem(item.id)} style={{ color: 'var(--error)', background: 'transparent' }}><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showItemModal && (
        <Modal title="Add Menu Item" onClose={() => setShowItemModal(false)}>
          <form onSubmit={handleAddItem}>
            <input required className="input-field" style={{marginBottom: '12px'}} placeholder="Item Name" value={itemForm.name} onChange={e => setItemForm({...itemForm, name: e.target.value})} />
            <input className="input-field" style={{marginBottom: '12px'}} placeholder="Description" value={itemForm.description} onChange={e => setItemForm({...itemForm, description: e.target.value})} />
            <input required type="number" className="input-field" style={{marginBottom: '20px'}} placeholder="Price" value={itemForm.price} onChange={e => setItemForm({...itemForm, price: e.target.value})} />
            <button type="submit" style={{width: '100%', justifyContent: 'center'}}>Save Item</button>
          </form>
        </Modal>
      )}
    </Modal>
  );
};

// ─── Stores ──────────────────────────────────────────────────────────────────
const Stores = () => {
  const [stores, setStores] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', category: '', ownerEmail: '', collegeId: '', isOpen: true });
  const [menuStore, setMenuStore] = useState(null);

  useEffect(() => {
    const unsubStores = onSnapshot(collection(db, 'stores'), snap => {
      setStores(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubColleges = onSnapshot(collection(db, 'colleges'), snap => {
      setColleges(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubStores(); unsubColleges(); };
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.collegeId) {
      alert('Please select a college first. If no colleges exist, add one in the Colleges section.');
      return;
    }
    await addDoc(collection(db, 'stores'), { ...form, rating: 4.5, createdAt: new Date() });
    setForm({ name: '', category: '', ownerEmail: '', collegeId: '', isOpen: true });
    setShowModal(false);
  };

  const handleToggle = async (id, current) => {
    await updateDoc(doc(db, 'stores', id), { isOpen: !current });
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this store?')) await deleteDoc(doc(db, 'stores', id));
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Manage Stores</h1>
        <button onClick={() => setShowModal(true)}><Plus size={16} /> Add Store</button>
      </div>
      <div className="card">
        <div className="table-responsive">
          <table>
            <thead><tr><th>Store Name</th><th>College</th><th>Category</th><th>Owner Email</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {stores.map(s => {
                const college = colleges.find(c => c.id === s.collegeId);
                return (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 'bold' }}>{s.name}</td>
                    <td style={{ fontSize: '13px' }}>{college ? college.name : 'Unknown'}</td>
                    <td>{s.category}</td>
                    <td>{s.ownerEmail}</td>
                    <td>
                      <span className={`badge ${s.isOpen ? 'success' : 'secondary'}`} style={{ cursor: 'pointer' }} onClick={() => handleToggle(s.id, s.isOpen)}>
                        {s.isOpen ? 'OPEN' : 'CLOSED'}
                      </span>
                    </td>
                    <td style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => setMenuStore(s)} style={{ background: 'var(--primary)', color: 'var(--secondary)', padding: '6px 12px' }}><Edit2 size={14} /> Menu</button>
                      <button onClick={() => handleDelete(s.id)} style={{ background: '#FEE2E2', color: 'var(--error)', padding: '6px 12px' }}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {showModal && (
        <Modal title="Add Store" onClose={() => setShowModal(false)}>
          <form onSubmit={handleAdd}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Select Campus/College</label>
              {colleges.length === 0 ? (
                <div style={{ padding: '12px', background: '#FFF7ED', color: '#9A3412', borderRadius: '8px', fontSize: '13px', border: '1px solid #FFEDD5' }}>
                  ⚠️ No colleges found. Please add a college first from the "Colleges" tab.
                </div>
              ) : (
                <select required className="input-field" value={form.collegeId} onChange={e => setForm({...form, collegeId: e.target.value})} style={{ appearance: 'auto' }}>
                  <option value="">-- Select an existing college --</option>
                  {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
            </div>
            <input required className="input-field" style={{marginBottom: '12px'}} placeholder="Store Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            <input required className="input-field" style={{marginBottom: '12px'}} placeholder="Category (e.g. Snacks)" value={form.category} onChange={e => setForm({...form, category: e.target.value})} />
            <input required className="input-field" style={{marginBottom: '20px'}} placeholder="Owner Email" value={form.ownerEmail} onChange={e => setForm({...form, ownerEmail: e.target.value})} />
            <button type="submit" style={{ width: '100%', justifyContent: 'center' }}>Save Store</button>
          </form>
        </Modal>
      )}
      {menuStore && <MenuEditor storeId={menuStore.id} storeName={menuStore.name} onClose={() => setMenuStore(null)} />}
    </div>
  );
};

// ─── Orders ──────────────────────────────────────────────────────────────────
const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [riders, setRiders] = useState([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const statusColor = s => s === 'delivered' ? 'success' : ['preparing', 'on_the_way', 'picked_up'].includes(s) ? 'primary' : 'secondary';
  const STATUS_FLOW = ['placed', 'preparing', 'ready', 'picked_up', 'on_the_way', 'delivered'];

  useEffect(() => {
    const unsubOrders = onSnapshot(query(collection(db, 'orders')), snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setOrders(data);
    });
    const unsubRiders = onSnapshot(query(collection(db, 'riders')), snap => {
      setRiders(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => r.isActive));
    });
    return () => { unsubOrders(); unsubRiders(); };
  }, []);

  const handleForceUpdate = async (id, currentStatus) => {
    const idx = STATUS_FLOW.indexOf(currentStatus);
    if (idx < STATUS_FLOW.length - 1) {
      await updateDoc(doc(db, 'orders', id), { status: STATUS_FLOW[idx + 1] });
    }
  };

  const handleAssignRider = async (riderId, riderName) => {
    await updateDoc(doc(db, 'orders', selectedOrder), {
      status: 'preparing',
      riderId: riderId,
      riderName: riderName
    });
    setShowAssignModal(false);
    setSelectedOrder(null);
  };

  return (
    <div>
      <h1 className="page-title">Live Orders ({orders.length})</h1>
      <div className="card">
        <div className="table-responsive">
          <table>
            <thead>
              <tr><th>Order ID</th><th>Store</th><th>Customer</th><th>Items</th><th>Amount</th><th>Status</th><th>Rider</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id}>
                  <td style={{ fontWeight: 'bold' }}>#{o.id.substring(0, 6)}</td>
                  <td>{o.storeName}</td>
                  <td style={{ fontSize: '12px' }}>{o.userId?.substring(0, 8)}...</td>
                  <td style={{ fontSize: '11px' }}>{o.items?.map(i => `${i.qty}x ${i.name}`).join(', ')}</td>
                  <td style={{ fontWeight: 'bold' }}>₹{o.totalAmount}</td>
                  <td><span className={`badge ${statusColor(o.status)}`}>{o.status?.toUpperCase()}</span></td>
                  <td style={{ fontSize: '12px' }}>{o.riderName || 'Unassigned'}</td>
                  <td style={{ display: 'flex', gap: '8px' }}>
                    {!o.riderId && <button onClick={() => { setSelectedOrder(o.id); setShowAssignModal(true); }} style={{ padding: '6px 10px', fontSize: '12px', background: 'var(--secondary)', color: 'white' }}>Assign</button>}
                    {o.status !== 'delivered' && <button onClick={() => handleForceUpdate(o.id, o.status)} style={{ padding: '6px 10px', fontSize: '12px' }}><RefreshCw size={12} /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {showAssignModal && (
        <Modal title="Assign Rider" onClose={() => setShowAssignModal(false)}>
          {riders.map(r => (
            <div key={r.id} className="card" style={{ padding: '12px', marginBottom: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }} onClick={() => handleAssignRider(r.id, r.name)}>
              <span>{r.name} ({r.vehicleNumber})</span>
              <Check size={16} />
            </div>
          ))}
        </Modal>
      )}
    </div>
  );
};

// ─── Users & Riders (Simplified List) ────────────────────────────────────────
const UsersPage = () => {
  const [users, setUsers] = useState([]);
  useEffect(() => onSnapshot(collection(db, 'users'), snap => setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })))), []);
  return (
    <div>
      <h1 className="page-title">Users</h1>
      <div className="card">
        <div className="table-responsive">
          <table>
            <thead><tr><th>ID</th><th>Phone</th><th>Name</th></tr></thead>
            <tbody>{users.map(u => <tr key={u.id}><td>{u.id.substring(0, 8)}</td><td>{u.phoneNumber}</td><td>{u.name || '-'}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const Riders = () => {
  const [riders, setRiders] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', vehicleNumber: '' });

  useEffect(() => onSnapshot(collection(db, 'riders'), snap => setRiders(snap.docs.map(d => ({ id: d.id, ...d.data() })))), []);

  const handleAdd = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, 'riders'), { ...form, isActive: true, createdAt: new Date() });
    setForm({ name: '', phone: '', vehicleNumber: '' });
    setShowModal(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 className="page-title">Riders</h1>
        <button onClick={() => setShowModal(true)}><Plus size={16} /> Add Rider</button>
      </div>
      <div className="card">
        <div className="table-responsive">
          <table>
            <thead><tr><th>Name</th><th>Phone</th><th>Vehicle</th><th>Actions</th></tr></thead>
            <tbody>
              {riders.map(r => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{r.phone}</td>
                  <td>{r.vehicleNumber}</td>
                  <td><button onClick={() => deleteDoc(doc(db, 'riders', r.id))} style={{ color: 'var(--error)', background: 'transparent' }}><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {showModal && (
        <Modal title="Add Rider" onClose={() => setShowModal(false)}>
          <form onSubmit={handleAdd}>
            <input required className="input-field" style={{marginBottom: '12px'}} placeholder="Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            <input required className="input-field" style={{marginBottom: '12px'}} placeholder="Phone" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
            <input required className="input-field" style={{marginBottom: '20px'}} placeholder="Vehicle Number" value={form.vehicleNumber} onChange={e => setForm({...form, vehicleNumber: e.target.value})} />
            <button type="submit" style={{width: '100%', justifyContent: 'center'}}>Save Rider</button>
          </form>
        </Modal>
      )}
    </div>
  );
};

// ─── App ─────────────────────────────────────────────────────────────────────
const ProtectedRoute = () => {
  const { isAuthenticated } = useContext(AuthContext);
  return isAuthenticated ? <Layout /> : <Navigate to="/login" replace />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/colleges" element={<Colleges />} />
            <Route path="/stores" element={<Stores />} />
            <Route path="/banners" element={<Banners />} />
            <Route path="/coupons" element={<Coupons />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/riders" element={<Riders />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
