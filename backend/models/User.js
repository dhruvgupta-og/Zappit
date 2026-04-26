const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  college_id: { type: mongoose.Schema.Types.ObjectId, ref: 'College' },
  role: { type: String, enum: ['user', 'admin', 'delivery'], default: 'user' },
  blocked: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
