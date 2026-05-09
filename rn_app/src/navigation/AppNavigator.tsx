import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Home as HomeIcon, Receipt, User } from 'lucide-react-native';
import { AppColors } from '../theme/colors';
import HomeScreen from '../screens/HomeScreen';
import OrdersScreen from '../screens/OrdersScreen';
import ProfileScreen from '../screens/ProfileScreen';
import StoreDetailsScreen from '../screens/StoreDetailsScreen';
import CartScreen from '../screens/CartScreen';
import OrderSuccessScreen from '../screens/OrderSuccessScreen';
import WebViewScreen from '../screens/WebViewScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TabNavigator = () => (
  <Tab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarStyle: {
        backgroundColor: AppColors.background,
        borderTopColor: 'rgba(255,255,255,0.05)',
        paddingTop: 10,
        height: 85,
      },
      tabBarActiveTintColor: AppColors.primary,
      tabBarInactiveTintColor: AppColors.textSecondary,
    }}
  >
    <Tab.Screen 
      name="Home" 
      component={HomeScreen} 
      options={{
        tabBarIcon: ({ color, size }) => <HomeIcon color={color} size={size} />,
      }}
    />
    <Tab.Screen 
      name="Orders" 
      component={OrdersScreen} 
      options={{
        tabBarIcon: ({ color, size }) => <Receipt color={color} size={size} />,
      }}
    />
    <Tab.Screen 
      name="Profile" 
      component={ProfileScreen} 
      options={{
        tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
      }}
    />
  </Tab.Navigator>
);

const AppNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={TabNavigator} />
      <Stack.Screen name="StoreDetails" component={StoreDetailsScreen} />
      <Stack.Screen name="Cart" component={CartScreen} />
      <Stack.Screen name="OrderSuccess" component={OrderSuccessScreen} />
      <Stack.Screen name="WebView" component={WebViewScreen} />
    </Stack.Navigator>
  );
};

export default AppNavigator;
