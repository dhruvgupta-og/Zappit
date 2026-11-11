import { Hono } from 'hono';
import { getPrisma } from '../db';
import { createRazorpayOrder, fetchRazorpayQrPayments, verifyRazorpaySignature, verifyWebhookSignature } from '../razorpay';
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

function orderMatchCondition(refId: string) {
  return {
    OR: [
      { razorpayOrderId: refId },
      { razorpayOrderId: { contains: refId } },
    ],
  };
}

// POST /api/create-order
orders.post('/create-order', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { items, coupon_code, address, college_id, additionalNote, payment_method, block_id, block_name, blockId } = body;

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
      if (dbItem.store && dbItem.store.isOpen === false) {
        return c.json({
          success: false,
          error: `"${dbItem.store.name || 'Store'}" is currently closed and not accepting orders.`,
        }, 400);
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

    // 3b. Add Block Delivery Fee if block is selected
    const activeBlockId = block_id || blockId;
    if (activeBlockId) {
      const block = await prisma.block.findUnique({ where: { id: activeBlockId } });
      if (block && block.deliveryFee > 0) {
        totalFees += block.deliveryFee;
        feesBreakdown.push({ name: `Block Fee (${block.name.trim()})`, type: 'flat', value: block.deliveryFee, amount: block.deliveryFee });
      }
    } else if (block_name || address) {
      const targetName = (block_name || address || '').split(',')[0].trim().toLowerCase();
      if (targetName) {
        const matchingBlock = await prisma.block.findFirst({
          where: {
            collegeId: college_id || undefined,
            name: { contains: targetName },
          },
        });
        if (matchingBlock && matchingBlock.deliveryFee > 0) {
          totalFees += matchingBlock.deliveryFee;
          feesBreakdown.push({ name: `Block Fee (${matchingBlock.name.trim()})`, type: 'flat', value: matchingBlock.deliveryFee, amount: matchingBlock.deliveryFee });
        }
      }
    }

    const amountToPay = Math.max(1, Math.round(subtotal - discount + totalFees));
    const amountInPaise = amountToPay * 100;

    // 4. Create Razorpay Order
    const receipt = `order_${Date.now()}`;
    const razorpayOrder: any = await createRazorpayOrder(
      c.env.RAZORPAY_KEY_ID,
      c.env.RAZORPAY_KEY_SECRET,
      amountInPaise,
      receipt
    );

    const orderRefId = razorpayOrder.id;

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
          razorpayOrderId: orderRefId,
        },
      });

      orderIds.push(orderId);
      isFirstStore = false;
    }

    return c.json({
      success: true,
      order_id: razorpayOrder.id,
      amount: amountInPaise,
      currency: 'INR',
      key_id: c.env.RAZORPAY_KEY_ID,
      db_order_ids: orderIds,
      fees_breakdown: feesBreakdown,
    });
  } catch (err: any) {
    console.error('Create Order Error:', err);
    return c.json({ success: false, error: err.message || 'Error creating order' }, 500);
  }
});

// GET /api/check-qr-payment/:qrId
orders.get('/check-qr-payment/:qrId', async (c) => {
  try {
    const qrId = c.req.param('qrId');
    if (!qrId) {
      return c.json({ success: false, error: 'qrId is required' }, 400);
    }

    const prisma = getPrisma(c.env.DB);
    const matchedOrders = await prisma.order.findMany({
      where: orderMatchCondition(qrId),
    });

    if (matchedOrders.length === 0) {
      return c.json({ success: false, error: 'No orders found for this QR' }, 404);
    }

    // Check if already paid
    const isAlreadyPaid = matchedOrders.some((o) => o.paymentStatus === 'paid');
    if (isAlreadyPaid) {
      return c.json({
        success: true,
        paid: true,
        orderIds: matchedOrders.map((o) => o.id),
        deliveryOtp: matchedOrders[0]?.deliveryOtp,
      });
    }

    // Check payments against this QR Code from Razorpay
    const paymentsData: any = await fetchRazorpayQrPayments(
      c.env.RAZORPAY_KEY_ID,
      c.env.RAZORPAY_KEY_SECRET,
      qrId
    );

    const successfulPayment = paymentsData?.items?.find(
      (p: any) => p.status === 'captured' || p.status === 'authorized'
    );

    if (successfulPayment) {
      // Mark orders as paid!
      await prisma.order.updateMany({
        where: orderMatchCondition(qrId),
        data: {
          paymentStatus: 'paid',
          orderStatus: 'preparing',
          razorpayPaymentId: successfulPayment.id,
        },
      });

      // Notify Store Staff via high-priority push (with loud alert sound)
      for (const ord of matchedOrders) {
        try {
          const storeStaff = await prisma.staff.findMany({
            where: { storeId: ord.storeId },
          });
          const staffTokens = storeStaff.map((s) => s.id);
          const usersWithTokens = await prisma.user.findMany({
            where: { id: { in: staffTokens }, expoPushToken: { not: null } },
          });
          const validTokens = usersWithTokens.map((u) => u.expoPushToken!).filter(Boolean);
          if (validTokens.length > 0) {
            await sendExpoPushNotification(
              validTokens,
              '⚡ NEW ORDER #' + ord.id.slice(-4),
              `Order for ₹${ord.totalAmount} received! Tap to prepare.`,
              { orderId: ord.id, channelId: 'order_loud_alert' }
            );
          }
        } catch (pushErr) {
          console.warn('[QR Payment Push Error]:', pushErr);
        }
      }

      return c.json({
        success: true,
        paid: true,
        orderIds: matchedOrders.map((o) => o.id),
        deliveryOtp: matchedOrders[0]?.deliveryOtp,
        paymentId: successfulPayment.id,
      });
    }

    return c.json({ success: true, paid: false });
  } catch (err: any) {
    console.error('Check QR Payment Error:', err);
    return c.json({ success: false, paid: false, error: err.message || 'Error checking payment status' }, 500);
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
      where: orderMatchCondition(razorpay_order_id),
    });

    if (matchedOrders.length === 0) {
      return c.json({ success: false, error: 'No orders found for payment' }, 404);
    }

    // Mark orders as paid
    await prisma.order.updateMany({
      where: orderMatchCondition(razorpay_order_id),
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

    // Auto-cancel abandoned checkout attempts older than 5 minutes
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
    } catch (cleanErr) {
      console.warn('Auto-cancel unpaid orders failed (non-critical):', cleanErr);
    }

    let where: any = {};

    if (user.role === 'admin' || isAdminQuery) {
      // Admins see all orders (optional college filter)
      const colId = c.req.query('college_id');
      if (colId) where.collegeId = colId;
    } else if (user.role === 'store_owner') {
      const storeId = c.req.query('store_id') || user.staff_store_id;
      if (!storeId || storeId === 'UNASSIGNED_STORE') {
        return c.json({ success: true, orders: [] });
      }
      where.storeId = storeId;
      // Store owners only see orders where payment is done
      where.paymentStatus = { in: ['paid', 'completed'] };
      where.orderStatus = { not: 'cancelled' };
    } else if (user.role === 'delivery') {
      const collegeId = c.req.query('college_id') || user.staff_college_id;
      if (!collegeId || collegeId === 'UNASSIGNED_COLLEGE') {
        return c.json({ success: true, orders: [] });
      }
      where.collegeId = collegeId;
      // Delivery partners only see orders where payment is done
      where.paymentStatus = { in: ['paid', 'completed'] };
      where.orderStatus = { not: 'cancelled' };
    } else {
      // Customers: only show orders where payment was completed
      where.userId = user.uid;
      where.paymentStatus = { in: ['paid', 'completed'] };
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
      delivery_address: o.address,
      delivery_fee: o.deliveryFee,
      payment_status: o.paymentStatus,
      order_status: o.orderStatus,
      additional_note: o.additionalNote,
      delivery_otp: o.deliveryOtp,
      requires_otp: !!o.deliveryOtp,
      razorpay_order_id: o.razorpayOrderId,
      rating: (o as any).rating || null,
      rating_feedback: (o as any).ratingFeedback || null,
      created_at: o.createdAt.toISOString(),
    }));

    return c.json({ success: true, orders: formatted });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/orders/:id/rating
orders.post('/orders/:id/rating', async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');
    const { rating, feedback } = await c.req.json();

    const ratingNum = Number(rating);
    if (!ratingNum || ratingNum < 1 || ratingNum > 5) {
      return c.json({ success: false, error: 'Rating must be between 1 and 5' }, 400);
    }

    const prisma = getPrisma(c.env.DB);
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return c.json({ success: false, error: 'Order not found' }, 404);

    if (order.userId !== user.uid && user.role !== 'admin') {
      return c.json({ success: false, error: 'Forbidden: You can only rate your own orders' }, 403);
    }

    const updated = await prisma.order.update({
      where: { id },
      data: {
        rating: ratingNum,
        ratingFeedback: feedback ? String(feedback).slice(0, 500) : null,
      },
    });

    // Update store average rating
    try {
      const allRatings = await prisma.order.findMany({
        where: {
          storeId: order.storeId,
          rating: { not: null },
        },
        select: { rating: true },
      });

      if (allRatings.length > 0) {
        const avg = allRatings.reduce((sum, r) => sum + (r.rating || 0), 0) / allRatings.length;
        const roundedAvg = Math.round(avg * 10) / 10;
        await prisma.store.update({
          where: { id: order.storeId },
          data: { rating: roundedAvg },
        });
      }
    } catch (storeRatingErr) {
      console.warn('[Zappit] Could not update store avg rating:', storeRatingErr);
    }

    return c.json({ success: true, order: updated });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/orders/:id/verify-otp
orders.post('/orders/:id/verify-otp', async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');
    const { otp } = await c.req.json();

    const isStaff = ['admin', 'delivery', 'store_owner'].includes(user?.role);
    if (!isStaff) return c.json({ success: false, error: 'Forbidden: Staff only' }, 403);

    const prisma = getPrisma(c.env.DB);
    const existing = await prisma.order.findUnique({ where: { id } });
    if (!existing) return c.json({ success: false, error: 'Order not found' }, 404);

    if (existing.deliveryOtp && String(existing.deliveryOtp).trim() !== String(otp).trim()) {
      return c.json({ success: false, error: 'Invalid PIN. Please ask customer for correct 4-digit PIN.' }, 400);
    }

    const updated = await prisma.order.update({
      where: { id },
      data: { orderStatus: 'delivered' },
    });

    // Notify customer
    const customer = await prisma.user.findUnique({ where: { id: existing.userId } });
    if (customer?.expoPushToken) {
      sendExpoPushNotification(
        customer.expoPushToken,
        '🎉 Order Delivered!',
        'Your order has been delivered successfully. Enjoy your meal!',
        { orderId: id }
      );
    }

    return c.json({ success: true, order: updated });
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

// POST /api/cancel-unpaid or /api/orders/cancel-unpaid
const cancelUnpaidHandler = async (c: any) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { razorpay_order_id, order_ids } = body;
    const prisma = getPrisma(c.env.DB);

    if (razorpay_order_id) {
      await prisma.order.updateMany({
        where: {
          ...orderMatchCondition(razorpay_order_id),
          paymentStatus: 'pending',
        },
        data: { orderStatus: 'cancelled' },
      });
    }

    if (Array.isArray(order_ids) && order_ids.length > 0) {
      await prisma.order.updateMany({
        where: {
          id: { in: order_ids },
          paymentStatus: 'pending',
        },
        data: { orderStatus: 'cancelled' },
      });
    }

    return c.json({ success: true, message: 'Unpaid orders cancelled' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
};

orders.post('/cancel-unpaid', cancelUnpaidHandler);
orders.post('/orders/cancel-unpaid', cancelUnpaidHandler);

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
    const prisma = getPrisma(c.env.DB);

    if (event.event === 'payment.captured' || event.event === 'order.paid' || event.event === 'qr_code.paid') {
      const payment = event.payload.payment?.entity;
      const qrCode = event.payload.qr_code?.entity;
      const razorpayOrderId = payment?.order_id || qrCode?.id;
      const razorpayPaymentId = payment?.id;

      if (razorpayOrderId) {
        await prisma.order.updateMany({
          where: orderMatchCondition(razorpayOrderId),
          data: {
            paymentStatus: 'paid',
            orderStatus: 'preparing',
            razorpayPaymentId: razorpayPaymentId || null,
          },
        });
      }
    } else if (event.event === 'payment.failed') {
      const payment = event.payload.payment?.entity;
      const razorpayOrderId = payment?.order_id;
      if (razorpayOrderId) {
        await prisma.order.updateMany({
          where: {
            ...orderMatchCondition(razorpayOrderId),
            paymentStatus: 'pending',
          },
          data: { orderStatus: 'cancelled' },
        });
      }
    }

    return c.json({ status: 'ok' });
  } catch (err: any) {
    console.error('Webhook error:', err);
    return c.text('Webhook processing failed', 500);
  }
});

export default orders;

