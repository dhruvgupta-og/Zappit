const mongoose = require('mongoose');
require('dotenv').config();
const Store = require('./models/Store');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const stores = await Store.find();
  console.log(`Total stores: ${stores.length}`);
  stores.forEach(s => {
    console.log(`  ID: ${s._id} | Name: "${s.name}" | College: ${s.college_name}`);
  });
  mongoose.disconnect();
});
