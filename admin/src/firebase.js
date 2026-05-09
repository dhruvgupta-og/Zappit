import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, onSnapshot, query, updateDoc, doc, addDoc, deleteDoc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBIQbGVZnK-W5zualbHeMYynWresG3loDU",
  authDomain: "zappit-app.firebaseapp.com",
  projectId: "zappit-app",
  storageBucket: "zappit-app.firebasestorage.app",
  messagingSenderId: "463173924340",
  appId: "1:463173924340:web:44d089b63d50c6351635a1",
  measurementId: "G-4VRQ8R1V6D"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export { signInWithEmailAndPassword, signOut, onAuthStateChanged, collection, onSnapshot, query, updateDoc, doc, addDoc, deleteDoc, setDoc };
