const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  user_id: { type: String, required: true },
  user_name: { type: String },
  user_phone: { type: String },
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
  discount_amount: { type: Number, default: 0 },
  address: { type: String },
  payment_status: { type: String, enum: ['pending', 'completed', 'paid', 'failed'], default: 'pending' },
  payment_transaction_id: { type: String },
  payment_id: { type: String },
  order_status: { type: String, enum: ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'picked_up', 'delivered', 'cancelled'], default: 'pending' },
  delivery_otp: { type: String },
  coupon_applied: { type: String },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', OrderSchema);
