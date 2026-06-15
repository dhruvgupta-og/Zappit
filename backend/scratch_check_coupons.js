const { db } = require('./firebase');

async function checkCoupons() {
  try {
    const snap = await db.collection('coupons').get();
    console.log('Total coupons:', snap.size);
    snap.forEach(doc => {
      console.log(`ID: ${doc.id}, Data:`, doc.data());
    });
  } catch (err) {
    console.error('Error fetching coupons:', err);
  }
}

checkCoupons();
