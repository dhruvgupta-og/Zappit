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
    } else if (req.user.role === 'store_owner') {
      // Store owners only see orders for their assigned store
      query.store_id = req.user.staff_store_id;
    } else if (req.user.role === 'delivery') {
      // Delivery partners only see orders for their assigned college
      query.college_id = req.user.staff_college_id;
    } else if (req.query.user_id) {
      // Admins can fetch specific user's orders if requested
      query.user_id = req.query.user_id;
    }

    const orders = await Order.find(query).sort({ created_at: -1 });
    res.json({ success: true, orders: orders.map(o => {
      const orderObj = { id: o._id, ...o.toObject() };
      // Flag for frontend to know if OTP is required
      orderObj.requires_otp = !!orderObj.delivery_otp;
      // Secure OTP: only admins or the order owner (customer) can see the OTP in the list response
      if (req.user.role !== 'admin' && req.user.uid !== orderObj.user_id) {
        delete orderObj.delivery_otp;
      }
      return orderObj;
    }) });
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

// Verify OTP and Mark Delivered
router.post('/:id/verify-otp', async (req, res) => {
  try {
    const isStaff = ['admin', 'delivery'].includes(req.user.role);
    if (!isStaff) {
      return res.status(403).json({ success: false, error: 'Forbidden: Delivery staff only' });
    }
    
    const { otp } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
    
    // Check college authorization for delivery staff
    if (req.user.role === 'delivery' && order.college_id !== req.user.staff_college_id) {
      return res.status(403).json({ success: false, error: 'Forbidden: Order not assigned to your college' });
    }

    if (order.delivery_otp !== otp) {
      return res.status(400).json({ success: false, error: 'Invalid OTP' });
    }

    order.order_status = 'delivered';
    const updatedOrder = await order.save();
    
    res.json({ success: true, order: updatedOrder });
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

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

    if (req.user.role === 'store_owner' && order.store_id !== req.user.staff_store_id) {
      return res.status(403).json({ success: false, error: 'Forbidden: Order not from your store' });
    }
    if (req.user.role === 'delivery' && order.college_id !== req.user.staff_college_id) {
      return res.status(403).json({ success: false, error: 'Forbidden: Order not to your college' });
    }

    const validTransitions = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['preparing', 'cancelled'],
      preparing: ['ready', 'cancelled'],
      ready: ['out_for_delivery', 'picked_up', 'cancelled'],
      out_for_delivery: ['delivered', 'cancelled'],
      picked_up: ['delivered', 'cancelled'],
      delivered: [],
      cancelled: []
    };

    // Skip validation for admin to allow overriding
    if (req.user.role !== 'admin') {
      const allowedNextStates = validTransitions[order.order_status] || [];
      if (!allowedNextStates.includes(order_status)) {
        return res.status(400).json({ 
          success: false, 
          error: `Invalid status transition from ${order.order_status} to ${order_status}` 
        });
      }
    }

    order.order_status = order_status;
    const updatedOrder = await order.save();

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
