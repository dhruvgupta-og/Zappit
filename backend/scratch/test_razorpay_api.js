require('dotenv').config();
const axios = require('axios');

async function testRazorpay() {
  console.log('Testing Razorpay Integration...');
  console.log('Key ID:', process.env.RAZORPAY_KEY_ID);
  
  try {
    const response = await axios.post('http://localhost:5000/api/payments/checkout', {
      amount: 100, // INR 100
      currency: 'INR',
      receipt: 'test_receipt_123'
    }, {
      headers: {
        // Mocking authCheck middleware if it requires any specific header
        'Authorization': 'Bearer mock-token'
      }
    });

    console.log('Response Status:', response.status);
    console.log('Response Data:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success && response.data.order_id) {
      console.log('✅ Razorpay Order Created Successfully!');
    } else {
      console.log('❌ Failed to create Razorpay Order.');
    }
  } catch (err) {
    console.error('❌ API Error:', err.response ? err.response.data : err.message);
  }
}

testRazorpay();
