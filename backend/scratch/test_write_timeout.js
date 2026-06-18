const { db } = require('../firebase');

async function testWriteWithTimeout() {
  console.log('Writing test document to coupons with timeout...');
  const start = Date.now();
  
  // Create a promise that rejects after 5 seconds
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Operation timed out after 5 seconds')), 5000)
  );

  const writePromise = db.collection('coupons').add({
    code: 'TEST_WRITE',
    discount_percent: 5,
    created_at: new Date().toISOString()
  });

  try {
    const docRef = await Promise.race([writePromise, timeoutPromise]);
    console.log('Document written with ID:', docRef.id, 'in', (Date.now() - start), 'ms');
  } catch (err) {
    console.error('Error writing document after', (Date.now() - start), 'ms:', err.message);
  }
}

testWriteWithTimeout();
