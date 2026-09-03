import { apiClient } from './client';
import { Order } from '../types';

export const ordersApi = {
  getAll: async (): Promise<Order[]> => {
    const res = await apiClient.get('/api/orders');
    return res.data.orders || res.data;
  },

  getById: async (id: string): Promise<Order> => {
    const res = await apiClient.get(`/api/orders`);
    const orders = res.data.orders || res.data || [];
    return orders.find((o: Order) => String(o.id || o._id) === String(id) || String(o._id) === String(id));
  },

  updateStatus: async (id: string, status: string): Promise<any> => {
    const res = await apiClient.patch(`/api/orders/${id}/status`, { status });
    return res.data;
  },

  update: async (id: string, data: Partial<Order>): Promise<any> => {
    const res = await apiClient.patch(`/api/orders/${id}`, data);
    return res.data;
  },
};
