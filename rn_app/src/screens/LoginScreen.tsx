import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppColors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';

const LoginScreen = () => {
  const { skipLogin, isLoading } = useAuth();
  const [localLoading, setLocalLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLocalLoading(true);
    // In a real app with Expo, we'd use useAuthRequest from expo-auth-session/providers/google
    // For this demonstration, we'll use the skipLogin logic to simulate a successful Google Sign-In
    setTimeout(() => {
      skipLogin();
      setLocalLoading(false);
    }, 1500);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>Z</Text>
          </View>
          <Text style={styles.title}>Zappit</Text>
          <Text style={styles.subtitle}>Campus Delivery Made Simple</Text>
        </View>

        <View style={styles.loginSection}>
          <Text style={styles.welcomeText}>Welcome to the Future of Campus Dining</Text>
          <Text style={styles.instructionText}>Sign in to start ordering from your favorite stores.</Text>

          <TouchableOpacity 
            style={styles.googleButton} 
            onPress={handleGoogleLogin}
            disabled={isLoading || localLoading}
          >
            {isLoading || localLoading ? (
              <ActivityIndicator color="black" />
            ) : (
              <>
                <Image 
                  source={{ uri: 'https://cdn-icons-png.flaticon.com/512/2991/2991148.png' }} 
                  style={styles.googleIcon} 
                />
                <Text style={styles.googleButtonText}>Sign in with Google</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.footerInfo}>
            <Text style={styles.footerText}>By continuing, you agree to our</Text>
            <View style={styles.linkRow}>
              <Text style={styles.link}>Terms of Service</Text>
              <Text style={styles.footerText}> & </Text>
              <Text style={styles.link}>Privacy Policy</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  content: {
    flexGrow: 1,
    padding: 30,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 25,
    backgroundColor: AppColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    elevation: 10,
    shadowColor: AppColors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  logoText: {
    fontSize: 48,
    fontWeight: '900',
    color: 'black',
  },
  title: {
    color: 'white',
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -1,
  },
  subtitle: {
    color: AppColors.textSecondary,
    fontSize: 16,
    marginTop: 5,
  },
  loginSection: {
    backgroundColor: AppColors.cardBackground,
    padding: 30,
    borderRadius: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  welcomeText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  instructionText: {
    color: AppColors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 20,
  },
  googleButton: {
    flexDirection: 'row',
    backgroundColor: 'white',
    width: '100%',
    padding: 18,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginBottom: 30,
  },
  googleIcon: {
    width: 24,
    height: 24,
  },
  googleButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footerInfo: {
    alignItems: 'center',
  },
  footerText: {
    color: AppColors.textSecondary,
    fontSize: 12,
  },
  linkRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  link: {
    color: AppColors.textSecondary,
    fontSize: 12,
    textDecorationLine: 'underline',
  },
});

export default LoginScreen;
