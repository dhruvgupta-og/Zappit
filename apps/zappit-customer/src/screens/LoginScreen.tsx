import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, Image,
} from 'react-native';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
} from 'firebase/auth';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as WebBrowser from 'expo-web-browser';
import { auth } from '../config/firebase';
import { useAuthStore } from '../store/authStore';
import { usersApi } from '../api/users';
import { colors } from '../theme/colors';
import { typography, spacing, radius } from '../theme/typography';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_WEB_CLIENT_ID = '12406084456-4rkekvj6h93rm4r90v7c3q324paok1k6.apps.googleusercontent.com';
const GOOGLE_ANDROID_CLIENT_ID = '12406084456-nkg0fjcb4v35il9917lk450dat2m3qla.apps.googleusercontent.com';

// Configure native Google Sign-In once
GoogleSignin.configure({
  webClientId: GOOGLE_WEB_CLIENT_ID,
  androidClientId: GOOGLE_ANDROID_CLIENT_ID,
  offlineAccess: false,
});

const LoginScreen = ({ navigation }: any) => {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);



  const friendlyError = (err: any) => {
    const code = err.code || '';
    if (code.includes('user-not-found') || code.includes('wrong-password') || code.includes('invalid-credential'))
      return 'Incorrect email or password. Please try again.';
    if (code.includes('email-already-in-use'))
      return 'An account with this email already exists. Try signing in.';
    if (code.includes('weak-password'))
      return 'Password is too weak. Use at least 6 characters.';
    if (code.includes('invalid-email'))
      return 'Please enter a valid email address.';
    return err.message?.replace('Firebase: ', '') || 'Something went wrong.';
  };

  const handleEmailLogin = async () => {
    setError('');
    if (!email.trim() || !password) { setError('Please fill in all fields.'); return; }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err: any) {
      setError(friendlyError(err));
      setLoading(false);
    }
  };

  const handleEmailRegister = async () => {
    setError('');
    if (!email.trim() || !password || !confirmPassword) { setError('Please fill in all fields.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
      try {
        await usersApi.updateProfile(result.user.uid, {
          email: email.trim(),
          profile_complete: false,
          auth_method: 'email',
        });
      } catch { }
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        try {
          await signInWithEmailAndPassword(auth, email.trim(), password);
        } catch {
          setError('An account with this email already exists. Please sign in with your password.');
          setTab('login');
          setLoading(false);
        }
      } else {
        setError(friendlyError(err));
        setLoading(false);
      }
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      if (Platform.OS === 'web') {
        // Web: use Firebase popup flow
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
      } else {
        // Native Android/iOS: use native Google Sign-In SDK
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        const userInfo = await GoogleSignin.signIn();
        const idToken = userInfo.data?.idToken;
        if (!idToken) throw new Error('No ID token received from Google.');
        const credential = GoogleAuthProvider.credential(idToken);
        await signInWithCredential(auth, credential);
      }
    } catch (err: any) {
      console.error('Google Sign-In error:', err);
      if (err.code === statusCodes.SIGN_IN_CANCELLED) {
        // User cancelled — no error message needed
      } else if (err.code === statusCodes.IN_PROGRESS) {
        setError('Sign-in already in progress. Please wait.');
      } else if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        setError('Google Play Services is not available on this device.');
      } else if (err.code !== 'auth/popup-closed-by-user') {
        setError(friendlyError(err));
      }
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoIcon}>⚡</Text>
            <Text style={styles.logoText}>Zappit</Text>
          </View>
          <Text style={styles.title}>Welcome to Zappit</Text>
          <Text style={styles.subtitle}>The fastest campus delivery app.</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          {/* Tab Switcher */}
          <View style={styles.tabContainer}>
            {(['login', 'register'] as const).map((key) => (
              <TouchableOpacity
                key={key}
                style={[styles.tab, tab === key && styles.tabActive]}
                onPress={() => { setTab(key); setError(''); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>
                  {key === 'login' ? 'Sign In' : 'Create Account'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Error */}
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          ) : null}

          {/* Email */}
          <Text style={styles.label}>Email Address</Text>
          <View style={styles.inputWrapper}>
            <Text style={styles.inputIcon}>✉️</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Dhruv@gmail.com"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Password */}
          <Text style={[styles.label, { marginTop: spacing.md }]}>Password</Text>
          <View style={styles.inputWrapper}>
            <Text style={styles.inputIcon}>🔒</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              secureTextEntry={!showPass}
            />
            <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
              <Text style={{ fontSize: 16 }}>{showPass ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          {/* Confirm Password (register) */}
          {tab === 'register' && (
            <>
              <Text style={[styles.label, { marginTop: spacing.md }]}>Confirm Password</Text>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputIcon}>🔒</Text>
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showConfirmPass}
                />
                <TouchableOpacity onPress={() => setShowConfirmPass(!showConfirmPass)} style={styles.eyeBtn}>
                  <Text style={{ fontSize: 16 }}>{showConfirmPass ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Submit */}
          <TouchableOpacity
            style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
            onPress={tab === 'login' ? handleEmailLogin : handleEmailRegister}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {tab === 'login' ? 'Sign In  →' : 'Create Account  →'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google */}
          <TouchableOpacity
            style={styles.googleBtn}
            onPress={handleGoogleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Image
              source={{ uri: 'https://cdn-icons-png.flaticon.com/512/2991/2991148.png' }}
              style={{ width: 20, height: 20 }}
            />
            <Text style={styles.googleBtnText}>
              {loading ? 'Connecting...' : 'Sign in with Google'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.terms}>
            By continuing, you agree to Zappit's Terms of Service and Privacy Policy.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgColor },
  scrollContent: {
    flexGrow: 1, justifyContent: 'center', padding: spacing.xxl,
  },
  logoContainer: { alignItems: 'center', marginBottom: spacing.xxxl },
  logoBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.primaryDark, paddingHorizontal: 22, paddingVertical: 14,
    borderRadius: 24, marginBottom: 18,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.35, shadowRadius: 25,
    elevation: 10,
  },
  logoIcon: { fontSize: 22, marginRight: 6 },
  logoText: { fontSize: 28, color: '#fff', fontWeight: '900', letterSpacing: -1 },
  title: { ...typography.h1, color: colors.textMain, marginBottom: 6 },
  subtitle: { ...typography.body, color: colors.textMuted, textAlign: 'center' },

  card: {
    backgroundColor: colors.cardBg, borderRadius: radius.lg,
    padding: spacing.xxl, borderWidth: 1, borderColor: colors.borderColor,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 8,
  },

  tabContainer: {
    flexDirection: 'row', backgroundColor: colors.bgColor,
    borderRadius: radius.md, padding: 4, marginBottom: spacing.xxl,
    borderWidth: 1, borderColor: colors.borderColor,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabActive: {
    backgroundColor: colors.primaryDark,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 8,
  },
  tabText: { ...typography.buttonSmall, color: colors.textMuted },
  tabTextActive: { color: '#fff' },

  errorBox: {
    backgroundColor: colors.errorGlow, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: 10, padding: spacing.md, marginBottom: spacing.lg,
  },
  errorText: { color: '#FCA5A5', fontSize: 14, fontWeight: '500' },

  label: {
    ...typography.label, color: colors.textMuted, marginBottom: 6,
  },

  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.borderColor,
    paddingHorizontal: spacing.md,
  },
  inputIcon: { fontSize: 16, marginRight: spacing.sm },
  input: {
    flex: 1, paddingVertical: 13, fontSize: 16, color: colors.textMain,
  },
  eyeBtn: { padding: spacing.xs },

  primaryBtn: {
    backgroundColor: colors.primaryDark, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', marginTop: spacing.lg,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 14,
    elevation: 6,
  },
  primaryBtnText: { ...typography.button, color: '#fff' },

  divider: {
    flexDirection: 'row', alignItems: 'center', marginVertical: spacing.xl,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.borderColor },
  dividerText: { color: colors.textMuted, fontSize: 12, fontWeight: '600', marginHorizontal: spacing.md },

  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff', borderRadius: radius.md,
    paddingVertical: 13, gap: 12,
    borderWidth: 1.5, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8,
    elevation: 3,
  },
  googleBtnText: { color: '#374151', fontWeight: '700', fontSize: 15 },

  terms: {
    marginTop: spacing.xl, fontSize: 11, color: colors.textMuted,
    textAlign: 'center', lineHeight: 16,
  },
});

export default LoginScreen;
