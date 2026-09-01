import { apiClient } from './client';

export const usersApi = {
  getStaffRole: async (): Promise<{ success: boolean; role: string; store_id?: string }> => {
    const res = await apiClient.get('/api/users/me/staff');
    return res.data;
  },
  updateProfile: async (uid: string, data: any): Promise<any> => {
    const res = await apiClient.post(`/api/users/${uid}`, data);
    return res.data;
  },
};
