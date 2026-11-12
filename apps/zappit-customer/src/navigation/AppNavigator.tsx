import React, { useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthStore, initAuthListener } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import { colors } from '../theme/colors';
import { FloatingActiveOrderBar } from '../components/FloatingActiveOrderBar';

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
import MaintenanceScreen from '../screens/MaintenanceScreen';
import UpdateRequiredScreen from '../screens/UpdateRequiredScreen';
import Constants from 'expo-constants';
import { apiClient } from '../api/client';

function isVersionOlder(current: string, target: string): boolean {
  if (!target) return false;
  const cParts = (current || '0.0.0').split('.').map(n => parseInt(n, 10) || 0);
  const tParts = target.split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(cParts.length, tParts.length); i++) {
    const c = cParts[i] || 0;
    const t = tParts[i] || 0;
    if (c < t) return true;
    if (c > t) return false;
  }
  return false;
}

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Cart icon with badge
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

const MainTabs = () => {
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom;
  const tabHeight = bottomInset > 0 ? 62 + bottomInset : 60;

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenListeners={{
          tabPress: () => {
            try { Haptics.selectionAsync(); } catch {}
          },
        }}
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.cardBg,
            borderTopColor: colors.borderColor,
            borderTopWidth: 1,
            paddingTop: 8,
            paddingBottom: bottomInset > 0 ? bottomInset + 4 : 8,
            height: tabHeight,
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
      <FloatingActiveOrderBar bottomOffset={tabHeight + 8} />
    </View>
  );
};

const AppNavigator = () => {
  const { firebaseUser, profileComplete, isLoading, isInitialized } = useAuthStore();
  const [isMaintenance, setIsMaintenance] = React.useState(false);
  const [checkingMaintenance, setCheckingMaintenance] = React.useState(true);
  const [updateRequired, setUpdateRequired] = React.useState<{
    required: boolean;
    info: any;
    installedVersion: string;
  } | null>(null);

  useEffect(() => {
    const unsubscribe = initAuthListener();
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const checkAppStatus = async () => {
      try {
        const res = await apiClient.get('/api/app-status');
        if (res.data?.isMaintenanceMode) {
          setIsMaintenance(true);
        }

        const versionInfo = res.data?.appVersion;
        if (versionInfo) {
          const installedVer = Constants.expoConfig?.version || '1.0.1';
          const isOlderThanMin = versionInfo.minVersion && isVersionOlder(installedVer, versionInfo.minVersion);
          const isOlderThanLatest = versionInfo.latestVersion && isVersionOlder(installedVer, versionInfo.latestVersion);

          if (isOlderThanMin || (versionInfo.forceUpdate && isOlderThanLatest)) {
            setUpdateRequired({
              required: true,
              info: versionInfo,
              installedVersion: installedVer,
            });
          }
        }
      } catch (e) {
        // ignore — if check fails, let the app open normally
      } finally {
        setCheckingMaintenance(false);
      }
    };
    checkAppStatus();
  }, []);

  if (!isInitialized || isLoading || checkingMaintenance) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgColor, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (isMaintenance) {
    return <MaintenanceScreen />;
  }

  if (updateRequired?.required) {
    return (
      <UpdateRequiredScreen
        currentVersion={updateRequired.installedVersion}
        updateInfo={updateRequired.info}
        onDismiss={() => setUpdateRequired(null)}
      />
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
            <Stack.Screen name="CartStack" component={CartScreen} />
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

