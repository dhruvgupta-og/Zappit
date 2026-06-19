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

    // Update the order status in MongoDB
    await Order.findByIdAndUpdate(orderId, { order_status: status });

    // 1. Fetch order to get user_id
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
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
    const { amount, receipt } = req.body;

    if (amount === undefined) {
      return res.status(400).json({ success: false, error: 'Amount is required' });
    }

    const amountInPaise = Math.round(Number(amount));

    if (amountInPaise < 100) {
      return res.status(400).json({ success: false, error: 'Minimum payment amount is 100 paise (₹1)' });
    }

    if (!razorpay) {
      return res.status(503).json({
        success: false,
        error: 'Payment service is currently unavailable (Razorpay keys missing)'
      });
    }

    const options = {
      amount: amountInPaise,
      currency: "INR",
      receipt: receipt || `order_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);

    res.status(200).json({
      success: true,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: process.env.RAZORPAY_KEY_ID
    });
  } catch (err) {
    console.error('Razorpay Create Order Error:', err);
    // Handle auth failure (return 401)
    if (err.statusCode === 401 || err.status === 401) {
      return res.status(401).json({ success: false, error: 'Razorpay authentication failed' });
    }
    // Handle other Razorpay API/internal errors (return 500)
    res.status(500).json({ success: false, error: err.message || 'Razorpay API Error' });
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

    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generated_signature = hmac.digest('hex');

    if (generated_signature === razorpay_signature) {
      res.status(200).json({ success: true, verified: true });
    } else {
      res.status(400).json({ success: false, verified: false, error: 'Signature mismatch' });
    }
  } catch (err) {
    console.error('Razorpay Verification Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/send-order-email
router.post('/send-order-email', async (req, res) => {
  try {
    const { email, orderIds, storeNames, items, totalAmount, deliveryOtp, address, fees, appliedCoupon } = req.body;

    if (!email || !orderIds || !items || totalAmount === undefined || !deliveryOtp) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const subtotal = items.reduce((sum, item) => sum + (Number(item.price) * Number(item.qty)), 0);

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
    if (fees && Array.isArray(fees)) {
      feesHtml = fees.map(f => `
        <tr>
          <td colspan="2" style="padding: 6px 0; font-size: 14px; color: #4b5563;">${f.name}</td>
          <td style="padding: 6px 0; font-size: 14px; color: #4b5563; text-align: right;">₹${f.value}</td>
        </tr>
      `).join('');
    }

    let discountHtml = '';
    if (appliedCoupon) {
      const discountVal = Math.round((subtotal * Number(appliedCoupon.discount_percent)) / 100);
      discountHtml = `
        <tr style="color: #10b981;">
          <td colspan="2" style="padding: 6px 0; font-size: 14px; font-weight: 500;">Discount (${appliedCoupon.code} - ${appliedCoupon.discount_percent}%)</td>
          <td style="padding: 6px 0; font-size: 14px; text-align: right; font-weight: 600;">-₹${discountVal}</td>
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

// Helper to race a promise with a timeout
const withTimeout = (promise, timeoutMs = 3000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore operation timed out')), timeoutMs))
  ]);
};

// GET /api/get-coupons
router.get('/get-coupons', async (req, res) => {
  try {
    let coupons = [];
    let source = 'firestore';
    try {
      const snap = await withTimeout(db.collection('coupons').get(), 3000);
      coupons = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.warn('[Zappit Coupon] Firestore get failed/timed out, using MongoDB only:', err.message);
      source = 'mongodb';
    }

    // Merge with MongoDB coupons
    const mongoCoupons = await Coupon.find({});
    const mongoCouponsMapped = mongoCoupons.map(c => ({
      id: c._id.toString(),
      code: c.code,
      discount_percent: c.discount_percent,
      college_id: c.college_id,
      once_per_user: c.once_per_user,
      active: c.active,
      created_at: c.createdAt,
      updated_at: c.updatedAt
    }));

    if (source === 'mongodb') {
      coupons = mongoCouponsMapped;
    } else {
      // Merge: avoid duplicates by code
      const existingCodes = new Set(coupons.map(c => c.code));
      for (const mc of mongoCouponsMapped) {
        if (!existingCodes.has(mc.code)) {
          coupons.push(mc);
        }
      }
    }

    return res.status(200).json({ success: true, coupons, source });
  } catch (err) {
    console.error('[Zappit Coupon] get-coupons error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/verify-coupon
router.post('/verify-coupon', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, error: 'code is required' });
    }
    const codeToQuery = code.toUpperCase().trim();
    let coupon = null;
    let source = 'firestore';

    try {
      const snap = await withTimeout(db.collection('coupons').where('code', '==', codeToQuery).get(), 3000);
      if (!snap.empty) {
        coupon = { id: snap.docs[0].id, ...snap.docs[0].data() };
      }
    } catch (err) {
      console.warn('[Zappit Coupon] Firestore verify failed/timed out, checking MongoDB:', err.message);
    }

    // If not found in Firestore or Firestore failed/timed out, check MongoDB
    if (!coupon) {
      const c = await Coupon.findOne({ code: codeToQuery });
      if (c) {
        coupon = {
          id: c._id.toString(),
          code: c.code,
          discount_percent: c.discount_percent,
          college_id: c.college_id,
          once_per_user: c.once_per_user,
          active: c.active,
          created_at: c.createdAt,
          updated_at: c.updatedAt
        };
        source = 'mongodb';
      }
    }

    if (!coupon) {
      return res.status(404).json({ success: false, error: 'Coupon not found' });
    }

    return res.status(200).json({ success: true, coupon, source });
  } catch (err) {
    console.error('[Zappit Coupon] verify-coupon error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/save-coupon
router.post('/save-coupon', async (req, res) => {
  console.log('[DEBUG] Inside save-coupon route handler');
  try {
    const { id, code, discount_percent, college_id, once_per_user, active } = req.body;
    console.log('[DEBUG] Request body parsed:', { id, code, discount_percent });

    if (!code || discount_percent === undefined) {
      return res.status(400).json({ success: false, error: 'code and discount_percent are required' });
    }

    const data = {
      code: code.toUpperCase().trim(),
      discount_percent: Number(discount_percent),
      college_id: college_id || 'all',
      once_per_user: once_per_user !== false,
      active: active !== false,
      updated_at: new Date().toISOString()
    };

    let firestoreSuccess = false;
    let savedId = id;

    // 1. Try Firestore with timeout
    try {
      if (id && !mongoose.Types.ObjectId.isValid(id)) {
        await withTimeout(db.collection('coupons').doc(id).update(data), 3000);
        console.log(`[Zappit Coupon] Updated coupon in Firestore: ${id} (${data.code})`);
        firestoreSuccess = true;
      } else if (!id) {
        data.created_at = new Date().toISOString();
        const docRef = await withTimeout(db.collection('coupons').add(data), 3000);
        savedId = docRef.id;
        console.log(`[Zappit Coupon] Created coupon in Firestore: ${savedId} (${data.code})`);
        firestoreSuccess = true;
      }
    } catch (err) {
      console.warn(`[Zappit Coupon] Firestore write failed/timed out. Falling back to MongoDB. Error: ${err.message}`);
    }

    // 2. Save/Sync to MongoDB
    const mongoData = {
      code: data.code,
      discount_percent: data.discount_percent,
      college_id: data.college_id,
      once_per_user: data.once_per_user,
      active: data.active
    };

    let mongoCoupon;
    if (id && mongoose.Types.ObjectId.isValid(id)) {
      mongoCoupon = await Coupon.findByIdAndUpdate(id, mongoData, { new: true, upsert: true });
    } else {
      mongoCoupon = await Coupon.findOneAndUpdate({ code: data.code }, mongoData, { new: true, upsert: true });
    }

    if (!savedId) {
      savedId = mongoCoupon._id.toString();
    }

    return res.status(200).json({ 
      success: true, 
      message: firestoreSuccess ? 'Coupon saved to Firestore and synced to MongoDB' : 'Coupon saved to MongoDB (Firestore offline/quota exceeded)', 
      id: savedId,
      source: firestoreSuccess ? 'firestore' : 'mongodb'
    });
  } catch (err) {
    console.error('[Zappit Coupon] save-coupon error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/delete-coupon
router.post('/delete-coupon', async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, error: 'id is required' });
    }

    // 1. Try to delete from Firestore with timeout
    let firestoreSuccess = false;
    if (id && !mongoose.Types.ObjectId.isValid(id)) {
      try {
        await withTimeout(db.collection('coupons').doc(id).delete(), 3000);
        console.log(`[Zappit Coupon] Deleted coupon in Firestore: ${id}`);
        firestoreSuccess = true;
      } catch (err) {
        console.warn(`[Zappit Coupon] Firestore delete failed/timed out. Error: ${err.message}`);
      }
    }

    // 2. Delete from MongoDB
    let mongoDeleteCount = 0;
    if (mongoose.Types.ObjectId.isValid(id)) {
      const deleteRes = await Coupon.deleteOne({ _id: id });
      mongoDeleteCount = deleteRes.deletedCount;
    }
    const deleteByCodeRes = await Coupon.deleteOne({ code: id });
    
    console.log(`[Zappit Coupon] Deleted from MongoDB. Delete count: ${mongoDeleteCount || deleteByCodeRes.deletedCount}`);

    return res.status(200).json({ 
      success: true, 
      message: 'Coupon deleted successfully',
      source: firestoreSuccess ? 'firestore' : 'mongodb'
    });
  } catch (err) {
    console.error('[Zappit Coupon] delete-coupon error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
