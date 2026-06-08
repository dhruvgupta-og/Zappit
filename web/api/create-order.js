const Razorpay = require('razorpay');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const KEY_ID = process.env.RAZORPAY_KEY_ID;
  const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

  if (!KEY_ID || !KEY_SECRET) {
    return res.status(503).json({ success: false, error: 'Razorpay keys not configured on server' });
  }

  try {
    const razorpay = new Razorpay({ key_id: KEY_ID, key_secret: KEY_SECRET });
    const { amount, receipt } = req.body;
    const amountInPaise = Math.round(Number(amount) * 100);

    if (amountInPaise < 100) {
      return res.status(400).json({ success: false, error: 'Minimum payment amount is ₹1' });
    }

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: receipt || `order_${Date.now()}`,
    });

    return res.status(200).json({
      success: true,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: KEY_ID, // Return key so frontend always uses the SAME key
    });
  } catch (err) {
    console.error('Create Order Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
