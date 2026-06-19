const mongoose = require('mongoose');

const CouponSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  discount_percent: { type: Number, required: true },
  college_id: { type: String, default: 'all' },
  once_per_user: { type: Boolean, default: true },
  active: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Coupon', CouponSchema);
