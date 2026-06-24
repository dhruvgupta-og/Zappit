const mongoose = require('mongoose');
const { admin } = require('./firebase');
const Staff = require('./models/Staff');
require('dotenv').config();

const migrateStaff = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB.');

    const snapshot = await admin.firestore().collection('staff').get();
    if (snapshot.empty) {
      console.log('No staff documents found in Firestore.');
      return;
    }

    let count = 0;
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const uid = doc.id;

      await Staff.findOneAndUpdate(
        { _id: uid },
        {
          role: data.role || 'store_owner',
          name: data.name || '',
          email: data.email || '',
          store_id: data.store_id || '',
          store_name: data.store_name || '',
          college_id: data.college_id || '',
          college_name: data.college_name || ''
        },
        { upsert: true, new: true }
      );
      count++;
      console.log(`Migrated staff: ${data.name || uid} (${data.role})`);
    }

    console.log(`Successfully migrated ${count} staff members from Firestore to MongoDB!`);
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

migrateStaff();
