const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  user_id: { type: String, required: true }, // UID from auth
  store_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
  items: [
    {
      id: { type: String },
      name: { type: String },
      price: { type: Number },
      qty: { type: Number }
    }
  ],
  total_amount: { type: Number, required: true },
  address: { type: String },
  payment_status: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
  payment_id: { type: String },
  order_status: { type: String, enum: ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered'], default: 'pending' },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', OrderSchema);
