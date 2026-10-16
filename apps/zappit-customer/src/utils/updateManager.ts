import * as Updates from 'expo-updates';
import { Alert, AppState, AppStateStatus } from 'react-native';

let isChecking = false;

/**
 * Checks for EAS OTA updates and downloads them.
 * Prompts the user to restart if a new update was fetched.
 */
export async function checkAndApplyUpdate(interactive: boolean = false) {
  if (__DEV__) return;
  if (isChecking) return;
  isChecking = true;

  try {
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      Alert.alert(
        'Update Ready',
        'A new version of Zappit with the latest improvements is ready. Would you like to restart now to apply it?',
        [
          { text: 'Later', style: 'cancel' },
          {
            text: 'Restart Now',
            onPress: async () => {
              try {
                await Updates.reloadAsync();
              } catch (e) {
                console.log('[Updates] Reload error:', e);
              }
            },
          },
        ]
      );
    } else if (interactive) {
      Alert.alert('Up to Date', 'You are running the latest version of Zappit.');
    }
  } catch (error) {
    console.log('[Updates] Check error:', error);
    if (interactive) {
      Alert.alert('Update Check Failed', 'Unable to check for updates right now. Please check your internet connection.');
    }
  } finally {
    isChecking = false;
  }
}

/**
 * Sets up background and foreground listeners to automatically check for updates.
 */
export function setupAutoUpdates() {
  if (__DEV__) return () => {};

  // Check on launch
  checkAndApplyUpdate(false);

  // Check whenever app returns to foreground from background
  const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active') {
      checkAndApplyUpdate(false);
    }
  });

  return () => {
    subscription.remove();
  };
}
