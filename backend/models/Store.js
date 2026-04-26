const mongoose = require('mongoose');

const StoreSchema = new mongoose.Schema({
  name: { type: String, required: true },
  image: { type: String },
  rating: { type: Number, default: 4.0 },
  delivery_time_mins: { type: String, default: '15-20' },
  is_open: { type: Boolean, default: true },
  tags: [String],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Store', StoreSchema);
