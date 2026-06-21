const express = require('express');
const router = express.Router();
const Order = require('../../models/Order');
const mongoose = require('mongoose');

// Get all orders for a specific user (or all if admin/staff)
router.get('/', async (req, res) => {
  try {
    let query = {};
    const isStaff = ['admin', 'store_owner', 'delivery'].includes(req.user.role);

    if (!isStaff) {
      // Non-staff can ONLY fetch their own orders
      query.user_id = req.user.uid;
    } else if (req.query.user_id) {
      // Admins/Staff can fetch specific user's orders if requested
      query.user_id = req.query.user_id;
    }

    const orders = await Order.find(query).sort({ created_at: -1 });
    res.json({ success: true, orders: orders.map(o => ({ id: o._id, ...o.toObject() })) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create Order (Moved checkout logic here for DB creation)
router.post('/', async (req, res) => {
  try {
    const orderData = { ...req.body };
    if (!orderData._id) {
      orderData._id = new mongoose.Types.ObjectId().toString();
    }
    
    // Enforce user_id to match the authenticated user
    orderData.user_id = req.user.uid;

    // Ensure default statuses if not provided by frontend
    if (!orderData.payment_status) orderData.payment_status = 'pending';
    if (!orderData.order_status) orderData.order_status = 'pending';

    const newOrder = new Order(orderData);
    const savedOrder = await newOrder.save();
    res.status(201).json({ success: true, order: savedOrder });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update Order Status (Store/Admin/Delivery Dashboard)
router.patch('/:id/status', async (req, res) => {
  try {
    // Only admins/staff can change status manually
    const isStaff = ['admin', 'store_owner', 'delivery'].includes(req.user.role);
    if (!isStaff) {
      return res.status(403).json({ success: false, error: 'Forbidden: Staff only' });
    }
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
    // Only admins can do arbitrary updates (like marking paid) directly
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden: Admins only' });
    }
    const updatedOrder = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, order: updatedOrder });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
