require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');

async function inspectOrder() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const doc = await db.collection('orders').findOne({});
  console.log('=== orders sample ===');
  console.log(JSON.stringify(doc, null, 2));
  await mongoose.disconnect();
}

inspectOrder().catch(console.error);

