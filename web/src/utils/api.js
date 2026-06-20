/**
 * Axios instance with automatic retry logic for when the Render backend is waking up.
 * Retries up to 6 times with exponential backoff (covers ~90 seconds of Render cold start).
 * Also exports a warmUp() function to pre-ping /health before making real requests.
 */
import axios from 'axios';

const api = axios.create();

const MAX_RETRIES = 6;
const BASE_DELAY_MS = 5000; // 5 seconds base

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// Pre-warm: ping /health and wait for a 200 before making real requests
export const warmUp = async () => {
  for (let i = 0; i < 10; i++) {
    try {
      const res = await axios.get('/api/health', { timeout: 8000 });
      if (res.status === 200) return true;
    } catch {
      // still waking up
    }
    await sleep(5000);
  }
  return false;
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    if (!config) return Promise.reject(error);

    config._retryCount = config._retryCount || 0;

    const isRetryable =
      !error.response || // network error / connection closed
      error.response.status === 502 ||
      error.response.status === 503 ||
      error.response.status === 504;

    if (isRetryable && config._retryCount < MAX_RETRIES) {
      config._retryCount += 1;
      // Exponential backoff: 5s, 8s, 12s, 17s, 23s, 30s
      const delay = BASE_DELAY_MS + (config._retryCount * config._retryCount * 1000);
      console.log(`[API] Server waking up... Retry ${config._retryCount}/${MAX_RETRIES} in ${delay / 1000}s`);
      await sleep(delay);
      return api(config);
    }

    return Promise.reject(error);
  }
);

export default api;

