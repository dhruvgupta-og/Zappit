import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { Home, ShoppingCart, ShoppingBag, User } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import axios from 'axios';
import { CartProvider, useCart } from './CartContext';
import { initFcm } from './utils/fcm';

import HomePage from './pages/Home';
import StorePage from './pages/Store';
import LoginPage from './pages/Login';
import CheckoutPage from './pages/Checkout';
import ProfilePage from './pages/Profile';
import StoreDashboard from './pages/StoreDashboard';
import DeliveryDashboard from './pages/DeliveryDashboard';
import OrderTracker from './pages/OrderTracker';
import AdminDashboard from './pages/AdminDashboard';
import OnboardingPage from './pages/Onboarding';
import StaffLogin from './pages/StaffLogin';
import PaymentCallback from './pages/PaymentCallback';

const DASHBOARD_PATHS = ['/login', '/store-dashboard', '/delivery-dashboard', '/admin', '/onboarding', '/staff-login', '/payment-callback'];

// ── Auth Guard: redirects to login if not authenticated, onboarding if profile incomplete
const AuthGuard = ({ children, user, profileComplete, checkingAuth }) => {
  const location = useLocation();
  const publicPaths = ['/login', '/store-dashboard', '/delivery-dashboard', '/admin', '/staff-login'];

  if (checkingAuth) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 44, height: 44, border: '4px solid #F3F4F6', borderTop: '4px solid var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>Loading...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user && !publicPaths.includes(location.pathname)) {
    return <Navigate to="/login" replace />;
  }

  if (user && !profileComplete && location.pathname !== '/onboarding' && !publicPaths.includes(location.pathname)) {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
};

// ── Bottom Navigation
const BottomNav = () => {
  const location = useLocation();
  const path = location.pathname;
  const { cartCount } = useCart();
  
  if (DASHBOARD_PATHS.includes(path) || path.startsWith('/track/')) return null;

  return (
    <div className="bottom-nav">
      <Link to="/" className={`nav-item ${path === '/' ? 'active' : ''}`}>
        <Home size={24} /><span>Home</span>
      </Link>
      <Link to="/checkout" className={`nav-item ${path === '/checkout' ? 'active' : ''}`} style={{ position: 'relative' }}>
        <ShoppingCart size={24} /><span>Cart</span>
        {cartCount > 0 && (
          <span style={{ position: 'absolute', top: 6, right: '20%', background: 'var(--primary)', color: 'white', fontSize: '0.65rem', fontWeight: 800, padding: '2px 5px', borderRadius: 10, transform: 'translate(50%, -50%)', border: '2px solid white' }}>
            {cartCount}
          </span>
        )}
      </Link>
      <Link to="/orders" className={`nav-item ${path === '/orders' ? 'active' : ''}`}>
        <ShoppingBag size={24} /><span>Orders</span>
      </Link>
      <Link to="/profile" className={`nav-item ${path === '/profile' ? 'active' : ''}`}>
        <User size={24} /><span>Profile</span>
      </Link>
    </div>
  );
};

function App() {
  const [user, setUser] = useState(null);
  const [profileComplete, setProfileComplete] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const authUnsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (!firebaseUser) {
        setProfileComplete(false);
        setCheckingAuth(false);
        return;
      }

      // Check profile completion from MongoDB
      try {
        const res = await axios.get(`/api/users/${firebaseUser.uid}`);
        console.log('DEBUG: Auth User:', firebaseUser.uid);
        console.log('DEBUG: User Profile Exists:', res.data.exists);
        console.log('DEBUG: User Profile Data:', res.data.user);

        const isComplete = res.data.exists && res.data.user?.profile_complete === true;
        console.log('DEBUG: profileComplete calculated:', isComplete);

        if (isComplete) {
          initFcm(firebaseUser.uid);
        }
        setProfileComplete(isComplete);
      } catch (err) {
        console.error('Profile fetch error:', err);
        setProfileComplete(false);
      } finally {
        setCheckingAuth(false);
      }
    });

    return () => authUnsub();
  }, []);

  return (
    <CartProvider>
      <Router>
        <div className="app-container">
          <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '20px' }}>
            <AuthGuard user={user} profileComplete={profileComplete} checkingAuth={checkingAuth}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/onboarding" element={<OnboardingPage />} />
                <Route path="/store/:id" element={<StorePage />} />
                <Route path="/checkout" element={<CheckoutPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/orders" element={<ProfilePage />} />
                <Route path="/track/:orderId" element={<OrderTracker />} />
                <Route path="/store-dashboard" element={<StoreDashboard />} />
                <Route path="/delivery-dashboard" element={<DeliveryDashboard />} />
                <Route path="/staff-login" element={<StaffLogin />} />
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/payment-callback" element={<PaymentCallback />} />
              </Routes>
            </AuthGuard>
          </div>
          <BottomNav />
        </div>
      </Router>
    </CartProvider>
  );
}

export default App;
