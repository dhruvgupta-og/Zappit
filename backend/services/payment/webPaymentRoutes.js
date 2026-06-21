const express = require('express');
const router = express.Router();
const razorpay = require('./razorpay');
const crypto = require('crypto');
const { Resend } = require('resend');
const { admin } = require('../../firebase');
const Coupon = require('../../models/Coupon');
const Order = require('../../models/Order');
const User = require('../../models/User');
const mongoose = require('mongoose');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Status → notification message map
const STATUS_MESSAGES = {
  preparing:        { title: '⚡ Order Accepted!',         body: 'Your order at Zappit is now being prepared by the store. Hang tight!' },
  ready:            { title: '🍱 Order Ready!',             body: 'Your order is packed and ready for pickup by the delivery partner.' },
  out_for_delivery: { title: '🛵 Out for Delivery!',       body: 'Your order has been picked up! Share your OTP with the delivery partner upon arrival.' },
  delivered:        { title: '✅ Order Delivered!',         body: 'Your order has been delivered. Enjoy your meal! Thanks for ordering with Zappit 🎉' },
  cancelled:        { title: '❌ Order Cancelled',           body: 'Unfortunately your order has been cancelled. Please contact support if this was unexpected.' },
};

// POST /api/send-status-notification
router.post('/send-status-notification', async (req, res) => {
  try {
    const { orderId, status } = req.body;

    if (!orderId || !status) {
      return res.status(400).json({ success: false, error: 'orderId and status are required' });
    }

    const msg = STATUS_MESSAGES[status];
    if (!msg) {
      return res.status(400).json({ success: false, error: `Unknown status: ${status}` });
    }

    // 1. Fetch order to get user_id and verify ownership
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    // Security check: Only staff can send notifications, and they must own the store/college
    const isStaff = ['admin', 'store_owner', 'delivery'].includes(req.user?.role);
    if (!isStaff) {
      return res.status(403).json({ success: false, error: 'Forbidden: Staff only' });
    }
    if (req.user.role === 'store_owner' && order.store_id !== req.user.staff_store_id) {
      return res.status(403).json({ success: false, error: 'Forbidden: Order not from your store' });
    }
    if (req.user.role === 'delivery' && order.college_id !== req.user.staff_college_id) {
      return res.status(403).json({ success: false, error: 'Forbidden: Order not to your college' });
    }

    const userId = order.user_id;

    if (!userId) {
      return res.status(200).json({ success: false, skipped: true, error: 'No user_id on order — cannot send push' });
    }

    // 2. Fetch user to get fcmToken
    const user = await User.findById(userId);
    if (!user) {
      return res.status(200).json({ success: false, skipped: true, error: 'User not found in MongoDB' });
    }
    const fcmToken = user.fcmToken;

    if (!fcmToken) {
      return res.status(200).json({ success: false, skipped: true, error: 'User has no FCM token — notifications not enabled on their device' });
    }

    // 3. Send FCM push notification
    const message = {
      token: fcmToken,
      notification: {
        title: msg.title,
        body: msg.body,
      },
      webpush: {
        notification: {
          icon: 'https://zappit-dun.vercel.app/zappit-icon.png',
          badge: 'https://zappit-dun.vercel.app/zappit-icon.png',
          requireInteraction: false,
        },
        fcmOptions: {
          link: 'https://zappit-dun.vercel.app/orders',
        },
      },
      data: {
        orderId,
        status,
        click_action: 'https://zappit-dun.vercel.app/orders',
      },
    };

    const response = await admin.messaging().send(message);
    console.log(`[Zappit FCM] Push sent for order ${orderId} → status: ${status} | FCM response:`, response);

    return res.status(200).json({ success: true, message: 'Push notification sent', fcmResponse: response });
  } catch (err) {
    console.error('[Zappit FCM] send-status-notification error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/create-order
router.post('/create-order', async (req, res) => {
  try {
    const { items, coupon_code, address, college_id } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ success: false, error: 'Items are required' });
    }

    const MenuItem = require('../../models/MenuItem');
    const Config = require('../../models/Config');

    // 1. Calculate subtotal securely from DB
    let subtotal = 0;
    const itemsByStore = {};
    for (const item of items) {
      const dbItem = await MenuItem.findById(item.id || item._id);
      if (!dbItem) {
        return res.status(400).json({ success: false, error: `Item not found: ${item.name}` });
      }
      const itemPrice = dbItem.price;
      subtotal += itemPrice * item.qty;

      // Group for DB order creation
      if (!itemsByStore[dbItem.store_id]) itemsByStore[dbItem.store_id] = [];
      itemsByStore[dbItem.store_id].push({
        ...item,
        price: itemPrice // Secure price override
      });
    }

    // 2. Apply coupon securely
    let discount = 0;
    let validCoupon = null;
    if (coupon_code) {
      const c = await Coupon.findOne({ code: coupon_code.toUpperCase(), active: true });
      if (c) {
         if (c.once_per_user && req.user) {
            const user = await User.findById(req.user.uid);
            if (!user || !user.used_coupons?.includes(c.code)) {
               discount = Math.round((subtotal * c.discount_percent) / 100);
               validCoupon = c;
            }
         } else {
            discount = Math.round((subtotal * c.discount_percent) / 100);
            validCoupon = c;
         }
      }
    }

    // 3. Add Config fees
    let totalFees = 0;
    const feesConfig = await Config.findById('fees');
    if (feesConfig && feesConfig.list) {
       totalFees = feesConfig.list.reduce((sum, f) => sum + Number(f.value), 0);
    }

    const amountToPay = Math.max(1, Math.round(subtotal - discount + totalFees));
    const amountInPaise = amountToPay * 100;

    if (!razorpay) {
      return res.status(503).json({ success: false, error: 'Payment service unavailable' });
    }

    // 4. Create Razorpay Order
    const options = {
      amount: amountInPaise,
      currency: "INR",
      receipt: `order_${Date.now()}`,
    };

    const razorpayOrder = await razorpay.orders.create(options);

    // 5. Create Pending Orders in MongoDB immediately
    const orderIds = [];
    const deliveryOtp = Math.floor(100000 + Math.random() * 900000).toString();
    
    let isFirstStore = true;
    for (const [storeId, storeItems] of Object.entries(itemsByStore)) {
      const storeName = storeItems[0].storeName || 'Campus Store';
      const storeSubtotal = storeItems.reduce((sum, i) => sum + (i.price * i.qty), 0);
      const storeTotalFees = isFirstStore ? totalFees : 0; // Assign fees to first order only
      const storeDiscount = validCoupon ? Math.round((storeSubtotal * validCoupon.discount_percent) / 100) : 0;
      
      const newOrder = new Order({
        _id: new mongoose.Types.ObjectId().toString(),
        user_id: req.user?.uid || 'guest_user',
        college_id: college_id || 'unknown',
        store_id: storeId,
        store_name: storeName,
        items: storeItems,
        total_amount: Math.max(0, storeSubtotal + storeTotalFees - storeDiscount),
        discount_amount: storeDiscount,
        coupon_applied: validCoupon ? validCoupon.code : null,
        address: address || '',
        payment_status: 'pending',
        order_status: 'pending',
        delivery_otp: deliveryOtp,
        razorpay_order_id: razorpayOrder.id, // Link for verify-payment
        created_at: new Date().toISOString()
      });
      await newOrder.save();
      orderIds.push(newOrder._id);
      isFirstStore = false;
    }

    res.status(200).json({
      success: true,
      order_id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key_id: process.env.RAZORPAY_KEY_ID,
      db_order_ids: orderIds
    });
  } catch (err) {
    console.error('Create Order Error:', err);
    res.status(500).json({ success: false, error: err.message || 'Error creating order' });
  }
});

// POST /api/verify-payment
router.post('/verify-payment', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, verified: false, error: 'Missing required payment verification fields' });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      return res.status(503).json({ success: false, error: 'Razorpay secret not configured' });
    }

    // 1. Verify HMAC Signature
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generated_signature = hmac.digest('hex');

    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({ success: false, verified: false, error: 'Signature mismatch' });
    }

    // 2. Fetch payment from Razorpay to confirm capture and amount
    const payment = await razorpay.payments.fetch(razorpay_payment_id);
    if (payment.status !== 'captured') {
      // Flag the order if payment not captured
      await Order.updateMany(
        { razorpay_order_id: razorpay_order_id },
        { payment_status: 'flagged', payment_transaction_id: razorpay_payment_id }
      );
      return res.status(400).json({ success: false, verified: false, error: 'Payment not captured by Razorpay' });
    }

    // 3. Mark orders as paid securely server-side
    const updatedOrders = await Order.updateMany(
      { razorpay_order_id: razorpay_order_id },
      { 
        payment_status: 'paid', 
        order_status: 'confirmed',
        payment_transaction_id: razorpay_payment_id 
      }
    );

    // Fetch the updated orders to return to frontend
    const verifiedOrders = await Order.find({ razorpay_order_id: razorpay_order_id });
    const orderIds = verifiedOrders.map(o => o._id);
    const deliveryOtp = verifiedOrders.length > 0 ? verifiedOrders[0].delivery_otp : null;

    res.status(200).json({ 
      success: true, 
      verified: true, 
      updatedCount: updatedOrders.modifiedCount,
      orderIds: orderIds,
      deliveryOtp: deliveryOtp
    });
  } catch (err) {
    console.error('Razorpay Verification Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/send-order-email
router.post('/send-order-email', async (req, res) => {
  try {
    const { orderIds } = req.body;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ success: false, error: 'orderIds array is required' });
    }

    // Fetch orders securely from the database
    const orders = await Order.find({ _id: { $in: orderIds } });
    if (orders.length === 0) {
      return res.status(404).json({ success: false, error: 'Orders not found' });
    }

    // Verify ownership
    if (orders[0].user_id !== req.user?.uid && req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden: You do not own these orders' });
    }

    const email = req.user?.email;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Authenticated user has no email address' });
    }

    // Reconstruct payload from trusted DB records
    const items = orders.map(o => o.items).flat();
    const subtotal = items.reduce((sum, item) => sum + (Number(item.price) * Number(item.qty)), 0);
    const totalAmount = orders.reduce((sum, o) => sum + o.total_amount, 0);
    const discountAmount = orders.reduce((sum, o) => sum + o.discount_amount, 0);
    const deliveryOtp = orders[0].delivery_otp;
    const address = orders[0].address;
    const appliedCoupon = orders.find(o => o.coupon_applied)?.coupon_applied;
    const calculatedFees = Math.max(0, totalAmount + discountAmount - subtotal);

    const itemsHtml = items.map(item => `
      <tr style="border-bottom: 1px solid #f3f4f6;">
        <td style="padding: 12px 0; font-size: 15px; color: #1f2937;">
          <span style="font-weight: 600;">${item.name}</span>
          <span style="color: #6b7280; margin-left: 6px;">x${item.qty}</span>
        </td>
        <td style="padding: 12px 0; font-size: 14px; color: #6b7280; text-align: center;">${item.storeName || 'Store'}</td>
        <td style="padding: 12px 0; font-size: 15px; color: #1f2937; text-align: right; font-weight: 500;">₹${Number(item.price) * Number(item.qty)}</td>
      </tr>
    `).join('');

    let feesHtml = '';
    if (calculatedFees > 0) {
      feesHtml = `
        <tr>
          <td colspan="2" style="padding: 6px 0; font-size: 14px; color: #4b5563;">Taxes & Platform Fees</td>
          <td style="padding: 6px 0; font-size: 14px; color: #4b5563; text-align: right;">₹${calculatedFees}</td>
        </tr>
      `;
    }

    let discountHtml = '';
    if (discountAmount > 0) {
      discountHtml = `
        <tr style="color: #10b981;">
          <td colspan="2" style="padding: 6px 0; font-size: 14px; font-weight: 500;">Discount ${appliedCoupon ? `(${appliedCoupon})` : ''}</td>
          <td style="padding: 6px 0; font-size: 14px; text-align: right; font-weight: 600;">-₹${discountAmount}</td>
        </tr>
      `;
    }

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmed - Zappit</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 0; -webkit-font-smoothing: antialiased;">
  <div style="width: 100%; background-color: #f3f4f6; padding: 40px 0;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025); border: 1px solid #e5e7eb;">
      
      <!-- Brand Header -->
      <div style="background: linear-gradient(135deg, #FFC107 0%, #FF9800 100%); padding: 35px 30px; text-align: center;">
        <h1 style="font-size: 30px; font-weight: 900; color: #ffffff; letter-spacing: 2px; margin: 0; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">⚡ ZAPPIT</h1>
        <p style="color: rgba(255, 255, 255, 0.95); font-size: 14px; font-weight: 500; margin: 6px 0 0 0; letter-spacing: 0.5px;">Campus Delivery, Instantly</p>
      </div>

      <!-- Main Receipt Card -->
      <div style="padding: 40px 30px;">
        <h2 style="color: #111827; font-size: 22px; font-weight: 700; margin-top: 0; margin-bottom: 8px;">Order Confirmed! 🎉</h2>
        <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 30px 0;">
          Hi there! Your payment was processed successfully. The store is preparing your items. You can find your delivery OTP and receipt below.
        </p>
        
        <!-- OTP Card -->
        <div style="background-color: #fffbeb; border: 2px dashed #fcd34d; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 35px;">
          <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 2px; color: #b45309; font-weight: 700; margin-bottom: 8px;">Share this OTP with your Delivery Partner</div>
          <div style="font-size: 42px; font-weight: 900; color: #d97706; letter-spacing: 6px; margin: 0; line-height: 1;">${deliveryOtp}</div>
        </div>
        
        <!-- Items Table -->
        <div style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; border-bottom: 2px solid #f3f4f6; padding-bottom: 8px; margin-bottom: 12px;">Items Ordered</div>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <tbody>
            ${itemsHtml}
            <tr>
              <td colspan="2" style="padding: 12px 0 6px 0; font-size: 14px; color: #4b5563;">Subtotal</td>
              <td style="padding: 12px 0 6px 0; font-size: 14px; color: #4b5563; text-align: right;">₹${subtotal}</td>
            </tr>
            ${feesHtml}
            ${discountHtml}
            <tr style="border-top: 2px solid #f3f4f6;">
              <td colspan="2" style="padding: 16px 0 0 0; font-size: 18px; font-weight: 800; color: #111827;">Total Amount Paid</td>
              <td style="padding: 16px 0 0 0; font-size: 18px; font-weight: 800; color: #111827; text-align: right;">₹${totalAmount}</td>
            </tr>
          </tbody>
        </table>
        
        <!-- Metadata Info Section -->
        <div style="border-top: 1px solid #e5e7eb; padding-top: 25px; margin-top: 30px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="width: 50%; vertical-align: top; padding-right: 15px;">
                <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #9ca3af; margin-bottom: 4px;">Delivery Address</div>
                <div style="font-size: 14px; color: #374151; line-height: 1.5; font-weight: 500;">${address}</div>
              </td>
              <td style="width: 50%; vertical-align: top;">
                <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #9ca3af; margin-bottom: 4px;">Order ID</div>
                <div style="font-size: 20px; color: #111827; font-family: monospace; font-weight: 900; letter-spacing: 2px;">${orderIds.map(id => '#' + id.slice(-6).toUpperCase()).join(', ')}</div>
                <div style="font-size: 11px; color: #9ca3af; margin-top: 4px; word-break: break-all;">${orderIds.join(', ')}</div>
              </td>
            </tr>
          </table>
        </div>

      </div>
      
      <!-- Footer -->
      <div style="background-color: #f9fafb; padding: 24px 30px; text-align: center; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; line-height: 1.5;">
        <p style="margin: 0 0 6px 0; font-weight: 600; color: #6b7280;">Thank you for ordering with Zappit!</p>
        <p style="margin: 0;">If you have any questions, reach out to us at <a href="mailto:zappit.shop@gmail.com" style="color: #ff9800; text-decoration: none; font-weight: 600;">support@zappit.shop</a></p>
      </div>

    </div>
  </div>
</body>
</html>
    `;

    if (resend) {
      console.log('[Zappit Debug] Sending order receipt email to:', email);
      const emailResponse = await resend.emails.send({
        from: 'Zappit <orders@zappit.shop>',
        to: email,
        subject: `⚡ Zappit Order Confirmed - OTP: ${deliveryOtp}`,
        html: htmlContent
      });
      console.log('[Zappit] Resend Email sent response:', email, emailResponse);
      return res.status(200).json({ success: true, message: `Email sent successfully to ${email}`, data: emailResponse });
    } else {
      console.log('========================================================================');
      console.log('[Zappit] MOCK EMAIL SENT (RESEND_API_KEY is missing or unconfigured)');
      console.log(`To: ${email}`);
      console.log(`Subject: ⚡ Zappit Order Confirmed - OTP: ${deliveryOtp}`);
      console.log(`Order IDs: ${orderIds.join(', ')}`);
      console.log(`Total Paid: ₹${totalAmount}`);
      console.log('========================================================================');
      return res.status(200).json({ 
        success: true, 
        message: 'Mock email logged to server console (RESEND_API_KEY missing)',
        mocked: true 
      });
    }

  } catch (err) {
    console.error('Send Order Email Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/send-welcome-email
router.post('/send-welcome-email', async (req, res) => {
  try {
    const { email, name, college } = req.body;

    if (!email || !name || !college) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Zappit!</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 0; -webkit-font-smoothing: antialiased;">
  <div style="width: 100%; background-color: #f3f4f6; padding: 40px 0;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025); border: 1px solid #e5e7eb;">
      
      <!-- Gradient Header -->
      <div style="background: linear-gradient(135deg, #FFC107 0%, #FF9800 100%); padding: 45px 30px; text-align: center;">
        <div style="font-size: 48px; margin-bottom: 10px;">⚡</div>
        <h1 style="font-size: 32px; font-weight: 900; color: #ffffff; letter-spacing: 1px; margin: 0; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">Welcome to Zappit!</h1>
        <p style="color: rgba(255, 255, 255, 0.95); font-size: 16px; font-weight: 500; margin: 8px 0 0 0; letter-spacing: 0.5px;">Your campus favorites, delivered instantly.</p>
      </div>

      <!-- Content -->
      <div style="padding: 40px 30px;">
        <h2 style="color: #111827; font-size: 22px; font-weight: 700; margin-top: 0; margin-bottom: 12px;">Hi ${name},</h2>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
          We are thrilled to welcome you to the Zappit family! Zappit brings your favorite campus cafes, stores, and snacks directly to you at <strong>${college}</strong>.
        </p>

        <!-- Feature Cards -->
        <div style="background-color: #f9fafb; border-radius: 12px; padding: 20px; border: 1px solid #f3f4f6; margin-bottom: 30px;">
          <div style="font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 15px;">What you can do now</div>
          
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="vertical-align: top;">
              <td style="font-size: 20px; padding-right: 12px; padding-bottom: 16px; width: 30px;">🍔</td>
              <td style="padding-bottom: 16px;">
                <strong style="color: #111827; font-size: 15px; display: block;">Order from Campus Cafes</strong>
                <span style="color: #6b7280; font-size: 14px; margin-top: 2px; display: block;">Skip the queues. Get hot food, beverages, and groceries.</span>
              </td>
            </tr>
            <tr style="vertical-align: top;">
              <td style="font-size: 20px; padding-right: 12px; padding-bottom: 16px;">⚡</td>
              <td style="padding-bottom: 16px;">
                <strong style="color: #111827; font-size: 15px; display: block;">Ultra-fast Campus Delivery</strong>
                <span style="color: #6b7280; font-size: 14px; margin-top: 2px; display: block;">Delivered to your block, library, or campus gate in minutes.</span>
              </td>
            </tr>
            <tr style="vertical-align: top;">
              <td style="font-size: 20px; padding-right: 12px;">📱</td>
              <td>
                <strong style="color: #111827; font-size: 15px; display: block;">Live Order Tracking</strong>
                <span style="color: #6b7280; font-size: 14px; margin-top: 2px; display: block;">Track your delivery agent live with secure OTP validation.</span>
              </td>
            </tr>
          </table>
        </div>

        <!-- Special Welcome Offer -->
        <div style="background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border: 1px solid #fde68a; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 30px;">
          <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 2px; color: #b45309; font-weight: 700; margin-bottom: 6px;">Your Welcome Gift 🎁</div>
          <div style="font-size: 20px; font-weight: 800; color: #78350f; margin-bottom: 4px;">Get 10% Off Your First Order</div>
          <p style="color: #92400e; font-size: 14px; margin: 0 0 16px 0;">Apply the coupon code below at checkout</p>
          <div style="display: inline-block; background-color: #ffffff; border: 2px dashed #f59e0b; border-radius: 8px; padding: 10px 20px; font-family: monospace; font-size: 18px; font-weight: 800; color: #d97706; letter-spacing: 1px;">WELCOME10</div>
        </div>

        <!-- CTA Button -->
        <div style="text-align: center; margin-bottom: 10px;">
          <a href="https://zappit-dun.vercel.app" style="display: inline-block; background: linear-gradient(135deg, #FFC107 0%, #FF9800 100%); color: #ffffff; font-size: 16px; font-weight: 700; text-decoration: none; padding: 16px 32px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(245, 158, 11, 0.4), 0 2px 4px -1px rgba(245, 158, 11, 0.2); font-family: inherit;">Explore Campus Stores ➔</a>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="background-color: #f9fafb; padding: 24px 30px; text-align: center; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; line-height: 1.5;">
        <p style="margin: 0 0 6px 0; font-weight: 600; color: #6b7280;">Welcome to the fast lane!</p>
        <p style="margin: 0;">If you have any questions, reach out to us at <a href="mailto:zappit.shop@gmail.com" style="color: #ff9800; text-decoration: none; font-weight: 600;">support@zappit.shop</a></p>
      </div>

    </div>
  </div>
</body>
</html>
    `;

    if (resend) {
      console.log('[Zappit Debug] Sending welcome email to:', email);
      const emailResponse = await resend.emails.send({
        from: 'Zappit <hello@zappit.shop>',
        to: email,
        subject: `⚡ Welcome to Zappit, ${name}!`,
        html: htmlContent
      });
      console.log('[Zappit] Resend Welcome Email sent response to:', email, emailResponse);
      return res.status(200).json({ success: true, message: `Welcome email sent successfully to ${email}`, data: emailResponse });
    } else {
      console.log('========================================================================');
      console.log('[Zappit] MOCK WELCOME EMAIL SENT (RESEND_API_KEY is missing or unconfigured)');
      console.log(`To: ${email}`);
      console.log(`Subject: ⚡ Welcome to Zappit, ${name}!`);
      console.log(`College: ${college}`);
      console.log('========================================================================');
      return res.status(200).json({ 
        success: true, 
        message: 'Mock welcome email logged to server console (RESEND_API_KEY missing)',
        mocked: true 
      });
    }

  } catch (err) {
    console.error('Send Welcome Email Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/get-coupons - MongoDB only
router.get('/get-coupons', async (req, res) => {
  try {
    const mongoCoupons = await Coupon.find({});
    const coupons = mongoCoupons.map(c => ({
      id: c._id.toString(),
      code: c.code,
      discount_percent: c.discount_percent,
      college_id: c.college_id,
      once_per_user: c.once_per_user,
      active: c.active,
      created_at: c.createdAt,
      updated_at: c.updatedAt
    }));
    return res.status(200).json({ success: true, coupons, source: 'mongodb' });
  } catch (err) {
    console.error('[Zappit Coupon] get-coupons error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/verify-coupon - MongoDB only
router.post('/verify-coupon', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, error: 'code is required' });
    }
    const codeToQuery = code.toUpperCase().trim();
    const c = await Coupon.findOne({ code: codeToQuery, active: true });
    if (!c) {
      return res.status(404).json({ success: false, error: 'Coupon not found or inactive' });
    }
    const coupon = {
      id: c._id.toString(),
      code: c.code,
      discount_percent: c.discount_percent,
      college_id: c.college_id,
      once_per_user: c.once_per_user,
      active: c.active,
      created_at: c.createdAt,
      updated_at: c.updatedAt
    };
    return res.status(200).json({ success: true, coupon, source: 'mongodb' });
  } catch (err) {
    console.error('[Zappit Coupon] verify-coupon error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/save-coupon
// POST /api/save-coupon - MongoDB only
router.post('/save-coupon', async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden: Admins only' });
    }
    const { id, code, discount_percent, college_id, once_per_user, active } = req.body;
    if (!code || discount_percent === undefined) {
      return res.status(400).json({ success: false, error: 'code and discount_percent are required' });
    }
    const mongoData = {
      code: code.toUpperCase().trim(),
      discount_percent: Number(discount_percent),
      college_id: college_id || 'all',
      once_per_user: once_per_user !== false,
      active: active !== false,
    };
    let mongoCoupon;
    if (id && mongoose.Types.ObjectId.isValid(id)) {
      mongoCoupon = await Coupon.findByIdAndUpdate(id, mongoData, { new: true, upsert: true });
    } else {
      mongoCoupon = await Coupon.findOneAndUpdate({ code: mongoData.code }, mongoData, { new: true, upsert: true, setDefaultsOnInsert: true });
    }
    return res.status(200).json({ success: true, message: 'Coupon saved to MongoDB', id: mongoCoupon._id.toString(), source: 'mongodb' });
  } catch (err) {
    console.error('[Zappit Coupon] save-coupon error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/delete-coupon - MongoDB only
router.post('/delete-coupon', async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden: Admins only' });
    }
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, error: 'id is required' });
    }
    if (mongoose.Types.ObjectId.isValid(id)) {
      await Coupon.deleteOne({ _id: id });
    } else {
      await Coupon.deleteOne({ code: id });
    }
    return res.status(200).json({ success: true, message: 'Coupon deleted successfully', source: 'mongodb' });
  } catch (err) {
    console.error('[Zappit Coupon] delete-coupon error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
