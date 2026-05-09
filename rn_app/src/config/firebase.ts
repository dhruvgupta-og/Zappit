import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyDaKn53ptNQatBgMA1csbD4ipC5jVRf7dQ",
  authDomain: "zappit-90a73.firebaseapp.com",
  projectId: "zappit-90a73",
  storageBucket: "zappit-90a73.firebasestorage.app",
  messagingSenderId: "12406084456",
  appId: "1:12406084456:web:b207789dea77b714597cdd",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth with persistence for React Native
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

export const db = getFirestore(app);
