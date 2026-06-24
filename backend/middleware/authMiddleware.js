const { admin } = require('../firebase');
const User = require('../models/User');
const Staff = require('../models/Staff');

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

    // Run MongoDB queries in parallel
    const [dbUser, staffData] = await Promise.all([
      User.findById(decodedToken.uid),
      Staff.findById(decodedToken.uid)
    ]);

    if (dbUser && dbUser.blocked) {
      return res.status(403).json({ success: false, error: 'Forbidden: Account blocked' });
    }

    let role = (dbUser && dbUser.role) || 'user';

    if (role !== 'admin' && staffData) {
      role = staffData.role || role;
      req.user.staff_store_id = staffData.store_id;
      req.user.staff_college_id = staffData.college_id;
      // Add extra staff data so userRoutes.js can return it for login
      req.user.staff_name = staffData.name;
      req.user.staff_store_name = staffData.store_name;
      req.user.staff_college_name = staffData.college_name;
    }

    req.user.role = role;

    next();
  } catch (error) {
    console.error('Auth Middleware Error:', error);
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid token' });
  }
};

module.exports = authMiddleware;