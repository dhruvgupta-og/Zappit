import React, { useState, useEffect } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { CheckCircle, Clock, ChefHat, Truck, Home, ArrowLeft, Package } from 'lucide-react';

const ORDER_STEPS = [
  { key: 'confirmed',        label: 'Order Confirmed',       icon: CheckCircle,  color: '#10B981', desc: 'Your payment was received. Store has been notified.' },
  { key: 'preparing',        label: 'Preparing Your Food',   icon: ChefHat,      color: '#F59E0B', desc: 'The store is cooking your order right now.' },
  { key: 'ready',            label: 'Ready for Pickup',      icon: Package,      color: '#3B82F6', desc: 'Your order is ready. Waiting for delivery partner.' },
  { key: 'out_for_delivery', label: 'Handed to Delivery',    icon: Clock,        color: '#8B5CF6', desc: 'A delivery partner has picked up your order.' },
  { key: 'picked_up',        label: 'On the Way',            icon: Truck,        color: '#EC4899', desc: 'Your delivery partner is heading to you!' },
  { key: 'delivered',        label: 'Delivered!',            icon: Home,         color: '#10B981', desc: 'Enjoy your meal 🎉' },
];

const statusIndex = (status) => ORDER_STEPS.findIndex(s => s.key === status);

const OrderTracker = () => {
  const { orderId } = useParams();
  const location = useLocation();
  const { storeName, address } = location.state || {};

  const orderIds = orderId ? orderId.split(',') : [];
  const [activeOrderId, setActiveOrderId] = useState(orderIds[0] || null);
  const [ordersMap, setOrdersMap] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (orderIds.length === 0) return;

    const unsubs = orderIds.map(id => 
      onSnapshot(doc(db, 'orders', id), (snap) => {
        if (snap.exists()) {
          setOrdersMap(prev => ({ ...prev, [id]: { id: snap.id, ...snap.data() } }));
        }
      })
    );

    // Give it a tiny bit of time to fetch initial data
    setTimeout(() => setLoading(false), 800);

    return () => unsubs.forEach(unsub => unsub());
  }, [orderId]);

  const order = ordersMap[activeOrderId];

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: '16px' }}>
        <div style={{ width: '48px', height: '48px', border: '4px solid #F3F4F6', borderTop: '4px solid var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ color: 'var(--text-muted)' }}>Loading your order...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', marginTop: '100px' }}>
        <h2>Order not found</h2>
        <Link to="/" className="btn btn-primary" style={{ display: 'inline-block', marginTop: '16px' }}>Back to Home</Link>
      </div>
    );
  }

  const currentStep = statusIndex(order.order_status);
  const currentStepData = ORDER_STEPS[currentStep] || ORDER_STEPS[0];
  const isDelivered = order.order_status === 'delivered';

  return (
    <div className="animate-fade-in" style={{ minHeight: '100vh', background: 'var(--bg-color)', paddingBottom: '40px' }}>
      {/* Header */}
      <div style={{
        background: isDelivered ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)' : 'var(--primary-gradient)',
        padding: '24px 20px 40px',
        color: 'white',
        transition: 'background 1s ease'
      }}>
        <Link to="/profile" style={{ color: 'white', display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none', opacity: 0.85, marginBottom: '16px', fontSize: '0.875rem' }}>
          <ArrowLeft size={16} /> My Orders
        </Link>

        {orderIds.length > 1 && (
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '20px', paddingBottom: '8px', scrollbarWidth: 'none' }} className="hide-scrollbar">
            {orderIds.map((id, index) => {
              const o = ordersMap[id];
              return (
                <button 
                  key={id}
                  onClick={() => setActiveOrderId(id)}
                  style={{
                    padding: '8px 16px', borderRadius: '20px', border: 'none', 
                    background: activeOrderId === id ? 'white' : 'rgba(255,255,255,0.2)',
                    color: activeOrderId === id ? 'var(--primary)' : 'white',
                    fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s'
                  }}>
                  {o ? o.store_name : `Order ${index + 1}`}
                </button>
              )
            })}
          </div>
        )}

        <div style={{ fontSize: '0.75rem', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Order ID</div>
        <h2 style={{ margin: '4px 0 2px', fontSize: '1.5rem', fontWeight: 800 }}>#{activeOrderId.slice(-6).toUpperCase()}</h2>
        <p style={{ margin: '0 0 16px', opacity: 0.85, fontSize: '0.9rem' }}>{order.store_name}</p>

        {/* Animated current status pill */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(255,255,255,0.2)',
          backdropFilter: 'blur(10px)',
          padding: '10px 18px',
          borderRadius: '20px',
          fontWeight: 700,
          fontSize: '0.9rem'
        }}>
          {!isDelivered && (
            <span style={{
              width: '8px', height: '8px',
              background: 'white',
              borderRadius: '50%',
              display: 'inline-block',
              animation: 'pulse 1.5s infinite'
            }} />
          )}
          {currentStepData.label}
        </div>
      </div>

      <div style={{ padding: '0 20px', marginTop: '-20px' }}>
        {/* Status Timeline Card */}
        <div className="card" style={{ padding: '24px', marginBottom: '16px' }}>
          <h3 style={{ margin: '0 0 20px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.75rem', fontWeight: 700 }}>Live Status</h3>
          <div className="flex flex-col" style={{ gap: '0' }}>
            {ORDER_STEPS.map((step, index) => {
              const isDone = index <= currentStep;
              const isCurrent = index === currentStep;
              const StepIcon = step.icon;
              const isLast = index === ORDER_STEPS.length - 1;

              return (
                <div key={step.key} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  {/* Icon + line column */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{
                      width: '40px', height: '40px',
                      borderRadius: '50%',
                      background: isDone ? step.color : 'var(--border-color)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.5s ease',
                      boxShadow: isCurrent ? `0 0 0 4px ${step.color}30` : 'none',
                      animation: isCurrent ? 'pulse 1.5s infinite' : 'none'
                    }}>
                      <StepIcon size={18} color={isDone ? 'white' : 'var(--text-muted)'} />
                    </div>
                    {!isLast && (
                      <div style={{
                        width: '2px', height: '32px',
                        background: index < currentStep ? step.color : 'var(--border-color)',
                        transition: 'background 0.5s ease',
                        margin: '4px 0'
                      }} />
                    )}
                  </div>

                  {/* Label + description column */}
                  <div style={{ paddingTop: '8px', paddingBottom: isLast ? '0' : '28px', flex: 1 }}>
                    <div style={{
                      fontWeight: isCurrent ? 700 : isDone ? 600 : 400,
                      color: isDone ? 'var(--text-main)' : '#9CA3AF',
                      fontSize: '0.95rem',
                      transition: 'all 0.3s ease'
                    }}>
                      {step.label}
                    </div>
                    {isCurrent && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {step.desc}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* OTP Display for Delivery */}
        {order.order_status === 'picked_up' && order.delivery_otp && (
          <div className="card animate-fade-in" style={{ padding: '20px', marginBottom: '16px', background: 'var(--primary-gradient)', color: 'white', border: 'none', textAlign: 'center' }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', opacity: 0.9 }}>Delivery OTP</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '0.2em' }}>{order.delivery_otp}</div>
            <div style={{ fontSize: '0.875rem', opacity: 0.9, marginTop: '8px' }}>Share this code with your delivery partner to receive your order.</div>
          </div>
        )}

        {/* Delivery Address Card */}
        <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Delivering To</div>
          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>📍 {order.address || address}</div>
        </div>

        {/* Order Summary Card */}
        <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '12px' }}>Order Summary</div>
          {(order.items || []).map((item, i) => (
            <div key={i} className="flex justify-between" style={{ marginBottom: '6px', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>{item.qty}× {item.name}</span>
              <span style={{ fontWeight: 600 }}>₹{item.price * item.qty}</span>
            </div>
          ))}
          <div className="flex justify-between" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed var(--border-color)', fontWeight: 800 }}>
            <span>Total Paid</span>
            <span style={{ color: 'var(--primary)' }}>₹{order.total_amount}</span>
          </div>
        </div>

        {/* CTA on delivery */}
        {isDelivered && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {order.store_id && (
              <a href={`/store/${order.store_id}`} className="btn btn-primary" style={{ display: 'block', textAlign: 'center', padding: '16px', borderRadius: '14px', textDecoration: 'none', fontWeight: 700, fontSize: '1rem' }}>
                🔄 Reorder from {order.store_name || 'Store'}
              </a>
            )}
            <a href="/" style={{ display: 'block', textAlign: 'center', padding: '14px', borderRadius: '14px', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>
              🏠 Back to Home
            </a>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </div>
  );
};

export default OrderTracker;
