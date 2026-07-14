import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

const DashboardSkeleton = ({ title }: { title: string }) => (
  <SafeAreaView style={styles.container}>
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
    </View>
    <View style={styles.content}>
      <Text style={styles.placeholderText}>This dashboard is under construction.</Text>
    </View>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgColor },
  header: { padding: 20, borderBottomWidth: 1, borderBottomColor: colors.borderColor },
  title: { fontSize: 24, fontWeight: '700', color: colors.textMain },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  placeholderText: { color: colors.textMuted, fontSize: 16 },
});

export const StoreDashboard = () => <DashboardSkeleton title="Store Dashboard" />;
export const DeliveryDashboard = () => <DashboardSkeleton title="Delivery Dashboard" />;
export const AdminDashboard = () => <DashboardSkeleton title="Admin Dashboard" />;
