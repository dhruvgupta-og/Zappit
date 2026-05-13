const express = require('express');
const router = express.Router();
const { db } = require('../firebase');
const razorpay = require('../services/payment/razorpay');
const crypto = require('crypto');

// Create a new order (Checkout Flow)
router.post('/checkout', async (req, res) => {
  try {
    const { user_id, store_id, store_name, items, total_amount, address } = req.body;

    if (!user_id || !store_id || !items || !total_amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // 1. Create order document in Firestore
    const orderRef = await db.collection('orders').add({
      user_id,
      store_id,
      store_name: store_name || 'Store',
      items,
      total_amount,
      address: address || 'Campus Main Gate',
      payment_status: 'pending',
      order_status: 'pending',
      created_at: new Date().toISOString()
    });


    // 2. Create Razorpay order
    const options = {
      amount: Math.round(total_amount * 100), // amount in the smallest currency unit (paise)
      currency: "INR",
      receipt: orderRef.id,
    };

    const razorpayOrder = await razorpay.orders.create(options);

    res.status(200).json({
      success: true,
      order_id: orderRef.id,
      razorpay_order_id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      message: 'Order created in Razorpay. Proceed to payment.'
    });

  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Update payment status (Webhook/Client verification)
router.post('/verify', async (req, res) => {
  const { 
    order_id, 
    razorpay_order_id, 
    razorpay_payment_id, 
    razorpay_signature 
  } = req.body;
  
  try {
    // 1. Verify Signature
    const secret = process.env.RAZORPAY_KEY_SECRET;
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generated_signature = hmac.digest('hex');

    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }

    // 2. Update order status in Firestore
    if (order_id) {
      await db.collection('orders').doc(order_id).update({
        payment_status: 'paid',
        razorpay_order_id: razorpay_order_id,
        razorpay_payment_id: razorpay_payment_id,
        order_status: 'confirmed',
        updated_at: new Date().toISOString()
      });
      res.json({ success: true, message: 'Payment verified successfully' });
    } else {
      res.status(400).json({ success: false, message: 'Order ID missing' });
    }
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
