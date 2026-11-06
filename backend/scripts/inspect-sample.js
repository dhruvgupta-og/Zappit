require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');

async function inspectSample() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const colList = ['colleges', 'stores', 'menuitems', 'banners', 'coupons', 'configs', 'staffs', 'users'];
  for (const name of colList) {
    const doc = await db.collection(name).findOne({});
    console.log(`=== ${name} sample ===`);
    console.log(JSON.stringify(doc, null, 2));
  }
  await mongoose.disconnect();
}

inspectSample().catch(console.error);

