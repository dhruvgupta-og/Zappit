import { Hono } from 'hono';
import { getPrisma } from '../db';
import { AuthUser } from '../auth';
import { sendExpoPushNotification } from '../push';

const admin = new Hono<{ Bindings: { DB: D1Database }; Variables: { user: AuthUser } }>();

// GET /api/get-coupons
admin.get('/get-coupons', async (c) => {
  try {
    const user = c.get('user');
    if (user?.role !== 'admin') return c.json({ success: false, error: 'Forbidden' }, 403);

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
    const user = c.get('user');
    // 'fees', 'maintenance', and 'app_version' are public configs. Any other key requires admin.
    if (!['fees', 'maintenance', 'app_version'].includes(key) && user?.role !== 'admin') {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }
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

    // Auto-cancel any lingering unpaid pending orders older than 5 minutes
    try {
      const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
      await prisma.order.updateMany({
        where: {
          paymentStatus: 'pending',
          orderStatus: { not: 'cancelled' },
          createdAt: { lt: fiveMinsAgo },
        },
        data: { orderStatus: 'cancelled' },
      });
    } catch (e) {
      console.warn('Dashboard stats cleanup warning:', e);
    }

    const [paidOrdersCount, totalStores, totalUsers, paidOrders] = await Promise.all([
      prisma.order.count({
        where: {
          paymentStatus: { in: ['paid', 'completed'] },
          orderStatus: { not: 'cancelled' },
        },
      }),
      prisma.store.count(),
      prisma.user.count(),
      prisma.order.findMany({
        where: {
          paymentStatus: { in: ['paid', 'completed'] },
          orderStatus: { not: 'cancelled' },
        },
        select: { totalAmount: true },
      }),
    ]);

    const totalRevenue = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0);

    return c.json({
      success: true,
      totalOrders: paidOrdersCount,
      totalStores,
      totalUsers,
      totalRevenue,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// GET /api/admin/analytics (Comprehensive Analytics for Admin Dashboard)
admin.get('/analytics', async (c) => {
  try {
    const user = c.get('user');
    if (user?.role !== 'admin') return c.json({ success: false, error: 'Forbidden' }, 403);

    const prisma = getPrisma(c.env.DB);
    const dateRange = c.req.query('dateRange') || 'all';
    const storeId = c.req.query('storeId');

    const [orders, allUsers, allStores, allStaff] = await Promise.all([
      prisma.order.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.user.findMany(),
      prisma.store.findMany(),
      prisma.staff.findMany(),
    ]);

    // Compute date bounds if specified
    const now = new Date();
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    if (dateRange === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (dateRange === 'yesterday') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
    } else if (dateRange === 'this_week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      startDate = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0);
      endDate = new Date();
    } else if (dateRange === 'last_week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1) - 7;
      startDate = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), diff + 6, 23, 59, 59, 999);
    } else if (dateRange === 'this_month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      endDate = new Date();
    } else if (dateRange === 'last_month') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    }

    let scopedOrders = orders;
    if (startDate && endDate) {
      scopedOrders = scopedOrders.filter((o) => o.createdAt >= startDate! && o.createdAt <= endDate!);
    }
    if (storeId && storeId !== 'all') {
      scopedOrders = scopedOrders.filter((o) => o.storeId === storeId);
    }

    // Filter to only paid orders (and cancelled orders for cancellation metrics)
    const paidOrders = scopedOrders.filter((o) => ['paid', 'completed'].includes(o.paymentStatus) && o.orderStatus !== 'cancelled');
    const completedOrders = scopedOrders.filter((o) => o.orderStatus === 'delivered' && ['paid', 'completed'].includes(o.paymentStatus)).length;
    const acceptedOrders = paidOrders.length;
    const preparingOrders = scopedOrders.filter((o) => o.orderStatus === 'preparing' && ['paid', 'completed'].includes(o.paymentStatus)).length;
    const readyOrders = scopedOrders.filter((o) => o.orderStatus === 'ready' && ['paid', 'completed'].includes(o.paymentStatus)).length;
    const outForDeliveryOrders = scopedOrders.filter((o) => o.orderStatus === 'out_for_delivery' && ['paid', 'completed'].includes(o.paymentStatus)).length;
    const cancelledOrders = scopedOrders.filter((o) => o.orderStatus === 'cancelled').length;
    const totalOrdersPlaced = paidOrders.length;
    const cancellationRate = totalOrdersPlaced > 0 ? ((cancelledOrders / (totalOrdersPlaced + cancelledOrders)) * 100).toFixed(1) : '0.0';

    // Grouping
    const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const ordersByWeekday: Record<string, number> = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };
    let totalItemsCount = 0;
    let totalDeliveredValue = 0;

    paidOrders.forEach((o) => {
      const d = o.createdAt;
      const weekday = weekdayNames[d.getDay()];
      ordersByWeekday[weekday] = (ordersByWeekday[weekday] || 0) + 1;

      try {
        const parsedItems = JSON.parse(o.items || '[]');
        if (Array.isArray(parsedItems)) {
          totalItemsCount += parsedItems.reduce((sum: number, it: any) => sum + Number(it.qty || 1), 0);
        }
      } catch {}

      if (o.orderStatus === 'delivered') {
        totalDeliveredValue += o.totalAmount;
      }
    });

    const averageOrderValue = completedOrders > 0
      ? Math.round(totalDeliveredValue / completedOrders)
      : (paidOrders.length > 0 ? Math.round(paidOrders.reduce((sum, o) => sum + o.totalAmount, 0) / paidOrders.length) : 0);

    const averageItemsPerOrder = paidOrders.length > 0 ? (totalItemsCount / paidOrders.length).toFixed(1) : '0.0';

    // Customer Metrics
    const userOrderCounts: Record<string, number> = {};
    paidOrders.forEach((o) => {
      if (o.userId) userOrderCounts[o.userId] = (userOrderCounts[o.userId] || 0) + 1;
    });
    const uniqueOrderingCustomers = Object.keys(userOrderCounts).length;
    const repeatCustomers = Object.values(userOrderCounts).filter((c) => c > 1).length;
    const repeatRate = uniqueOrderingCustomers > 0 ? ((repeatCustomers / uniqueOrderingCustomers) * 100).toFixed(1) : '0.0';

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const activeDaily = new Set(paidOrders.filter((o) => o.createdAt >= oneDayAgo).map((o) => o.userId)).size;
    const activeWeekly = new Set(paidOrders.filter((o) => o.createdAt >= sevenDaysAgo).map((o) => o.userId)).size;
    const activeMonthly = new Set(paidOrders.filter((o) => o.createdAt >= thirtyDaysAgo).map((o) => o.userId)).size;

    // Delivery Metrics
    const totalRiders = allStaff.filter((s) => s.role === 'delivery').length;
    const riderEstimatedPayout = completedOrders * 10;

    // Store Performance
    const storeStats: Record<string, any> = {};
    allStores.forEach((st) => {
      const sOrders = paidOrders.filter((o) => o.storeId === st.id);
      const sDelivered = sOrders.filter((o) => o.orderStatus === 'delivered').length;
      const sSales = sOrders.reduce((sum, o) => sum + o.totalAmount, 0);
      storeStats[st.name] = {
        totalOrders: sOrders.length,
        delivered: sDelivered,
        sales: sSales,
      };
    });

    // Finance Metrics (from delivered paid orders)
    const deliveredList = scopedOrders.filter((o) => o.orderStatus === 'delivered' && ['paid', 'completed'].includes(o.paymentStatus));
    const gmv = deliveredList.reduce((sum, o) => sum + o.totalAmount, 0);
    const deliveryFeesCollected = deliveredList.length * 20;
    const platformFeesCollected = deliveredList.length * 5;
    const zappitDiscounts = deliveredList.reduce((sum, o) => sum + o.discountAmount, 0);
    const totalContribution = platformFeesCollected - zappitDiscounts;
    const contributionPerOrder = deliveredList.length > 0 ? Math.round(totalContribution / deliveredList.length) : 0;

    // Growth Metrics
    const couponUsageCount = paidOrders.filter((o) => o.couponApplied).length;
    const estimatedStudentsReached = allUsers.length * 4;

    // Live Operations (Today)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayOrders = paidOrders.filter((o) => o.createdAt >= todayStart);

    return c.json({
      success: true,
      orders: {
        totalOrdersPlaced,
        completedOrders,
        acceptedOrders,
        preparingOrders,
        readyOrders,
        outForDeliveryOrders,
        cancelledOrders,
        cancellationRate,
        averageOrderValue,
        averageItemsPerOrder,
        ordersByWeekday,
      },
      customers: {
        totalRegisteredUsers: allUsers.length,
        uniqueOrderingCustomers,
        repeatCustomers,
        repeatRate,
        activeDaily,
        activeWeekly,
        activeMonthly,
      },
      delivery: {
        avgDeliveryTime: '15 mins',
        avgPrepTime: '10 mins',
        riderEstimatedPayout,
        avgPayoutPerDelivery: 10,
      },
      storePerformance: {
        totalActiveStores: allStores.filter((s) => s.isOpen).length,
        storeStats,
      },
      finance: {
        gmv,
        totalContribution,
        platformFeesCollected,
        deliveryFeesCollected,
        zappitDiscounts,
        contributionPerOrder,
      },
      growth: {
        estimatedStudentsReached,
        couponUsageCount,
        referralUsage: 0,
        cac: 0,
      },
      liveOperations: {
        ordersReceivedToday: todayOrders.length,
        completedOrdersToday: todayOrders.filter((o) => o.orderStatus === 'delivered').length,
        liveAwaitingAcceptance: 0,
        livePreparing: todayOrders.filter((o) => o.orderStatus === 'preparing').length,
        liveReady: todayOrders.filter((o) => o.orderStatus === 'ready').length,
        liveOutForDelivery: todayOrders.filter((o) => o.orderStatus === 'out_for_delivery').length,
      },
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

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.price !== undefined && !isNaN(Number(data.price))) updateData.price = Number(data.price);
    if (data.desc !== undefined) updateData.desc = data.desc;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.isVeg !== undefined) updateData.isVeg = data.isVeg !== false;
    if (data.image !== undefined) updateData.image = data.image;
    if (data.is_available !== undefined) updateData.isAvailable = data.is_available === true;
    if (data.isAvailable !== undefined) updateData.isAvailable = data.isAvailable === true;

    const saved = await prisma.menuItem.upsert({
      where: { id },
      create: {
        id,
        storeId: data.store_id || data.storeId,
        name: data.name || 'Item',
        price: Number(data.price || 0),
        desc: data.desc || '',
        category: data.category || 'Other',
        isVeg: data.isVeg !== false,
        image: data.image || '',
        isAvailable: data.is_available !== false && data.isAvailable !== false,
      },
      update: updateData,
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

