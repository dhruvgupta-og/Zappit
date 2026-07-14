import axios from 'axios';
import { auth } from '../config/firebase';

// Live backend — same as the website
const API_BASE_URL = 'https://zappit-backend.onrender.com';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// Automatically attach Firebase ID token to every request (mirrors website's axiosSetup.js)
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const user = auth.currentUser;
      if (user) {
        const token = await user.getIdToken();
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // If token fetch fails, continue without — public routes still work
    }
    return config;
  },
  (error) => Promise.reject(error),
);
