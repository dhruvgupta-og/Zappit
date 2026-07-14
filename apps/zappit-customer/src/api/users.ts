import { apiClient } from './client';
import { User } from '../types';

export const usersApi = {
  getProfile: async (uid: string): Promise<{ exists: boolean; user: User | null }> => {
    const res = await apiClient.get(`/api/users/${uid}`);
    return { exists: res.data.exists, user: res.data.user };
  },

  updateProfile: async (uid: string, data: Partial<User>): Promise<any> => {
    const res = await apiClient.post(`/api/users/${uid}`, data);
    return res.data;
  },
};
