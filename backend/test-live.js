const axios = require('axios');

async function testAdmin() {
  try {
    const res = await axios.get('https://zappit-backend.onrender.com/api/stores');
    console.log('Stores API Status:', res.status);
    console.log('Stores Count:', res.data.stores.length);
  } catch (err) {
    console.error('API Error:', err.message);
  }
}
testAdmin();
