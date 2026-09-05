const request = require('supertest');
const express = require('express');
const orderRoutes = require('../services/order/orderRoutes');
const Order = require('../models/Order');

// Mock Mongoose model
jest.mock('../models/Order');

// Create a mock app
const app = express();
app.use(express.json());

// Mock auth middleware
app.use((req, res, next) => {
  // We can set req.user in the test via headers
  const role = req.headers['x-role'] || 'customer';
  const college_id = req.headers['x-college'] || 'c1';
  req.user = { uid: 'u1', role, staff_college_id: college_id };
  next();
});

app.use('/api/orders', orderRoutes);

describe('Order OTP Verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const testCases = [
    { state: 'out_for_delivery', otp: '1234', role: 'delivery', expectedStatus: 200, label: 'A. out_for_delivery + correct OTP' },
    { state: 'picked_up', otp: '1234', role: 'delivery', expectedStatus: 200, label: 'B. picked_up + correct OTP' },
    { state: 'pending', otp: '1234', role: 'delivery', expectedStatus: 400, label: 'C. pending + correct OTP' },
    { state: 'confirmed', otp: '1234', role: 'delivery', expectedStatus: 400, label: 'D. confirmed + correct OTP' },
    { state: 'preparing', otp: '1234', role: 'delivery', expectedStatus: 400, label: 'E. preparing + correct OTP' },
    { state: 'ready', otp: '1234', role: 'delivery', expectedStatus: 400, label: 'F. ready + correct OTP' },
    { state: 'delivered', otp: '1234', role: 'delivery', expectedStatus: 400, label: 'G. delivered + correct OTP' },
    { state: 'cancelled', otp: '1234', role: 'delivery', expectedStatus: 400, label: 'H. cancelled + correct OTP' },
  ];

  testCases.forEach(({ state, otp, role, expectedStatus, label }) => {
    it(`should return ${expectedStatus} for: ${label}`, async () => {
      Order.findById.mockResolvedValue({
        _id: 'order1',
        college_id: 'c1',
        order_status: state,
        delivery_otp: '1234',
        save: jest.fn().mockResolvedValue(true)
      });

      const res = await request(app)
        .post('/api/orders/order1/verify-otp')
        .set('x-role', role)
        .set('x-college', 'c1')
        .send({ otp });

      expect(res.status).toBe(expectedStatus);
    });
  });

  it('I. should return 400 for wrong OTP', async () => {
    Order.findById.mockResolvedValue({
      _id: 'order1',
      college_id: 'c1',
      order_status: 'out_for_delivery',
      delivery_otp: '1234',
      save: jest.fn()
    });

    const res = await request(app)
      .post('/api/orders/order1/verify-otp')
      .set('x-role', 'delivery')
      .set('x-college', 'c1')
      .send({ otp: '9999' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid OTP');
  });

  it('J. should return 403 for delivery staff from wrong college', async () => {
    Order.findById.mockResolvedValue({
      _id: 'order1',
      college_id: 'c2', // different college
      order_status: 'out_for_delivery',
      delivery_otp: '1234'
    });

    const res = await request(app)
      .post('/api/orders/order1/verify-otp')
      .set('x-role', 'delivery')
      .set('x-college', 'c1')
      .send({ otp: '1234' });

    expect(res.status).toBe(403);
  });

  it('K. should return 403 for customer attempting OTP verification', async () => {
    const res = await request(app)
      .post('/api/orders/order1/verify-otp')
      .set('x-role', 'customer')
      .send({ otp: '1234' });

    expect(res.status).toBe(403);
  });
});
