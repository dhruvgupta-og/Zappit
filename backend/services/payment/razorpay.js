const Razorpay = require('razorpay');

let razorpay = null;

try {
  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  } else {
    console.error('RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is missing. Payment functionality will be unavailable.');
  }
} catch (error) {
  console.error('Failed to initialize Razorpay SDK:', error.message);
}

module.exports = razorpay;

