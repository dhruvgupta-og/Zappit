import axios from 'axios';
import { auth } from './firebase';

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
