import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Star, Clock, Plus, Minus, Info } from 'lucide-react';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useCart } from '../CartContext';

const StorePage = () => {
  const { id } = useParams();
  const [store, setStore] = useState(null);
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const { cart, addToCart: globalAdd, removeFromCart, cartTotal, cartCount } = useCart();

  useEffect(() => {
    const fetchStoreAndMenu = async () => {
      try {
        const storeRef = doc(db, 'stores', id);
        const storeSnap = await getDoc(storeRef);
        
        if (storeSnap.exists()) {
          setStore({ id: storeSnap.id, ...storeSnap.data() });
          
          // Fetch menu subcollection
          const menuSnap = await getDocs(collection(storeRef, 'menu'));
          const menuData = menuSnap.docs.map(mDoc => ({
            id: mDoc.id,
            ...mDoc.data()
          }));
          setMenu(menuData);
        }
      } catch (err) {
        console.error("Error fetching store:", err);
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchStoreAndMenu();
  }, [id]);

  const addToCart = (item) => {
    globalAdd(item, store.id, store.name);
  };

  if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>;
  if (!store) return <div style={{ padding: '20px', textAlign: 'center' }}>Store not found.</div>;

  return (
    <div className="animate-fade-in" style={{ paddingBottom: cartCount > 0 ? '160px' : '80px' }}>
      {/* Store Cover & Header */}
      <div style={{ position: 'relative', height: '220px' }}>
        <img 
          src={store.image} 
          alt="Store Cover" 
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
        />
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0) 100%)' }}>
          <Link to="/" style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)', border: 'none', width: 36, height: 36, borderRadius: '50%', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <ArrowLeft size={20} />
          </Link>
          <div style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)', border: 'none', width: 36, height: 36, borderRadius: '50%', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <Info size={20} />
          </div>
        </div>
      </div>

      {/* Store Info Container */}
      <div style={{ position: 'relative', marginTop: '-40px', padding: '0 20px', zIndex: 10 }}>
        <div className="card" style={{ padding: '20px', boxShadow: 'var(--shadow-lg)' }}>
          <div className="flex justify-between items-start">
            <div>
              <h1 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>{store.name}</h1>
              <div className="flex gap-4 items-center" style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 500, marginBottom: '12px' }}>
                <span className="flex items-center gap-1" style={{ color: '#10B981', fontWeight: 600 }}>
                  <Star size={14} fill="#10B981" /> {store.rating}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock size={14} /> {store.delivery_time_mins} mins
                </span>
              </div>
            </div>
            {store.is_open === false && (
              <div style={{ background: '#FEE2E2', color: '#991B1B', padding: '6px 12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 800 }}>CLOSED</div>
            )}
          </div>
          <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
            {store.tags && store.tags.map(tag => (
              <span key={tag} className="tag">{tag}</span>
            ))}
          </div>
        </div>
      </div>

      {store.is_open === false && (
        <div style={{ margin: '20px', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', borderRadius: '12px', textAlign: 'center', fontWeight: 700, border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.9rem' }}>
          This store is currently not accepting orders.
        </div>
      )}

      {/* Menu Listing */}
      <div style={{ padding: '24px 20px' }}>
        <h3 style={{ marginBottom: '16px', fontSize: '1.25rem' }}>Menu</h3>
        <div className="flex flex-col gap-6">
          {menu.map(item => {
            const itemInCart = cart[`${store.id}_${item.id}`];
            return (
              <div key={item.id} className="flex justify-between" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '24px', opacity: store.is_open !== false ? 1 : 0.6, filter: store.is_open !== false ? 'none' : 'grayscale(0.5)' }}>
                <div style={{ flex: 1, paddingRight: '16px' }}>
                  <div style={{ width: '16px', height: '16px', border: `1px solid ${item.isVeg ? '#10B981' : '#EF4444'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px', borderRadius: '4px' }}>
                    <div style={{ width: '8px', height: '8px', backgroundColor: item.isVeg ? '#10B981' : '#EF4444', borderRadius: '50%' }}></div>
                  </div>
                  <h4 style={{ fontSize: '1.125rem', marginBottom: '4px' }}>{item.name}</h4>
                  <div style={{ fontWeight: 600, marginBottom: '8px' }}>₹{item.price}</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{item.desc}</div>
                </div>
                <div style={{ width: '110px', flexShrink: 0, position: 'relative' }}>
                  <img src={item.image} alt={item.name} style={{ width: '100%', height: '100px', borderRadius: '12px', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', bottom: '-12px', left: '50%', transform: 'translateX(-50%)', width: '90px' }}>
                    {store.is_open !== false ? (
                      itemInCart ? (
                        <div className="flex items-center justify-between" style={{ background: 'var(--bg-color)', border: '1px solid var(--primary)', borderRadius: '8px', height: '36px', padding: '0 4px', boxShadow: 'var(--shadow-sm)' }}>
                          <button onClick={() => removeFromCart(item, store.id)} style={{ background: 'none', border: 'none', color: 'var(--primary)', padding: '4px', cursor: 'pointer' }}><Minus size={16} /></button>
                          <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--primary)' }}>{itemInCart.qty}</span>
                          <button onClick={() => addToCart(item)} style={{ background: 'none', border: 'none', color: 'var(--primary)', padding: '4px', cursor: 'pointer' }}><Plus size={16} /></button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => addToCart(item)}
                          className="btn btn-primary" 
                          style={{ width: '100%', height: '36px', borderRadius: '8px', padding: 0, boxShadow: 'var(--shadow-sm)', fontSize: '0.875rem' }}
                        >
                          ADD
                        </button>
                      )
                    ) : (
                      <div style={{ background: '#F1F5F9', color: '#94A3B8', border: '1px solid #E2E8F0', borderRadius: '8px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800 }}>CLOSED</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* View Cart Bar */}
      {cartCount > 0 && (
        <div style={{ position: 'fixed', bottom: '80px', left: 0, right: 0, padding: '0 20px', zIndex: 100, maxWidth: '480px', margin: '0 auto' }}>
          <Link 
            to="/checkout"
            className="btn-primary flex justify-between items-center" 
            style={{ width: '100%', padding: '16px 20px', borderRadius: '16px', textDecoration: 'none' }}
          >
            <div>
              <div style={{ fontWeight: 700 }}>{cartCount} ITEM{cartCount > 1 ? 'S' : ''}</div>
              <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>₹{cartTotal}</div>
            </div>
            <div className="flex items-center gap-2" style={{ fontWeight: 700 }}>
              Proceed to Pay <ArrowLeft size={18} style={{ transform: 'rotate(180deg)' }} />
            </div>
          </Link>
        </div>
      )}
    </div>
  );
};

export default StorePage;
