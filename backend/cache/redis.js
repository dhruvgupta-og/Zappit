const redis = require('redis');

// ── In-memory fallback cache (used when Redis is unavailable) ──
// This alone cuts MongoDB load significantly with zero infrastructure cost.
const memCache = new Map();
const memCacheTTL = new Map();

const memGet = (key) => {
  const expiry = memCacheTTL.get(key);
  if (expiry && Date.now() > expiry) {
    memCache.delete(key);
    memCacheTTL.delete(key);
    return null;
  }
  return memCache.get(key) ?? null;
};

const memSet = (key, value, ttlSeconds) => {
  memCache.set(key, value);
  memCacheTTL.set(key, Date.now() + ttlSeconds * 1000);
};

const memDel = (key) => {
  memCache.delete(key);
  memCacheTTL.delete(key);
};

// ── Redis Client (optional — gracefully degrades to in-memory) ──
let client = null;
let redisReady = false;

if (process.env.REDIS_URL) {
  client = redis.createClient({ url: process.env.REDIS_URL });
  client.on('error', (err) => {
    redisReady = false;
    console.warn('[Redis] Error (falling back to in-memory cache):', err.message);
  });
  client.on('ready', () => {
    redisReady = true;
    console.log('[Redis] Connected — using Redis cache');
  });
  client.on('end', () => {
    redisReady = false;
    console.warn('[Redis] Disconnected — falling back to in-memory cache');
  });
  client.connect().catch((err) => {
    console.warn('[Redis] Could not connect, using in-memory cache:', err.message);
  });
} else {
  console.log('[Cache] No REDIS_URL set — using in-memory cache (works fine for single server)');
}

// ── Public helpers ──
const getCache = async (key) => {
  try {
    if (redisReady && client) {
      const data = await client.get(key);
      return data ? JSON.parse(data) : null;
    }
    return memGet(key);
  } catch (err) {
    console.error('[Cache] getCache error:', err.message);
    return memGet(key); // fallback
  }
};

const setCache = async (key, value, ttlSeconds = 300) => {
  try {
    if (redisReady && client) {
      await client.setEx(key, ttlSeconds, JSON.stringify(value));
    }
    memSet(key, value, ttlSeconds); // always populate in-memory too
  } catch (err) {
    console.error('[Cache] setCache error:', err.message);
    memSet(key, value, ttlSeconds); // fallback
  }
};

const clearCache = async (key) => {
  try {
    if (redisReady && client) {
      await client.del(key);
    }
    memDel(key);
  } catch (err) {
    console.error('[Cache] clearCache error:', err.message);
    memDel(key);
  }
};

module.exports = { client, getCache, setCache, clearCache };
