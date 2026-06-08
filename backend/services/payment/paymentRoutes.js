const express = require('express');
const router = express.Router();
const razorpay = require('./razorpay');
const crypto = require('crypto');

// Initiate Razorpay Payment
router.post('/checkout', async (req, res) => {
  try {
    const { amount, receipt } = req.body;
    
    if (!razorpay) {
      return res.status(503).json({ 
        success: false, 
        error: 'Payment service is currently unavailable (Razorpay keys missing)' 
      });
    }

    // Amount in paise
    const amountInPaise = Math.round(amount * 100);
    
    if (amountInPaise < 100) {
      return res.status(400).json({
        success: false,
        error: 'Minimum payment amount is 1 INR'
      });
    }

    const options = {
      amount: amountInPaise,
      currency: "INR",
      receipt: receipt || `order_${Date.now()}`,
    };

    let order;
    try {
      order = await razorpay.orders.create(options);
    } catch (rzpErr) {
      if (rzpErr.statusCode === 401 || !process.env.RAZORPAY_KEY_ID) {
        // Fallback for development if keys are invalid
        console.warn('Razorpay Auth Failed: Falling back to mock order mode.');
        return res.json({
          success: true,
          order_id: `mock_order_${Date.now()}`,
          amount: options.amount,
          currency: options.currency,
          isMock: true
        });
      }
      throw rzpErr;
    }

    res.json({ 
      success: true, 
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      isMock: false
    });
  } catch (err) {
    console.error('Razorpay Checkout Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Verify Razorpay Payment Signature
router.post('/verify', async (req, res) => {
  try {
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature 
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, verified: false, message: 'Missing required payment verification fields' });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generated_signature = hmac.digest('hex');

    if (generated_signature === razorpay_signature) {
      res.json({ success: true, verified: true });
    } else {
      res.status(400).json({ success: false, verified: false, message: 'Invalid signature' });
    }
  } catch (err) {
    console.error('Razorpay Verification Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
