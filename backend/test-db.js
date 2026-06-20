const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const Store = require('./models/Store');

async function test() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const id = '6a367d4b3a6db6e97aeb5601';
    console.log('Searching for ID:', id);

    const store = await Store.findById(id);
    console.log('findById result:', store);

    const store2 = await Store.findOne({ _id: id });
    console.log('findOne result:', store2);

    const allStores = await Store.find();
    console.log('All store IDs in DB:');
    allStores.forEach(s => console.log(`- ${s.name} (ID: ${s._id}, type: ${typeof s._id})`));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

test();
