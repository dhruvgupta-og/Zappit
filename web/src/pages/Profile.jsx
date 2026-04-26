import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auth, db } from '../firebase';
import { collection, query, where, onSnapshot, doc, getDoc, setDoc, getDocs } from 'firebase/firestore';
import { User, MapPin, Package, LogOut, ChevronRight, Phone, School, Edit2, CheckCircle, X } from 'lucide-react';
import { signOut } from 'firebase/auth';

const ProfilePage = () => {
  const navigate = useNavigate();
  const currentUser = auth.currentUser;

  // Profile state
  const [profile, setProfile] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', phone: '', college: '' });
  const [colleges, setColleges] = useState([]);
  const [saving, setSaving] = useState(false);

  // Address state
  const [address, setAddress] = useState(localStorage.getItem('userAddress') || 'Engineering Block A');
  const [isEditingAddress, setIsEditingAddress] = useState(false);

  // Orders state
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch colleges (from admin panel)
  useEffect(() => {
    getDocs(collection(db, 'colleges')).then(snap => {
      setColleges(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, []);

  // Fetch user profile from Firestore
  useEffect(() => {
    if (!currentUser) { setLoading(false); return; }
    const fetchProfile = async () => {
      const snap = await getDoc(doc(db, 'users', currentUser.uid));
      if (snap.exists()) {
        const data = snap.data();
        setProfile(data);
        setEditForm({ name: data.name || '', phone: data.phone || '', college: data.college_name || data.college || '' });
      }
    };
    fetchProfile();
  }, [currentUser]);

  // Live order updates
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'orders'), where('user_id', '==', currentUser.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setOrders(data);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [currentUser]);

  const handleSaveProfile = async () => {
    if (!editForm.name.trim() || !editForm.phone.trim() || !editForm.college) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'users', currentUser.uid), {
        ...profile,
        name: editForm.name.trim(),
        phone: editForm.phone.trim(),
        college: editForm.college,
        college_name: editForm.college,
        updated_at: new Date().toISOString(),
        profile_complete: true
      });
      setProfile(p => ({ ...p, name: editForm.name.trim(), phone: editForm.phone.trim(), college: editForm.college, college_name: editForm.college }));
      localStorage.setItem('userCollegeName', editForm.college);
      localStorage.setItem('userCollege', editForm.college);
      setEditMode(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddressSave = (e) => {
    setAddress(e.target.value);
    localStorage.setItem('userAddress', e.target.value);
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  if (!currentUser) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', padding: '20px' }}>
        <User size={64} color="var(--text-muted)" style={{ marginBottom: '16px' }} />
        <h2 style={{ marginBottom: '8px' }}>Not logged in</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '24px', textAlign: 'center' }}>Sign in to view your profile and past orders.</p>
        <button onClick={() => navigate('/login')} className="btn btn-primary" style={{ width: '100%' }}>Login or Sign Up</button>
      </div>
    );
  }

  const statusColorMap = {
    pending:          { bg: '#FEF3C7', text: '#92400E' },
    confirmed:        { bg: '#DBEAFE', text: '#1E40AF' },
    preparing:        { bg: '#FEF9C3', text: '#854D0E' },
    ready:            { bg: '#E0F2FE', text: '#075985' },
    out_for_delivery: { bg: '#EDE9FE', text: '#5B21B6' },
    picked_up:        { bg: '#CFFAFE', text: '#155E75' },
    delivered:        { bg: '#D1FAE5', text: '#065F46' },
    cancelled:        { bg: '#FEE2E2', text: '#991B1B' },
  };

  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: '10px',
    border: '1.5px solid var(--border-color)', outline: 'none',
    fontSize: '0.9rem', fontFamily: 'inherit', background: 'var(--card-bg)', 
    color: 'var(--text-main)', boxSizing: 'border-box'
  };

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '90px' }}>
      {/* Header */}
      <header className="header">
        <h2 style={{ fontSize: '1.25rem', margin: 0 }}>My Profile</h2>
        <button onClick={() => setEditMode(v => !v)} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9rem' }}>
          <Edit2 size={16} /> {editMode ? 'Cancel' : 'Edit'}
        </button>
      </header>

      <div style={{ padding: '20px' }}>

        {/* ── USER CARD ── */}
        <div className="card" style={{ marginBottom: '20px', padding: '20px' }}>
          {/* Avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: editMode ? 20 : 0 }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--primary-gradient)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 800, flexShrink: 0 }}>
              {(profile?.name || currentUser.email || 'U')[0].toUpperCase()}
            </div>
            {!editMode ? (
              <div>
                <h3 style={{ margin: 0, fontSize: '1.125rem' }}>{profile?.name || 'Set your name'}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '2px 0' }}>{currentUser.email}</p>
                {(profile?.college_name || profile?.college) && <span style={{ fontSize: '0.75rem', background: 'rgba(255,81,47,0.1)', color: 'var(--primary)', padding: '2px 10px', borderRadius: 20, fontWeight: 600 }}>🎓 {profile.college_name || profile.college}</span>}
              </div>
            ) : (
              <div style={{ flex: 1 }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>{currentUser.email}</p>
              </div>
            )}
          </div>

          {/* Edit Form */}
          {editMode && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Name */}
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: 5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Full Name</label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{ position: 'absolute', top: '50%', left: 10, transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input type="text" value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} placeholder="Your full name" style={{ ...inputStyle, paddingLeft: 34 }} />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: 5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Phone Number</label>
                <div style={{ position: 'relative' }}>
                  <Phone size={16} style={{ position: 'absolute', top: '50%', left: 10, transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input type="tel" value={editForm.phone} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))} placeholder="10-digit mobile number" maxLength={10} style={{ ...inputStyle, paddingLeft: 34 }} />
                </div>
              </div>

              {/* College Dropdown */}
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: 5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>College</label>
                <div style={{ position: 'relative' }}>
                  <School size={16} style={{ position: 'absolute', top: '50%', left: 10, transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }} />
                  <select value={editForm.college} onChange={e => setEditForm(p => ({ ...p, college: e.target.value }))} style={{ ...inputStyle, paddingLeft: 34, appearance: 'none', cursor: 'pointer' }}>
                    <option value="">-- Select college --</option>
                    {colleges.length > 0
                      ? colleges.map(c => <option key={c.id} value={c.name}>{c.name}{c.city ? `, ${c.city}` : ''}</option>)
                      : ['IIT Delhi', 'NIT Trichy', 'BITS Pilani', 'VIT Vellore', 'Other'].map(n => <option key={n} value={n}>{n}</option>)
                    }
                  </select>
                </div>
              </div>

              {/* Save Button */}
              <button onClick={handleSaveProfile} disabled={saving} className="btn btn-primary" style={{ width: '100%', padding: '12px', borderRadius: '12px', marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {saving ? 'Saving...' : <><CheckCircle size={18} /> Save Changes</>}
              </button>
            </div>
          )}

          {/* Show info rows when not editing */}
          {!editMode && (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { icon: <Phone size={16} />, label: 'Phone', value: profile?.phone || 'Not set' },
                { icon: <School size={16} />, label: 'College', value: profile?.college_name || profile?.college || 'Not set' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--card-bg)', borderRadius: 10, border: '1px solid var(--border-color)' }}>
                  <div style={{ color: 'var(--primary)', flexShrink: 0 }}>{item.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{item.label}</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: item.value === 'Not set' ? 'var(--text-muted)' : 'var(--text-main)' }}>{item.value}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── DELIVERY ADDRESS ── */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ fontSize: '1.rem', margin: 0, fontWeight: 700 }}>Delivery Address</h3>
            <button onClick={() => setIsEditingAddress(v => !v)} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}>
              {isEditingAddress ? 'Done' : 'Edit'}
            </button>
          </div>
          <div className="card" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ background: 'rgba(255,81,47,0.1)', padding: '10px', borderRadius: '50%', color: 'var(--primary)', flexShrink: 0 }}>
                <MapPin size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: 4 }}>Default Address</div>
                {isEditingAddress ? (
                  <input type="text" value={address} onChange={handleAddressSave} onKeyDown={e => e.key === 'Enter' && setIsEditingAddress(false)} autoFocus style={{ ...inputStyle, padding: '8px 10px' }} placeholder="Your hostel/room/block" />
                ) : (
                  <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>{address}</p>
                )}
              </div>
              {!isEditingAddress && <ChevronRight size={18} color="var(--text-muted)" />}
            </div>
          </div>
        </div>

        {/* ── RECENT ORDERS ── */}
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '12px', fontWeight: 700 }}>Recent Orders</h3>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>Loading orders...</div>
          ) : orders.length === 0 ? (
            <div className="card" style={{ padding: '28px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Package size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
              <p style={{ margin: 0 }}>No orders yet. Go order something! 🍔</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {orders.slice(0, 5).map(order => {
                const isActive = !['delivered', 'cancelled'].includes(order.order_status);
                const sc = statusColorMap[order.order_status] || { bg: '#F3F4F6', text: '#374151' };
                return (
                  <Link key={order.id} to={`/track/${order.id}`} style={{ textDecoration: 'none' }}>
                    <div className="card card-interactive" style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div>
                          <h4 style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem' }}>#{order.id.slice(-6).toUpperCase()}</h4>
                          <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {order.store_name || 'Store'} · {new Date(order.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {isActive && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#F59E0B', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />}
                          <span style={{ background: sc.bg, color: sc.text, padding: '3px 9px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700, textTransform: 'capitalize' }}>
                            {order.order_status.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          {(order.items || []).length} item{(order.items || []).length !== 1 ? 's' : ''}
                        </span>
                        <span style={{ fontWeight: 700, color: 'var(--primary)' }}>₹{order.total_amount}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* ── LOGOUT ── */}
        <button onClick={handleLogout} style={{ width: '100%', padding: '14px 16px', border: 'none', cursor: 'pointer', background: '#FEF2F2', borderRadius: 14, color: '#DC2626', display: 'flex', alignItems: 'center', gap: 12, fontWeight: 700, fontSize: '0.95rem' }}>
          <LogOut size={20} /> Log Out
        </button>
      </div>
    </div>
  );
};

export default ProfilePage;
