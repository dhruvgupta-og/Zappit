const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/zappit';

// Connection options — tuned for Render free tier + MongoDB Atlas M0
const mongoOptions = {
  maxPoolSize: 10,          // Max 10 concurrent DB connections (M0 allows 100 total)
  minPoolSize: 2,           // Keep 2 connections warm at all times
  serverSelectionTimeoutMS: 8000,  // Fail fast if Atlas unreachable (8s)
  socketTimeoutMS: 45000,   // Drop idle sockets after 45s
  connectTimeoutMS: 10000,  // Initial connection timeout
  heartbeatFrequencyMS: 10000, // Check connection health every 10s
  retryWrites: true,        // Auto-retry failed writes (covers transient errors)
  retryReads: true,         // Auto-retry failed reads
};

let isConnected = false;

async function connectDB() {
  if (isConnected) return;

  try {
    await mongoose.connect(MONGO_URI, mongoOptions);
    isConnected = true;
    console.log('[MongoDB] Connected successfully');
  } catch (err) {
    console.error('[MongoDB] Initial connection failed:', err.message);
    // Retry after 5 seconds
    setTimeout(connectDB, 5000);
  }
}

// Handle connection events
mongoose.connection.on('connected', () => {
  isConnected = true;
  console.log('[MongoDB] Connection established');
});

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.warn('[MongoDB] Disconnected. Attempting to reconnect...');
  setTimeout(connectDB, 3000);
});

mongoose.connection.on('error', (err) => {
  console.error('[MongoDB] Connection error:', err.message);
  isConnected = false;
});

// Expose a health check helper for the /health endpoint
function isDBHealthy() {
  return mongoose.connection.readyState === 1; // 1 = connected
}

connectDB();

module.exports = { mongoose, isDBHealthy };
