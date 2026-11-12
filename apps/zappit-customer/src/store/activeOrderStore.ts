import { create } from 'zustand';
import { ordersApi } from '../api/orders';
import { Order } from '../types';
import { useAuthStore } from './authStore';

// Statuses considered actively in progress
export const ACTIVE_STATUSES = [
  'placed',
  'confirmed',
  'accepted',
  'preparing',
  'ready',
  'picked_up',
  'out_for_delivery',
];

interface ActiveOrderState {
  activeOrder: Order | null;
  isLoading: boolean;
  lastUpdated: number;
  isDismissed: boolean;
  dismissedOrderId: string | null;
  fetchActiveOrder: (silent?: boolean) => Promise<void>;
  setActiveOrder: (order: Order | null) => void;
  dismissBar: () => void;
  restoreBar: () => void;
}

export const useActiveOrderStore = create<ActiveOrderState>((set, get) => ({
  activeOrder: null,
  isLoading: false,
  lastUpdated: 0,
  isDismissed: false,
  dismissedOrderId: null,

  fetchActiveOrder: async (silent = false) => {
    const { firebaseUser, profileComplete } = useAuthStore.getState();
    if (!firebaseUser || !profileComplete) {
      set({ activeOrder: null });
      return;
    }

    if (!silent) set({ isLoading: true });

    try {
      const orders = await ordersApi.getAll();
      if (!Array.isArray(orders)) {
        set({ activeOrder: null, isLoading: false });
        return;
      }

      // Sort newest first
      const sorted = [...orders].sort((a, b) => {
        const d1 = new Date((a as any).created_at || a.createdAt || 0).getTime();
        const d2 = new Date((b as any).created_at || b.createdAt || 0).getTime();
        return d2 - d1;
      });

      // Find first active order
      const found = sorted.find((o) => {
        const st = ((o as any).order_status || o.status || '').toLowerCase();
        return ACTIVE_STATUSES.includes(st);
      }) || null;

      const currentDismissed = get().dismissedOrderId;
      const currentActive = get().activeOrder;

      // If the found order is different, or if its status progressed, un-dismiss it
      let shouldKeepDismissed = get().isDismissed;
      if (found) {
        const foundId = String(found.id || (found as any)._id);
        const currentId = currentActive ? String(currentActive.id || (currentActive as any)._id) : null;
        const foundStatus = (found as any).order_status || found.status;
        const currentStatus = currentActive ? ((currentActive as any).order_status || currentActive.status) : null;

        if (foundId !== currentDismissed || (foundId === currentId && foundStatus !== currentStatus)) {
          shouldKeepDismissed = false;
        }
      } else {
        shouldKeepDismissed = false;
      }

      set({
        activeOrder: found,
        isLoading: false,
        lastUpdated: Date.now(),
        isDismissed: shouldKeepDismissed,
      });
    } catch (err) {
      console.warn('Failed to fetch active order:', err);
      set({ isLoading: false });
    }
  },

  setActiveOrder: (order) => {
    set({
      activeOrder: order,
      isDismissed: false,
      lastUpdated: Date.now(),
    });
  },

  dismissBar: () => {
    const current = get().activeOrder;
    set({
      isDismissed: true,
      dismissedOrderId: current ? String(current.id || (current as any)._id) : null,
    });
  },

  restoreBar: () => {
    set({ isDismissed: false });
  },
}));
