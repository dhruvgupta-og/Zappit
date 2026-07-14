import { create } from 'zustand';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import { apiClient } from '../api/client';
import { User } from '../types';

interface AuthState {
  firebaseUser: FirebaseUser | null;
  profile: User | null;
  isLoading: boolean;
  isInitialized: boolean;

  setFirebaseUser: (user: FirebaseUser | null) => void;
  setProfile: (profile: User | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => Promise<void>;
  fetchProfile: () => Promise<User | null>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  firebaseUser: null,
  profile: null,
  isLoading: true,
  isInitialized: false,

  setFirebaseUser: (user) => set({ firebaseUser: user }),
  setProfile: (profile) => set({ profile }),
  setLoading: (loading) => set({ isLoading: loading }),

  logout: async () => {
    await auth.signOut();
    set({ firebaseUser: null, profile: null });
  },

  fetchProfile: async () => {
    const user = auth.currentUser;
    if (!user) {
      set({ profile: null });
      return null;
    }
    try {
      const res = await apiClient.get(`/api/users/${user.uid}`);
      const profileData = res.data.user;
      set({ profile: profileData });
      return profileData;
    } catch {
      set({ profile: null });
      return null;
    }
  },
}));

export const initAuthListener = () => {
  return onAuthStateChanged(auth, async (firebaseUser) => {
    const store = useAuthStore.getState();
    store.setFirebaseUser(firebaseUser);

    if (!firebaseUser) {
      store.setProfile(null);
      store.setLoading(false);
      useAuthStore.setState({ isInitialized: true });
      return;
    }

    try {
      await store.fetchProfile();
    } finally {
      store.setLoading(false);
      useAuthStore.setState({ isInitialized: true });
    }
  });
};
