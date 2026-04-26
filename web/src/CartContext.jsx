import React, { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem('zappit_cart');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [storeId, setStoreId] = useState(() => localStorage.getItem('zappit_cart_storeId') || null);
  const [storeName, setStoreName] = useState(() => localStorage.getItem('zappit_cart_storeName') || null);

  useEffect(() => {
    localStorage.setItem('zappit_cart', JSON.stringify(cart));
    if (storeId) localStorage.setItem('zappit_cart_storeId', storeId);
    else localStorage.removeItem('zappit_cart_storeId');
    
    if (storeName) localStorage.setItem('zappit_cart_storeName', storeName);
    else localStorage.removeItem('zappit_cart_storeName');
  }, [cart, storeId, storeName]);

  const addToCart = (item, currentStoreId, currentStoreName) => {
    // Generate a unique key per store and item to allow multi-store orders
    const cartKey = `${currentStoreId}_${item.id}`;
    
    setCart(prev => ({
      ...prev,
      [cartKey]: { 
        ...item, 
        storeId: currentStoreId, 
        storeName: currentStoreName, 
        qty: (prev[cartKey]?.qty || 0) + 1 
      }
    }));
  };

  const removeFromCart = (item, currentStoreId) => {
    setCart(prev => {
      const newCart = { ...prev };
      const cartKey = currentStoreId ? `${currentStoreId}_${item.id}` : Object.keys(newCart).find(k => newCart[k].id === item.id);
      
      if (cartKey && newCart[cartKey]?.qty > 1) {
        newCart[cartKey] = { ...newCart[cartKey], qty: newCart[cartKey].qty - 1 };
      } else if (cartKey) {
        delete newCart[cartKey];
      }
      
      if (Object.keys(newCart).length === 0) {
        setStoreId(null);
        setStoreName(null);
      }
      return newCart;
    });
  };

  const clearCart = () => {
    setCart({});
    setStoreId(null);
    setStoreName(null);
  };

  const cartItems = Object.values(cart);
  const cartTotal = cartItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const cartCount = cartItems.reduce((sum, item) => sum + item.qty, 0);

  return (
    <CartContext.Provider value={{ cart, cartItems, storeId, storeName, addToCart, removeFromCart, clearCart, cartTotal, cartCount }}>
      {children}
    </CartContext.Provider>
  );
};
