import React, { useEffect, useState } from 'react';
import { View, Text, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import * as Sentry from '@sentry/react-native';
import { setupAutoUpdates } from './src/utils/updateManager';
import { colors } from './src/theme/colors';

Sentry.init({
  dsn: 'https://b6f5b31b5408027932f0992f5150c8f5@o4512033615052800.ingest.us.sentry.io/4512033623769088',

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Enable Logs
  enableLogs: true,

  // Configure Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

export default Sentry.wrap(function App() {
  const [updateState, setUpdateState] = useState<{ isUpdating: boolean; text?: string }>({
    isUpdating: false,
  });

  useEffect(() => {
    const cleanup = setupAutoUpdates((isUpdating, text) => {
      setUpdateState({ isUpdating, text });
    });
    return cleanup;
  }, []);

  if (updateState.isUpdating) {
    return (
      <View style={styles.updatingContainer}>
        <Image source={require('./assets/icon.png')} style={styles.updatingIcon} />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.updatingTitle}>Updating Zappit...</Text>
        <Text style={styles.updatingSubtitle}>
          {updateState.text || 'Applying the latest updates for you. Just a moment!'}
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <AppNavigator />
    </SafeAreaProvider>
  );
});

const styles = StyleSheet.create({
  updatingContainer: {
    flex: 1,
    backgroundColor: colors.bgColor,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  updatingIcon: {
    width: 84,
    height: 84,
    borderRadius: 22,
    marginBottom: 24,
  },
  updatingTitle: {
    color: colors.textMain,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 18,
    textAlign: 'center',
  },
  updatingSubtitle: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
  },
});

