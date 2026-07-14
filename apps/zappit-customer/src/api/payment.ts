import { apiClient } from './client';

export const paymentApi = {
  createOrder: async (data: {
    amount: number;
    items: any[];
    storeId: string;
    storeName: string;
    deliveryAddress: string;
    deliveryFee: number;
    couponCode?: string;
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
    const res = await apiClient.get('/api/admin/config/delivery_fee');
    return res.data.value ?? 20;
  },
};
