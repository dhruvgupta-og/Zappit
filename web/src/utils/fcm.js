import { getToken, onMessage } from 'firebase/messaging';
import { messaging } from '../firebase';
import api from './api';

const VAPID_KEY = 'BOFAZK4xsc9kN_LOFdGf2E3o-k8jEnVrTPnjmmpmdljXMrBFQPV5-IhUwkX88GkEErxyMrEQjPxEVbfXLcJAoQ4';

export const initFcm = async (userId) => {
  if (!userId) return;

  try {
    // 1. Request permission from the user
    console.log('[FCM] Requesting notification permission...');
    const permission = await Notification.requestPermission();

    if (permission === 'granted') {
      console.log('[FCM] Notification permission granted.');

      // 2. Fetch the FCM registration token from Firebase
      const token = await getToken(messaging, { vapidKey: VAPID_KEY });

      if (token) {
        console.log('[FCM] Token generated:', token);

        // 3. Save the token via our API so it goes to MongoDB
        await api.post(`/api/users/${userId}`, {
          fcmToken: token,
          updated_at: new Date().toISOString()
        });
        console.log('[FCM] Token successfully registered in MongoDB.');
      } else {
        console.warn('[FCM] No registration token available.');
      }
    } else {
      console.warn('[FCM] Notification permission denied/blocked by user.');
    }

    // 4. Set up foreground notification handler
    onMessage(messaging, (payload) => {
      console.log('[FCM] Received foreground message:', payload);
      if (payload.notification) {
        const title = payload.notification.title || '⚡ Zappit Alert';
        const body = payload.notification.body || 'You have a new campus notification.';
        if (Notification.permission === 'granted') {
          new Notification(title, { body, icon: '/logo192.png' });
        }
      }
    });

  } catch (error) {
    console.error('[FCM] Error initializing push notifications:', error);
  }
};
