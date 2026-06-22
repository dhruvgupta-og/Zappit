import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import api from '../utils/api';
import { CheckCircle, XCircle, Loader2, ShoppingBag } from 'lucide-react';

const PaymentCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing'); // processing, success, failure
  const [error, setError] = useState('');
  const [animationPhase, setAnimationPhase] = useState(0);

  useEffect(() => {
    const verifyPayment = async () => {
      const merchantOrderId = searchParams.get('merchantOrderId');
      const transactionId = searchParams.get('transactionId');
      const isVerified = searchParams.get('verified') === 'true';
      const errorMsg = searchParams.get('error');
      const orderIdsParam = searchParams.get('orderIds');
      
      if (errorMsg) {
        setStatus('failure');
        setError(decodeURIComponent(errorMsg));
        return;
      }

      if (!isVerified) {
        setStatus('failure');
        setError('Payment verification failed');
        return;
      }

      try {
        setStatus('success');
        
        // Clear cart
        localStorage.removeItem('zappit_cart');
        localStorage.removeItem('zappit_cart_storeId');
        localStorage.removeItem('zappit_cart_storeName');

        // Parse order IDs
        const orderIds = orderIdsParam ? orderIdsParam.split(',') : [];

        if (orderIds.length > 0) {
          // Send Order Confirmation Email
          try {
            await api.post('/api/send-order-email', { orderIds: orderIds });
          } catch (err) {
            console.error('[Zappit] Failed to send email on callback', err);
          }
          
          setAnimationPhase(1);
          setTimeout(() => setAnimationPhase(2), 1500);
          setTimeout(() => setAnimationPhase(3), 2500);
          setTimeout(() => setAnimationPhase(4), 3500);
          
          setTimeout(() => {
             navigate(`/track/${orderIds.join(',')}`);
          }, 5500);
        } else {
          setTimeout(() => {
             navigate('/orders');
          }, 3000);
        }

      } catch (err) {
        console.error(err);
        setStatus('failure');
        setError(err.message);
      }
    };

    verifyPayment();
  }, [searchParams, navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
      {status === 'processing' && (
        <>
          <Loader2 className="w-16 h-16 mb-4 animate-spin text-primary" />
          <h2 className="text-2xl font-bold">Verifying Payment...</h2>
          <p className="text-muted-foreground">Please do not close this window.</p>
        </>
      )}

      {status === 'success' && (
        <>
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

          {animationPhase === 0 && (
            <>
              <CheckCircle className="w-16 h-16 mb-4 text-green-500" />
              <h2 className="text-2xl font-bold">Payment Successful!</h2>
              <p className="text-muted-foreground">Your order has been placed. Redirecting to tracker...</p>
            </>
          )}
        </>
      )}

      {status === 'failure' && (
        <>
          <XCircle className="w-16 h-16 mb-4 text-red-500" />
          <h2 className="text-2xl font-bold">Payment Failed</h2>
          <p className="text-red-500 mb-6">{error}</p>
          <button onClick={() => navigate('/checkout')} className="btn btn-primary">Try Again</button>
        </>
      )}
    </div>
  );
};

export default PaymentCallback;
