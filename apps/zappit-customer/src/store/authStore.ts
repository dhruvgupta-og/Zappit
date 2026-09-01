import { create } from 'zustand';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { auth } from '../config/firebase';
import { usersApi } from '../api/users';
import { User } from '../types';
import { registerForPushNotifications } from '../utils/notifications';

interface AuthState {
  firebaseUser: FirebaseUser | null;
  profile: User | null;
  profileComplete: boolean;
  isLoading: boolean;
  isInitialized: boolean;

  setFirebaseUser: (user: FirebaseUser | null) => void;
  setProfile: (profile: User | null) => void;
  setProfileComplete: (complete: boolean) => void;
  setLoading: (loading: boolean) => void;
  logout: () => Promise<void>;
  checkProfileComplete: () => Promise<boolean>;
}


export const useAuthStore = create<AuthState>((set, get) => ({
  firebaseUser: null,
  profile: null,
  profileComplete: false,
  isLoading: true,
  isInitialized: false,

  setFirebaseUser: (user) => set({ firebaseUser: user }),
  setProfile: (profile) => set({ profile }),
  setProfileComplete: (complete) => set({ profileComplete: complete }),
  setLoading: (loading) => set({ isLoading: loading }),

  logout: async () => {
    try {
      await GoogleSignin.signOut();
    } catch (error) {
      // Ignored
    }
    await auth.signOut();
    set({
      firebaseUser: null,
      profile: null,
      profileComplete: false,
    });
  },

  checkProfileComplete: async () => {
    const user = auth.currentUser;
    if (!user) {
      set({ profileComplete: false });
      return false;
    }
    try {
      const { exists, user: profile } = await usersApi.getProfile(user.uid);
      const isComplete = exists && profile?.profile_complete === true;
      set({ profile, profileComplete: isComplete });
      return isComplete;
    } catch {
      set({ profileComplete: false });
      return false;
    }
  },
}));

// Listen to Firebase auth state and sync with store
export const initAuthListener = () => {
  return onAuthStateChanged(auth, async (firebaseUser) => {
    const store = useAuthStore.getState();
    store.setLoading(true); // Prevent flash of uninitialized profile state
    store.setFirebaseUser(firebaseUser);

    if (!firebaseUser) {
      store.setProfile(null);
      store.setProfileComplete(false);
      store.setLoading(false);
      useAuthStore.setState({ isInitialized: true });
      return;
    }
      
    try {
      await store.checkProfileComplete();

      // Register for push notifications and save token to backend
      try {
        const pushToken = await registerForPushNotifications();
        if (pushToken && firebaseUser) {
          await usersApi.updateProfile(firebaseUser.uid, { fcmToken: pushToken });
          console.log('[Notifications] Push token registered:', pushToken);
        }
      } catch (notifErr) {
        console.warn('[Notifications] Token registration failed (non-fatal):', notifErr);
      }

    } catch {
      store.setProfileComplete(false);
    } finally {
      store.setLoading(false);
      useAuthStore.setState({ isInitialized: true });
    }
  });
};
