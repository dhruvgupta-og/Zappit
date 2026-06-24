const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // Auth UID
  email: { type: String },
  name: { type: String },
  phone: { type: String },
  college: { type: String },
  college_name: { type: String },
  college_id: { type: String },
  auth_method: { type: String, default: 'email' }, // 'email' | 'google'
  photo_url: { type: String },
  role: { type: String, enum: ['user', 'admin', 'delivery'], default: 'user' },
  blocked: { type: Boolean, default: false },
  fcmToken: { type: String },
  profile_complete: { type: Boolean, default: false },
  used_coupons: [String]
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
