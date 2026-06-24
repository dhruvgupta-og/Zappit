const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const College = require('../../models/College');
const Banner = require('../../models/Banner');
const Store = require('../../models/Store');
const MenuItem = require('../../models/MenuItem');
const Config = require('../../models/Config');
const { admin } = require('../../firebase');
const Staff = require('../../models/Staff');

const generateId = () => new mongoose.Types.ObjectId().toString();

// --- PUBLIC ROUTES (No Admin required) ---
router.get('/config/:key', async (req, res) => {
  try {
    const config = await Config.findById(req.params.key);
    res.json({ success: true, data: config || null });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Route Guard
router.use((req, res, next) => {
  const allowedRoles = ['admin', 'store_owner'];
  if (!allowedRoles.includes(req.user?.role)) {
    return res.status(403).json({ success: false, error: 'Forbidden: Admins/Store Owners only' });
  }
  
  // Restrict store_owner from accessing anything other than stores, menu, and delete
  if (req.user.role === 'store_owner') {
    const allowedPaths = ['/stores', '/menu', '/delete'];
    if (!allowedPaths.includes(req.path)) {
      return res.status(403).json({ success: false, error: 'Forbidden: Store Owners can only manage their own stores and menu' });
    }
  }
  
  next();
});

// --- COLLEGES ---
router.get('/colleges', async (req, res) => {
  try {
    const colleges = await College.find();
    res.json({ success: true, colleges: colleges.map(c => ({ id: c._id, ...c.toObject() })) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/colleges', async (req, res) => {
  try {
    const data = { ...req.body };
    if (!data.id && !data._id) data._id = generateId();
    else if (data.id) data._id = data.id;

    const updateData = { ...data };
    delete updateData._id;
    delete updateData.id;

    const newCollege = await College.findByIdAndUpdate(data._id, updateData, { upsert: true, new: true, setDefaultsOnInsert: true });
    res.json({ success: true, college: newCollege });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/delete', async (req, res) => {
  try {
    const { collection, id } = req.body;
    
    if (req.user.role === 'store_owner') {
      if (collection !== 'menu') {
        return res.status(403).json({ success: false, error: 'Forbidden: Store Owners can only delete menu items' });
      }
      const item = await MenuItem.findById(id);
      if (!item || item.store_id !== req.user.staff_store_id) {
        return res.status(403).json({ success: false, error: 'Forbidden: Item does not belong to your store' });
      }
    }

    if (collection === 'colleges') await College.findByIdAndDelete(id);
    if (collection === 'banners') await Banner.findByIdAndDelete(id);
    if (collection === 'stores') {
      // Delete the store
      await Store.findByIdAndDelete(id);
      // Also delete all menu items for this store
      await MenuItem.deleteMany({ store_id: id });
      // Also delete the Staff profile linked to this store
      await Staff.deleteMany({ store_id: id });
    }
    if (collection === 'menu') await MenuItem.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- BANNERS ---
router.get('/banners', async (req, res) => {
  try {
    const banners = await Banner.find();
    res.json({ success: true, banners: banners.map(b => ({ id: b._id, ...b.toObject() })) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/banners', async (req, res) => {
  try {
    const data = { ...req.body };
    if (!data.id && !data._id) data._id = generateId();
    else if (data.id) data._id = data.id;

    const updateData = { ...data };
    delete updateData._id;
    delete updateData.id;

    const newBanner = await Banner.findByIdAndUpdate(data._id, updateData, { upsert: true, new: true, setDefaultsOnInsert: true });
    res.json({ success: true, banner: newBanner });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- STORES ---
router.post('/create-store-owner', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden: Admins only' });
    }

    // 1. Create Firebase Auth User
    let userRecord;
    try {
      userRecord = await admin.auth().createUser({
        email,
        password,
      });
    } catch (authErr) {
      return res.status(400).json({ success: false, error: authErr.message });
    }

    // 2. Create Store in MongoDB
    const storeName = email.split('@')[0];
    const storeId = generateId();
    const newStore = await Store.create({
      _id: storeId,
      name: storeName,
    });

    // 3. Create Staff profile
    const newStaff = await Staff.create({
      _id: userRecord.uid,
      role: 'store_owner',
      name: storeName + ' Owner',
      email: email,
      store_id: storeId,
      store_name: storeName
    });

    res.json({ success: true, store: newStore, staff: newStaff });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/stores', async (req, res) => {
  try {
    const data = { ...req.body };
    if (!data.id && !data._id) data._id = generateId();
    else if (data.id) data._id = data.id;

    if (req.user.role === 'store_owner' && data._id !== req.user.staff_store_id) {
      return res.status(403).json({ success: false, error: 'Forbidden: You can only update your own store' });
    }

    const updateData = { ...data };
    delete updateData._id;
    delete updateData.id;

    const newStore = await Store.findByIdAndUpdate(data._id, updateData, { upsert: true, new: true, setDefaultsOnInsert: true });
    res.json({ success: true, store: newStore });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- MENU ---
router.post('/menu', async (req, res) => {
  try {
    const data = { ...req.body };
    if (!data.id && !data._id) data._id = generateId();
    else if (data.id) data._id = data.id;

    if (req.user.role === 'store_owner') {
      if (data.store_id !== req.user.staff_store_id) {
        return res.status(403).json({ success: false, error: 'Forbidden: You can only update menu items for your own store' });
      }

      // Prevent hijacking existing items from other stores by checking the database first
      if (data._id) {
        const existingItem = await MenuItem.findById(data._id);
        if (existingItem && existingItem.store_id !== req.user.staff_store_id) {
           return res.status(403).json({ success: false, error: 'Forbidden: Cannot hijack menu item from another store' });
        }
      }
    }

    const updateData = { ...data };
    delete updateData._id;
    delete updateData.id;

    const newMenuItem = await MenuItem.findByIdAndUpdate(data._id, updateData, { upsert: true, new: true, setDefaultsOnInsert: true });
    res.json({ success: true, menuItem: newMenuItem });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- CONFIG / FEES ---
router.post('/config/:key', async (req, res) => {
  try {
    const updated = await Config.findByIdAndUpdate(
      req.params.key,
      { _id: req.params.key, ...req.body },
      { upsert: true, new: true }
    );
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
