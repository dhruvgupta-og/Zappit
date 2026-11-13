import { Hono } from 'hono';
import { getPrisma } from '../db';
import { getCached, setCached } from '../cache';

const stores = new Hono<{ Bindings: { DB: D1Database } }>();

// Helper to get active kitchen counts cached for 12 seconds
async function getCachedActiveKitchenCounts(prisma: any): Promise<Record<string, number>> {
  const cacheKey = 'active_kitchen_counts';
  const cached = getCached<Record<string, number>>(cacheKey);
  if (cached) return cached;

  const activeKitchenOrders = await prisma.order.findMany({
    where: {
      orderStatus: { in: ['confirmed', 'preparing', 'ready'] },
      paymentStatus: { in: ['paid', 'completed'] },
    },
    select: { storeId: true },
  });

  const activeCountsByStore: Record<string, number> = {};
  for (const ord of activeKitchenOrders) {
    activeCountsByStore[ord.storeId] = (activeCountsByStore[ord.storeId] || 0) + 1;
  }

  setCached(cacheKey, activeCountsByStore, 12000);
  return activeCountsByStore;
}

// GET /api/stores
stores.get('/', async (c) => {
  try {
    const collegeId = c.req.query('college_id') || 'all';
    const cacheKey = `stores_${collegeId}`;

    // 1. Fast in-memory hit
    const memoryHit = getCached<any>(cacheKey);
    if (memoryHit) {
      c.header('Cache-Control', 'public, max-age=5, s-maxage=10, stale-while-revalidate=30');
      c.header('X-Cache', 'HIT-MEMORY');
      return c.json({ success: true, stores: memoryHit });
    }

    const prisma = getPrisma(c.env.DB);
    const where: any = {};
    if (collegeId && collegeId !== 'all') {
      where.collegeId = collegeId;
    }

    const [allStores, activeCountsByStore] = await Promise.all([
      prisma.store.findMany({
        where,
        include: {
          menuItems: {
            select: { name: true },
          },
        },
      }),
      getCachedActiveKitchenCounts(prisma),
    ]);

    const storesWithSearchInfo = allStores.map((s) => ({
      id: s.id,
      _id: s.id,
      name: s.name,
      description: s.description,
      image: s.image,
      rating: s.rating,
      delivery_time_mins: s.deliveryTimeMins,
      is_open: s.isOpen,
      tags: JSON.parse(s.tags || '[]'),
      college_id: s.collegeId,
      active_orders_count: activeCountsByStore[s.id] || 0,
      menuItemsForSearch: s.menuItems.map((m) => m.name.toLowerCase()),
    }));

    // Save to memory cache for 8 seconds
    setCached(cacheKey, storesWithSearchInfo, 8000);

    c.header('Cache-Control', 'public, max-age=5, s-maxage=10, stale-while-revalidate=30');
    c.header('X-Cache', 'MISS');
    return c.json({ success: true, stores: storesWithSearchInfo });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// GET /api/stores/colleges/all
stores.get('/colleges/all', async (c) => {
  try {
    const cacheKey = 'colleges_all';
    const cached = getCached<any>(cacheKey);
    if (cached) {
      c.header('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=120');
      c.header('X-Cache', 'HIT-MEMORY');
      return c.json({ success: true, colleges: cached });
    }

    const prisma = getPrisma(c.env.DB);
    const colleges = await prisma.college.findMany({
      where: { isActive: true },
      include: { blocks: true },
    });

    const collegesData = colleges.map((col) => ({
      id: col.id,
      _id: col.id,
      name: col.name,
      city: col.city,
      isActive: col.isActive,
      blocks: col.blocks.map((b) => ({
        id: b.id,
        name: b.name,
        deliveryFee: b.deliveryFee,
      })),
    }));

    setCached(cacheKey, collegesData, 60000);

    c.header('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=120');
    c.header('X-Cache', 'MISS');
    return c.json({ success: true, colleges: collegesData });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// GET /api/stores/banners/active
stores.get('/banners/active', async (c) => {
  try {
    const collegeId = c.req.query('college_id') || 'all';
    const cacheKey = `banners_${collegeId}`;
    const cached = getCached<any>(cacheKey);
    if (cached) {
      c.header('Cache-Control', 'public, max-age=15, s-maxage=30, stale-while-revalidate=60');
      c.header('X-Cache', 'HIT-MEMORY');
      return c.json({ success: true, banners: cached });
    }

    const prisma = getPrisma(c.env.DB);
    const where: any = { active: true };
    if (collegeId && collegeId !== 'all') {
      where.OR = [{ collegeId: 'all' }, { collegeId }];
    }

    const banners = await prisma.banner.findMany({ where });

    const bannersData = banners.map((b) => ({
      id: b.id,
      _id: b.id,
      imageUrl: b.imageUrl,
      coupon_code: b.couponCode,
      collegeId: b.collegeId,
      active: b.active,
    }));

    setCached(cacheKey, bannersData, 30000);

    c.header('Cache-Control', 'public, max-age=15, s-maxage=30, stale-while-revalidate=60');
    c.header('X-Cache', 'MISS');
    return c.json({ success: true, banners: bannersData });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// GET /api/stores/:id
stores.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const cacheKey = `store_detail_${id}`;
    const cached = getCached<any>(cacheKey);
    if (cached) {
      c.header('Cache-Control', 'public, max-age=5, s-maxage=10, stale-while-revalidate=20');
      c.header('X-Cache', 'HIT-MEMORY');
      return c.json({ success: true, ...cached });
    }

    const prisma = getPrisma(c.env.DB);

    const store = await prisma.store.findUnique({
      where: { id },
      include: {
        menuItems: true,
      },
    });

    if (!store) {
      return c.json({ success: false, message: 'Store not found' }, 404);
    }

    const activeCountsByStore = await getCachedActiveKitchenCounts(prisma);
    const activeOrdersCount = activeCountsByStore[store.id] || 0;

    const responseData = {
      store: {
        id: store.id,
        _id: store.id,
        name: store.name,
        description: store.description,
        image: store.image,
        rating: store.rating,
        delivery_time_mins: store.deliveryTimeMins,
        is_open: store.isOpen,
        active_orders_count: activeOrdersCount,
        tags: JSON.parse(store.tags || '[]'),
        college_id: store.collegeId,
      },
      menu: store.menuItems.map((m) => ({
        id: m.id,
        _id: m.id,
        store_id: m.storeId,
        name: m.name,
        price: m.price,
        desc: m.desc,
        category: m.category,
        isVeg: m.isVeg,
        image: m.image,
        is_available: m.isAvailable,
      })),
    };

    setCached(cacheKey, responseData, 8000);

    c.header('Cache-Control', 'public, max-age=5, s-maxage=10, stale-while-revalidate=20');
    c.header('X-Cache', 'MISS');
    return c.json({ success: true, ...responseData });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

export default stores;
