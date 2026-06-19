import axios from 'axios';
import { auth } from './firebase';

// Set the base URL for the live backend in production, or use local proxy in development
axios.defaults.baseURL = import.meta.env.MODE === 'production' 
  ? 'https://zappit-backend.onrender.com' 
  : '';

// Automatically attach Firebase ID token to every axios request
axios.interceptors.request.use(async (config) => {
  try {
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (e) {
    // If token fetch fails, continue without token (public routes still work)
  }
  return config;
});
