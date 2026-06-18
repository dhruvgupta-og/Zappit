import { getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc } from 'firebase/firestore';
import { messaging, db } from '../firebase';

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

        // 3. Save the token — use setDoc with merge so it works for both
        //    new email/password users (doc may not fully exist) and Google users
        const userRef = doc(db, 'users', userId);
        await setDoc(userRef, {
          fcmToken: token,
          fcmUpdatedAt: new Date().toISOString(),
        }, { merge: true });
        console.log('[FCM] Token successfully registered in Firestore.');
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
