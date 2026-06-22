import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import axios from 'axios';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

const PaymentCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing'); // processing, success, failure
  const [error, setError] = useState('');

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
          
          setTimeout(() => {
             navigate(`/track/${orderIds.join(',')}`);
          }, 3000);
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
          <CheckCircle className="w-16 h-16 mb-4 text-green-500" />
          <h2 className="text-2xl font-bold">Payment Successful!</h2>
          <p className="text-muted-foreground">Your order has been placed. Redirecting to tracker...</p>
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
