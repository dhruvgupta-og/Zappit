const axios = require('axios');

async function test() {
  try {
    console.log('Fetching single store...');
    const res = await axios.get('http://localhost:5000/api/stores/6a367d4b3a6db6e97aeb5601');
    console.log('Store Name:', res.data.store.name);
    console.log('Menu Items Count:', res.data.menu.length);
  } catch (err) {
    console.error('API Error:', err.response ? err.response.status : err.message);
  }
}
test();
