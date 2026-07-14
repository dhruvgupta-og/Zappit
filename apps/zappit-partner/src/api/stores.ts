import { apiClient } from './client';

export const storesApi = {
  getStoreById: async (id: string) => {
    const res = await apiClient.get(`/api/stores/${id}`);
    return res.data;
  },

  updateStore: async (data: { id: string; is_open?: boolean; [key: string]: any }) => {
    const res = await apiClient.post('/api/admin/stores', data);
    return res.data;
  },
};
