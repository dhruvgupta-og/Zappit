import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CartItem, MenuItem } from '../types';

interface CartState {
  items: Record<string, CartItem>; // key = `${storeId}_${itemId}`
  addToCart: (item: MenuItem, storeId: string, storeName: string) => void;
  removeFromCart: (item: MenuItem, storeId: string) => void;
  clearCart: () => void;
  getCartCount: () => number;
  getCartTotal: () => number;
  getCartStoreId: () => string | null;
  getCartStoreName: () => string | null;
  getCartItems: () => CartItem[];
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
  items: {},

  addToCart: (item, storeId, storeName) => {
    set((state) => {
      const key = `${storeId}_${item.id || item._id}`;
      const existing = state.items[key];
      return {
        items: {
          ...state.items,
          [key]: {
            menuItem: item,
            qty: existing ? existing.qty + 1 : 1,
            storeId,
            storeName,
          },
        },
      };
    });
  },

  removeFromCart: (item, storeId) => {
    set((state) => {
      const key = `${storeId}_${item.id || item._id}`;
      const existing = state.items[key];
      if (!existing) return state;

      if (existing.qty <= 1) {
        const { [key]: _, ...rest } = state.items;
        return { items: rest };
      }

      return {
        items: {
          ...state.items,
          [key]: { ...existing, qty: existing.qty - 1 },
        },
      };
    });
  },

  clearCart: () => set({ items: {} }),

  getCartCount: () => {
    return Object.values(get().items).reduce((sum, item) => sum + item.qty, 0);
  },

  getCartTotal: () => {
    return Object.values(get().items).reduce(
      (sum, item) => sum + item.menuItem.price * item.qty,
      0,
    );
  },

  getCartStoreId: () => {
    const items = Object.values(get().items);
    return items.length > 0 ? items[0].storeId : null;
  },

  getCartStoreName: () => {
    const items = Object.values(get().items);
    return items.length > 0 ? items[0].storeName : null;
  },

  getCartItems: () => Object.values(get().items),
    }),
    {
      name: 'cart-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
