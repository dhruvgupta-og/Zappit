const express = require('express');
const router = express.Router();
const { db } = require('../firebase');

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

    // 2. Mocking Razorpay initiation (Normally you'd create a Razorpay order here)
    const mockPaymentId = `pay_${Math.random().toString(36).substr(2, 9)}`;

    res.status(200).json({
      success: true,
      order_id: orderRef.id,
      payment_id: mockPaymentId,
      message: 'Order placed successfully. Proceed to payment.'
    });

  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Update payment status (Webhook/Client verification)
router.post('/verify', async (req, res) => {
  const { order_id, payment_id } = req.body;
  
  try {
    if (order_id && payment_id) {
      await db.collection('orders').doc(order_id).update({
        payment_status: 'paid',
        payment_id: payment_id,
        order_status: 'confirmed'
      });
      res.json({ success: true });
    } else {
      res.status(400).json({ success: false, message: 'Invalid data' });
    }
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
