const mongoose = require('mongoose');

const CouponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  discount_percent: { type: Number, required: true },
  college_id: { type: String, default: 'all' },
  once_per_user: { type: Boolean, default: true },
  active: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Coupon', CouponSchema);
