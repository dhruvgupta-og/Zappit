/**
 * Axios instance with automatic retry logic for when the Render backend is waking up.
 * On a 503 or connection failure, it retries up to 3 times with exponential backoff.
 */
import axios from 'axios';

const api = axios.create();

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000; // 3 seconds

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

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
      const delay = RETRY_DELAY_MS * config._retryCount;
      console.log(`[API] Server waking up... Retry ${config._retryCount}/${MAX_RETRIES} in ${delay / 1000}s`);
      await sleep(delay);
      return api(config);
    }

    return Promise.reject(error);
  }
);

export default api;
