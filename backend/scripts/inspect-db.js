require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');

async function inspect() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  console.log('Collections in MongoDB:');
  for (const c of collections) {
    const count = await db.collection(c.name).countDocuments();
    console.log(`- ${c.name}: ${count} documents`);
  }
  await mongoose.disconnect();
}

inspect().catch(console.error);

