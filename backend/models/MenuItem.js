const mongoose = require('mongoose');

const MenuItemSchema = new mongoose.Schema({
  store_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  desc: { type: String },
  category: { type: String },
  isVeg: { type: Boolean, default: true },
  image: { type: String }
});

module.exports = mongoose.model('MenuItem', MenuItemSchema);
