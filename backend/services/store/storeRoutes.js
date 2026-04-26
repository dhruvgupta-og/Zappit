const express = require('express');
const router = express.Router();
const Store = require('../../models/Store');
const MenuItem = require('../../models/MenuItem');

// Get all stores
router.get('/', async (req, res) => {
  try {
    const stores = await Store.find();
    res.json({ success: true, stores });
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
    
    res.json({ success: true, store, menu });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
