const express = require('express');
const router = express.Router();
const Order = require('../../models/Order');

// Get all orders for a specific user (or all if admin)
router.get('/', async (req, res) => {
  try {
    const { user_id, admin } = req.query; 

    let query = {};
    if (user_id) query.user_id = user_id;

    const orders = await Order.find(query).sort({ created_at: -1 });
    res.json({ success: true, orders: orders.map(o => ({ id: o._id, ...o.toObject() })) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create Order (Moved checkout logic here for DB creation)
router.post('/', async (req, res) => {
  try {
    const { user_id, store_id, items, total_amount, address } = req.body;

    const newOrder = new Order({
      user_id,
      store_id,
      items,
      total_amount,
      address,
      payment_status: 'pending',
      order_status: 'pending'
    });

    const savedOrder = await newOrder.save();
    res.status(201).json({ success: true, order: savedOrder });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update Order Status (Store/Admin Dashboard)
router.patch('/:id/status', async (req, res) => {
  try {
    const { order_status } = req.body;
    const updatedOrder = await Order.findByIdAndUpdate(req.params.id, { order_status }, { new: true });
    res.json({ success: true, order: updatedOrder });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update Order (e.g., Payment success callback)
router.patch('/:id', async (req, res) => {
  try {
    const updatedOrder = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, order: updatedOrder });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
