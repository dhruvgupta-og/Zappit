import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
// TODO: Replace with your actual Firebase project config

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
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
