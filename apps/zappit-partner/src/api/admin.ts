import { apiClient } from './client';

export const adminApi = {
  // Stats
  getDashboardStats: async () => {
    const res = await apiClient.get('/api/admin/dashboard-stats');
    return res.data;
  },

  // Cache
  flushCache: async () => {
    const res = await apiClient.post('/api/admin/flush-cache', {});
    return res.data;
  },

  // Broadcast Push Notification
  sendBroadcastNotification: async (title: string, body: string, college_id?: string) => {
    const res = await apiClient.post('/api/admin/send-broadcast-notification', { title, body, college_id });
    return res.data;
  },

  // Colleges
  getColleges: async () => {
    const res = await apiClient.get('/api/admin/colleges');
    return res.data;
  },
  saveCollege: async (data: { id?: string; name: string; city?: string; isActive?: boolean }) => {
    const res = await apiClient.post('/api/admin/colleges', data);
    return res.data;
  },
  deleteCollege: async (id: string) => {
    const res = await apiClient.post('/api/admin/delete', { collection: 'colleges', id });
    return res.data;
  },

  // Stores
  getAllStores: async () => {
    const res = await apiClient.get('/api/stores');
    return res.data;
  },
  saveStore: async (data: any) => {
    const res = await apiClient.post('/api/admin/stores', data);
    return res.data;
  },
  deleteStore: async (id: string) => {
    const res = await apiClient.post('/api/admin/delete', { collection: 'stores', id });
    return res.data;
  },
  createStoreOwner: async (email: string, password: string) => {
    const res = await apiClient.post('/api/admin/create-store-owner', { email, password });
    return res.data;
  },

  // Banners
  getBanners: async () => {
    const res = await apiClient.get('/api/admin/banners');
    return res.data;
  },
  saveBanner: async (data: any) => {
    const res = await apiClient.post('/api/admin/banners', data);
    return res.data;
  },
  deleteBanner: async (id: string) => {
    const res = await apiClient.post('/api/admin/delete', { collection: 'banners', id });
    return res.data;
  },

  // Coupons
  getCoupons: async () => {
    const res = await apiClient.get('/api/get-coupons');
    return res.data;
  },
  saveCoupon: async (data: any) => {
    const res = await apiClient.post('/api/save-coupon', data);
    return res.data;
  },
  deleteCoupon: async (code: string) => {
    const res = await apiClient.post('/api/delete-coupon', { code });
    return res.data;
  },

  // Orders
  getAllOrders: async () => {
    const res = await apiClient.get('/api/orders?admin=true');
    return res.data;
  },
  updateOrderStatus: async (id: string, status: string) => {
    const res = await apiClient.patch(`/api/orders/${id}/status`, { order_status: status });
    return res.data;
  },

  // Config / Fees
  getFees: async () => {
    const res = await apiClient.get('/api/admin/config/fees');
    return res.data;
  },
  saveFees: async (list: any[]) => {
    const res = await apiClient.post('/api/admin/config/fees', { list });
    return res.data;
  },
  getDeliveryFeeConfig: async () => {
    const res = await apiClient.get('/api/admin/config/delivery_fee');
    return res.data;
  },
  saveDeliveryFeeConfig: async (value: number) => {
    const res = await apiClient.post('/api/admin/config/delivery_fee', { value });
    return res.data;
  },
};
