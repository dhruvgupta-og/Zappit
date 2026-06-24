const mongoose = require('mongoose');

const StaffSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // Firebase UID
  role: { type: String, enum: ['store_owner', 'delivery'], required: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  
  // Store Owner specific fields
  store_id: { type: String },
  store_name: { type: String },

  // Delivery specific fields
  college_id: { type: String },
  college_name: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Staff', StaffSchema);
