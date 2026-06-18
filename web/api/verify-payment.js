const crypto = require('crypto');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, verified: false, message: 'Missing required fields' });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
        return res.redirect(302, `/payment-callback?error=config_missing`);
      }
      return res.status(503).json({ success: false, error: 'Razorpay secret not configured' });
    }

    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(razorpay_order_id + '|' + razorpay_payment_id);
    const generated_signature = hmac.digest('hex');

    const isVerified = generated_signature === razorpay_signature;

    // If request comes from Razorpay callback_url (form submission)
    if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
      if (isVerified) {
        return res.redirect(302, `/payment-callback?merchantOrderId=${razorpay_order_id}&transactionId=${razorpay_payment_id}&verified=true`);
      } else {
        return res.redirect(302, `/payment-callback?merchantOrderId=${razorpay_order_id}&verified=false`);
      }
    }

    // Default JSON response for handler flows
    if (isVerified) {
      return res.status(200).json({ success: true, verified: true });
    } else {
      return res.status(400).json({ success: false, verified: false, message: 'Invalid signature' });
    }
  } catch (err) {
    console.error('Verify Payment Error:', err);
    if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
      return res.redirect(302, `/payment-callback?error=${encodeURIComponent(err.message)}`);
    }
    return res.status(500).json({ success: false, error: err.message });
  }
};
