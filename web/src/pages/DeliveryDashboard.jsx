import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, query } from 'firebase/firestore';
import { Package, CheckCircle, Truck, MapPin, Clock, Store, Phone } from 'lucide-react';

const MAX_ACTIVE_ORDERS = 3;

const DeliveryDashboard = () => {
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('new');
  const [myActiveCount, setMyActiveCount] = useState(0);

  const [otpPromptId, setOtpPromptId] = useState(null);
  const [otpInput, setOtpInput] = useState('');

  // ── AUTH-BASED DELIVERY IDP ──
  // College identity comes from sessionStorage set by /staff-login
  const collegeId   = sessionStorage.getItem('staff_college_id');
  const collegeName = sessionStorage.getItem('staff_college_name') || '';
  const isLoggedIn  = sessionStorage.getItem('staff_role') === 'delivery' && !!collegeId;

  const handleMarkDelivered = (order) => {
    if (order.delivery_otp) {
      setOtpPromptId(order.id);
      setOtpInput('');
    } else {
      updateOrderStatus(order.id, 'delivered');
    }
  };

  const verifyOtpAndDeliver = (order) => {
    if (otpInput === order.delivery_otp) {
      updateOrderStatus(order.id, 'delivered');
      setOtpPromptId(null);
      setOtpInput('');
    } else {
      alert('Invalid OTP. Please check with the customer.');
    }
  };



  useEffect(() => {
    if (!collegeId) return;
    const q = query(collection(db, 'orders'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const raw = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      
      const ordersData = raw.filter(o => {
        const orderId = (o.college_id || '').trim();
        const staffId = (collegeId || '').trim();
        return orderId === staffId;
      });
      setOrders(ordersData);
      setMyActiveCount(ordersData.filter(o => o.order_status === 'picked_up').length);
    });
    return () => unsubscribe();
  }, [collegeId]);

  // FIFO: sort by created_at ascending
  const sortedByTime = (list) => [...list].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  const newOrders     = sortedByTime(orders.filter(o => o.order_status === 'ready' || o.order_status === 'out_for_delivery'));
  const activeOrders  = sortedByTime(orders.filter(o => o.order_status === 'picked_up'));
  const completedOrders = sortedByTime(orders.filter(o => o.order_status === 'delivered')).reverse();

  const tabOrders = activeTab === 'new' ? newOrders : activeTab === 'active' ? activeOrders : completedOrders;

  const updateOrderStatus = async (orderId, status) => {
    await updateDoc(doc(db, 'orders', orderId), { order_status: status });
  };

  const getItems = (items) => {
    if (!items) return [];
    if (Array.isArray(items)) return items;
    return Object.entries(items).map(([id, qty]) => ({ id, name: id, qty, price: 0 }));
  };

  const tabs = [
    { key: 'new',       label: 'To Pick Up',  count: newOrders.length,       icon: <Package size={14} /> },
    { key: 'active',    label: 'Active',       count: activeOrders.length,    icon: <Truck size={14} /> },
    { key: 'completed', label: 'Completed',    count: completedOrders.length, icon: <CheckCircle size={14} /> },
  ];

  const atCapacity = myActiveCount >= MAX_ACTIVE_ORDERS;

  // ── AUTH GATE SCREEN ──
  if (!isLoggedIn) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #0B132B 0%, #1E293B 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: 12 }}>🔒</div>
        <h2 style={{ color: 'white', margin: '0 0 8px' }}>Delivery Access Required</h2>
        <p style={{ color: '#94A3B8', margin: '0 0 24px', fontSize: '0.9rem', maxWidth: 300 }}>You must log in through the Delivery Partner Portal to access this dashboard.</p>
        <a href="/staff-login?type=delivery" style={{ background: 'linear-gradient(135deg, #FFC107, #FF8F00)', color: '#0B132B', padding: '14px 28px', borderRadius: 12, fontWeight: 800, textDecoration: 'none', fontSize: '1rem' }}>
          🛵 Go to Delivery Login
        </a>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', paddingBottom: 20 }}>
      {/* ── HEADER ── */}
      <div style={{ background: 'linear-gradient(135deg, #1E293B 0%, #334155 100%)', padding: '20px 20px 32px', color: 'white' }}>
        <div style={{ marginBottom: 4, fontSize: '0.72rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>🛵 Delivery Partner</div>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>Delivery Dashboard</h1>
        {collegeName && <div style={{ fontSize: '0.78rem', opacity: 0.7, marginTop: 2 }}>📍 {collegeName}</div>}

        {/* Queue Info */}
        <div style={{ marginTop: 12, padding: '10px 14px', background: atCapacity ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.1)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Active Orders</span>
          <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>{myActiveCount} / {MAX_ACTIVE_ORDERS}</span>
        </div>
        {atCapacity && (
          <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(239,68,68,0.2)', borderRadius: 8, fontSize: '0.8rem', color: '#FCA5A5', fontWeight: 600 }}>
            ⚠️ At capacity — deliver current orders first
          </div>
        )}

        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 16 }}>
          {[
            { label: 'To Pick Up', value: newOrders.length },
            { label: 'In Progress', value: activeOrders.length },
            { label: 'Done Today', value: completedOrders.length },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{s.value}</div>
              <div style={{ fontSize: '0.65rem', opacity: 0.7, textTransform: 'uppercase' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── TAB BAR ── */}
      <div style={{ padding: '0 16px', marginTop: -16 }}>
        <div style={{ background: 'white', borderRadius: 14, padding: 6, display: 'flex', gap: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{ flex: 1, padding: '10px 4px', borderRadius: 10, border: 'none', background: activeTab === tab.key ? 'linear-gradient(135deg, #1E293B, #334155)' : 'transparent', color: activeTab === tab.key ? 'white' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, transition: 'all 0.2s ease' }}>
              {tab.icon} {tab.label}
              {tab.count > 0 && <span style={{ background: activeTab === tab.key ? 'rgba(255,255,255,0.25)' : '#EF4444', color: 'white', borderRadius: 10, padding: '0px 6px', fontSize: '0.68rem', fontWeight: 700 }}>{tab.count}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ── ORDER CARDS ── */}
      <div style={{ padding: 16 }}>
        {tabOrders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <Package size={48} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
            <h3 style={{ margin: '0 0 8px' }}>{activeTab === 'new' ? 'No pickups ready' : activeTab === 'active' ? 'No active deliveries' : 'No completed orders'}</h3>
            <p style={{ margin: 0, fontSize: '0.875rem' }}>{activeTab === 'new' ? 'Orders will appear once stores mark them ready.' : activeTab === 'active' ? 'Pick up an order to start.' : 'Completed deliveries show here.'}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {tabOrders.map((order, idx) => {
              const items = getItems(order.items);
              const isFirst = idx === 0;
              return (
                <div key={order.id} className="card" style={{ padding: 0, overflow: 'hidden', border: isFirst && activeTab === 'new' ? '2px solid #F59E0B' : '1px solid var(--border-color)' }}>
                  {/* FIFO indicator */}
                  {activeTab === 'new' && isFirst && (
                    <div style={{ background: '#F59E0B', padding: '4px 12px', fontSize: '0.7rem', fontWeight: 700, color: 'white' }}>
                      📋 NEXT IN QUEUE
                    </div>
                  )}
                  <div style={{ height: 4, background: activeTab === 'new' ? 'linear-gradient(90deg, #F59E0B, #EF4444)' : activeTab === 'active' ? 'linear-gradient(90deg, #3B82F6, #06B6D4)' : 'linear-gradient(90deg, #10B981, #059669)' }} />

                  <div style={{ padding: 16 }}>
                    {/* Order ID & Time */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>ORDER ID</div>
                        <div style={{ fontWeight: 800, fontSize: '1rem' }}>#{order.id.slice(-6).toUpperCase()}</div>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        <div>📅 {order.created_at ? new Date(order.created_at).toLocaleDateString() : ''}</div>
                        <div>🕒 {order.created_at ? new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</div>
                      </div>
                    </div>

                    {/* Store */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '8px 10px', background: '#F8FAFC', borderRadius: 8 }}>
                      <Store size={15} color="var(--primary)" />
                      <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{order.store_name || 'Store'}</span>
                    </div>

                    {/* Items */}
                    <div style={{ marginBottom: 10 }}>
                      {items.slice(0, 3).map((item, i) => (
                        <div key={i} style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 2 }}>{item.qty}× {item.name}</div>
                      ))}
                      {items.length > 3 && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>+{items.length - 3} more</div>}
                    </div>

                    {/* Delivery Details */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px', background: '#FFF7ED', borderRadius: 8, marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <MapPin size={15} color="#F97316" />
                        <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#9A3412' }}>{order.address || 'No address'}</span>
                      </div>
                      {order.user_phone && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: '2px' }}>
                          <Phone size={15} color="#F97316" />
                          <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#9A3412' }}>
                            <a href={`tel:${order.user_phone}`} style={{ color: 'inherit', textDecoration: 'none' }}>{order.user_phone}</a>
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Amount */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Total</span>
                      <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--primary)' }}>₹{order.total_amount}</span>
                    </div>

                    {/* Action Buttons */}
                    {activeTab === 'new' && !atCapacity && (
                      <button onClick={() => updateOrderStatus(order.id, 'picked_up')} style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #1E293B, #334155)', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
                        🛵 Pick Up This Order
                      </button>
                    )}
                    {activeTab === 'new' && atCapacity && (
                      <div style={{ width: '100%', padding: '12px', borderRadius: 10, background: '#F3F4F6', color: '#9CA3AF', fontWeight: 600, fontSize: '0.85rem', textAlign: 'center' }}>
                        Deliver active orders first
                      </div>
                    )}
                    {activeTab === 'active' && (
                      <>
                        {otpPromptId === order.id ? (
                          <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-main)', textAlign: 'center' }}>Enter 6-digit OTP from Customer</div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <input 
                                type="text" 
                                maxLength={6}
                                value={otpInput}
                                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                                placeholder="000000"
                                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', textAlign: 'center', fontSize: '1.2rem', letterSpacing: '0.2em', fontWeight: 700 }}
                              />
                              <button 
                                onClick={() => verifyOtpAndDeliver(order)}
                                style={{ background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', padding: '0 16px', fontWeight: 700, cursor: 'pointer' }}
                              >
                                Verify
                              </button>
                            </div>
                            <button 
                              onClick={() => setOtpPromptId(null)}
                              style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '8px', cursor: 'pointer', fontWeight: 600 }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => handleMarkDelivered(order)} style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #10B981, #059669)', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
                            ✅ Mark as Delivered
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default DeliveryDashboard;
