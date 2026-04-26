require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

// Database and Cache Setup
// Using Firebase Admin as the database layer to avoid local MongoDB installation issues
// require('./database/mongodb'); 
// require('./cache/redis');

const app = express();

// Health Check for Hosting Providers
app.get('/health', (req, res) => res.status(200).json({ status: 'healthy', timestamp: new Date() }));

app.use(cors());
app.use(express.json());

// API GATEWAY: Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use('/api/', apiLimiter);

// Auth Check Middleware (Mock for now, would verify JWT/Firebase Token)
const authCheck = (req, res, next) => {
  // Authentication logic goes here
  next();
};

// SERVICE ROUTERS
// const authService = require('./services/auth/authRoutes');
const storeService = require('./services/store/storeRoutes');
const orderService = require('./services/order/orderRoutes');
const paymentService = require('./services/payment/paymentRoutes');

// app.use('/api/auth', authService);
app.use('/api/stores', storeService);
app.use('/api/orders', authCheck, orderService);
app.use('/api/payments', authCheck, paymentService);

// REALTIME LAYER (WebSockets/Firebase placeholder)
// const server = require('http').createServer(app);
// require('./realtime/socket')(server);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`API Gateway & Services running on port ${PORT}`);
});
