import * as Updates from 'expo-updates';
import { Alert, AppState, AppStateStatus } from 'react-native';

export type UpdateStatusListener = (isUpdating: boolean, statusText?: string) => void;

let isChecking = false;
let hasAutoReloadedThisSession = false;

/**
 * Returns current update runtime diagnostic information for Partner App.
 */
export function getUpdateInfo() {
  return {
    isEnabled: Updates.isEnabled,
    channel: Updates.channel || 'none',
    runtimeVersion: typeof Updates.runtimeVersion === 'string' ? Updates.runtimeVersion : 'appVersion',
    updateId: Updates.updateId,
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
    createdAt: Updates.createdAt ? new Date(Updates.createdAt).toLocaleString() : null,
  };
}

/**
 * Checks for EAS OTA updates and downloads them.
 * If running the embedded base build (new partner download), it automatically applies and reloads.
 * If interactive, shows alert diagnostics.
 */
export async function checkAndApplyUpdate(
  interactive: boolean = false,
  onStatusChange?: UpdateStatusListener
) {
  if (__DEV__) {
    if (interactive) {
      Alert.alert('Development Mode', 'OTA updates are disabled in development mode (__DEV__ is true).');
    }
    return;
  }

  if (!Updates.isEnabled) {
    if (interactive) {
      Alert.alert('Updates Disabled', 'Expo Updates is not enabled in this build. Please verify expo-updates configuration.');
    }
    return;
  }

  if (isChecking) return;
  isChecking = true;

  try {
    console.log('[Partner Updates] Checking on channel:', Updates.channel, 'runtimeVersion:', Updates.runtimeVersion);
    const update = await Updates.checkForUpdateAsync();

    if (update.isAvailable) {
      console.log('[Partner Updates] New update found, fetching...');

      // If the app is currently running the base embedded APK build (new user download)
      // and has not yet reloaded this session, immediately fetch and reload so they get
      // all the latest updates on first launch without having to press any alert.
      if (Updates.isEmbeddedLaunch && !hasAutoReloadedThisSession) {
        onStatusChange?.(true, 'Applying the latest updates for you...');
        await Updates.fetchUpdateAsync();
        hasAutoReloadedThisSession = true;
        await Updates.reloadAsync();
        return;
      }

      // For existing users already on an OTA update, download in background and prompt
      await Updates.fetchUpdateAsync();
      Alert.alert(
        'Update Ready',
        'A new version of Zappit Partner with the latest improvements is ready. Would you like to restart now to apply it?',
        [
          { text: 'Later', style: 'cancel' },
          {
            text: 'Restart Now',
            onPress: async () => {
              try {
                await Updates.reloadAsync();
              } catch (e) {
                console.log('[Partner Updates] Reload error:', e);
              }
            },
          },
        ]
      );
    } else if (interactive) {
      const channelText = Updates.channel ? `Channel: ${Updates.channel}` : 'No channel set';
      const versionText = typeof Updates.runtimeVersion === 'string' ? `Runtime: ${Updates.runtimeVersion}` : '';
      const stateText = Updates.isEmbeddedLaunch ? 'Running base build' : 'Running OTA update';
      Alert.alert(
        'Up to Date',
        `You are running the latest version of Zappit Partner.\n\n• ${channelText}\n• ${versionText}\n• ${stateText}`
      );
    }
  } catch (error: any) {
    console.log('[Partner Updates] Check error:', error);
    onStatusChange?.(false);
    if (interactive) {
      Alert.alert(
        'Update Check Failed',
        `Unable to check for updates: ${error?.message || 'Network error'}\n\nChannel: ${Updates.channel || 'none'}\nRuntime: ${Updates.runtimeVersion || 'unknown'}`
      );
    }
  } finally {
    isChecking = false;
  }
}

/**
 * Sets up background and foreground listeners to automatically check for updates.
 * For new users (isEmbeddedLaunch = true), it triggers the auto-update check immediately.
 */
export function setupAutoUpdates(onStatusChange?: UpdateStatusListener) {
  if (__DEV__ || !Updates.isEnabled) return () => {};

  // Check on launch
  checkAndApplyUpdate(false, onStatusChange);

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
