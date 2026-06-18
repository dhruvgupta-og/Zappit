const { db } = require('../firebase');

async function testWrite() {
  console.log('Writing test document to coupons...');
  const start = Date.now();
  try {
    const docRef = await db.collection('coupons').add({
      code: 'TEST_WRITE',
      discount_percent: 5,
      created_at: new Date().toISOString()
    });
    console.log('Document written with ID:', docRef.id, 'in', (Date.now() - start), 'ms');
  } catch (err) {
    console.error('Error writing document after', (Date.now() - start), 'ms:', err);
  }
}

testWrite();
