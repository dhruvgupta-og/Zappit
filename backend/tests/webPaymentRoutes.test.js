const request = require('supertest');
const express = require('express');
const webPaymentRoutes = require('../services/payment/webPaymentRoutes');
const Order = require('../models/Order');

// Mock Mongoose model
jest.mock('../models/Order');
jest.mock('../models/User', () => ({
  findById: jest.fn().mockResolvedValue({ _id: 'u1', email: 'test@test.com' })
}));
jest.mock('../services/payment/razorpay', () => ({
  payments: {
    fetch: jest.fn()
  },
  orders: {
    create: jest.fn()
  }
}));

// Since the route might instantiate razorpay directly or import from a config, 
// if it relies on process.env.RAZORPAY_KEY_ID we must ensure it doesn't crash.
process.env.RAZORPAY_KEY_SECRET = 'secret';

const app = express();
app.use(express.json());

// Mock auth middleware for testing send-order-email
app.use((req, res, next) => {
  const role = req.headers['x-role'] || 'customer';
  const uid = req.headers['x-uid'] || 'u1';
  req.user = { uid, role, email: 'test@test.com' };
  next();
});

app.use('/api', webPaymentRoutes);

describe('webPaymentRoutes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. send-order-email authorization', () => {
    it('should reject non-admin users attempting to email mixed/foreign orders', async () => {
      // Mock Order.find to return orders with mixed user IDs
      Order.find.mockResolvedValue([
        { _id: 'o1', user_id: 'u1', items: [], total_amount: 100, discount_amount: 0 },
        { _id: 'o2', user_id: 'u2', items: [], total_amount: 100, discount_amount: 0 } // foreign order
      ]);

      const res = await request(app)
        .post('/api/send-order-email')
        .set('x-uid', 'u1')
        .set('x-role', 'customer')
        .send({ orderIds: ['o1', 'o2'] });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Forbidden/);
    });

    it('should allow admin users to email foreign orders', async () => {
      Order.find.mockResolvedValue([
        { _id: 'o1', user_id: 'u1', items: [], total_amount: 100, discount_amount: 0 },
        { _id: 'o2', user_id: 'u2', items: [], total_amount: 100, discount_amount: 0 }
      ]);

      const res = await request(app)
        .post('/api/send-order-email')
        .set('x-uid', 'admin1')
        .set('x-role', 'admin')
        .send({ orderIds: ['o1', 'o2'] });

      // Assuming it goes past the 403, we don't care if it fails later due to missing mock data, as long as it's not 403
      expect(res.status).not.toBe(403);
    });
  });

  describe('3. verify-payment verification', () => {
    const crypto = require('crypto');
    
    it('should return 404 if no matching orders exist', async () => {
      const hmac = crypto.createHmac('sha256', 'secret');
      hmac.update("order_rzp|pay_rzp");
      const signature = hmac.digest('hex');

      // Mock razorpay payment fetch
      const razorpayInstance = require('../services/payment/razorpay');
      razorpayInstance.payments.fetch.mockResolvedValue({ status: 'captured', amount: 10000 });

      // Mock Order.find to return NO orders
      Order.find.mockResolvedValue([]);
      Order.updateMany.mockResolvedValue({ modifiedCount: 0 });

      const res = await request(app)
        .post('/api/verify-payment')
        .send({ 
          razorpay_order_id: 'order_rzp', 
          razorpay_payment_id: 'pay_rzp', 
          razorpay_signature: signature 
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/No matching order found/);
    });

    it('should return 400 if payment amount does not match expected total', async () => {
      const hmac = crypto.createHmac('sha256', 'secret');
      hmac.update("order_rzp|pay_rzp");
      const signature = hmac.digest('hex');

      const razorpayInstance = require('../services/payment/razorpay');
      // Payment captured for 5000 paise (Rs 50)
      razorpayInstance.payments.fetch.mockResolvedValue({ status: 'captured', amount: 5000 });

      // DB orders total to 100 (Rs 100 -> 10000 paise)
      Order.find.mockResolvedValue([
        { _id: 'o1', total_amount: 50 },
        { _id: 'o2', total_amount: 50 }
      ]);
      Order.updateMany.mockResolvedValue({ modifiedCount: 0 });

      const res = await request(app)
        .post('/api/verify-payment')
        .send({ 
          razorpay_order_id: 'order_rzp', 
          razorpay_payment_id: 'pay_rzp', 
          razorpay_signature: signature 
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Payment amount mismatch/);
    });
  });
});
