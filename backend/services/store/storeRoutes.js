const express = require('express');
const router = express.Router();
const Store = require('../../models/Store');
const MenuItem = require('../../models/MenuItem');
const College = require('../../models/College');
const Banner = require('../../models/Banner');

// Get all stores
router.get('/', async (req, res) => {
  try {
    const stores = await Store.find();
    res.json({ success: true, stores: stores.map(s => ({ id: s._id, ...s.toObject() })) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Public: Get all colleges (no auth needed for onboarding/profile)
router.get('/colleges/all', async (req, res) => {
  try {
    const colleges = await College.find();
    res.json({ success: true, colleges: colleges.map(c => ({ id: c._id, ...c.toObject() })) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Public: Get active banners (no auth needed for home page)
router.get('/banners/active', async (req, res) => {
  try {
    const banners = await Banner.find({ active: { $ne: false } });
    res.json({ success: true, banners: banners.map(b => ({ id: b._id, ...b.toObject() })) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get single store with menu
router.get('/:id', async (req, res) => {
  try {
    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json({ success: false, message: 'Store not found' });
    
    const menu = await MenuItem.find({ store_id: req.params.id });
    
    res.json({ success: true, store: { id: store._id, ...store.toObject() }, menu: menu.map(m => ({ id: m._id, ...m.toObject() })) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
