import { apiClient } from './client';
import { Store, College, Banner, MenuItem } from '../types';

export const storesApi = {
  getAll: async (): Promise<Store[]> => {
    const res = await apiClient.get('/api/stores');
    return res.data.stores || res.data;
  },

  getById: async (id: string): Promise<{ store: Store; menu: MenuItem[] }> => {
    const res = await apiClient.get(`/api/stores/${id}`);
    return { store: res.data.store, menu: res.data.menu || [] };
  },

  getColleges: async (): Promise<College[]> => {
    const res = await apiClient.get('/api/stores/colleges/all');
    return res.data.colleges || res.data;
  },

  getActiveBanners: async (): Promise<Banner[]> => {
    const res = await apiClient.get('/api/stores/banners/active');
    const banners = res.data.banners || res.data;
    return (banners as Banner[]).filter((b) => b.active !== false);
  },
};
