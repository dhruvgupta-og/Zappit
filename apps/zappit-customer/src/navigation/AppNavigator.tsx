import React, { useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';

import { useAuthStore, initAuthListener } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
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

// Cart icon with badge — mirrors the web BottomNav badge
const CartTabIcon = ({ color, size }: { color: string; size: number }) => {
  const cartCount = useCartStore((s) => s.getCartCount());
  return (
    <View style={{ position: 'relative' }}>
      <Feather name="shopping-cart" size={size} color={color} />
      {cartCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{cartCount > 99 ? '99+' : cartCount}</Text>
        </View>
      )}
    </View>
  );
};

const MainTabs = () => (
  <Tab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarStyle: {
        backgroundColor: colors.cardBg,
        borderTopColor: colors.borderColor,
        borderTopWidth: 1,
        paddingBottom: 6,
        paddingTop: 8,
        height: 60,
      },
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.textMuted,
      tabBarLabelStyle: {
        fontSize: 11,
        fontWeight: '600',
        marginTop: 2,
      },
    }}
  >
    <Tab.Screen
      name="Home"
      component={HomeScreen}
      options={{
        tabBarIcon: ({ color, size }) => (
          <Feather name="home" size={size} color={color} />
        ),
      }}
    />
    <Tab.Screen
      name="Cart"
      component={CartScreen}
      options={{
        tabBarIcon: ({ color, size }) => (
          <CartTabIcon color={color} size={size} />
        ),
      }}
    />
    <Tab.Screen
      name="Orders"
      component={OrdersScreen}
      options={{
        tabBarIcon: ({ color, size }) => (
          <Feather name="shopping-bag" size={size} color={color} />
        ),
      }}
    />
    <Tab.Screen
      name="Profile"
      component={ProfileScreen}
      options={{
        tabBarIcon: ({ color, size }) => (
          <Feather name="user" size={size} color={color} />
        ),
      }}
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
            <Stack.Screen name="Checkout" component={CheckoutScreen} />
            <Stack.Screen name="OrderTracker" component={OrderTrackerScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 2,
    borderColor: colors.cardBg,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 13,
  },
});

export default AppNavigator;

