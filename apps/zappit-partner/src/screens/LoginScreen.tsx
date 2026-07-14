import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { auth } from '../config/firebase';
import { useAuthStore } from '../store/authStore';
import { colors } from '../theme/colors';
import { typography, spacing, radius } from '../theme/typography';

WebBrowser.maybeCompleteAuthSession();
const GOOGLE_CLIENT_ID = '12406084456-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX.apps.googleusercontent.com';

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { fetchProfile } = useAuthStore();

  const handleLogin = async () => {
    setError('');
    if (!email.trim() || !password) { setError('Please fill in all fields.'); return; }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      await fetchProfile();
    } catch (err: any) {
      setError(err.message?.replace('Firebase: ', '') || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const discovery = AuthSession.useAutoDiscovery('https://accounts.google.com');
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_CLIENT_ID,
      scopes: ['openid', 'profile', 'email'],
      responseType: AuthSession.ResponseType.IdToken,
      redirectUri: AuthSession.makeRedirectUri(),
    },
    discovery
  );

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);
      setLoading(true);
      signInWithCredential(auth, credential)
        .then(() => fetchProfile())
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [response]);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.logoContainer}>
          <Text style={styles.title}>Zappit Partners</Text>
          <Text style={styles.subtitle}>Store • Delivery • Admin</Text>
        </View>

        <View style={styles.card}>
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          ) : null}

          <Text style={styles.label}>Partner Email</Text>
          <View style={styles.inputWrapper}>
            <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="email@zappit.com" placeholderTextColor={colors.textMuted} autoCapitalize="none" />
          </View>

          <Text style={[styles.label, { marginTop: spacing.md }]}>Password</Text>
          <View style={styles.inputWrapper}>
            <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="••••••••" placeholderTextColor={colors.textMuted} secureTextEntry={!showPass} />
            <TouchableOpacity onPress={() => setShowPass(!showPass)}><Text style={{ fontSize: 16 }}>{showPass ? '🙈' : '👁️'}</Text></TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Sign In</Text>}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity style={styles.googleBtn} onPress={() => promptAsync()} disabled={loading}>
            <Text style={styles.googleBtnText}>Sign in with Google</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgColor },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: spacing.xxl },
  logoContainer: { alignItems: 'center', marginBottom: spacing.xxxl },
  title: { ...typography.h1, color: colors.textMain },
  subtitle: { ...typography.body, color: colors.primary },
  card: { backgroundColor: colors.cardBg, borderRadius: radius.lg, padding: spacing.xxl, borderWidth: 1, borderColor: colors.borderColor },
  errorBox: { backgroundColor: colors.errorGlow, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', borderRadius: 10, padding: spacing.md, marginBottom: spacing.lg },
  errorText: { color: '#FCA5A5', fontSize: 14, fontWeight: '500' },
  label: { ...typography.label, color: colors.textMuted, marginBottom: 6 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.borderColor, paddingHorizontal: spacing.md },
  input: { flex: 1, paddingVertical: 13, fontSize: 16, color: colors.textMain },
  primaryBtn: { backgroundColor: colors.primaryDark, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: spacing.lg },
  primaryBtnText: { ...typography.button, color: '#fff' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.xl },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.borderColor },
  dividerText: { color: colors.textMuted, fontSize: 12, marginHorizontal: spacing.md },
  googleBtn: { backgroundColor: '#fff', borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
  googleBtnText: { color: '#374151', fontWeight: '700', fontSize: 15 },
});

export default LoginScreen;
