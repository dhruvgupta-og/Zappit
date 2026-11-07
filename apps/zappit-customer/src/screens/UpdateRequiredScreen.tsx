import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { typography, spacing, radius } from '../theme/typography';

interface UpdateRequiredScreenProps {
  currentVersion: string;
  updateInfo: {
    latestVersion?: string;
    minVersion?: string;
    forceUpdate?: boolean;
    downloadUrl?: string;
    releaseNotes?: string;
  };
  onDismiss?: () => void;
}

const UpdateRequiredScreen = ({
  currentVersion,
  updateInfo,
  onDismiss,
}: UpdateRequiredScreenProps) => {
  const downloadUrl = updateInfo.downloadUrl || 'https://zappit.shop/download';
  const isForced = updateInfo.forceUpdate === true;

  const handleDownload = () => {
    Linking.canOpenURL(downloadUrl).then((supported) => {
      if (supported) {
        Linking.openURL(downloadUrl);
      } else {
        Linking.openURL('https://zappit.shop/download');
      }
    }).catch(() => {
      Linking.openURL('https://zappit.shop/download');
    });
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent(
      `Hi Zappit Support, I need help updating the app to v${updateInfo.latestVersion || 'latest'}.`
    );
    Linking.openURL(`https://wa.me/918463037671?text=${text}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Glow Badge */}
        <View style={styles.badge}>
          <Text style={styles.badgeText}>⚡ UPDATE REQUIRED</Text>
        </View>

        {/* Icon */}
        <View style={styles.iconCircle}>
          <Text style={{ fontSize: 44 }}>🚀</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>
          {isForced ? 'Update to Continue' : 'New Version Available!'}
        </Text>
        <Text style={styles.subtitle}>
          A new build of the Zappit APK has been published.
          Please download the latest version from our website for the best experience.
        </Text>

        {/* Version Pill */}
        <View style={styles.versionRow}>
          <View style={styles.versionPill}>
            <Text style={styles.versionLabel}>Installed</Text>
            <Text style={styles.versionValue}>v{currentVersion}</Text>
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 18 }}>→</Text>
          <View style={[styles.versionPill, { borderColor: colors.primary }]}>
            <Text style={[styles.versionLabel, { color: colors.primary }]}>Latest</Text>
            <Text style={[styles.versionValue, { color: colors.primary }]}>
              v{updateInfo.latestVersion || '1.0.2'}
            </Text>
          </View>
        </View>

        {/* Release Notes */}
        <View style={styles.notesCard}>
          <Text style={styles.notesTitle}>What's New in this Build</Text>
          <Text style={styles.notesText}>
            {updateInfo.releaseNotes || 'Faster ordering, real-time tracking, loud kitchen alerts, and bug fixes.'}
          </Text>
        </View>

        {/* Action Button */}
        <TouchableOpacity
          style={styles.downloadBtn}
          onPress={handleDownload}
          activeOpacity={0.8}
        >
          <Text style={styles.downloadBtnText}>📥 Download APK from Website</Text>
        </TouchableOpacity>

        {/* Optional Skip */}
        {!isForced && onDismiss && (
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={onDismiss}
            activeOpacity={0.7}
          >
            <Text style={styles.skipBtnText}>Remind Me Later</Text>
          </TouchableOpacity>
        )}

        {/* WhatsApp Help */}
        <TouchableOpacity style={styles.helpBtn} onPress={handleWhatsApp}>
          <Text style={{ color: '#25D366', fontSize: 13, fontWeight: '700' }}>
            💬 Need help installing? WhatsApp Support
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgColor,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    backgroundColor: 'rgba(255, 193, 7, 0.15)',
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.full,
    marginBottom: spacing.xl,
  },
  badgeText: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255, 193, 7, 0.12)',
    borderWidth: 2,
    borderColor: 'rgba(255, 193, 7, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.textMain,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: spacing.xl,
    maxWidth: 320,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: spacing.xl,
  },
  versionPill: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderColor,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    minWidth: 90,
  },
  versionLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  versionValue: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textMain,
    marginTop: 2,
  },
  notesCard: {
    width: '100%',
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderColor,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  notesTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  notesText: {
    fontSize: 14,
    color: colors.textMain,
    lineHeight: 20,
  },
  downloadBtn: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  downloadBtnText: {
    color: '#0B132B',
    fontWeight: '900',
    fontSize: 16,
  },
  skipBtn: {
    paddingVertical: 14,
    marginTop: spacing.xs,
  },
  skipBtnText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  helpBtn: {
    marginTop: spacing.xl,
    padding: spacing.sm,
  },
});

export default UpdateRequiredScreen;
