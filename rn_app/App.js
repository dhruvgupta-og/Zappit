import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import AppNavigator from './src/navigation/AppNavigator';
import { AdminNavigator, StoreNavigator, DeliveryNavigator } from './src/navigation/RoleNavigators';
import LoginScreen from './src/screens/LoginScreen';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppColors } from './src/theme/colors';
import { StatusBar } from 'expo-status-bar';

const Root = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: AppColors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={AppColors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!user ? (
        <LoginScreen />
      ) : user.role === 'admin' ? (
        <AdminNavigator />
      ) : user.role === 'store' ? (
        <StoreNavigator />
      ) : user.role === 'delivery' ? (
        <DeliveryNavigator />
      ) : (
        <AppNavigator />
      )}
    </NavigationContainer>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <Root />
        </SafeAreaProvider>
      </CartProvider>
    </AuthProvider>
  );
}
