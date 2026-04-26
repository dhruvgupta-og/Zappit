import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin, Clock, Star, Zap, ChevronLeft, ChevronRight } from 'lucide-react';
import { collection, getDocs, collectionGroup, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';

const HomePage = () => {
  const navigate = useNavigate();
  const [stores, setStores] = useState([]);
  const [banners, setBanners] = useState([]);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showToast, setShowToast] = useState(null); // { message, type }

  const [address, setAddress] = useState(localStorage.getItem('userAddress') || 'Engineering Block A');
  const [isEditingAddress, setIsEditingAddress] = useState(false);

  const handleAddressSave = (e) => {
    setAddress(e.target.value);
    localStorage.setItem('userAddress', e.target.value);
  };

  useEffect(() => {
    const fetchStores = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'stores'));
        const storesData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Fetch all menus to allow dish searching
        const menuSnapshot = await getDocs(collectionGroup(db, 'menu'));
        const menuDataByStore = {};
        menuSnapshot.docs.forEach(doc => {
          const storeId = doc.ref.parent.parent?.id;
          if (storeId) {
            if (!menuDataByStore[storeId]) menuDataByStore[storeId] = [];
            menuDataByStore[storeId].push(doc.data().name.toLowerCase());
          }
        });

        const storesWithMenu = storesData.map(store => ({
          ...store,
          menuItemsForSearch: menuDataByStore[store.id] || []
        }));

        const userCollegeId = localStorage.getItem('userCollegeId');
        const userCollegeName = localStorage.getItem('userCollegeName') || localStorage.getItem('userCollege');
        if (userCollegeId || userCollegeName) {
          setStores(storesWithMenu.filter(store => store.college_id === userCollegeId || store.college_name === userCollegeName));
        } else {
          setStores(storesWithMenu);
        }
      } catch (err) {
        console.error("Error fetching stores:", err);
      } finally {
        setLoading(false);
      }
    };

    const unsubBanners = onSnapshot(collection(db, 'banners'), (snapshot) => {
      setBanners(snapshot.docs.map(d => ({ id: d.id, ...d.data() })).filter(b => b.active !== false));
    });

    // ── SYNC COLLEGE ID ──
    const syncCollege = async () => {
      const user = auth.currentUser;
      if (user) {
        const { getDoc, doc } = await import('firebase/firestore');
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          const data = snap.data();
          if (data.college_id) localStorage.setItem('userCollegeId', data.college_id);
          if (data.college_name) localStorage.setItem('userCollegeName', data.college_name);
          if (data.name) localStorage.setItem('userName', data.name);
        }
      }
    };

    fetchStores();
    syncCollege();
    return () => unsubBanners();
  }, []);

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

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const filteredStores = stores.filter(store => {
    const matchesCategory = activeCategory === 'All' || (store.tags && store.tags.includes(activeCategory));
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      store.name.toLowerCase().includes(query) || 
      (store.tags && store.tags.some(tag => tag.toLowerCase().includes(query))) ||
      (store.menuItemsForSearch && store.menuItemsForSearch.some(item => item.includes(query)));
    return matchesCategory && matchesSearch;
  });

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

            {/* Navigation Arrows (DEBUG COLOR) */}
            {banners.length > 1 && (
              <>
                <button 
                  onClick={(e) => { e.stopPropagation(); setCurrentBannerIndex(prev => (prev === 0 ? banners.length - 1 : prev - 1)); }} 
                  className="banner-nav-btn"
                  style={{ 
                    position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', 
                    background: 'red !important', 
                    border: 'none', width: 34, height: 34, borderRadius: '50%', 
                    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    cursor: 'pointer', zIndex: 9999, boxShadow: '0 8px 16px rgba(0,0,0,0.5)',
                    padding: 0
                  }}
                >
                   <ChevronLeft size={20} strokeWidth={3} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setCurrentBannerIndex(prev => (prev === banners.length - 1 ? 0 : prev + 1)); }} 
                  className="banner-nav-btn"
                  style={{ 
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', 
                    background: 'red !important', 
                    border: 'none', width: 34, height: 34, borderRadius: '50%', 
                    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    cursor: 'pointer', zIndex: 9999, boxShadow: '0 8px 16px rgba(0,0,0,0.5)',
                    padding: 0
                  }}
                >
                   <ChevronRight size={20} strokeWidth={3} />
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
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>Loading stores...</div>
            ) : filteredStores.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔍</div>
                <h3 style={{ margin: '0 0 8px', color: 'var(--text-main)' }}>No matches found</h3>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>Try searching for a different keyword or category.</p>
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
                      <span className="flex items-center gap-1" style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 500 }}>
                        <Clock size={14} /> {store.delivery_time_mins} mins
                      </span>
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
    </div>
  );
};

export default HomePage;
