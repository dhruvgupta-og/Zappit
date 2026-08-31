const express = require('express');
const router = express.Router();
const Store = require('../../models/Store');
const MenuItem = require('../../models/MenuItem');
const College = require('../../models/College');
const Banner = require('../../models/Banner');
const { getCache, setCache } = require('../../cache/redis');

// Get all stores
router.get('/', async (req, res) => {
  try {
    const cachedStores = await getCache('api:stores:all');
    if (cachedStores) {
      return res.json({ success: true, stores: cachedStores, cached: true });
    }

    const stores = await Store.find();
    // Fetch all menu items to support dish-level searching on the frontend
    const menuItems = await MenuItem.find();
    
    const storesWithSearchInfo = stores.map(s => {
      const storeObj = { id: s._id, ...s.toObject() };
      // Find all menu items belonging to this store and map their names to lowercase
      storeObj.menuItemsForSearch = menuItems
        .filter(m => m.store_id === s._id.toString() || m.store_id === s._id)
        .map(m => m.name.toLowerCase());
      return storeObj;
    });

    await setCache('api:stores:all', storesWithSearchInfo, 300); // Cache for 5 minutes
    res.json({ success: true, stores: storesWithSearchInfo, cached: false });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Public: Get all colleges (no auth needed for onboarding/profile)
router.get('/colleges/all', async (req, res) => {
  try {
    const cachedColleges = await getCache('api:colleges:all');
    if (cachedColleges) {
      return res.json({ success: true, colleges: cachedColleges, cached: true });
    }

    const colleges = await College.find();
    const collegesData = colleges.map(c => ({ id: c._id, ...c.toObject() }));
    
    await setCache('api:colleges:all', collegesData, 86400); // Cache for 24 hours
    res.json({ success: true, colleges: collegesData, cached: false });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Public: Get active banners (no auth needed for home page)
router.get('/banners/active', async (req, res) => {
  try {
    const cachedBanners = await getCache('api:banners:active');
    if (cachedBanners) {
      return res.json({ success: true, banners: cachedBanners, cached: true });
    }

    const banners = await Banner.find({ active: { $ne: false } });
    const bannersData = banners.map(b => ({ id: b._id, ...b.toObject() }));
    
    await setCache('api:banners:active', bannersData, 3600); // Cache for 1 hour
    res.json({ success: true, banners: bannersData, cached: false });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get single store with menu
router.get('/:id', async (req, res) => {
  try {
    const cacheKey = `api:store:${req.params.id}`;
    const cachedStoreData = await getCache(cacheKey);
    
    if (cachedStoreData) {
      return res.json({ success: true, ...cachedStoreData, cached: true });
    }

    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json({ success: false, message: 'Store not found' });
    
    const menu = await MenuItem.find({ store_id: req.params.id });
    
    const responseData = { 
      store: { id: store._id, ...store.toObject() }, 
      menu: menu.map(m => ({ id: m._id, ...m.toObject() })) 
    };

    await setCache(cacheKey, responseData, 300); // Cache for 5 minutes
    res.json({ success: true, ...responseData, cached: false });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
