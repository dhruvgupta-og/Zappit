const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  user_id: { type: String, required: true }, // UID from auth
  store_id: { type: String, required: true },
  store_name: { type: String },
  college_id: { type: String },
  college_name: { type: String },
  items: [
    {
      id: { type: String },
      name: { type: String },
      price: { type: Number },
      qty: { type: Number },
      storeName: { type: String }
    }
  ],
  total_amount: { type: Number, required: true },
  address: { type: String },
  payment_status: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
  payment_id: { type: String },
  order_status: { type: String, enum: ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'picked_up', 'delivered', 'cancelled'], default: 'pending' },
  delivery_otp: { type: String },
  coupon_applied: { type: String },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', OrderSchema);
