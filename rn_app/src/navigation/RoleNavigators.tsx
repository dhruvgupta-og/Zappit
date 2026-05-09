import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AdminDashboard from '../screens/AdminDashboard';
import StoreDashboard from '../screens/StoreDashboard';
import DeliveryDashboard from '../screens/DeliveryDashboard';

const Stack = createNativeStackNavigator();

export const AdminNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="AdminHome" component={AdminDashboard} />
  </Stack.Navigator>
);

export const StoreNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="StoreHome" component={StoreDashboard} />
  </Stack.Navigator>
);

export const DeliveryNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="DeliveryHome" component={DeliveryDashboard} />
  </Stack.Navigator>
);
