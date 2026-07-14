import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuthStore, initAuthListener } from '../store/authStore';
import { colors } from '../theme/colors';

// Screens
import LoginScreen from '../screens/LoginScreen';
import StoreDashboardScreen from '../screens/StoreDashboardScreen';
import DeliveryDashboardScreen from '../screens/DeliveryDashboardScreen';
import AdminDashboardScreen from '../screens/AdminDashboardScreen';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  const { firebaseUser, profile, isLoading, isInitialized } = useAuthStore();

  useEffect(() => {
    const unsubscribe = initAuthListener();
    return () => unsubscribe();
  }, []);

  if (!isInitialized || isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgColor, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Determine the correct dashboard based on role
  let DashboardComponent = StoreDashboardScreen;
  if (profile?.role === 'admin') DashboardComponent = AdminDashboardScreen;
  else if (profile?.role === 'delivery') DashboardComponent = DeliveryDashboardScreen;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bgColor } }}>
        {!firebaseUser ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <Stack.Screen name="Dashboard" component={DashboardComponent} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
