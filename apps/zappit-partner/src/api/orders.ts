import { apiClient } from './client';

export const ordersApi = {
  getOrders: async (storeId?: string) => {
    const url = storeId ? `/api/orders?store_id=${storeId}` : '/api/orders';
    const res = await apiClient.get(url);
    return res.data;
  },

  updateOrderStatus: async (orderId: string, status: string) => {
    const res = await apiClient.patch(`/api/orders/${orderId}/status`, { order_status: status });
    return res.data;
  },

  verifyOtp: async (orderId: string, otp: string) => {
    const res = await apiClient.post(`/api/orders/${orderId}/verify-otp`, { otp });
    return res.data;
  },

  sendStatusNotification: async (orderId: string, status: string) => {
    try {
      await apiClient.post('/api/send-status-notification', { orderId, status });
    } catch {
      // Non-critical — don't block on notification failure
    }
  },
};
