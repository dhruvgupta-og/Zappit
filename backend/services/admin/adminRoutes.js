const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const College = require('../../models/College');
const Banner = require('../../models/Banner');
const Store = require('../../models/Store');
const MenuItem = require('../../models/MenuItem');

const generateId = () => new mongoose.Types.ObjectId().toString();

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
    if (collection === 'colleges') await College.findByIdAndDelete(id);
    if (collection === 'banners') await Banner.findByIdAndDelete(id);
    if (collection === 'stores') await Store.findByIdAndDelete(id);
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
router.post('/stores', async (req, res) => {
  try {
    const data = { ...req.body };
    if (!data.id && !data._id) data._id = generateId();
    else if (data.id) data._id = data.id;

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

    const updateData = { ...data };
    delete updateData._id;
    delete updateData.id;

    const newMenuItem = await MenuItem.findByIdAndUpdate(data._id, updateData, { upsert: true, new: true, setDefaultsOnInsert: true });
    res.json({ success: true, menuItem: newMenuItem });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
