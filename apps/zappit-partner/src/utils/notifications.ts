import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Configure how notifications appear while the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Requests notification permission and returns the Expo push token.
 * Returns null if permission is denied or device is a simulator.
 */
export const registerForPushNotificationsAsync = async (): Promise<string | null> => {
  if (!Device.isDevice) {
    console.log('[Notifications] Push notifications not supported on simulator/emulator.');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[Notifications] Permission denied.');
    return null;
  }

  // Create a default notification channel on Android
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Zappit Partner Notifications',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2196F3', // blueish color for partner app
      sound: 'default',
    });
  }

  // Get the Expo push token (used by Expo's push service which relays to FCM)
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: 'ce9b1cff-bc10-4261-aadb-1a8100e00046', // from app.json extra.eas.projectId
  });

  return tokenData.data;
};

