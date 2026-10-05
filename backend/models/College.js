const mongoose = require('mongoose');

const CollegeSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  name: { type: String, required: true },
  city: { type: String },
  isActive: { type: Boolean, default: true },
  blocks: [{
    name: { type: String, required: true },
    deliveryFee: { type: Number, default: 0 }
  }]
}, { timestamps: true });

module.exports = mongoose.model('College', CollegeSchema);
