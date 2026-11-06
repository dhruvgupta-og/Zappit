import { Hono } from 'hono';
import { getPrisma } from '../db';
import { AuthUser } from '../auth';
import { sendExpoPushNotification } from '../push';

const admin = new Hono<{ Bindings: { DB: D1Database }; Variables: { user: AuthUser } }>();

// GET /api/get-coupons
admin.get('/get-coupons', async (c) => {
  try {
    const prisma = getPrisma(c.env.DB);
    const list = await prisma.coupon.findMany();
    const mapped = list.map((cp) => ({
      id: cp.id,
      code: cp.code,
      discount_percent: cp.discountPercent,
      discount: cp.discount || cp.discountPercent,
      type: cp.type,
      minOrder: cp.minOrder,
      maxUses: cp.maxUses,
      college_id: cp.collegeId,
      once_per_user: cp.oncePerUser,
      active: cp.active,
    }));
    return c.json({ success: true, coupons: mapped });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/save-coupon
admin.post('/save-coupon', async (c) => {
  try {
    const user = c.get('user');
    if (!user || user.role !== 'admin') {
      return c.json({ success: false, error: 'Forbidden: Admins only' }, 403);
    }

    const body = await c.req.json();
    const { id, code, discount_percent, discount, type, minOrder, maxUses, college_id, once_per_user, active } = body;

    const resolvedDiscount = discount_percent !== undefined && discount_percent !== ''
      ? Number(discount_percent)
      : (discount !== undefined && discount !== '' ? Number(discount) : undefined);

    if (!code || resolvedDiscount === undefined || isNaN(resolvedDiscount)) {
      return c.json({ success: false, error: 'code and discount are required' }, 400);
    }

    const prisma = getPrisma(c.env.DB);
    const couponId = id || `COUPON-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const codeUpper = code.toUpperCase().trim();

    const data = {
      code: codeUpper,
      discountPercent: resolvedDiscount,
      discount: resolvedDiscount,
      type: type || 'percent',
      minOrder: Number(minOrder || 0),
      maxUses: maxUses ? Number(maxUses) : null,
      collegeId: college_id || 'all',
      oncePerUser: once_per_user !== false,
      active: active !== false,
    };

    const saved = await prisma.coupon.upsert({
      where: { code: codeUpper },
      create: { id: couponId, ...data },
      update: data,
    });

    return c.json({ success: true, message: 'Coupon saved', id: saved.id });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/delete-coupon
admin.post('/delete-coupon', async (c) => {
  try {
    const user = c.get('user');
    if (!user || user.role !== 'admin') {
      return c.json({ success: false, error: 'Forbidden: Admins only' }, 403);
    }

    const { id, code } = await c.req.json();
    if (!id && !code) return c.json({ success: false, error: 'id or code required' }, 400);

    const prisma = getPrisma(c.env.DB);
    if (code) {
      await prisma.coupon.deleteMany({ where: { code: code.toUpperCase().trim() } });
    } else {
      await prisma.coupon.deleteMany({ where: { id } });
    }

    return c.json({ success: true, message: 'Coupon deleted' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// GET /api/admin/config/:key (Public or admin)
admin.get('/config/:key', async (c) => {
  try {
    const key = c.req.param('key');
    const prisma = getPrisma(c.env.DB);
    const cfg = await prisma.config.findUnique({ where: { key } });
    if (!cfg) return c.json({ success: true, data: null });
    return c.json({ success: true, data: JSON.parse(cfg.value) });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/admin/config/:key
admin.post('/config/:key', async (c) => {
  try {
    const user = c.get('user');
    if (user?.role !== 'admin') return c.json({ success: false, error: 'Forbidden' }, 403);

    const key = c.req.param('key');
    const body = await c.req.json();
    const prisma = getPrisma(c.env.DB);

    await prisma.config.upsert({
      where: { key },
      create: { key, value: JSON.stringify(body) },
      update: { value: JSON.stringify(body) },
    });

    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// GET /api/admin/dashboard-stats
admin.get('/dashboard-stats', async (c) => {
  try {
    const user = c.get('user');
    if (user?.role !== 'admin') return c.json({ success: false, error: 'Forbidden' }, 403);

    const prisma = getPrisma(c.env.DB);
    const [totalOrders, totalStores, totalUsers, paidOrders] = await Promise.all([
      prisma.order.count({ where: { orderStatus: { not: 'cancelled' } } }),
      prisma.store.count(),
      prisma.user.count(),
      prisma.order.findMany({
        where: { orderStatus: 'delivered', paymentStatus: 'paid' },
        select: { totalAmount: true },
      }),
    ]);

    const totalRevenue = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0);

    return c.json({
      success: true,
      totalOrders,
      totalStores,
      totalUsers,
      totalRevenue,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/admin/menu
admin.post('/menu', async (c) => {
  try {
    const user = c.get('user');
    const allowed = ['admin', 'store_owner'].includes(user?.role);
    if (!allowed) return c.json({ success: false, error: 'Forbidden' }, 403);

    const data = await c.req.json();
    const prisma = getPrisma(c.env.DB);
    const id = data.id || data._id || `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const saved = await prisma.menuItem.upsert({
      where: { id },
      create: {
        id,
        storeId: data.store_id || data.storeId,
        name: data.name,
        price: Number(data.price),
        desc: data.desc || '',
        category: data.category || 'Other',
        isVeg: data.isVeg !== false,
        image: data.image || '',
        isAvailable: data.is_available !== false,
      },
      update: {
        name: data.name,
        price: Number(data.price),
        desc: data.desc,
        category: data.category,
        isVeg: data.isVeg !== false,
        image: data.image,
        isAvailable: data.is_available !== false,
      },
    });

    return c.json({ success: true, menuItem: saved });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/admin/send-broadcast-notification
admin.post('/send-broadcast-notification', async (c) => {
  try {
    const user = c.get('user');
    if (user?.role !== 'admin') return c.json({ success: false, error: 'Forbidden: Admins only' }, 403);

    const { title, body, college_id } = await c.req.json();
    if (!title || !body) return c.json({ success: false, error: 'Title and body required' }, 400);

    const prisma = getPrisma(c.env.DB);
    const where: any = { expoPushToken: { not: null } };
    if (college_id && college_id !== 'all') where.collegeId = college_id;

    const usersWithToken = await prisma.user.findMany({
      where,
      select: { expoPushToken: true },
    });

    const tokens = usersWithToken.map((u) => u.expoPushToken!).filter(Boolean);
    if (tokens.length > 0) {
      await sendExpoPushNotification(tokens, title, body, { type: 'broadcast' });
    }

    return c.json({ success: true, sentCount: tokens.length });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

export default admin;

