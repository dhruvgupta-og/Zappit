import { apiClient } from './client';

export const usersApi = {
  getStaffRole: async (): Promise<{ success: boolean; role: string; store_id?: string }> => {
    const res = await apiClient.get('/api/users/me/staff');
    return res.data;
  },
};
