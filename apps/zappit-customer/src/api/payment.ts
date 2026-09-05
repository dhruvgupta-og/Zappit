import { apiClient } from './client';

export const paymentApi = {
  createOrder: async (data: {
    amount?: number;
    items: any[];
    storeId?: string;
    storeName?: string;
    address?: string;
    deliveryAddress?: string;
    deliveryFee?: number;
    coupon_code?: string;
    couponCode?: string;
    college_id?: string;
    additionalNote?: string;
  }): Promise<any> => {
    const res = await apiClient.post('/api/create-order', data);
    return res.data;
  },

  verifyPayment: async (data: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }): Promise<any> => {
    const res = await apiClient.post('/api/verify-payment', data);
    return res.data;
  },

  verifyCoupon: async (code: string): Promise<any> => {
    const res = await apiClient.post('/api/verify-coupon', { code });
    return res.data;
  },

  getDeliveryFee: async (): Promise<number> => {
    try {
      const res = await apiClient.get('/api/admin/config/fees');
      if (res.data.success && res.data.data?.list) {
        const list: any[] = res.data.data.list;
        // Return only the delivery fee (flat) for backwards compat
        const deliveryFee = list.find((f: any) => f.name?.toLowerCase().includes('delivery'));
        return deliveryFee ? Number(deliveryFee.value) : 0;
      }
      return 0;
    } catch {
      return 0;
    }
  },

  getAllFees: async (): Promise<Array<{ name: string; type: string; value: number }>> => {
    try {
      const res = await apiClient.get('/api/admin/config/fees');
      if (res.data.success && res.data.data?.list) {
        return res.data.data.list;
      }
      return [];
    } catch {
      return [];
    }
  },
};
