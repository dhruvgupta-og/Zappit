const mongoose = require('mongoose');

const BannerSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  image: { type: String, required: true },
  link: { type: String },
  coupon_code: { type: String },
  active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Banner', BannerSchema);
