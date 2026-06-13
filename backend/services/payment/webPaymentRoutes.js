const express = require('express');
const router = express.Router();
const razorpay = require('./razorpay');
const crypto = require('crypto');

// POST /api/create-order
router.post('/create-order', async (req, res) => {
  try {
    const { amount, receipt } = req.body;

    if (amount === undefined) {
      return res.status(400).json({ success: false, error: 'Amount is required' });
    }

    const amountInPaise = Math.round(Number(amount));

    if (amountInPaise < 100) {
      return res.status(400).json({ success: false, error: 'Minimum payment amount is 100 paise (₹1)' });
    }

    if (!razorpay) {
      return res.status(503).json({
        success: false,
        error: 'Payment service is currently unavailable (Razorpay keys missing)'
      });
    }

    const options = {
      amount: amountInPaise,
      currency: "INR",
      receipt: receipt || `order_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);

    res.status(200).json({
      success: true,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: process.env.RAZORPAY_KEY_ID
    });
  } catch (err) {
    console.error('Razorpay Create Order Error:', err);
    // Handle auth failure (return 401)
    if (err.statusCode === 401 || err.status === 401) {
      return res.status(401).json({ success: false, error: 'Razorpay authentication failed' });
    }
    // Handle other Razorpay API/internal errors (return 500)
    res.status(500).json({ success: false, error: err.message || 'Razorpay API Error' });
  }
});

// POST /api/verify-payment
router.post('/verify-payment', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, verified: false, error: 'Missing required payment verification fields' });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      return res.status(503).json({ success: false, error: 'Razorpay secret not configured' });
    }

    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generated_signature = hmac.digest('hex');

    if (generated_signature === razorpay_signature) {
      res.status(200).json({ success: true, verified: true });
    } else {
      res.status(400).json({ success: false, verified: false, error: 'Signature mismatch' });
    }
  } catch (err) {
    console.error('Razorpay Verification Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
