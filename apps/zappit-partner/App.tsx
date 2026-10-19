import React, { useEffect, useState } from 'react';
import { View, Text, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { setupAutoUpdates } from './src/utils/updateManager';
import { colors } from './src/theme/colors';

export default function App() {
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
        <Text style={styles.updatingTitle}>Updating Zappit Partner...</Text>
        <Text style={styles.updatingSubtitle}>
          {updateState.text || 'Applying the latest updates for you. Just a moment!'}
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AppNavigator />
    </SafeAreaProvider>
  );
}

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

