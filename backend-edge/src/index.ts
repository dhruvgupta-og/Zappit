import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authMiddleware, AuthUser } from './auth';
import { getPrisma } from './db';
import stores from './routes/stores';
import orders from './routes/orders';
import admin from './routes/admin';
import users from './routes/users';

export type Bindings = {
  DB: D1Database;
  RAZORPAY_KEY_ID: string;
  RAZORPAY_KEY_SECRET: string;
  RAZORPAY_WEBHOOK_SECRET?: string;
};

const app = new Hono<{ Bindings: Bindings; Variables: { user: AuthUser } }>();

// ── CORS Middleware ──
app.use('*', cors({
  origin: (origin) => {
    if (!origin) return '*';
    const allowed = [
      'http://localhost:5173',
      'http://localhost:5174',
      'https://zappit.shop',
      'https://www.zappit.shop',
      'https://zappit-dun.vercel.app',
    ];
    const isRazorpay = /^https:\/\/([a-z0-9-]+\.)*razorpay\.com$/.test(origin);
    if (allowed.includes(origin) || isRazorpay) return origin;
    return '*';
  },
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'x-razorpay-signature'],
  exposeHeaders: ['Content-Length'],
  maxAge: 86400,
  credentials: true,
}));

// ── Health Checks ──
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    runtime: 'cloudflare-worker',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health', (c) => {
  return c.json({
    status: 'healthy',
    runtime: 'cloudflare-worker',
    timestamp: new Date().toISOString(),
  });
});

// ── App Status (Maintenance check for customer/partner apps) ──
app.get('/api/app-status', async (c) => {
  try {
    const prisma = getPrisma(c.env.DB);
    const config = await prisma.config.findUnique({ where: { key: 'maintenance' } });
    if (!config) return c.json({ success: true, isMaintenanceMode: false });
    const parsed = JSON.parse(config.value);
    return c.json({ success: true, isMaintenanceMode: parsed.isMaintenanceMode === true });
  } catch {
    return c.json({ success: true, isMaintenanceMode: false });
  }
});

// ── Auth Middleware Route Filters ──

// 1. Users routes: all protected
app.use('/api/users/*', authMiddleware);

// 2. Admin routes: protected, except public config reads (e.g. fees)
app.use('/api/admin/*', async (c, next) => {
  if (c.req.method === 'GET' && c.req.path.startsWith('/api/admin/config/')) {
    return next();
  }
  return authMiddleware(c, next);
});

// 3. Payment & Order protected routes
app.use('/api/create-order', authMiddleware);
app.use('/api/verify-payment', authMiddleware);
app.use('/api/verify-coupon', authMiddleware);
app.use('/api/orders', authMiddleware);
app.use('/api/orders/*', authMiddleware);
app.use('/api/send-status-notification', authMiddleware);
app.use('/api/get-coupons', authMiddleware);
app.use('/api/save-coupon', authMiddleware);
app.use('/api/delete-coupon', authMiddleware);

// ── Mount Sub-Routers ──
app.route('/api/stores', stores);
app.route('/api/users', users);
app.route('/api/admin', admin);

// Alias coupon endpoints to support both /api/get-coupons and /api/admin/get-coupons
app.get('/api/get-coupons', async (c) => {
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
});

app.post('/api/save-coupon', async (c) => {
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
});

app.post('/api/delete-coupon', async (c) => {
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
});

// Cache Flush Endpoint
app.post('/api/admin/flush-cache', (c) => {
  return c.json({ success: true, message: 'Edge Worker cache is synced automatically.' });
});

// Mount Orders & Payment routes at /api
app.route('/api', orders);

// ── Global Error & Not Found ──
app.notFound((c) => {
  return c.json({ success: false, error: 'Not Found' }, 404);
});

app.onError((err, c) => {
  console.error('Edge worker error:', err);
  return c.json({ success: false, error: err.message || 'Internal Server Error' }, 500);
});

export default app;

