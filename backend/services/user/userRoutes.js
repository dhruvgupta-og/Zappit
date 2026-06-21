const express = require('express');
const router = express.Router();
const User = require('../../models/User');

// GET staff info safely
router.get('/me/staff', async (req, res) => {
  res.json({
    success: true,
    role: req.user.role,
    store_id: req.user.staff_store_id,
    college_id: req.user.staff_college_id
  });
});

// Middleware to ensure a user only accesses/modifies their own profile (unless admin)
router.use('/:uid', (req, res, next) => {
  if (req.user.uid !== req.params.uid && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Forbidden: You can only access your own profile' });
  }
  next();
});

// GET user profile by UID
router.get('/:uid', async (req, res) => {
  try {
    const user = await User.findById(req.params.uid);
    if (!user) {
      return res.json({ success: true, user: null, exists: false });
    }
    res.json({ success: true, user: { id: user._id, ...user.toObject() }, exists: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST save/update user profile
router.post('/:uid', async (req, res) => {
  try {
    let data = { ...req.body };
    delete data._id; // prevent overwrite of _id via body

    // Prevent mass assignment: non-admins cannot change role or blocked status
    if (req.user.role !== 'admin') {
      const allowedFields = ['uid', 'email', 'name', 'phone', 'college_id', 'college', 'college_name', 'address', 'profile_complete', 'auth_method', 'fcmToken', 'updated_at'];
      const filteredData = {};
      for (const key of Object.keys(data)) {
        if (allowedFields.includes(key)) {
          filteredData[key] = data[key];
        }
      }
      data = filteredData;
    }

    const user = await User.findByIdAndUpdate(
      req.params.uid,
      { $set: data },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, user: { id: user._id, ...user.toObject() } });
  } catch (err) {
    // Handle MongoDB duplicate key error (e.g. phone number already registered)
    if (err.code === 11000 && err.keyPattern && err.keyPattern.phone) {
      return res.status(400).json({ 
        success: false, 
        error: 'This phone number is already registered to another account. Please use a different phone number or log in using OTP.' 
      });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST track coupon usage (single-use coupons)
router.post('/:uid/track-coupon', async (req, res) => {
  try {
    const { code } = req.body;
    await User.findByIdAndUpdate(
      req.params.uid,
      { $addToSet: { used_coupons: code } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
