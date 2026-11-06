import { Hono } from 'hono';
import { getPrisma } from '../db';
import { createRazorpayOrder, verifyRazorpaySignature, verifyWebhookSignature } from '../razorpay';
import { sendExpoPushNotification } from '../push';
import { AuthUser } from '../auth';

type Bindings = {
  DB: D1Database;
  RAZORPAY_KEY_ID: string;
  RAZORPAY_KEY_SECRET: string;
  RAZORPAY_WEBHOOK_SECRET?: string;
};

const orders = new Hono<{ Bindings: Bindings; Variables: { user: AuthUser } }>();

const STATUS_MESSAGES: Record<string, { title: string; body: string }> = {
  preparing:        { title: '⚡ Order Accepted!',   body: 'Your order at Zappit is now being prepared by the store. Hang tight!' },
  ready:            { title: '🍱 Order Ready!',       body: 'Your order is packed and ready for pickup by the delivery partner.' },
  out_for_delivery: { title: '🛵 Out for Delivery!', body: 'Your order has been picked up! Share your OTP with the delivery partner upon arrival.' },
  delivered:        { title: '✅ Order Delivered!',   body: 'Your order has been delivered. Enjoy your meal! Thanks for ordering with Zappit 🎉' },
  cancelled:        { title: '❌ Order Cancelled',     body: 'Unfortunately your order has been cancelled. Please contact support if this was unexpected.' },
};

// POST /api/create-order
orders.post('/create-order', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { items, coupon_code, address, college_id, additionalNote } = body;

    if (!items || !items.length) {
      return c.json({ success: false, error: 'Items are required' }, 400);
    }
    if (items.length > 50) {
      return c.json({ success: false, error: 'Cart cannot exceed 50 items' }, 400);
    }
    if (address && address.length > 500) {
      return c.json({ success: false, error: 'Address too long (max 500 chars)' }, 400);
    }

    const prisma = getPrisma(c.env.DB);

    // 1. Batch fetch menu items securely
    const itemIds = items.map((i: any) => i.id || i._id).filter(Boolean);
    const dbItems = await prisma.menuItem.findMany({
      where: { id: { in: itemIds } },
      include: { store: true },
    });

    const dbItemMap = new Map();
    dbItems.forEach((it) => dbItemMap.set(it.id, it));

    let subtotal = 0;
    const itemsByStore: Record<string, any[]> = {};

    for (const item of items) {
      const idStr = (item.id || item._id)?.toString();
      const dbItem = dbItemMap.get(idStr);
      if (!dbItem) {
        return c.json({ success: false, error: `Item not found: ${item.name}` }, 400);
      }
      const qty = Number(item.qty);
      if (!Number.isInteger(qty) || qty < 1 || qty > 100) {
        return c.json({ success: false, error: 'Invalid quantity: must be between 1 and 100' }, 400);
      }
      const price = dbItem.price;
      subtotal += price * qty;

      if (!itemsByStore[dbItem.storeId]) itemsByStore[dbItem.storeId] = [];
      itemsByStore[dbItem.storeId].push({
        id: dbItem.id,
        name: dbItem.name,
        price,
        qty,
        storeName: dbItem.store.name || item.storeName || 'Campus Store',
      });
    }

    // 2. Apply coupon
    let discount = 0;
    let validCoupon: any = null;
    if (coupon_code) {
      const codeUpper = coupon_code.toUpperCase().trim();
      const cp = await prisma.coupon.findUnique({ where: { code: codeUpper } });
      if (cp && cp.active) {
        if (cp.oncePerUser && user?.uid) {
          const dbUser = await prisma.user.findUnique({ where: { id: user.uid } });
          const used: string[] = JSON.parse(dbUser?.usedCoupons || '[]');
          if (!used.includes(cp.code)) {
            discount = Math.round((subtotal * cp.discountPercent) / 100);
            validCoupon = cp;
          }
        } else {
          discount = Math.round((subtotal * cp.discountPercent) / 100);
          validCoupon = cp;
        }
      }
    }

    // 3. Add Fees
    let totalFees = 0;
    const feesBreakdown: any[] = [];
    const feeConfig = await prisma.config.findUnique({ where: { key: 'fees' } });
    if (feeConfig && feeConfig.value) {
      const parsed = JSON.parse(feeConfig.value);
      const list = parsed.list || [];
      list.forEach((f: any) => {
        const feeAmt = f.type === 'percent'
          ? Math.round((subtotal * Number(f.value)) / 100)
          : Number(f.value);
        totalFees += feeAmt;
        feesBreakdown.push({ name: f.name, type: f.type || 'flat', value: f.value, amount: feeAmt });
      });
    }

    const amountToPay = Math.max(1, Math.round(subtotal - discount + totalFees));
    const amountInPaise = amountToPay * 100;

    // 4. Create Razorpay Order
    const receipt = `order_${Date.now()}`;
    const razorpayOrder = await createRazorpayOrder(
      c.env.RAZORPAY_KEY_ID,
      c.env.RAZORPAY_KEY_SECRET,
      amountInPaise,
      receipt
    );

    // 5. Fetch User Profile
    let orderUserName = 'Guest';
    let orderUserPhone = '';
    if (user?.uid) {
      const dbUser = await prisma.user.findUnique({ where: { id: user.uid } });
      if (dbUser) {
        orderUserName = dbUser.name || 'Guest';
        orderUserPhone = dbUser.phone || '';
      }
    }

    // 6. Create Pending Orders in D1
    const orderIds: string[] = [];
    const deliveryOtp = Math.floor(1000 + Math.random() * 9000).toString();

    let remainingDiscount = discount;
    const storeCount = Object.keys(itemsByStore).length;
    let storeIndex = 0;
    let isFirstStore = true;

    for (const [storeId, storeItems] of Object.entries(itemsByStore)) {
      storeIndex++;
      const storeName = storeItems[0].storeName || 'Campus Store';
      const storeSubtotal = storeItems.reduce((s, i) => s + i.price * i.qty, 0);
      const storeTotalFees = isFirstStore ? totalFees : 0;

      let storeDiscount = 0;
      if (validCoupon) {
        if (storeIndex === storeCount) {
          storeDiscount = remainingDiscount;
        } else {
          storeDiscount = Math.round((storeSubtotal * validCoupon.discountPercent) / 100);
          remainingDiscount -= storeDiscount;
        }
      }

      const store = await prisma.store.findUnique({
        where: { id: storeId },
        include: { college: true },
      });

      const actualCollegeId = store?.collegeId || college_id || 'unknown';
      const actualCollegeName = store?.college?.name || '';
      const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      await prisma.order.create({
        data: {
          id: orderId,
          userId: user?.uid || 'guest_user',
          userName: orderUserName,
          userPhone: orderUserPhone,
          collegeId: actualCollegeId,
          collegeName: actualCollegeName,
          storeId,
          storeName,
          items: JSON.stringify(storeItems),
          totalAmount: Math.max(0, storeSubtotal + storeTotalFees - storeDiscount),
          discountAmount: storeDiscount,
          couponApplied: validCoupon?.code || null,
          address: address || '',
          deliveryFee: storeTotalFees,
          paymentStatus: 'pending',
          orderStatus: 'pending',
          additionalNote: additionalNote || '',
          deliveryOtp,
          razorpayOrderId: razorpayOrder.id,
        },
      });

      orderIds.push(orderId);
      isFirstStore = false;
    }

    return c.json({
      success: true,
      order_id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key_id: c.env.RAZORPAY_KEY_ID,
      db_order_ids: orderIds,
      fees_breakdown: feesBreakdown,
    });
  } catch (err: any) {
    console.error('Create Order Error:', err);
    return c.json({ success: false, error: err.message || 'Error creating order' }, 500);
  }
});

// POST /api/verify-payment
orders.post('/verify-payment', async (c) => {
  try {
    const body = await c.req.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return c.json({ success: false, verified: false, error: 'Missing required payment fields' }, 400);
    }

    const isValid = await verifyRazorpaySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      c.env.RAZORPAY_KEY_SECRET
    );

    if (!isValid) {
      return c.json({ success: false, verified: false, error: 'Signature mismatch' }, 400);
    }

    const prisma = getPrisma(c.env.DB);
    const matchedOrders = await prisma.order.findMany({
      where: { razorpayOrderId: razorpay_order_id },
    });

    if (matchedOrders.length === 0) {
      return c.json({ success: false, error: 'No orders found for payment' }, 404);
    }

    // Mark orders as paid
    await prisma.order.updateMany({
      where: { razorpayOrderId: razorpay_order_id },
      data: {
        paymentStatus: 'paid',
        orderStatus: 'preparing',
        razorpayPaymentId: razorpay_payment_id,
      },
    });

    // Notify store owners via Expo push
    for (const ord of matchedOrders) {
      const staffList = await prisma.staff.findMany({
        where: { storeId: ord.storeId },
      });
      for (const st of staffList) {
        const u = await prisma.user.findUnique({ where: { id: st.id } });
        if (u?.expoPushToken) {
          sendExpoPushNotification(
            u.expoPushToken,
            '🛍️ New Order Received!',
            `A new order of ₹${ord.totalAmount} was placed. Check orders tab!`,
            { orderId: ord.id }
          );
        }
      }
    }

    return c.json({
      success: true,
      verified: true,
      orderIds: matchedOrders.map((o) => o.id),
      deliveryOtp: matchedOrders[0].deliveryOtp,
    });
  } catch (err: any) {
    console.error('Verify Payment Error:', err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/verify-payment-redirect (For Mobile Browser Redirects)
orders.post('/verify-payment-redirect', async (c) => {
  const frontendUrl = 'https://www.zappit.shop';
  try {
    const body: any = await c.req.parseBody();
    const razorpayOrderId = body.razorpay_order_id;
    const razorpayPaymentId = body.razorpay_payment_id;
    const razorpaySignature = body.razorpay_signature;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return c.redirect(`${frontendUrl}/payment-callback?error=Missing+payment+fields`);
    }

    const isValid = await verifyRazorpaySignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      c.env.RAZORPAY_KEY_SECRET
    );

    if (!isValid) {
      return c.redirect(`${frontendUrl}/payment-callback?error=Signature+mismatch`);
    }

    const prisma = getPrisma(c.env.DB);
    await prisma.order.updateMany({
      where: { razorpayOrderId },
      data: {
        paymentStatus: 'paid',
        orderStatus: 'preparing',
        razorpayPaymentId,
      },
    });

    const verifiedOrders = await prisma.order.findMany({
      where: { razorpayOrderId },
    });

    const orderIds = verifiedOrders.map((o) => o.id).join(',');
    return c.redirect(`${frontendUrl}/payment-callback?verified=true&transactionId=${razorpayPaymentId}&orderIds=${orderIds}`);
  } catch (err: any) {
    console.error('Razorpay Redirect Verification Error:', err);
    return c.redirect(`${frontendUrl}/payment-callback?error=Verification+failed`);
  }
});

// POST /api/send-order-email
orders.post('/send-order-email', async (c) => {
  return c.json({ success: true, message: 'Order email processed' });
});

// POST /api/send-welcome-email
orders.post('/send-welcome-email', async (c) => {
  return c.json({ success: true, message: 'Welcome email processed' });
});

// POST /api/verify-coupon
orders.post('/verify-coupon', async (c) => {
  try {
    const { code } = await c.req.json();
    if (!code) return c.json({ success: false, error: 'code is required' }, 400);

    const prisma = getPrisma(c.env.DB);
    const cp = await prisma.coupon.findUnique({
      where: { code: code.toUpperCase().trim() },
    });

    if (!cp || !cp.active) {
      return c.json({ success: false, error: 'Coupon not found or inactive' }, 404);
    }

    return c.json({
      success: true,
      coupon: {
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
      },
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// GET /api/orders
orders.get('/orders', async (c) => {
  try {
    const user = c.get('user');
    const prisma = getPrisma(c.env.DB);
    const isAdminQuery = c.req.query('admin') === 'true';

    let where: any = {};

    if (user.role === 'admin' || isAdminQuery) {
      // Return all orders (optional college filter)
      const colId = c.req.query('college_id');
      if (colId) where.collegeId = colId;
    } else if (user.role === 'store_owner' && user.staff_store_id) {
      where.storeId = user.staff_store_id;
    } else if (user.role === 'delivery' && user.staff_college_id) {
      where.collegeId = user.staff_college_id;
    } else {
      where.userId = user.uid;
    }

    const orderList = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const formatted = orderList.map((o) => ({
      id: o.id,
      _id: o.id,
      user_id: o.userId,
      user_name: o.userName,
      user_phone: o.userPhone,
      college_id: o.collegeId,
      college_name: o.collegeName,
      store_id: o.storeId,
      store_name: o.storeName,
      items: JSON.parse(o.items || '[]'),
      total_amount: o.totalAmount,
      discount_amount: o.discountAmount,
      coupon_applied: o.couponApplied,
      address: o.address,
      delivery_fee: o.deliveryFee,
      payment_status: o.paymentStatus,
      order_status: o.orderStatus,
      additional_note: o.additionalNote,
      delivery_otp: o.deliveryOtp,
      razorpay_order_id: o.razorpayOrderId,
      created_at: o.createdAt.toISOString(),
    }));

    return c.json({ success: true, orders: formatted });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// PATCH /api/orders/:id/status
orders.patch('/orders/:id/status', async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');
    const { order_status } = await c.req.json();

    const isStaff = ['admin', 'store_owner', 'delivery'].includes(user.role);
    if (!isStaff) return c.json({ success: false, error: 'Forbidden: Staff only' }, 403);

    const prisma = getPrisma(c.env.DB);
    const existing = await prisma.order.findUnique({ where: { id } });
    if (!existing) return c.json({ success: false, error: 'Order not found' }, 404);

    const updated = await prisma.order.update({
      where: { id },
      data: { orderStatus: order_status },
    });

    // Notify customer
    const customer = await prisma.user.findUnique({ where: { id: existing.userId } });
    const msg = STATUS_MESSAGES[order_status];
    if (customer?.expoPushToken && msg) {
      sendExpoPushNotification(customer.expoPushToken, msg.title, msg.body, { orderId: id });
    }

    return c.json({ success: true, order: updated });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// GET /api/track/:orderIds (Public tracking)
orders.get('/track/:orderIds', async (c) => {
  try {
    const orderIds = c.req.param('orderIds').split(',');
    const prisma = getPrisma(c.env.DB);

    const list = await prisma.order.findMany({
      where: { id: { in: orderIds } },
    });

    const mapped = list.map((o) => ({
      id: o.id,
      storeName: o.storeName,
      status: o.orderStatus,
      paymentStatus: o.paymentStatus,
      totalAmount: o.totalAmount,
      items: JSON.parse(o.items || '[]'),
      createdAt: o.createdAt.toISOString(),
    }));

    return c.json({ success: true, orders: mapped });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/razorpay-webhook (Bulletproof Payment Fail-Safe)
orders.post('/razorpay-webhook', async (c) => {
  try {
    const rawBody = await c.req.text();
    const signature = c.req.header('x-razorpay-signature') || '';
    const secret = c.env.RAZORPAY_WEBHOOK_SECRET || c.env.RAZORPAY_KEY_SECRET;

    if (secret) {
      const isValid = await verifyWebhookSignature(rawBody, signature, secret);
      if (!isValid) return c.text('Invalid signature', 400);
    }

    const event = JSON.parse(rawBody);
    if (event.event === 'payment.captured' || event.event === 'order.paid') {
      const payment = event.payload.payment.entity;
      const razorpayOrderId = payment.order_id;
      const razorpayPaymentId = payment.id;

      const prisma = getPrisma(c.env.DB);
      await prisma.order.updateMany({
        where: { razorpayOrderId },
        data: {
          paymentStatus: 'paid',
          orderStatus: 'preparing',
          razorpayPaymentId,
        },
      });
    }

    return c.json({ status: 'ok' });
  } catch (err: any) {
    console.error('Webhook error:', err);
    return c.text('Webhook processing failed', 500);
  }
});

export default orders;

