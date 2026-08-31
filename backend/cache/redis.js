const redis = require('redis');

// Initialize Redis Client
const client = redis.createClient({
  url: process.env.REDIS_URL || 'redis://127.0.0.1:6379'
});

client.on('error', (err) => console.log('Redis Client Error', err));
client.on('connect', () => console.log('Connected to Redis Cache'));

client.connect().catch(console.error);

// Helper functions for common cache operations
const getCache = async (key) => {
  try {
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error('Redis Get Error:', err);
    return null;
  }
};

const setCache = async (key, value, expiry = 3600) => {
  try {
    await client.setEx(key, expiry, JSON.stringify(value));
  } catch (err) {
    console.error('Redis Set Error:', err);
  }
};

const clearCache = async (pattern) => {
  try {
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(keys);
    }
  } catch (err) {
    console.error('Redis Delete Error:', err);
  }
};

module.exports = {
  client,
  getCache,
  setCache,
  clearCache
};
