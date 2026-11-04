require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');

async function migrate() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is missing in .env');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected.');

  const db = mongoose.connection.db;

  // 1. Migrate menuitems
  const menuCollection = db.collection('menuitems');
  const objectIdItems = await menuCollection.find({ _id: { $type: 'objectId' } }).toArray();
  console.log(`Found ${objectIdItems.length} menu items with ObjectId _id`);

  let menuSuccess = 0;
  for (const item of objectIdItems) {
    const stringId = item._id.toString();
    const newDoc = { ...item, _id: stringId };
    await menuCollection.insertOne(newDoc);
    await menuCollection.deleteOne({ _id: item._id });
    menuSuccess++;
    console.log(`[MenuItem ${menuSuccess}/${objectIdItems.length}] Migrated "${item.name}" -> ${stringId}`);
  }

  // 2. Migrate coupons
  const couponCollection = db.collection('coupons');
  const objectIdCoupons = await couponCollection.find({ _id: { $type: 'objectId' } }).toArray();
  console.log(`Found ${objectIdCoupons.length} coupons with ObjectId _id`);

  let couponSuccess = 0;
  for (const coupon of objectIdCoupons) {
    const stringId = coupon._id.toString();
    const newDoc = { ...coupon, _id: stringId };
    await couponCollection.insertOne(newDoc);
    await couponCollection.deleteOne({ _id: coupon._id });
    couponSuccess++;
    console.log(`[Coupon ${couponSuccess}/${objectIdCoupons.length}] Migrated "${coupon.code}" -> ${stringId}`);
  }

  // Verification
  const remainingObjMenuItems = await menuCollection.countDocuments({ _id: { $type: 'objectId' } });
  const remainingObjCoupons = await couponCollection.countDocuments({ _id: { $type: 'objectId' } });
  const totalMenuItems = await menuCollection.countDocuments();
  const totalCoupons = await couponCollection.countDocuments();

  console.log('\n--- Migration Summary ---');
  console.log(`Total menu items: ${totalMenuItems} (ObjectId remaining: ${remainingObjMenuItems})`);
  console.log(`Total coupons: ${totalCoupons} (ObjectId remaining: ${remainingObjCoupons})`);

  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
