import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { colors } from '../theme/colors';
import { typography, spacing, radius } from '../theme/typography';

const ProfileScreen = () => {
  const { profile, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl }}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{profile?.name?.charAt(0) || 'U'}</Text>
          </View>
          <Text style={styles.name}>{profile?.name || 'User'}</Text>
          <Text style={styles.email}>{profile?.email}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Details</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.label}>Phone</Text>
              <Text style={styles.value}>{profile?.phone || 'Not set'}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.label}>College</Text>
              <Text style={styles.value}>{profile?.college_name || profile?.college || 'Not set'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.rowBtn}>
              <Text style={styles.btnLabel}>Push Notifications</Text>
              <Text style={styles.btnValue}>Enabled</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.rowBtn}>
              <Text style={styles.btnLabel}>Saved Addresses</Text>
              <Text style={{ color: colors.textMuted }}>→</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.rowBtn}>
              <Text style={styles.btnLabel}>Help & Support</Text>
              <Text style={{ color: colors.textMuted }}>→</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgColor },
  header: { padding: spacing.xl, paddingBottom: spacing.sm },
  title: { ...typography.h2, color: colors.textMain },

  avatarContainer: { alignItems: 'center', marginBottom: spacing.xxxl, marginTop: spacing.lg },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primaryDark,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },
  avatarText: { fontSize: 36, fontWeight: '800', color: '#fff' },
  name: { ...typography.h2, color: colors.textMain, marginBottom: 4 },
  email: { fontSize: 15, color: colors.textMuted },

  section: { marginBottom: spacing.xxl },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', marginBottom: spacing.sm, paddingLeft: 4 },
  card: {
    backgroundColor: colors.cardBg, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.borderColor,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', padding: spacing.lg },
  rowBtn: { flexDirection: 'row', justifyContent: 'space-between', padding: spacing.lg, alignItems: 'center' },
  label: { fontSize: 15, color: colors.textMuted },
  value: { fontSize: 15, color: colors.textMain, fontWeight: '500' },
  btnLabel: { fontSize: 15, color: colors.textMain },
  btnValue: { fontSize: 14, color: colors.primary, fontWeight: '600' },
  divider: { height: 1, backgroundColor: colors.borderColor },

  logoutBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: radius.md,
    padding: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)',
    marginTop: spacing.xl,
  },
  logoutText: { color: colors.error, fontWeight: '700', fontSize: 16 },
});

export default ProfileScreen;
