import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Vibration } from 'react-native';

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

/**
 * Triggers an urgent loud sound and persistent vibration alert
 * for store and delivery dashboards when a new order arrives.
 */
export const playOrderAlert = async (title: string, body: string) => {
  try {
    // 1. Urgent vibration pattern
    Vibration.vibrate([0, 600, 250, 600, 250, 800, 250, 1000]);

    // 2. High-priority Android notification channel with sound and max importance
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('order_loud_alert', {
        name: 'Urgent Order Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 600, 250, 600, 250, 800, 250, 1000],
        sound: 'default',
        enableVibrate: true,
        enableLights: true,
        lightColor: '#EF4444',
        bypassDnd: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }

    // 3. Fire high-priority notification with loud sound immediately
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        channelId: 'order_loud_alert',
        priority: Notifications.AndroidNotificationPriority.MAX,
        vibrate: [0, 600, 250, 600, 250, 800, 250, 1000],
      },
      trigger: null,
    });

    // 4. Follow-up chime ring after 2.2 seconds to ensure it catches attention
    setTimeout(async () => {
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            sound: true,
            channelId: 'order_loud_alert',
            priority: Notifications.AndroidNotificationPriority.MAX,
          },
          trigger: null,
        });
        Vibration.vibrate([0, 500, 200, 500]);
      } catch {}
    }, 2200);
  } catch (err) {
    console.warn('[Notifications] Failed to play order alert notification:', err);
    Vibration.vibrate([0, 800, 300, 800]);
  }
};

