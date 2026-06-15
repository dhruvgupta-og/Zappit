import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, MapPin, CreditCard, CheckCircle, Trash2, Plus, Minus, ShoppingBag, Tag } from 'lucide-react';
import { auth, db } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, query, where, getDocs, updateDoc, arrayUnion, onSnapshot } from 'firebase/firestore';
import { useCart } from '../CartContext';

const CheckoutPage = () => {
  const navigate = useNavigate();
  const { cartItems, cartTotal: subtotal, clearCart, addToCart, removeFromCart } = useCart();
  
  const [address, setAddress] = useState(localStorage.getItem('userAddress') || 'Engineering Block A');
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [animationPhase, setAnimationPhase] = useState(0);
  
  // ── COUPON STATE ──
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [applying, setApplying] = useState(false);

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setApplying(true);
    setCouponError('');
    try {
      const codeToQuery = couponCode.toUpperCase().trim();
      console.log('[Zappit Debug] Applying coupon with code:', codeToQuery);
      
      // Query coupons by code only
      const q = query(collection(db, 'coupons'), where('code', '==', codeToQuery));
      const snap = await getDocs(q);
      
      console.log('[Zappit Debug] Query returned documents count:', snap.size);
      
      if (snap.empty) {
        // Let's check if there are other coupons in database just to log them
        const allCouponsSnap = await getDocs(collection(db, 'coupons'));
        console.log('[Zappit Debug] All coupons in DB:', allCouponsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        
        setCouponError('Invalid or expired code');
        setAppliedCoupon(null);
      } else {
        const coupon = { id: snap.docs[0].id, ...snap.docs[0].data() };
        console.log('[Zappit Debug] Found coupon:', coupon);
        
        const userCollegeId = localStorage.getItem('userCollegeId');
        console.log('[Zappit Debug] userCollegeId from localStorage:', userCollegeId);
        
        if (coupon.active === false) {
          setCouponError('This coupon is inactive or expired');
          setAppliedCoupon(null);
        } else if (coupon.college_id !== 'all' && coupon.college_id !== userCollegeId) {
          setCouponError(`Not valid for your college (Coupon college: ${coupon.college_id}, User college: ${userCollegeId})`);
          setAppliedCoupon(null);
        } else {
          // Check if single use
          if (coupon.once_per_user !== false && auth.currentUser) {
            const userSnap = await getDoc(doc(db, 'users', auth.currentUser.uid));
            if (userSnap.exists()) {
              const usedCoupons = userSnap.data().used_coupons || [];
              if (usedCoupons.includes(coupon.code)) {
                setCouponError('You have already used this coupon');
                setAppliedCoupon(null);
                setApplying(false);
                return;
              }
            }
          }
          setAppliedCoupon(coupon);
          setCouponCode('');
        }
      }
    } catch (err) {
      console.error('[Zappit Debug] Error applying coupon:', err);
      setCouponError('Error applying coupon: ' + err.message);
    } finally {
      setApplying(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponError('');
  };

  const handleAddressChange = (e) => {
    setAddress(e.target.value);
    localStorage.setItem('userAddress', e.target.value);
  };

  // ── DYNAMIC FEES FROM FIRESTORE ──
  const [fees, setFees] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'fees'), (docSnap) => {
      if (docSnap.exists() && Array.isArray(docSnap.data().list)) {
        setFees(docSnap.data().list);
      } else {
        setFees([
          { name: 'Delivery Fee', value: 20 },
          { name: 'Platform Fee', value: 5 }
        ]);
      }
    });
    return () => unsub();
  }, []);

  const totalFees = fees.reduce((sum, f) => sum + Number(f.value || 0), 0);

  // ── RAZORPAY SCRIPT LOADER ──
  const loadRazorpay = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePayment = async () => {
    setPaymentProcessing(true);
    
    try {
      const res = await loadRazorpay();
      if (!res) {
        alert('Razorpay SDK failed to load. Are you online?');
        setPaymentProcessing(false);
        return;
      }

      // 1. Create order on backend
      const discount = appliedCoupon ? Math.round((subtotal * appliedCoupon.discount_percent) / 100) : 0;
      const amountToPay = Math.max(1, Math.round(subtotal + totalFees - discount));
      const amountInPaise = amountToPay * 100;

      const { data } = await axios.post('/api/create-order', {
        amount: amountInPaise,
        receipt: `order_${Date.now()}`
      });

      if (!data.success) {
        throw new Error(data.error || 'Failed to initiate payment');
      }

      console.log('[Zappit] Order API response:', data);

      // 2. Open Razorpay Checkout
      const options = {
        key: data.key_id || import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_T0gdDL6JAF6MCI',
        amount: data.amount,
        currency: data.currency,
        name: 'Zappit',
        description: 'Campus Delivery',
        order_id: data.order_id,
        handler: async function (response) {
          try {
            // 3. Verify Payment Signature
            const verifyRes = await axios.post('/api/verify-payment', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            });

            if (verifyRes.data.success) {
              await finalizeOrder(response.razorpay_payment_id);
            } else {
              alert('Payment verification failed');
              setPaymentProcessing(false);
            }
          } catch (err) {
            console.error('Verification error:', err);
            const errMsg = err.response?.data?.error || err.message || 'Error verifying payment';
            alert('Verification error: ' + errMsg);
            setPaymentProcessing(false);
          }
        },
        prefill: {
          name: auth.currentUser?.displayName || '',
          email: auth.currentUser?.email || '',
          contact: ''
        },
        theme: {
          color: '#FFC107'
        },
        modal: {
          ondismiss: function() {
            alert('Payment cancelled by user');
            setPaymentProcessing(false);
          }
        }
      };

      const paymentObject = new window.Razorpay(options);

      paymentObject.on('payment.failed', function(response) {
        console.error('Razorpay payment.failed:', response.error);
        alert('Payment failed: ' + (response.error.description || response.error.reason || 'Unknown error'));
        setPaymentProcessing(false);
      });

      paymentObject.open();

    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.error || err.message || 'Unknown error';
      alert('Payment initialization failed: ' + errMsg);
      setPaymentProcessing(false);
    }
  };

  const finalizeOrder = async (paymentTransactionId) => {
    try {
      // Generate a 6-digit delivery OTP
      const deliveryOtp = Math.floor(100000 + Math.random() * 900000).toString();

      let userPhone = '';
      let userCollegeId = localStorage.getItem('userCollegeId') || '';
      if (auth.currentUser?.uid) {
        const userSnap = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userSnap.exists()) {
          userPhone = userSnap.data().phone || '';
          userCollegeId = userSnap.data().college_id || userCollegeId;
        }
      }
      
      if (!userCollegeId) {
        throw new Error("Campus identity missing. Please go to Profile and re-select your college.");
      }

      // Group items by store
      const itemsByStore = {};
      cartItems.forEach(item => {
        if (!itemsByStore[item.storeId]) itemsByStore[item.storeId] = [];
        itemsByStore[item.storeId].push(item);
      });

      const orderIds = [];
      const storeNames = [];

      for (const [storeId, items] of Object.entries(itemsByStore)) {
        const storeName = items[0].storeName || 'Campus Store';
        storeNames.push(storeName);
        
        const storeSubtotal = items.reduce((sum, i) => sum + (i.price * i.qty), 0);
        const isFirst = orderIds.length === 0;
        const storeTotal = storeSubtotal + (isFirst ? totalFees : 0);

        const discount = appliedCoupon ? Math.round((storeSubtotal * appliedCoupon.discount_percent) / 100) : 0;

        const docRef = await addDoc(collection(db, 'orders'), {
          user_id: auth.currentUser?.uid || 'guest_user',
          user_name: auth.currentUser?.displayName || 'Campus User',
          user_phone: userPhone,
          college_id: userCollegeId,
          store_id: storeId,
          store_name: storeName,
          items: items,
          total_amount: Math.max(0, storeTotal - discount),
          discount_amount: discount,
          coupon_applied: appliedCoupon ? appliedCoupon.code : null,
          address: address,
          payment_status: 'completed',
          payment_transaction_id: paymentTransactionId,
          order_status: 'confirmed',
          delivery_otp: deliveryOtp,
          created_at: serverTimestamp()
        });
        orderIds.push(docRef.id);
      }

      // Track coupon usage if single-use
      if (appliedCoupon && appliedCoupon.once_per_user !== false && auth.currentUser) {
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
          used_coupons: arrayUnion(appliedCoupon.code)
        });
      }

      // Send Order Confirmation Email via Resend
      try {
        const discountAmount = appliedCoupon ? Math.round((subtotal * appliedCoupon.discount_percent) / 100) : 0;
        const totalAmount = Math.max(1, Math.round(subtotal + totalFees - discountAmount));

        await axios.post('/api/send-order-email', {
          email: auth.currentUser?.email || '',
          orderIds,
          storeNames,
          items: cartItems,
          totalAmount,
          deliveryOtp,
          address,
          fees,
          appliedCoupon: appliedCoupon ? {
            code: appliedCoupon.code,
            discount_percent: appliedCoupon.discount_percent
          } : null
        });
        console.log('[Zappit] Order confirmation email requested successfully.');
      } catch (emailErr) {
        console.error('[Zappit] Failed to send order confirmation email:', emailErr);
      }
      
      const combinedStoreNames = storeNames.join(', ');

      setPaymentProcessing(false);
      clearCart();
      setPaymentSuccess(true);
      setAnimationPhase(1);

      setTimeout(() => setAnimationPhase(2), 1500);
      setTimeout(() => setAnimationPhase(3), 2500);
      setTimeout(() => setAnimationPhase(4), 3500);
      
      setTimeout(() => {
        navigate(`/track/${orderIds.join(',')}`, { state: { storeName: combinedStoreNames, address } });
      }, 5500);
      
    } catch (err) {
      console.error(err);
      alert('Failed to finalize order');
      setPaymentProcessing(false);
    }
  };

  if (cartItems.length === 0 && !paymentSuccess) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', marginTop: '100px' }}>
        <h2>Your cart is empty</h2>
        <button onClick={() => navigate(-1)} className="btn btn-outline" style={{ marginTop: '20px' }}>Go Back</button>
      </div>
    );
  }

  if (paymentSuccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[90vh]" style={{ padding: '24px', textAlign: 'center', background: 'var(--bg-color)' }}>
        {animationPhase === 1 && (
          <div className="animate-fade-in flex flex-col items-center">
            <div style={{ background: 'var(--card-bg)', padding: '24px', borderRadius: '24px', marginBottom: '24px', position: 'relative' }}>
              <div style={{ fontSize: '4rem' }}>📦</div>
              <div style={{ position: 'absolute', top: '-10px', right: '-10px', background: 'white', borderRadius: '50%' }}>
                <CheckCircle size={32} color="#10B981" fill="#10B981" stroke="white" />
              </div>
            </div>
            <h2 style={{ fontSize: '1.5rem', color: 'var(--text-main)', marginBottom: '8px' }}>Order Placed</h2>
            <p style={{ color: 'var(--text-muted)' }}>Hang tight!</p>
          </div>
        )}

        {animationPhase === 2 && (
          <div className="animate-zapp flex flex-col items-center justify-center" style={{ width: '100%', height: '300px' }}>
            <div style={{ position: 'relative' }}>
              <div style={{ fontSize: '10rem', color: 'var(--primary)', lineHeight: 1, filter: 'drop-shadow(0 0 20px rgba(255,193,7,0.5))' }}>💥</div>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'white', fontWeight: 900, fontSize: '3rem', fontStyle: 'italic', textShadow: '2px 2px 0px rgba(0,0,0,0.8)' }}>
                ZAPP!
              </div>
            </div>
          </div>
        )}

        {animationPhase === 3 && (
          <div className="animate-energy flex flex-col items-center justify-center" style={{ width: '100%', height: '300px' }}>
            <div style={{ color: 'var(--primary)', filter: 'drop-shadow(0 0 30px var(--primary))' }}>
              <ShoppingBag size={120} />
            </div>
          </div>
        )}

        {animationPhase === 4 && (
          <div className="animate-fade-in flex flex-col items-center">
            <div style={{ background: 'var(--primary-gradient)', padding: '32px', borderRadius: '50%', marginBottom: '24px', boxShadow: '0 0 40px rgba(255,193,7,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--bg-color)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <h2 style={{ fontSize: '1.75rem', color: 'var(--text-main)', marginBottom: '8px' }}>Confirmed!</h2>
            <p style={{ color: 'var(--text-muted)' }}>Redirecting to Tracker...</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '100px' }}>
      {/* Header */}
      <header className="header">
        <button onClick={() => navigate(-1)} className="btn-icon" style={{ background: 'transparent', boxShadow: 'none', padding: 0 }}>
          <ArrowLeft size={24} />
        </button>
        <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Checkout</h2>
        <div style={{ width: 24 }}></div> {/* spacer */}
      </header>

      <div style={{ padding: '20px' }}>
        {/* Delivery Address */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1.125rem', marginBottom: '12px' }}>Delivery Address</h3>
          
          <div className="flex gap-3 items-center">
            <div style={{ background: 'rgba(255, 193, 7, 0.1)', padding: '10px', borderRadius: '50%', color: 'var(--primary)' }}>
              <MapPin size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <input 
                type="text"
                value={address} 
                onChange={handleAddressChange} 
                placeholder="Enter your hostel/room details"
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', fontSize: '1rem', fontWeight: 500, color: 'var(--text-main)', background: 'var(--bg-color)' }}
              />
            </div>
          </div>
        </div>

        {/* Order Summary */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1.125rem', marginBottom: '16px' }}>Order Summary</h3>
          <div className="flex flex-col gap-4" style={{ marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
            {cartItems.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center">
                <div className="flex items-center gap-3" style={{ flex: 1 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)' }}>{item.name}</div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-muted)' }}>₹{item.price}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="flex items-center" style={{ background: 'var(--bg-color)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                    <button onClick={() => removeFromCart(item, item.storeId)} style={{ background: 'none', border: 'none', padding: '6px 10px', cursor: 'pointer', color: item.qty === 1 ? '#EF4444' : 'var(--primary)', display: 'flex', alignItems: 'center' }}>
                      {item.qty === 1 ? <Trash2 size={14} /> : <Minus size={14} />}
                    </button>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', width: '20px', textAlign: 'center' }}>{item.qty}</span>
                    <button onClick={() => addToCart(item, item.storeId, item.storeName)} style={{ background: 'none', border: 'none', padding: '6px 10px', cursor: 'pointer', color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
                      <Plus size={14} />
                    </button>
                  </div>
                  <span style={{ fontWeight: 700, color: 'var(--text-main)', minWidth: '45px', textAlign: 'right' }}>₹{item.price * item.qty}</span>
                </div>
              </div>
            ))}
          </div>
          
          {/* Coupon Section */}
          <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--bg-color)', borderRadius: '12px', border: '1px dashed var(--border-color)' }}>
            {!appliedCoupon ? (
              <>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input 
                    placeholder="Enter Coupon Code" 
                    value={couponCode} 
                    onChange={e => setCouponCode(e.target.value.toUpperCase())}
                    style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'white', fontSize: '0.85rem' }}
                  />
                  <button 
                    onClick={applyCoupon}
                    disabled={applying}
                    style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
                  >
                    {applying ? '...' : 'Apply'}
                  </button>
                </div>
                {couponError && <div style={{ color: '#EF4444', fontSize: '0.75rem', marginTop: 4, fontWeight: 600 }}>{couponError}</div>}
              </>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Tag size={16} color="var(--primary)" />
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--primary)' }}>{appliedCoupon.code} Applied!</div>
                    <div style={{ fontSize: '0.72rem', color: '#10B981', fontWeight: 700 }}>{appliedCoupon.discount_percent}% Discount</div>
                  </div>
                </div>
                <button onClick={removeCoupon} style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>Remove</button>
              </div>
            )}
          </div>

          {/* Bill Details */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between" style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              <span>Item Total</span>
              <span>₹{subtotal}</span>
            </div>
            {fees.map((fee, fIdx) => (
              <div key={fIdx} className="flex justify-between" style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                <span>{fee.name}</span>
                <span>₹{fee.value}</span>
              </div>
            ))}
            {appliedCoupon && (
              <div className="flex justify-between" style={{ fontSize: '0.875rem', color: '#10B981', fontWeight: 700 }}>
                <span>Coupon Discount ({appliedCoupon.discount_percent}%)</span>
                <span>-₹{Math.round((subtotal * appliedCoupon.discount_percent) / 100)}</span>
              </div>
            )}
            <div className="flex justify-between items-center" style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--border-color)', fontWeight: 700, fontSize: '1.125rem' }}>
              <span>To Pay</span>
              <span style={{ color: 'var(--primary)' }}>₹{Math.max(0, Math.round(subtotal + totalFees - (appliedCoupon ? (subtotal * appliedCoupon.discount_percent) / 100 : 0)))}</span>
            </div>
          </div>
        </div>



      </div>

      {/* Payment Sticky Bar */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--card-bg)', padding: '16px 20px', paddingBottom: 'calc(16px + env(safe-area-inset-bottom))', boxShadow: '0 -4px 12px rgba(0,0,0,0.3)', zIndex: 100, maxWidth: '480px', margin: '0 auto', display: 'flex', gap: '16px', alignItems: 'center' }}>
        <div style={{ flexShrink: 0 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>To Pay</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>₹{Math.max(0, Math.round(subtotal + totalFees - (appliedCoupon ? (subtotal * appliedCoupon.discount_percent) / 100 : 0)))}</div>
        </div>
        <button 
          onClick={handlePayment} 
          className="btn btn-primary" 
          style={{ flex: 1, padding: '16px', borderRadius: '12px', fontSize: '1.125rem', color: 'var(--bg-color)' }}
          disabled={paymentProcessing}
        >
          {paymentProcessing ? 'Processing...' : 'Pay securely'}
        </button>
      </div>
    </div>
  );
};

export default CheckoutPage;
