const mongoose = require('mongoose');
require('dotenv').config();
const { admin } = require('./firebase');
const User = require('./models/User');

const migrateUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB.');

    let nextPageToken;
    let totalMigrated = 0;
    let totalSkipped = 0;

    do {
      const listUsersResult = await admin.auth().listUsers(1000, nextPageToken);

      for (const userRecord of listUsersResult.users) {
        // Skip staff accounts — they use the Staff model
        const staffCheck = await mongoose.connection.db.collection('staffs').findOne({ _id: userRecord.uid });
        if (staffCheck) {
          console.log(`⏭  Skipping staff: ${userRecord.email}`);
          totalSkipped++;
          continue;
        }

        const authMethod = userRecord.providerData?.some(p => p.providerId === 'google.com') ? 'google' : 'email';
        const photoUrl = userRecord.photoURL || userRecord.providerData?.[0]?.photoURL || '';
        const displayName = userRecord.displayName || userRecord.providerData?.[0]?.displayName || '';
        const phone = userRecord.phoneNumber || '';

        // Upsert: always update email, name, photo, auth_method from Firebase
        // but preserve existing college, profile_complete etc.
        await User.findByIdAndUpdate(
          userRecord.uid,
          {
            $set: {
              email: userRecord.email || '',
              name: displayName,
              auth_method: authMethod,
              photo_url: photoUrl,
              ...(phone && { phone }),
            },
            $setOnInsert: {
              _id: userRecord.uid,
              profile_complete: false,
              role: 'user',
            }
          },
          { upsert: true, new: true }
        );

        totalMigrated++;
        console.log(`✅ Saved: ${userRecord.email || userRecord.uid} (${authMethod})`);
      }

      nextPageToken = listUsersResult.pageToken;
    } while (nextPageToken);

    console.log(`\n🎉 Done! Saved/Updated: ${totalMigrated}, Skipped (staff): ${totalSkipped}`);
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

migrateUsers();
