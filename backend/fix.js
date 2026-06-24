const mongoose = require('mongoose');
require('dotenv').config();
const Order = require('./models/Order');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const orders = await Order.find({order_status: { $nin: ['delivered', 'cancelled', 'pending'] }}); 
  console.log('Active orders:', orders.map(o => ({id: o._id, status: o.order_status, college: o.college_id})));
  mongoose.disconnect();
});
