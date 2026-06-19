const admin = require('firebase-admin');

// Initialize firebase-admin once (singleton pattern for serverless)
if (!admin.apps.length) {
  try {
    const serviceAccount = process.env.FIREBASE_PROJECT_ID
      ? {
          project_id: process.env.FIREBASE_PROJECT_ID,
          client_email: process.env.FIREBASE_CLIENT_EMAIL,
          private_key: process.env.FIREBASE_PRIVATE_KEY
            ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
            : undefined,
        }
      : require('../backend/serviceAccountKey.json');

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (e) {
    console.error('[Zappit Vercel] Firebase Admin init error:', e);
  }
}

const db = admin.firestore();

// Status → notification message map
const STATUS_MESSAGES = {
  preparing:        { title: '⚡ Order Accepted!',        body: 'Your order at Zappit is now being prepared by the store. Hang tight!' },
  ready:            { title: '🍱 Order Ready!',            body: 'Your order is packed and ready for pickup by the delivery partner.' },
  out_for_delivery: { title: '🛵 Out for Delivery!',      body: 'Your order has been picked up! Share your OTP with the delivery partner upon arrival.' },
  delivered:        { title: '✅ Order Delivered!',        body: 'Your order has been delivered. Enjoy your meal! Thanks for ordering with Zappit 🎉' },
  cancelled:        { title: '❌ Order Cancelled',          body: 'Unfortunately your order has been cancelled. Please contact support if this was unexpected.' },
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { orderId, status } = req.body;

    if (!orderId || !status) {
      return res.status(400).json({ success: false, error: 'orderId and status are required' });
    }

    const msg = STATUS_MESSAGES[status];
    if (!msg) {
      return res.status(400).json({ success: false, error: `Unknown status: ${status}` });
    }

    // 1. Update order status in Firestore (Admin SDK bypasses security rules)
    await db.collection('orders').doc(orderId).update({
      order_status: status,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`[Zappit] Order ${orderId} status updated to: ${status}`);

    const msg = STATUS_MESSAGES[status];

    // 2. Fetch order to get user_id (re-fetch after update)
    const orderSnap = await db.collection('orders').doc(orderId).get();
    const order = orderSnap.data();
    const userId = order.user_id || order.userId;

    if (!msg) {
      return res.status(200).json({ success: true, updated: true, skipped: true, reason: 'No push message for this status' });
    }

    if (!userId) {
      return res.status(200).json({ success: false, skipped: true, error: 'No user_id on order — cannot send push' });
    }

    // 2. Fetch user to get fcmToken
    const userSnap = await db.collection('users').doc(userId).get();
    if (!userSnap.exists) {
      return res.status(200).json({ success: false, skipped: true, error: 'User not found in Firestore' });
    }
    const user = userSnap.data();
    const fcmToken = user.fcmToken;

    if (!fcmToken) {
      return res.status(200).json({
        success: false,
        skipped: true,
        error: 'User has no FCM token — push notifications not enabled on their device',
      });
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
    console.log(`[Zappit Vercel FCM] Push sent for order ${orderId} → ${status} | Response:`, response);

    return res.status(200).json({ success: true, message: 'Push notification sent', fcmResponse: response });
  } catch (err) {
    console.error('[Zappit Vercel FCM] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
