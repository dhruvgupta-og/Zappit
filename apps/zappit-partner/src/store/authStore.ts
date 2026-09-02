import { create } from 'zustand';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import { apiClient } from '../api/client';
import { usersApi } from '../api/users';
import { registerForPushNotificationsAsync } from '../utils/notifications';
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
      // First try to fetch standard profile
      let profileData = null;
      try {
        const res = await apiClient.get(`/api/users/${user.uid}`);
        profileData = res.data.user;
      } catch (e) {
        // Ignore error, fallback to staff route
      }

      // Partner app: always try to merge staff details
      try {
        const staffRes = await apiClient.get(`/api/users/me/staff`);
        if (staffRes.data && staffRes.data.success) {
          const staffData = staffRes.data;
          profileData = {
            ...(profileData || {}),
            uid: user.uid,
            email: user.email,
            role: staffData.role,
            name: staffData.name || profileData?.name || '',
            college_id: staffData.college_id,
            college_name: staffData.college_name,
            store_name: staffData.store_name,
            store_id: staffData.store_id,
          };
        }
      } catch (e) {
        // Ignore staff error
      }

      if (!profileData) {
        set({ profile: null });
        return null;
      }

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

      // Register for push notifications and save Expo token to backend
      try {
        const pushToken = await registerForPushNotificationsAsync();
        if (pushToken && firebaseUser) {
          await usersApi.updateProfile(firebaseUser.uid, { expoPushToken: pushToken });
          console.log('[Notifications] Partner Expo push token registered:', pushToken);
        }
      } catch (notifErr) {
        console.warn('[Notifications] Partner token registration failed:', notifErr);
      }

    } finally {
      store.setLoading(false);
      useAuthStore.setState({ isInitialized: true });
    }
  });
};
