const mongoose = require('mongoose');
const Staff = require('./models/Staff');
require('dotenv').config(); // Load environment variables if needed

const addStaff = async () => {
  // Replace these with your actual values
  const FIREBASE_UID = "TJY7LojeWiTJHgwvtMEWzdPIenG2"; // Get this from Firebase Authentication Console
  const STAFF_EMAIL = "Biryani@zappit.shop";
  const STORE_ID = "store_biryani_001"; // The exact _id string from your stores collection
  const STORE_NAME = "Biryani";

  if (FIREBASE_UID === "REPLACE_WITH_UID") {
    console.error("Please replace 'REPLACE_WITH_UID' with the actual UID from Firebase Auth.");
    process.exit(1);
  }

  try {
    await mongoose.connect('mongodb+srv://dhruv:dhruvgupta@cluster0.bnd0n.mongodb.net/zappit?retryWrites=true&w=majority&appName=Cluster0');
    console.log('Connected to MongoDB.');

    const newStaff = await Staff.findOneAndUpdate(
      { _id: FIREBASE_UID },
      {
        role: 'store_owner',
        name: STORE_NAME + ' Store Owner',
        email: STAFF_EMAIL,
        store_id: STORE_ID,
        store_name: STORE_NAME
      },
      { upsert: true, new: true }
    );

    console.log('Successfully added staff member to MongoDB:', newStaff);
  } catch (error) {
    console.error('Error adding staff member:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(0);
  }
}

addStaff();
