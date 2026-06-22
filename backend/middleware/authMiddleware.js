const { admin } = require('../firebase');
const User = require('../models/User');

// Short-lived in-memory cache for staff role lookups (Firestore).
// Staff assignment doesn't change second-to-second, so caching for a
// short window removes a network round trip from the hot path on
// almost every authenticated request, which was the source of the
// per-request slowdown.
const staffCache = new Map(); // uid -> { data, expiresAt }
const STAFF_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const getCachedStaffDoc = async (uid) => {
  const cached = staffCache.get(uid);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const staffDoc = await admin.firestore().collection('staff').doc(uid).get();
  const data = staffDoc.exists ? staffDoc.data() : null;
  staffCache.set(uid, { data, expiresAt: Date.now() + STAFF_CACHE_TTL_MS });
  return data;
};

// Wrap a promise so a slow/hanging network call (Firebase/Firestore)
// fails fast instead of hanging the whole request for tens of seconds.
const withTimeout = (promise, ms, label) => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    )
  ]);
};

const authMiddleware = async (req, res, next) => {
  // Bypass auth only for specific public routes (exact path match)
  const rawPath = (req.originalUrl || '').split('?')[0]; // strip query params
  const PUBLIC_PATHS = ['/api/verify-payment-redirect'];
  const isTrackingPath = /^\/api\/track\/[^/]+$/.test(rawPath);
  if (PUBLIC_PATHS.includes(rawPath) || isTrackingPath) {
    return next();
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Unauthorized: No token provided' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await withTimeout(
      admin.auth().verifyIdToken(idToken),
      8000,
      'Firebase token verification'
    );

    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email
    };

    // Mongo lookup and Firestore staff lookup don't depend on each other
    // (both only need decodedToken.uid), so run them in parallel instead
    // of serially.
    const [dbUser, staffData] = await Promise.all([
      User.findById(decodedToken.uid),
      getCachedStaffDoc(decodedToken.uid).catch((err) => {
        console.error('Firestore staff fetch error:', err.message);
        return null;
      })
    ]);

    if (dbUser && dbUser.blocked) {
      return res.status(403).json({ success: false, error: 'Forbidden: Account blocked' });
    }

    let role = (dbUser && dbUser.role) || 'user';

    if (role !== 'admin' && staffData) {
      role = staffData.role || role;
      req.user.staff_store_id = staffData.store_id;
      req.user.staff_college_id = staffData.college_id;
    }

    req.user.role = role;

    next();
  } catch (error) {
    console.error('Auth Middleware Error:', error);
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid token' });
  }
};

module.exports = authMiddleware;