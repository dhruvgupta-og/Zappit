import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { Home, ShoppingCart, ShoppingBag, User } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import api from './utils/api';
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
import PrivacyPolicy from './pages/PrivacyPolicy';

const DASHBOARD_PATHS = ['/login', '/store-dashboard', '/delivery-dashboard', '/admin-secure-dashboard', '/onboarding', '/staff-login', '/payment-callback'];

// Routes that bypass maintenance mode (admin/staff only)
const BYPASS_MAINTENANCE_PATHS = ['/admin-secure-dashboard', '/store-dashboard', '/delivery-dashboard', '/staff-login'];

// ── Maintenance Screen
const MaintenancePage = () => (
  <div style={{
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    textAlign: 'center',
    fontFamily: "'Inter', sans-serif"
  }}>
    <div style={{
      width: 100, height: 100, borderRadius: 28,
      background: 'linear-gradient(135deg, #EF4444, #DC2626)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      marginBottom: 28, boxShadow: '0 20px 60px rgba(239,68,68,0.4)',
      animation: 'pulse 2s infinite'
    }}>
      <span style={{ fontSize: 48 }}>🔧</span>
    </div>
    <h1 style={{ color: 'white', fontSize: '2rem', fontWeight: 900, margin: '0 0 12px' }}>
      We'll be back soon!
    </h1>
    <p style={{ color: '#94A3B8', fontSize: '1rem', lineHeight: 1.7, maxWidth: 360, margin: '0 0 32px' }}>
      Zappit is currently undergoing maintenance. We're working hard to get back online.
      Please check back in a little while!
    </p>
    <div style={{
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 14,
      padding: '16px 24px',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#EF4444', animation: 'blink 1.2s infinite' }} />
      <span style={{ color: '#CBD5E1', fontSize: '0.9rem', fontWeight: 600 }}>Maintenance in progress</span>
    </div>
    <style>{`
      @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.06)} }
      @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.2} }
    `}</style>
  </div>
);

// ── Auth Guard: redirects to login if not authenticated, onboarding if profile incomplete
const AuthGuard = ({ children, user, profileComplete, checkingAuth }) => {
  const location = useLocation();
  const publicPaths = ['/login', '/store-dashboard', '/delivery-dashboard', '/admin-secure-dashboard', '/staff-login', '/privacy-policy'];

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

// ── Maintenance Gate: wraps customer routes, bypasses admin/staff paths
const MaintenanceGate = ({ isMaintenance, children }) => {
  const location = useLocation();
  const isBypass = BYPASS_MAINTENANCE_PATHS.some(p => location.pathname.startsWith(p));
  if (isMaintenance && !isBypass) return <MaintenancePage />;
  return children;
};

function App() {
  const [user, setUser] = useState(null);
  const [profileComplete, setProfileComplete] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isMaintenance, setIsMaintenance] = useState(false);

  // Check maintenance mode on load (no auth required - public endpoint)
  useEffect(() => {
    api.get('/api/admin/config/maintenance')
      .then(res => {
        if (res.data?.data?.isMaintenanceMode) setIsMaintenance(true);
      })
      .catch(() => {});
  }, []);

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
        const res = await api.get(`/api/users/${firebaseUser.uid}`);
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
        <MaintenanceGate isMaintenance={isMaintenance}>
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
                  <Route path="/admin-secure-dashboard" element={<AdminDashboard />} />
                  <Route path="/payment-callback" element={<PaymentCallback />} />
                  <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                </Routes>
              </AuthGuard>
            </div>
            <BottomNav />
          </div>
        </MaintenanceGate>
      </Router>
    </CartProvider>
  );
}

export default App;
