import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CartItem, MenuItem } from '../types';

export interface CartState {
  items: Record<string, CartItem>;
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

      addToCart: (item: MenuItem, storeId: string, storeName: string) => {
        set((state) => {
          const key = `${storeId}_${item._id || item.id}`;
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

      removeFromCart: (item: MenuItem, storeId: string) => {
        set((state) => {
          const key = `${storeId}_${item._id || item.id}`;
          const existing = state.items[key];
          if (!existing) return state;

          if (existing.qty <= 1) {
            const newItems = { ...state.items };
            delete newItems[key];
            return { items: newItems };
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
          0
        );
      },

      getCartStoreId: () => {
        const itemsList = Object.values(get().items);
        return itemsList.length > 0 ? itemsList[0].storeId : null;
      },

      getCartStoreName: () => {
        const itemsList = Object.values(get().items);
        return itemsList.length > 0 ? itemsList[0].storeName : null;
      },

      getCartItems: () => Object.values(get().items),
    }),
    {
      name: 'cart-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
