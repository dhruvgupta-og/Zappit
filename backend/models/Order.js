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
  payment_status: { type: String, enum: ['pending', 'completed', 'paid', 'failed', 'flagged'], default: 'pending' },
  payment_transaction_id: { type: String },
  payment_id: { type: String },
  razorpay_order_id: { type: String, index: true },
  order_status: { type: String, enum: ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'picked_up', 'delivered', 'cancelled'], default: 'pending' },
  delivery_otp: { type: String },
  coupon_applied: { type: String },
  additional_note: { type: String },
  created_at: { type: Date, default: Date.now }
});

// ── Indexes for fast queries ──
// Most critical: user opens Orders tab → queries by user_id + order_status
OrderSchema.index({ user_id: 1, order_status: 1 });
// Partner app loads pending orders → queries by store_id + order_status
OrderSchema.index({ store_id: 1, order_status: 1 });
// Admin dashboard sorts by date → index on created_at
OrderSchema.index({ created_at: -1 });
// Payment verification → razorpay_order_id (already indexed inline above, this ensures it)
OrderSchema.index({ razorpay_order_id: 1 });
// College-level order filtering
OrderSchema.index({ college_id: 1, order_status: 1 });

module.exports = mongoose.model('Order', OrderSchema);
