const mongoose = require('mongoose');

const CouponSchema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.Mixed, required: true },
  code: { type: String, required: true, unique: true },
  discount_percent: { type: Number, required: true },
  discount: { type: Number },
  type: { type: String, default: 'percent' },
  min_order: { type: Number, default: 0 },
  max_uses: { type: Number },
  college_id: { type: String, default: 'all' },
  once_per_user: { type: Boolean, default: true },
  active: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Coupon', CouponSchema);
