import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { useAuthStore, initAuthListener } from '../store/authStore';
import { colors } from '../theme/colors';

// Screens
import LoginScreen from '../screens/LoginScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import HomeScreen from '../screens/HomeScreen';
import StoreDetailScreen from '../screens/StoreDetailScreen';
import CartScreen from '../screens/CartScreen';
import CheckoutScreen from '../screens/CheckoutScreen';
import OrderTrackerScreen from '../screens/OrderTrackerScreen';
import OrdersScreen from '../screens/OrdersScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const MainTabs = () => (
  <Tab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarStyle: {
        backgroundColor: colors.cardBg,
        borderTopColor: colors.borderColor,
        paddingBottom: 4,
        paddingTop: 8,
      },
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.textMuted,
    }}
  >
    <Tab.Screen
      name="Home"
      component={HomeScreen}
      options={{ tabBarIcon: () => <Text style={{ fontSize: 20 }}>🏠</Text> }}
    />
    <Tab.Screen
      name="Orders"
      component={OrdersScreen}
      options={{ tabBarIcon: () => <Text style={{ fontSize: 20 }}>📦</Text> }}
    />
    <Tab.Screen
      name="Profile"
      component={ProfileScreen}
      options={{ tabBarIcon: () => <Text style={{ fontSize: 20 }}>👤</Text> }}
    />
  </Tab.Navigator>
);

const AppNavigator = () => {
  const { firebaseUser, profileComplete, isLoading, isInitialized } = useAuthStore();

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

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bgColor } }}>
        {!firebaseUser ? (
          // Auth Flow
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : !profileComplete ? (
          // Onboarding Flow
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          // Main Flow
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="StoreDetail" component={StoreDetailScreen} />
            <Stack.Screen name="Cart" component={CartScreen} />
            <Stack.Screen name="Checkout" component={CheckoutScreen} />
            <Stack.Screen name="OrderTracker" component={OrderTrackerScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

// Simple text shim since we don't have react-native-vector-icons installed
import { Text } from 'react-native';

export default AppNavigator;
