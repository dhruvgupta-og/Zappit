module.exports = async function handler(req, res) {
  res.status(200).json({
    status: 'ok',
    razorpayKeyConfigured: !!process.env.RAZORPAY_KEY_ID,
    razorpaySecretConfigured: !!process.env.RAZORPAY_KEY_SECRET,
    keyPrefix: process.env.RAZORPAY_KEY_ID ? process.env.RAZORPAY_KEY_ID.substring(0, 10) + '...' : 'NOT SET'
  });
};
