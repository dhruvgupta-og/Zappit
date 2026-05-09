import React, { createContext, useContext, useState } from 'react';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  storeId: string;
  storeName?: string;
  imageUrl?: string;
}

interface CartContextType {
  items: CartItem[];
  totalAmount: number;
  addItem: (item: any, storeId: string, storeName?: string) => void;
  removeSingleItem: (id: string) => void;
  removeItem: (id: string) => void;
  clear: () => void;
  storeId: string | null;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [storeId, setStoreId] = useState<string | null>(null);

  const addItem = (item: any, sid: string, sname?: string) => {
    if (storeId && storeId !== sid) {
      setItems([{ ...item, quantity: 1, storeId: sid, storeName: sname }]);
      setStoreId(sid);
      return;
    }

    setItems(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1, storeId: sid, storeName: sname }];
    });
    setStoreId(sid);
  };

  const removeSingleItem = (id: string) => {
    setItems(prev => {
      const existing = prev.find(i => i.id === id);
      if (existing && existing.quantity > 1) {
        return prev.map(i => i.id === id ? { ...i, quantity: i.quantity - 1 } : i);
      }
      const newItems = prev.filter(i => i.id !== id);
      if (newItems.length === 0) setStoreId(null);
      return newItems;
    });
  };

  const removeItem = (id: string) => {
    setItems(prev => {
      const newItems = prev.filter(i => i.id !== id);
      if (newItems.length === 0) setStoreId(null);
      return newItems;
    });
  };

  const clear = () => {
    setItems([]);
    setStoreId(null);
  };

  const totalAmount = items.reduce((acc, item) => acc + item.price * item.quantity, 0);

  return (
    <CartContext.Provider value={{ items, totalAmount, addItem, removeSingleItem, removeItem, clear, storeId }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
};
