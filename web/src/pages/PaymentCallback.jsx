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
      
      if (!merchantOrderId) {
        setStatus('failure');
        setError('Missing Order ID');
        return;
      }

      try {
        // 1. Verify with backend
        const { data } = await axios.post('http://localhost:5000/api/payments/verify', {
          merchantOrderId
        });

        if (data.success && data.verified) {
          // 2. Finalize order in Firestore
          await finalizeOrder(transactionId || merchantOrderId);
          setStatus('success');
          
          // Redirect to tracker after delay
          setTimeout(() => {
             // In a real app, you'd get the new order IDs from the finalizeOrder response
             navigate('/orders'); // Fallback to orders list
          }, 3000);
        } else {
          setStatus('failure');
          setError('Payment verification failed');
        }
      } catch (err) {
        console.error(err);
        setStatus('failure');
        setError(err.message);
      }
    };

    verifyPayment();
  }, []);

  const finalizeOrder = async (paymentTransactionId) => {
    const pendingData = JSON.parse(localStorage.getItem('pendingOrderData'));
    if (!pendingData) return;

    const { cartItems, address, appliedCoupon, subtotal, deliveryFee, platformFee } = pendingData;
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

    const itemsByStore = {};
    cartItems.forEach(item => {
      if (!itemsByStore[item.storeId]) itemsByStore[item.storeId] = [];
      itemsByStore[item.storeId].push(item);
    });

    const orderIds = [];
    for (const [storeId, items] of Object.entries(itemsByStore)) {
      const storeName = items[0].storeName || 'Campus Store';
      const storeSubtotal = items.reduce((sum, i) => sum + (i.price * i.qty), 0);
      const isFirst = orderIds.length === 0;
      const storeTotal = storeSubtotal + (isFirst ? deliveryFee + platformFee : 0);
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

    if (appliedCoupon && auth.currentUser) {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        used_coupons: arrayUnion(appliedCoupon.code)
      });
    }

    localStorage.removeItem('pendingOrderData');
    return orderIds;
  };

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
