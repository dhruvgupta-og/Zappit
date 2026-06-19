const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // Auth UID
  name: { type: String },
  phone: { type: String, unique: true },
  college: { type: String },
  college_name: { type: String },
  college_id: { type: String },
  role: { type: String, enum: ['user', 'admin', 'delivery'], default: 'user' },
  blocked: { type: Boolean, default: false },
  fcmToken: { type: String },
  profile_complete: { type: Boolean, default: false },
  used_coupons: [String]
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
