const mongoose = require('mongoose');
require('dotenv').config();
const { admin } = require('./firebase');
const User = require('./models/User');

// ─── EDIT THESE DETAILS ────────────────────────────────────────────
const USER_EMAIL    = 'newuser@gmail.com';  // The user's email
const USER_PASSWORD = 'password123';        // Their login password (min 6 chars)
const USER_NAME     = 'New User';           // Their display name
const USER_PHONE    = '9999999999';         // Their phone number
const USER_COLLEGE  = 'ITM GOI';           // College name
// ───────────────────────────────────────────────────────────────────

const addUser = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB.');

    // 1. Create Firebase Auth account
    let userRecord;
    try {
      userRecord = await admin.auth().createUser({
        email: USER_EMAIL,
        password: USER_PASSWORD,
        displayName: USER_NAME,
      });
      console.log(`✅ Firebase account created: ${userRecord.uid}`);
    } catch (authErr) {
      if (authErr.code === 'auth/email-already-exists') {
        // User already in Firebase, just fetch them
        userRecord = await admin.auth().getUserByEmail(USER_EMAIL);
        console.log(`ℹ️  Firebase account already exists: ${userRecord.uid}`);
      } else {
        throw authErr;
      }
    }

    // 2. Save/update user in MongoDB
    const savedUser = await User.findByIdAndUpdate(
      userRecord.uid,
      {
        $set: {
          email: USER_EMAIL,
          name: USER_NAME,
          phone: USER_PHONE,
          college: USER_COLLEGE,
          college_name: USER_COLLEGE,
          auth_method: 'email',
          profile_complete: true,  // Set to false if you want them to go through onboarding
        },
        $setOnInsert: {
          _id: userRecord.uid,
          role: 'user',
          blocked: false,
        }
      },
      { upsert: true, new: true }
    );

    console.log(`\n🎉 User added successfully!`);
    console.log(`   UID:    ${savedUser._id}`);
    console.log(`   Email:  ${savedUser.email}`);
    console.log(`   Name:   ${savedUser.name}`);
    console.log(`   Phone:  ${savedUser.phone}`);
    console.log(`\n   They can now log in at: http://localhost:5173/login`);
    console.log(`   Email:    ${USER_EMAIL}`);
    console.log(`   Password: ${USER_PASSWORD}`);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

addUser();
