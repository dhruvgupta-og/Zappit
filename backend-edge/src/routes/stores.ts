import { Hono } from 'hono';
import { getPrisma } from '../db';

const stores = new Hono<{ Bindings: { DB: D1Database } }>();

// GET /api/stores
stores.get('/', async (c) => {
  try {
    const prisma = getPrisma(c.env.DB);
    const collegeId = c.req.query('college_id');

    const where: any = {};
    if (collegeId) {
      where.collegeId = collegeId;
    }

    const allStores = await prisma.store.findMany({
      where,
      include: {
        menuItems: {
          select: { name: true },
        },
      },
    });

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
      menuItemsForSearch: s.menuItems.map((m) => m.name.toLowerCase()),
    }));

    return c.json({ success: true, stores: storesWithSearchInfo });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// GET /api/stores/colleges/all
stores.get('/colleges/all', async (c) => {
  try {
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

    return c.json({ success: true, colleges: collegesData });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// GET /api/stores/banners/active
stores.get('/banners/active', async (c) => {
  try {
    const prisma = getPrisma(c.env.DB);
    const collegeId = c.req.query('college_id');

    const where: any = { active: true };
    if (collegeId) {
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

    return c.json({ success: true, banners: bannersData });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// GET /api/stores/:id
stores.get('/:id', async (c) => {
  try {
    const prisma = getPrisma(c.env.DB);
    const id = c.req.param('id');

    const store = await prisma.store.findUnique({
      where: { id },
      include: {
        menuItems: true,
      },
    });

    if (!store) {
      return c.json({ success: false, message: 'Store not found' }, 404);
    }

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

    return c.json({ success: true, ...responseData });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

export default stores;

