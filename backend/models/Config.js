const mongoose = require('mongoose');

const ConfigSchema = new mongoose.Schema({
  _id: { type: String },
  list: { type: Array, default: [] }
}, { _id: false, strict: false });

module.exports = mongoose.model('Config', ConfigSchema, 'configs');
