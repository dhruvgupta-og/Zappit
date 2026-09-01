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
const { clearCache } = require('../../cache/redis');

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

// --- DASHBOARD STATS ---
router.get('/dashboard-stats', async (req, res) => {
  if (!['admin'].includes(req.user?.role)) {
    return res.status(403).json({ success: false, error: 'Forbidden: Admins only' });
  }
  try {
    const Order = require('../../models/Order');
    const User = require('../../models/User');
    const [totalOrders, totalStores, totalUsers, revenueAgg] = await Promise.all([
      Order.countDocuments({ order_status: { $ne: 'cancelled' } }),
      Store.countDocuments(),
      User.countDocuments(),
      Order.aggregate([
        { $match: { order_status: 'delivered', payment_status: { $in: ['completed', 'paid'] } } },
        { $group: { _id: null, total: { $sum: '$total_amount' } } }
      ])
    ]);
    res.json({
      success: true,
      totalOrders,
      totalStores,
      totalUsers,
      totalRevenue: revenueAgg[0]?.total || 0
    });
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

// --- FLUSH CACHE (Admin only) ---
router.post('/flush-cache', async (req, res) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Forbidden: Admins only' });
  }
  try {
    const keys = req.body.keys || ['api:colleges:all', 'api:banners:active', 'api:stores:all'];
    for (const key of keys) {
      await clearCache(key);
    }
    res.json({ success: true, message: `Cleared cache keys: ${keys.join(', ')}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- BROADCAST PUSH NOTIFICATION ---
router.post('/send-broadcast-notification', async (req, res) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Forbidden: Admins only' });
  }
  try {
    const { title, body, college_id } = req.body;
    if (!title || !body) {
      return res.status(400).json({ success: false, error: 'Title and body are required.' });
    }

    const User = require('../../models/User');
    const query = { fcmToken: { $exists: true, $ne: null } };
    if (college_id) query.college_id = college_id;

    const users = await User.find(query).select('fcmToken name');
    if (users.length === 0) {
      return res.json({ success: true, sent: 0, message: 'No users with push tokens found.' });
    }

    // Send in batches of 500 (FCM limit per multicast)
    const BATCH_SIZE = 500;
    let totalSent = 0;
    let totalFailed = 0;

    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);
      const tokens = batch.map(u => u.fcmToken).filter(Boolean);
      if (tokens.length === 0) continue;

      try {
        const response = await admin.messaging().sendEachForMulticast({
          tokens,
          notification: { title, body },
          android: {
            notification: {
              icon: 'notification_icon',
              color: '#FFD60A',
              sound: 'default',
            },
            priority: 'high',
          },
          data: { type: 'broadcast', title, body },
        });
        totalSent += response.successCount;
        totalFailed += response.failureCount;
      } catch (batchErr) {
        console.error('[Broadcast] Batch error:', batchErr.message);
        totalFailed += tokens.length;
      }
    }

    console.log(`[Broadcast] Sent: ${totalSent}, Failed: ${totalFailed}, Total users: ${users.length}`);
    res.json({ success: true, sent: totalSent, failed: totalFailed, total: users.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
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
    await clearCache('api:colleges:all'); // Invalidate cache so apps reflect changes
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

    if (collection === 'colleges') {
      await College.findByIdAndDelete(id);
      await clearCache('api:colleges:all'); // Invalidate cache
    }
    if (collection === 'banners') {
      await Banner.findByIdAndDelete(id);
      await clearCache('api:banners:active'); // Invalidate cache
    }
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
    await clearCache('api:banners:active'); // Invalidate banner cache
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
const ALLOWED_CONFIG_KEYS = ['fees'];
router.post('/config/:key', async (req, res) => {
  try {
    // M3: Only allow known config keys — prevent arbitrary key creation/overwrite
    if (!ALLOWED_CONFIG_KEYS.includes(req.params.key)) {
      return res.status(400).json({ success: false, error: `Unknown config key: ${req.params.key}` });
    }
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
