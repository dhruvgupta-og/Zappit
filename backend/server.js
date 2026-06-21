require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');
const cluster = require('cluster');
const os = require('os');

// Catch-all for uncaught exceptions to prevent silent crashes
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! Shutting down gracefully...', err);
  process.exit(1);
});

// Load Balancer & Clustering implementation (Sharding across CPUs)
const useClustering = process.env.NODE_ENV === 'production';
if (useClustering && (cluster.isPrimary || cluster.isMaster)) {
  const numCPUs = os.cpus().length;
  console.log(`Master process ${process.pid} is running`);
  console.log(`Setting up ${numCPUs} worker processes for load balancing...`);

  // Fork workers.
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  // Handle worker failure and respawn to prevent downtime (zero casualty)
  cluster.on('exit', (worker, code, signal) => {
    console.error(`Worker ${worker.process.pid} died. Respawning a new worker to maintain capacity...`);
    cluster.fork();
  });
} else {
  // Database and Cache Setup
  // Using Firebase Admin as the database layer to avoid local MongoDB installation issues
  require('./database/mongodb'); 
  // require('./cache/redis');

  const app = express();

  // Trust Render's reverse proxy so rate limiting works correctly
  app.set('trust proxy', 1);

  // Security Headers and Payload Compression for Production
  app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  }));
  app.use(compression());

  // Health Check for Hosting Providers and Frontend Proxy
  app.get('/health', (req, res) => res.status(200).json({ status: 'healthy', timestamp: new Date() }));
  app.get('/api/health', (req, res) => res.status(200).json({ status: 'healthy', timestamp: new Date() }));

  // ── KEEP-ALIVE: Self-ping every 14 minutes to prevent Render free tier from sleeping
  if (process.env.NODE_ENV === 'production') {
    const keepAliveUrl = process.env.BACKEND_URL
      ? `${process.env.BACKEND_URL}/health`
      : `http://localhost:${process.env.PORT || 5000}/health`;
    const https = require('https');
    const http = require('http');
    const requester = keepAliveUrl.startsWith('https') ? https : http;
    setInterval(() => {
      requester.get(keepAliveUrl, (res) => {
        console.log(`[Keep-Alive] Self-ping OK: ${res.statusCode}`);
      }).on('error', (err) => {
        console.error('[Keep-Alive] Self-ping failed:', err.message);
      });
    }, 14 * 60 * 1000); // every 14 minutes
    console.log(`[Keep-Alive] Self-ping scheduled every 14 minutes → ${keepAliveUrl}`);
  }

  // ── CORS Configuration ──
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://zappit.shop',
    'https://www.zappit.shop',
    'https://zappit-dun.vercel.app'
  ];

  app.use(cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true
  }));
  app.use(express.json());

  // DEBUG: Log all incoming requests (Disable body logging in production for security)
  app.use((req, res, next) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEBUG] ${req.method} ${req.url} - Body:`, JSON.stringify(req.body));
    } else {
      console.log(`[REQ] ${req.method} ${req.url}`);
    }
    next();
  });

// API GATEWAY: Rate Limiting
if (process.env.NODE_ENV === 'production') {
  // Global limiter: 100 requests per 15 minutes
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100, 
    message: { success: false, error: 'Too many requests from this IP, please try again after 15 minutes' }
  });
  app.use('/api/', apiLimiter);

  // Strict limiter for payments and coupons: 10 requests per 15 minutes
  const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { success: false, error: 'Too many payment/coupon attempts. Please try again later.' }
  });
  app.use('/api/create-order', strictLimiter);
  app.use('/api/verify-payment', strictLimiter);
  app.use('/api/verify-coupon', strictLimiter);
}

// Auth Check Middleware
const authCheck = require('./middleware/authMiddleware');

// SERVICE ROUTERS
// const authService = require('./services/auth/authRoutes');
const storeService = require('./services/store/storeRoutes');
const orderService = require('./services/order/orderRoutes');
const paymentService = require('./services/payment/paymentRoutes');
const webPaymentService = require('./services/payment/webPaymentRoutes');
const adminService = require('./services/admin/adminRoutes');
const userService = require('./services/user/userRoutes');

// app.use('/api/auth', authService);
app.use('/api/stores', storeService);
app.use('/api/orders', authCheck, orderService);
app.use('/api/payments', authCheck, paymentService);
app.use('/api/admin', authCheck, adminService);
app.use('/api/users', authCheck, userService);
app.use('/api', authCheck, webPaymentService);

  // Error handling middleware to prevent app from crashing on unhandled promise rejections
  app.use((err, req, res, next) => {
    console.error('Unhandled Route Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  });

  // REALTIME LAYER (WebSockets/Firebase placeholder)
  // const server = require('http').createServer(app);
  // require('./realtime/socket')(server);

  const PORT = process.env.PORT || 5000;
  const server = app.listen(PORT, () => {
    console.log(`Worker ${process.pid}: API Gateway & Services running on port ${PORT}`);
  });

  // Graceful shutdown handling
  const shutdown = () => {
    console.log(`Worker ${process.pid} shutting down gracefully...`);
    server.close(() => {
      console.log(`Worker ${process.pid} closed out remaining connections.`);
      process.exit(0);
    });

    // Force close after 10 seconds
    setTimeout(() => {
      console.error(`Worker ${process.pid} could not close connections in time, forcefully shutting down`);
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  process.on('unhandledRejection', (err) => {
    console.error(`Worker ${process.pid}: UNHANDLED REJECTION! Shutting down...`, err);
    shutdown();
  });
}
