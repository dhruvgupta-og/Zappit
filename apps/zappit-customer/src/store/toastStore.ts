import { create } from 'zustand';
import * as Haptics from 'expo-haptics';

export type ToastType = 'success' | 'error' | 'info';

interface ToastState {
  visible: boolean;
  message: string;
  type: ToastType;
  showToast: (message: string, type?: ToastType) => void;
  hideToast: () => void;
}

let toastTimeout: ReturnType<typeof setTimeout> | null = null;

export const useToastStore = create<ToastState>((set) => ({
  visible: false,
  message: '',
  type: 'info',
  showToast: (message: string, type: ToastType = 'info') => {
    if (toastTimeout) clearTimeout(toastTimeout);
    
    // Trigger subtle haptic based on toast type
    try {
      if (type === 'error') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else if (type === 'success') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch {}

    set({ visible: true, message, type });

    toastTimeout = setTimeout(() => {
      set({ visible: false });
    }, 3200);
  },
  hideToast: () => {
    if (toastTimeout) clearTimeout(toastTimeout);
    set({ visible: false });
  },
}));

// Global helper for simple non-hook calls
export const showToast = (message: string, type: ToastType = 'info') => {
  useToastStore.getState().showToast(message, type);
};

