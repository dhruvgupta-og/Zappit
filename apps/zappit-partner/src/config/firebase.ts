import { initializeApp, getApps } from 'firebase/app';
// @ts-ignore
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'AIzaSyDaKn53ptNQatBgMA1csbD4ipC5jVRf7dQ',
  authDomain: 'zappit-90a73.firebaseapp.com',
  projectId: 'zappit-90a73',
  storageBucket: 'zappit-90a73.firebasestorage.app',
  messagingSenderId: '12406084456',
  appId: '1:12406084456:web:b207789dea77b714597cdd',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

export default app;
