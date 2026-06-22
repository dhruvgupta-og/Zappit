import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin, Clock, Star, Zap } from 'lucide-react';
import api, { warmUp } from '../utils/api';
import axios from 'axios';
import { auth } from '../firebase';

const HomePage = () => {
  const navigate = useNavigate();
  const [allStores, setAllStores] = useState(() => {
    const cached = localStorage.getItem('zappit_stores');
    return cached ? JSON.parse(cached) : [];
  });
  const [banners, setBanners] = useState(() => {
    const cached = localStorage.getItem('zappit_banners');
    return cached ? JSON.parse(cached) : [];
  });
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [loading, setLoading] = useState(() => !localStorage.getItem('zappit_stores'));
  const [wakingUp, setWakingUp] = useState(false);
  const [showToast, setShowToast] = useState(null); // { message, type }
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const getCleanLS = (key) => {
    const val = localStorage.getItem(key);
    return (val === 'null' || val === 'undefined' || !val) ? null : val;
  };

  const [address, setAddress] = useState(getCleanLS('userAddress') || 'Engineering Block A');
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [userCollege, setUserCollege] = useState({ 
    id: getCleanLS('userCollegeId'), 
    name: getCleanLS('userCollegeName') || getCleanLS('userCollege') 
  });

  const handleAddressSave = (e) => {
    setAddress(e.target.value);
    localStorage.setItem('userAddress', e.target.value);
  };

  useEffect(() => {
    // Fetch stores and banners from MongoDB via API
    const fetchData = async () => {
      try {
        // First, quietly check if server is alive; if not, warm it up
        try {
          await axios.get(`${api.defaults.baseURL || ''}/api/health`, { timeout: 4000 });
        } catch {
          setWakingUp(true);
          await warmUp();
          setWakingUp(false);
        }

        const [storesRes, bannersRes] = await Promise.all([
          api.get('/api/stores'),
          api.get('/api/stores/banners/active')
        ]);

        if (storesRes.data.success) {
          setAllStores(storesRes.data.stores);
          localStorage.setItem('zappit_stores', JSON.stringify(storesRes.data.stores));
        }
        if (bannersRes.data.success) {
          const activeBanners = bannersRes.data.banners.filter(b => b.active !== false);
          setBanners(activeBanners);
          localStorage.setItem('zappit_banners', JSON.stringify(activeBanners));
        }
      } catch (err) {
        console.error('Failed to fetch home data:', err.message);
      } finally {
        setLoading(false);
        setWakingUp(false);
      }
    };

    fetchData();

    // ── SYNC USER COLLEGE FROM LOCALSTORAGE / FIREBASE AUTH ──
    const unsubAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        // Try to get college from localStorage (set during onboarding/profile save)
        const collegeId = localStorage.getItem('userCollegeId');
        const collegeName = localStorage.getItem('userCollegeName') || localStorage.getItem('userCollege');
        if (collegeId || collegeName) {
          setUserCollege({ id: collegeId, name: collegeName });
        }
        if (user.displayName) localStorage.setItem('userName', user.displayName);
      }
    });

    return () => unsubAuth();
  }, []);

  // ── FILTER STORES ──
  const filteredByCollege = React.useMemo(() => {
    if (!userCollege.id && !userCollege.name) return allStores;
    return allStores.filter(store => {
      // 1. If store is global (no college assigned), show to everyone
      if (!store.college_id && !store.college_name) return true;

      // 2. Match by Firestore document ID (most reliable)
      if (userCollege.id && store.college_id && store.college_id === userCollege.id) return true;

      // 3. Match by college name (case-insensitive fallback)
      if (userCollege.name && store.college_name &&
          userCollege.name.trim().toLowerCase() === store.college_name.trim().toLowerCase()) return true;

      // 4. Match store's college_id against user's college_name via direct comparison
      //    (handles case where store was saved with id but user only has name)
      if (userCollege.name && store.college_id) {
        // check if the store's college_id produces a matching name via localStorage/state
        const storedCollegeId = localStorage.getItem('userCollegeId');
        if (storedCollegeId && store.college_id === storedCollegeId) return true;
      }

      return false;
    });
  }, [allStores, userCollege]);

  const filteredStores = React.useMemo(() => {
    return filteredByCollege.filter(store => {
      const matchesSearch = store.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            (store.menuItemsForSearch && store.menuItemsForSearch.some(item => item.includes(searchQuery.toLowerCase())));
      const matchesCategory = activeCategory === 'All' || (store.tags && store.tags.includes(activeCategory));
      return matchesSearch && matchesCategory;
    });
  }, [filteredByCollege, searchQuery, activeCategory]);

  // ── BANNER CAROUSEL LOGIC ──
  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentBannerIndex(prev => (prev + 1) % banners.length);
    }, 7000);
    return () => clearInterval(interval);
  }, [banners.length]);

  const handleBannerClick = (b) => {
    // 1. Copy Coupon if present
    if (b.coupon_code) {
      navigator.clipboard.writeText(b.coupon_code);
      setShowToast({ message: `Coupon "${b.coupon_code}" Copied!`, type: 'success' });
      setTimeout(() => setShowToast(null), 3000);
    }

    // 2. Redirect if link present (with tiny delay to show toast)
    if (b.link) {
      setTimeout(() => {
        if (b.link.startsWith('http')) {
          window.open(b.link, '_blank');
        } else {
          navigate(b.link);
        }
      }, 600);
    }
  };



  return (
    <div className="animate-fade-in" style={{ paddingBottom: '80px' }}>
      {/* Header */}
      <header className="header" style={{ alignItems: 'flex-start' }}>
        <div className="flex flex-col gap-0" style={{ flex: 1, minWidth: 0, marginRight: '12px' }}>
          <span className="flex items-center gap-1.5" style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
            <MapPin size={14} /> Delivering to
          </span>
          {isEditingAddress ? (
            <input 
              type="text" 
              value={address} 
              onChange={handleAddressSave}
              onBlur={() => setIsEditingAddress(false)}
              onKeyDown={(e) => e.key === 'Enter' && setIsEditingAddress(false)}
              autoFocus
              style={{ fontSize: '1.1rem', border: 'none', borderBottom: '2px solid var(--primary)', outline: 'none', background: 'transparent', fontWeight: 700, width: '100%', color: 'var(--text-main)' }}
            />
          ) : (
            <div onClick={() => setIsEditingAddress(true)} style={{ cursor: 'pointer', minWidth: 0 }}>
              <h2 style={{ fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{address}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--primary)', flexShrink: 0 }}>✎</span>
              </h2>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {localStorage.getItem('userCollegeName') || localStorage.getItem('userCollege') || 'Campus'}
              </div>
            </div>
          )}
        </div>
        <div className="btn-icon" style={{ marginTop: '4px', background: 'var(--primary-gradient)', border: 'none', width: '36px', height: '36px', boxShadow: '0 4px 10px rgba(255,193,7,0.3)' }} onClick={() => navigate('/profile')}>
          <Zap size={18} color="white" fill="white" />
        </div>
      </header>

      <div style={{ padding: '20px' }}>
        {/* Banner Carousel */}
        {banners.length > 0 && (
          <div style={{ marginBottom: '24px', position: 'relative', width: '100%', aspectRatio: '3/1', borderRadius: '16px', overflow: 'hidden', boxShadow: 'var(--shadow-md)' }}>
            <div 
              style={{ 
                display: 'flex', 
                transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)', 
                transform: `translateX(-${currentBannerIndex * 100}%)`,
                height: '100%' 
              }}
            >
              {banners.map((b, i) => (
                <div 
                  key={b.id} 
                  onClick={() => handleBannerClick(b)}
                  style={{ flexShrink: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                >
                  <img src={b.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Promo" />
                </div>
              ))}
            </div>
            {/* Pagination Dots */}
            <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 5 }}>
              {banners.map((_, i) => (
                <div 
                  key={i} 
                  style={{ 
                    width: currentBannerIndex === i ? 18 : 5, 
                    height: 5, 
                    borderRadius: 10, 
                    background: currentBannerIndex === i ? 'white' : 'rgba(255,255,255,0.4)', 
                    transition: 'all 0.4s ease',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                  }} 
                />
              ))}
            </div>

            {/* Navigation Arrows (No-Icon Fix) */}
            {banners.length > 1 && (
              <>
                <button 
                  onClick={(e) => { e.stopPropagation(); setCurrentBannerIndex(prev => (prev === 0 ? banners.length - 1 : prev - 1)); }} 
                  style={{ 
                    position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', 
                    background: 'rgba(0,0,0,0.5)', border: 'none', width: 32, height: 32, borderRadius: '50%', 
                    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    cursor: 'pointer', zIndex: 10, fontSize: '1.2rem', fontWeight: 800, padding: 0
                  }}
                >
                  ‹
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setCurrentBannerIndex(prev => (prev === banners.length - 1 ? 0 : prev + 1)); }} 
                  style={{ 
                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', 
                    background: 'rgba(0,0,0,0.5)', border: 'none', width: 32, height: 32, borderRadius: '50%', 
                    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    cursor: 'pointer', zIndex: 10, fontSize: '1.2rem', fontWeight: 800, padding: 0
                  }}
                >
                  ›
                </button>
              </>
            )}
          </div>
        )}

        {/* Search Bar */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{
            background: 'var(--card-bg)',
            padding: '12px 16px',
            borderRadius: '12px',
            boxShadow: 'var(--shadow-sm)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input 
              type="text" 
              placeholder="Search for restaurants or dishes..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ border: 'none', outline: 'none', width: '100%', fontSize: '1rem', background: 'transparent', color: 'var(--text-main)' }}
            />
          </div>
        </div>

        {/* Categories */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '16px', fontSize: '1.125rem' }}>Categories</h3>
          <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px', scrollbarWidth: 'none' }}>
            {['All', 'Snacks', 'Meals', 'Drinks', 'Healthy'].map((cat, i) => (
              <button 
                key={i} 
                onClick={() => setActiveCategory(cat)}
                className={`tag ${activeCategory === cat ? 'highlight' : ''}`} 
                style={{ padding: '8px 16px', fontSize: '0.875rem', whiteSpace: 'nowrap', border: 'none', cursor: 'pointer', outline: 'none' }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Store Listing */}
        <div>
          <h3 style={{ marginBottom: '16px', fontSize: '1.125rem' }}>Restaurants near you</h3>
          <div className="flex flex-col gap-4">
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                {wakingUp ? (
                  <>
                    <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>⚡</div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)', marginBottom: '6px' }}>Starting up...</div>
                    <div style={{ fontSize: '0.85rem' }}>Our server is warming up. This takes ~30 seconds on first visit.</div>
                    <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center' }}>
                      <div style={{ width: 36, height: 36, border: '3px solid var(--border-color)', borderTop: '3px solid var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    </div>
                  </>
                ) : (
                  <div>Loading stores...</div>
                )}
              </div>
            ) : filteredStores.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔍</div>
                <h3 style={{ margin: '0 0 8px', color: 'var(--text-main)' }}>No matches found</h3>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>Try searching for a different keyword or category.</p>
                <div style={{ marginTop: '20px', padding: '10px', background: 'rgba(255,0,0,0.1)', color: '#ff6b6b', fontSize: '0.8rem', borderRadius: '8px', textAlign: 'left' }}>
                  <strong>Debug Info:</strong><br/>
                  Total Stores fetched: {allStores.length}<br/>
                  User College: {userCollege.name} (ID: {userCollege.id || 'none'})<br/>
                  LocalStorage ID: {localStorage.getItem('userCollegeId') || 'none'}
                </div>
              </div>
            ) : filteredStores.map(store => (
              <Link to={`/store/${store.id}`} key={store.id} style={{ textDecoration: 'none' }}>
                <div className="card card-interactive" style={{ padding: 0, overflow: 'hidden', position: 'relative', opacity: store.is_open !== false ? 1 : 0.7, filter: store.is_open !== false ? 'none' : 'grayscale(0.8)' }}>
                  <div style={{ position: 'relative', height: '160px' }}>
                    <img src={store.image} alt={store.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    {!store.is_open && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ color: 'white', fontWeight: 700, fontSize: '1.25rem', padding: '8px 16px', background: 'rgba(0,0,0,0.6)', borderRadius: '8px' }}>CLOSED</span>
                      </div>
                    )}
                    <div style={{ position: 'absolute', top: '12px', right: '12px', background: 'var(--bg-color)', padding: '4px 8px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-main)' }}>
                      <Star size={14} fill="#F59E0B" color="#F59E0B" /> {store.rating}
                    </div>
                  </div>
                  <div style={{ padding: '16px' }}>
                    <div className="flex justify-between items-center" style={{ marginBottom: '8px' }}>
                      <h4 style={{ fontSize: '1.125rem', margin: 0, color: 'var(--text-main)' }}>{store.name}</h4>
                      <div style={{ textAlign: 'right' }}>
                        <span className="flex items-center gap-1" style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 500, justifyContent: 'flex-end' }}>
                          <Clock size={14} /> {store.delivery_time_mins} mins
                        </span>
                        <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 700, marginTop: 2 }}>
                          📍 {store.college_name || 'All Campuses'}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                      {store.tags && store.tags.map(tag => (
                        <span key={tag} className="tag">{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
      {/* Toast Notification */}
      {showToast && (
        <div style={{ 
          position: 'fixed', 
          bottom: '120px', 
          left: '50%', 
          transform: 'translateX(-50%)', 
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', 
          color: 'white', 
          padding: '16px 32px', 
          borderRadius: '16px', 
          fontSize: '1rem', 
          fontWeight: 800, 
          boxShadow: '0 20px 40px rgba(0,0,0,0.4)', 
          zIndex: 9999, 
          display: 'flex', 
          alignItems: 'center', 
          gap: 12, 
          border: '1px solid rgba(255,255,255,0.1)',
          whiteSpace: 'nowrap',
          animation: 'slideUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)' 
        }}>
          <span style={{ fontSize: '1.4rem' }}>✨</span> {showToast.message}
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { bottom: 50px; opacity: 0; }
          to { bottom: 100px; opacity: 1; }
        }
      `}</style>
      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '16px 24px 8px', marginTop: 8 }}>
        <Link
          to="/privacy-policy"
          style={{
            color: 'var(--text-muted)',
            fontSize: '0.8rem',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            opacity: 0.7,
            transition: 'opacity 0.2s',
          }}
          onMouseOver={e => e.currentTarget.style.opacity = 1}
          onMouseOut={e => e.currentTarget.style.opacity = 0.7}
        >
          🔒 Privacy Policy
        </Link>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: '0 10px', opacity: 0.4 }}>·</span>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', opacity: 0.5 }}>© 2026 Zappit</span>
      </div>

    </div>
  );
};

export default HomePage;
