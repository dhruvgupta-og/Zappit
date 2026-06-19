require('dotenv').config();
const mongoose = require('mongoose');
const { db } = require('./firebase'); // Firestore

// Models
const User = require('./models/User');
const Store = require('./models/Store');
const MenuItem = require('./models/MenuItem');
const Order = require('./models/Order');
const Coupon = require('./models/Coupon');
const College = require('./models/College');
const Banner = require('./models/Banner');

async function migrateCollection(collectionName, Model, transform = null) {
  console.log(`Starting migration for: ${collectionName}`);
  const snapshot = await db.collection(collectionName).get();
  let count = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    data._id = doc.id; // Preserve original ID

    if (transform) {
      transform(data);
    }

    try {
      await Model.findByIdAndUpdate(doc.id, data, { upsert: true, new: true, setDefaultsOnInsert: true });
      count++;
    } catch (err) {
      console.error(`Error migrating ${collectionName} ID ${doc.id}:`, err.message);
    }
  }
  console.log(`Migrated ${count} documents for ${collectionName}.`);
  return snapshot.docs;
}

async function migrateMenus(storesDocs) {
  console.log('Starting migration for: stores/{storeId}/menu');
  let count = 0;

  for (const storeDoc of storesDocs) {
    const menuSnapshot = await db.collection('stores').doc(storeDoc.id).collection('menu').get();
    
    for (const doc of menuSnapshot.docs) {
      const data = doc.data();
      data._id = doc.id;
      data.store_id = storeDoc.id;

      try {
        await MenuItem.findByIdAndUpdate(doc.id, data, { upsert: true, new: true, setDefaultsOnInsert: true });
        count++;
      } catch (err) {
        console.error(`Error migrating menu item ID ${doc.id} for store ${storeDoc.id}:`, err.message);
      }
    }
  }
  console.log(`Migrated ${count} menu items.`);
}

async function runMigration() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB Atlas successfully.');

    // 1. Users
    await migrateCollection('users', User, (data) => {
      // Any specific user transformations if needed
    });

    // 2. Colleges
    await migrateCollection('colleges', College);

    // 3. Stores
    const storesDocs = await migrateCollection('stores', Store);

    // 4. Menus (Subcollection)
    await migrateMenus(storesDocs);

    // 5. Banners
    await migrateCollection('banners', Banner);

    // 6. Coupons
    await migrateCollection('coupons', Coupon);

    // 7. Orders
    await migrateCollection('orders', Order, (data) => {
      // Make sure items array exists
      if (!data.items) data.items = [];
    });

    console.log('🎉 Full Migration Completed Successfully!');
    process.exit(0);

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
