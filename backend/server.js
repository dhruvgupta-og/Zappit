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

  // Security Headers and Payload Compression for Production
  app.use(helmet());
  app.use(compression());

  // Health Check for Hosting Providers
  app.get('/health', (req, res) => res.status(200).json({ status: 'healthy', timestamp: new Date() }));

  app.use(cors());
  app.use(express.json());

  // DEBUG: Log all incoming requests
  app.use((req, res, next) => {
    console.log(`[DEBUG] ${req.method} ${req.url} - Body:`, JSON.stringify(req.body));
    next();
  });

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
