const mongoose = require('mongoose');

const CollegeSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  name: { type: String, required: true },
  city: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('College', CollegeSchema);
