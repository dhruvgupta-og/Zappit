import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { usersApi } from '../api/users';
import { storesApi } from '../api/stores';
import { College } from '../types';
import { colors } from '../theme/colors';
import { typography, spacing, radius } from '../theme/typography';

const ProfileScreen = () => {
  const { profile, setProfile, logout, firebaseUser } = useAuthStore();

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(profile?.name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [college, setCollege] = useState(profile?.college_name || profile?.college || '');
  const [collegeId, setCollegeId] = useState(profile?.college_id || '');
  const [colleges, setColleges] = useState<College[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    storesApi.getColleges().then(setColleges).catch(() => {});
  }, []);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  const handleSave = async () => {
    if (!firebaseUser?.uid || !firebaseUser?.email || !profile) return;
    setLoading(true);
    try {
      const selectedCollege = colleges.find((c) => (c.id || c._id) === collegeId);
      const collegeName = selectedCollege?.name || college;
      await usersApi.updateProfile(firebaseUser.uid, { ...profile, uid: firebaseUser.uid, email: firebaseUser.email, name, phone, college_name: collegeName, college_id: collegeId });
      setProfile({ ...profile, name, phone, college_name: collegeName, college_id: collegeId });
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
        {isEditing ? (
          <TouchableOpacity onPress={handleSave} disabled={loading} style={styles.editBtn}>
            {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.editBtnText}>Save</Text>}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.editBtnLight}>
            <Text style={styles.editBtnTextLight}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl }}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{profile?.name?.charAt(0) || 'U'}</Text>
          </View>
          {isEditing ? (
            <TextInput style={styles.editInputName} value={name} onChangeText={setName} placeholder="Your Name" placeholderTextColor={colors.textMuted} />
          ) : (
            <Text style={styles.name}>{profile?.name || 'User'}</Text>
          )}
          <Text style={styles.email}>{profile?.email}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Details</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.label}>Phone</Text>
              {isEditing ? (
                <TextInput style={styles.editInput} value={phone} onChangeText={setPhone} placeholder="Phone Number" keyboardType="phone-pad" placeholderTextColor={colors.textMuted} />
              ) : (
                <Text style={styles.value}>{profile?.phone || 'Not set'}</Text>
              )}
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.label}>College</Text>
              {!isEditing && (
                <Text style={styles.value}>{profile?.college_name || profile?.college || 'Not set'}</Text>
              )}
            </View>
            {isEditing && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}>
                {colleges.map((c) => {
                  const cId = c.id || c._id;
                  const isActive = collegeId === cId || (college === c.name && !collegeId);
                  return (
                    <TouchableOpacity
                      key={cId}
                      style={[styles.collegeChip, isActive && styles.collegeChipActive]}
                      onPress={() => { setCollegeId(cId!); setCollege(c.name); }}
                    >
                      <Text style={[styles.collegeChipText, isActive && styles.collegeChipTextActive]}>
                        🎓 {c.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
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
            <TouchableOpacity style={styles.rowBtn} onPress={() => Alert.alert('Coming Soon', 'This feature is under development.')}>
              <Text style={styles.btnLabel}>Saved Addresses</Text>
              <Text style={{ color: colors.textMuted }}>→</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.rowBtn} onPress={() => Alert.alert('Coming Soon', 'This feature is under development.')}>
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
  header: { padding: spacing.xl, paddingBottom: spacing.sm, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { ...typography.h2, color: colors.textMain },
  editBtn: { backgroundColor: colors.primaryDark, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  editBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  editBtnLight: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  editBtnTextLight: { color: colors.textMain, fontWeight: '700', fontSize: 14 },

  avatarContainer: { alignItems: 'center', marginBottom: spacing.xxxl, marginTop: spacing.lg },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primaryDark,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },
  avatarText: { fontSize: 36, fontWeight: '800', color: '#fff' },
  name: { ...typography.h2, color: colors.textMain, marginBottom: 4 },
  editInputName: { ...typography.h2, color: colors.textMain, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: colors.primary, textAlign: 'center', minWidth: 200 },
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
  editInput: { fontSize: 15, color: colors.textMain, fontWeight: '500', borderBottomWidth: 1, borderBottomColor: colors.primary, minWidth: 120, textAlign: 'right', padding: 0 },
  btnLabel: { fontSize: 15, color: colors.textMain },
  btnValue: { fontSize: 14, color: colors.primary, fontWeight: '600' },
  divider: { height: 1, backgroundColor: colors.borderColor },

  collegeChip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.full,
    backgroundColor: colors.bgColor, borderWidth: 1, borderColor: colors.borderColor,
    marginRight: spacing.sm,
  },
  collegeChipActive: { backgroundColor: 'rgba(255,193,7,0.15)', borderColor: colors.primary },
  collegeChipText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  collegeChipTextActive: { color: colors.primary },

  logoutBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: radius.md,
    padding: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)',
    marginTop: spacing.xl,
  },
  logoutText: { color: colors.error, fontWeight: '700', fontSize: 16 },
});

export default ProfileScreen;

