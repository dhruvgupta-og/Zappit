const { db } = require('./firebase');

async function verifyCoupon() {
  const testCoupon = {
    code: 'Y100',
    discount_percent: 50,
    college_id: 'QFKMBgygyzSn9be6JK6c',
    once_per_user: true,
    active: true
  };

  try {
    // 1. Call the local API to save the coupon
    const saveRes = await fetch('http://127.0.0.1:5000/api/save-coupon', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testCoupon)
    });

    console.log('Save API Response status:', saveRes.status);
    const saveResult = await saveRes.json();
    console.log('Save API Response body:', saveResult);

    if (!saveResult.success) {
      throw new Error('Save API returned success: false');
    }

    // 2. Query the coupon via verify-coupon API
    console.log('\n2. Calling verify-coupon API for coupon Y100...');
    const verifyRes = await fetch('http://127.0.0.1:5000/api/verify-coupon', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ code: 'Y100' })
    });

    console.log('Verify API Response status:', verifyRes.status);
    const verifyResult = await verifyRes.json();
    console.log('Verify API Response body:', verifyResult);

    if (!verifyResult.success) {
      throw new Error('Verify API returned success: false');
    }

    console.log('\nSUCCESS: Programmatic verification of coupon save and verify logic completed successfully!');
  } catch (err) {
    console.error('\nVERIFICATION FAILED:', err.message);
  }
}

verifyCoupon();
