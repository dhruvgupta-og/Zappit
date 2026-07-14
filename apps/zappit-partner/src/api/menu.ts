import { apiClient } from './client';

export const menuApi = {
  saveMenuItem: async (data: {
    id?: string;
    store_id: string;
    name: string;
    price: number;
    desc?: string;
    category?: string;
    isVeg?: boolean;
    is_available?: boolean;
  }) => {
    const res = await apiClient.post('/api/admin/menu', data);
    return res.data;
  },

  deleteMenuItem: async (id: string) => {
    const res = await apiClient.post('/api/admin/delete', { collection: 'menu', id });
    return res.data;
  },

  toggleAvailability: async (id: string, isAvailable: boolean) => {
    const res = await apiClient.post('/api/admin/menu', { id, is_available: isAvailable });
    return res.data;
  },
};
