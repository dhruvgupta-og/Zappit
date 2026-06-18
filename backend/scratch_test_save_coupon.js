async function testSaveCoupon() {
  try {
    const data = {
      code: 'TEST10',
      discount_percent: 10,
      college_id: 'all',
      once_per_user: true,
      active: true
    };
    const res = await fetch('http://localhost:5000/api/save-coupon', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    console.log('Response status:', res.status);
    const body = await res.json();
    console.log('Response data:', body);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testSaveCoupon();
