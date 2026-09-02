require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI);
async function run() {
  const db = mongoose.connection;
  await new Promise(r => db.once('open', r));
  
  // Fix Biryani staff
  const biryaniRes = await db.collection('staffs').updateOne(
    { _id: 'TJY7LojeWiTJHgwvtMEWzdPIenG2' },
    { $set: { store_id: 'store_biryani_001' } }
  );
  
  // Fix Momomafia staff
  const momoRes = await db.collection('staffs').updateOne(
    { _id: 'sW7sdFqM27g7oNYWnyLn2aYg27E2' },
    { $set: { store_id: '6a42a1548a6e20cdfb9764f0' } }
  );

  // Also make sure their role in users collection is store_owner
  await db.collection('users').updateOne(
    { _id: 'TJY7LojeWiTJHgwvtMEWzdPIenG2' },
    { $set: { role: 'store_owner' } }
  );
  await db.collection('users').updateOne(
    { _id: 'sW7sdFqM27g7oNYWnyLn2aYg27E2' },
    { $set: { role: 'store_owner' } }
  );

  console.log('Fixed Biryani Staff:', biryaniRes.modifiedCount);
  console.log('Fixed Momomafia Staff:', momoRes.modifiedCount);
  
  mongoose.disconnect();
}
run();
