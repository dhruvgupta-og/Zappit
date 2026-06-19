const express = require('express');
const router = express.Router();
const User = require('../../models/User');

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
    const data = { ...req.body };
    delete data._id; // prevent overwrite of _id via body

    const user = await User.findByIdAndUpdate(
      req.params.uid,
      { $set: data },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, user: { id: user._id, ...user.toObject() } });
  } catch (err) {
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
