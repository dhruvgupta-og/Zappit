import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import {
  EmailAuthProvider, linkWithCredential, updatePassword,
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../api/client';
import { usersApi } from '../api/users';
import { storesApi } from '../api/stores';
import { colors } from '../theme/colors';
import { typography, spacing, radius } from '../theme/typography';
import { College } from '../types';

const OnboardingScreen = ({ navigation }: any) => {
  const [step, setStep] = useState(0);
  const [isGoogleUser, setIsGoogleUser] = useState(false);

  // Step 0
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [collegeId, setCollegeId] = useState('');
  const [colleges, setColleges] = useState<College[]>([]);

  // Step 1 (Google users)
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { checkProfileComplete } = useAuthStore();

  useEffect(() => {
    storesApi.getColleges().then(setColleges).catch(() => {});

    const user = auth.currentUser;
    if (!user) return;

    const providerIds = user.providerData.map((p) => p.providerId);
    const isGoogle = providerIds.includes('google.com') && !providerIds.includes('password');
    setIsGoogleUser(isGoogle);

    if (user.displayName) setName(user.displayName);
  }, []);

  const handleProfileSubmit = async () => {
    setError('');
    if (!name.trim()) { setError('Please enter your name.'); return; }
    if (!collegeId) { setError('Please select your college.'); return; }
    if (!phone.trim() || phone.length < 10) { setError('Please enter a valid 10-digit phone number.'); return; }

    if (isGoogleUser) {
      setStep(1);
      return;
    }

    await saveProfile();
  };

  const handlePasswordSubmit = async () => {
    setError('');
    if (!newPassword) { setError('Please enter a password.'); return; }
    if (newPassword.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }

    setLoading(true);
    try {
      const user = auth.currentUser!;
      const credential = EmailAuthProvider.credential(user.email!, newPassword);
      try {
        await linkWithCredential(user, credential);
      } catch (linkErr: any) {
        if (linkErr.code === 'auth/provider-already-linked' || linkErr.code === 'auth/email-already-in-use') {
          await updatePassword(user, newPassword);
        } else {
          throw linkErr;
        }
      }
      await saveProfile();
    } catch (err: any) {
      setError(err.message?.replace('Firebase: ', '') || 'Failed to set password.');
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const user = auth.currentUser!;
      const selectedCollege = colleges.find((c) => c.id === collegeId || c._id === collegeId);
      const collegeName = selectedCollege?.name || collegeId;

      await usersApi.updateProfile(user.uid, {
        uid: user.uid,
        email: user.email || '',
        name: name.trim(),
        phone: phone.trim(),
        college_id: collegeId,
        college: collegeName,
        college_name: collegeName,
        address: 'Engineering Block A',
        profile_complete: true,
        auth_method: isGoogleUser ? 'google' : 'email',
        updated_at: new Date().toISOString(),
      });

      // Send Welcome Email (non-blocking) — pass data in body as fallback for DB race condition
      try {
        await apiClient.post('/api/send-welcome-email', {
          name: name.trim(),
          email: user.email || '',
          college: collegeName,
        });
      } catch (emailErr) {
        console.warn('[Zappit] Welcome email send failed (non-critical):', emailErr);
      }

      await checkProfileComplete();
      // Auth listener will detect profileComplete=true and switch to Main
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to save profile.');
    } finally {
      setLoading(false);
    }
  };

  const steps = isGoogleUser ? ['Profile', 'Password'] : ['Profile'];

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>⚡ Zappit</Text>
          </View>
          <Text style={styles.title}>
            {step === 0 ? 'Complete Your Profile' : 'Set Your Password'}
          </Text>
          <Text style={styles.subtitle}>
            {step === 0 ? 'Just a few details so we know where to deliver!' : 'Secure your account with a password.'}
          </Text>
        </View>

        {/* Step Indicator */}
        <View style={styles.stepRow}>
          {steps.map((s, i) => (
            <View key={s} style={styles.stepItem}>
              <View style={[
                styles.stepCircle,
                i < step && styles.stepDone,
                i === step && styles.stepActive,
              ]}>
                <Text style={[styles.stepNumber, (i <= step) && { color: '#fff' }]}>
                  {i < step ? '✓' : i + 1}
                </Text>
              </View>
              <Text style={[
                styles.stepLabel,
                i === step && { color: colors.primary },
                i < step && { color: colors.success },
              ]}>{s}</Text>
              {i < steps.length - 1 && <View style={[styles.stepLine, i < step && { backgroundColor: colors.success }]} />}
            </View>
          ))}
        </View>

        {/* Card */}
        <View style={styles.card}>
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          ) : null}

          {step === 0 && (
            <>
              <Text style={styles.label}>Full Name</Text>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputIcon}>👤</Text>
                <TextInput
                  style={styles.input} value={name} onChangeText={setName}
                  placeholder="e.g. Dhruv Sharma" placeholderTextColor={colors.textMuted}
                />
              </View>

              <Text style={[styles.label, { marginTop: spacing.lg }]}>Phone Number</Text>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputIcon}>📱</Text>
                <TextInput
                  style={styles.input} value={phone}
                  onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit mobile number" placeholderTextColor={colors.textMuted}
                  keyboardType="phone-pad" maxLength={10}
                />
                {phone.length === 10 && <Text style={{ color: colors.success, fontSize: 16 }}>✓</Text>}
              </View>

              <Text style={[styles.label, { marginTop: spacing.lg }]}>College / University</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
                {colleges.map((c) => (
                  <TouchableOpacity
                    key={c.id || c._id}
                    style={[
                      styles.collegeChip,
                      (collegeId === c.id || collegeId === c._id) && styles.collegeChipActive,
                    ]}
                    onPress={() => setCollegeId(c.id || c._id!)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.collegeChipText,
                      (collegeId === c.id || collegeId === c._id) && styles.collegeChipTextActive,
                    ]}>
                      🎓 {c.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity
                style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
                onPress={handleProfileSubmit} disabled={loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : (
                  <Text style={styles.primaryBtnText}>
                    {isGoogleUser ? 'Next: Set Password  →' : 'Start Ordering  →'}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {step === 1 && isGoogleUser && (
            <>
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                  🔐 <Text style={{ color: colors.textMain, fontWeight: '700' }}>Set a password</Text> so you can sign in with email + password anytime, not just Google.
                </Text>
              </View>

              <Text style={styles.label}>New Password</Text>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputIcon}>🔒</Text>
                <TextInput
                  style={styles.input} value={newPassword} onChangeText={setNewPassword}
                  placeholder="Min. 6 characters" placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showPass}
                />
                <TouchableOpacity onPress={() => setShowPass(!showPass)}>
                  <Text style={{ fontSize: 16 }}>{showPass ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.label, { marginTop: spacing.lg }]}>Confirm Password</Text>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputIcon}>🔒</Text>
                <TextInput
                  style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword}
                  placeholder="Re-enter your password" placeholderTextColor={colors.textMuted}
                  secureTextEntry
                />
                {confirmPassword && newPassword === confirmPassword && (
                  <Text style={{ color: colors.success, fontSize: 16 }}>✓</Text>
                )}
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
                onPress={handlePasswordSubmit} disabled={loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : (
                  <Text style={styles.primaryBtnText}>Set Password & Start Ordering  →</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setStep(0)} style={{ marginTop: spacing.md, alignItems: 'center' }}>
                <Text style={{ color: colors.textMuted, fontSize: 14, textDecorationLine: 'underline' }}>← Back to profile</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgColor },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: spacing.xxl },
  header: { alignItems: 'center', marginBottom: spacing.xxl },
  logoBadge: {
    backgroundColor: colors.primaryDark, paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 20, marginBottom: 14,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 25,
    elevation: 10,
  },
  logoText: { fontSize: 22, color: '#fff', fontWeight: '900', letterSpacing: -1 },
  title: { ...typography.h1, color: colors.textMain, marginBottom: 6, textAlign: 'center' },
  subtitle: { ...typography.body, color: colors.textMuted, textAlign: 'center' },

  stepRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: spacing.xxl },
  stepItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepCircle: {
    width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  stepDone: { backgroundColor: colors.success },
  stepActive: { backgroundColor: colors.primaryDark },
  stepNumber: { fontSize: 13, fontWeight: '700', color: '#6B7280' },
  stepLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  stepLine: { width: 20, height: 2, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 1, marginHorizontal: 4 },

  card: {
    backgroundColor: colors.cardBg, borderRadius: radius.lg, padding: spacing.xxl,
    borderWidth: 1, borderColor: colors.borderColor,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 8,
  },
  errorBox: {
    backgroundColor: colors.errorGlow, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: 10, padding: spacing.md, marginBottom: spacing.lg,
  },
  errorText: { color: '#FCA5A5', fontSize: 14, fontWeight: '500' },
  infoBox: {
    backgroundColor: 'rgba(255,193,7,0.08)', borderWidth: 1, borderColor: 'rgba(255,193,7,0.2)',
    borderRadius: 10, padding: spacing.md, marginBottom: spacing.lg,
  },
  infoText: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  label: { ...typography.label, color: colors.textMuted, marginBottom: 6 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.borderColor, paddingHorizontal: spacing.md,
  },
  inputIcon: { fontSize: 16, marginRight: spacing.sm },
  input: { flex: 1, paddingVertical: 13, fontSize: 16, color: colors.textMain },
  collegeChip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.full,
    backgroundColor: colors.bgColor, borderWidth: 1, borderColor: colors.borderColor,
    marginRight: spacing.sm,
  },
  collegeChipActive: { backgroundColor: 'rgba(255,193,7,0.15)', borderColor: colors.primary },
  collegeChipText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  collegeChipTextActive: { color: colors.primary },
  primaryBtn: {
    backgroundColor: colors.primaryDark, borderRadius: 14, paddingVertical: 15,
    alignItems: 'center', marginTop: spacing.lg,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 14,
    elevation: 6,
  },
  primaryBtnText: { ...typography.button, color: '#fff' },
});

export default OnboardingScreen;
