const { admin } = require('../firebase');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Unauthorized: No token provided' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    // Attach base Firebase info
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email
    };

    let role = 'user';
    const dbUser = await User.findById(decodedToken.uid);
    
    if (dbUser) {
      if (dbUser.blocked) {
        return res.status(403).json({ success: false, error: 'Forbidden: Account blocked' });
      }
      role = dbUser.role || 'user';
    }

    // Check Firestore staff collection if not admin in MongoDB
    if (role !== 'admin') {
      try {
        const staffDoc = await admin.firestore().collection('staff').doc(decodedToken.uid).get();
        if (staffDoc.exists) {
          role = staffDoc.data().role || role; // 'store_owner' or 'delivery'
          req.user.staff_store_id = staffDoc.data().store_id;
          req.user.staff_college_id = staffDoc.data().college_id;
        }
      } catch (err) {
        console.error('Firestore staff fetch error:', err.message);
      }
    }

    req.user.role = role;

    next();
  } catch (error) {
    console.error('Auth Middleware Error:', error);
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid token' });
  }
};

module.exports = authMiddleware;
