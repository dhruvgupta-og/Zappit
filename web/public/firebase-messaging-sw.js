// Import the Firebase scripts inside the service worker
importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker
// Note: This must match the credentials from your web client config
firebase.initializeApp({
  apiKey: "AIzaSyDaKn53ptNQatBgMA1csbD4ipC5jVRf7dQ",
  authDomain: "zappit-90a73.firebaseapp.com",
  projectId: "zappit-90a73",
  storageBucket: "zappit-90a73.firebasestorage.app",
  messagingSenderId: "12406084456",
  appId: "1:12406084456:web:b207789dea77b714597cdd",
});

// Retrieve an instance of Firebase Messaging so that it can handle background messages
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[Zappit SW] Received background message: ', payload);

  const notificationTitle = payload.notification.title || '⚡ Zappit Alert';
  const notificationOptions = {
    body: payload.notification.body || 'You have a new campus notification.',
    icon: '/logo192.png', // Fallback to app icon (must exist or fallback to generic)
    badge: '/logo192.png',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
