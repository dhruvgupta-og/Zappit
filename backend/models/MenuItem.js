const mongoose = require('mongoose');

const MenuItemSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  store_id: { type: String, required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  desc: { type: String },
  category: { type: String },
  isVeg: { type: Boolean, default: true },
  image: { type: String },
  is_available: { type: Boolean, default: true }
});

module.exports = mongoose.model('MenuItem', MenuItemSchema);
