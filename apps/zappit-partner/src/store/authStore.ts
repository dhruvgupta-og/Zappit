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
    console.log('[AuthStore] fetchProfile called, uid:', user?.uid ?? 'NO USER');
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
        console.log('[AuthStore] user profile fetched:', JSON.stringify(profileData));
      } catch (e: any) {
        console.warn('[AuthStore] user profile fetch failed:', e?.message);
      }

      // Partner app: always try to merge staff details
      try {
        const staffRes = await apiClient.get(`/api/users/me/staff`);
        console.log('[AuthStore] staff raw response:', JSON.stringify(staffRes.data));
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
          console.log('[AuthStore] merged profile:', JSON.stringify(profileData));
        } else {
          console.warn('[AuthStore] staff response not success:', JSON.stringify(staffRes.data));
        }
      } catch (e: any) {
        console.error('[AuthStore] staff fetch error:', e?.message, e?.response?.data);
      }

      if (!profileData) {
        console.warn('[AuthStore] no profileData, setting null');
        set({ profile: null });
        return null;
      }

      set({ profile: profileData });
      return profileData;
    } catch (e: any) {
      console.error('[AuthStore] fetchProfile outer error:', e?.message);
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
