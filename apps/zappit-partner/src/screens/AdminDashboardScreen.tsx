import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ordersApi } from '../api/orders';
import { apiClient } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { colors } from '../theme/colors';
import { typography, spacing, radius } from '../theme/typography';

const AdminDashboardScreen = () => {
  const { logout } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ orders: 0, revenue: 0, stores: 0, users: 0 });

  const fetchStats = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/admin/dashboard-stats');
      if (res.data.success) {
        setStats({
          orders: res.data.totalOrders,
          revenue: res.data.totalRevenue,
          stores: res.data.totalStores,
          users: res.data.totalUsers,
        });
      }
    } catch (err) {
      console.error('Failed to fetch admin stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.adminAccent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.topBarSubtitle}>👑 Super Admin</Text>
          <Text style={styles.topBarTitle}>Dashboard</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Text style={{ fontSize: 16 }}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={{ padding: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.adminAccent} />}
      >
        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          {[
            { label: 'Total Orders', value: stats.orders, emoji: '📦' },
            { label: 'Total Revenue', value: `₹${stats.revenue.toLocaleString()}`, emoji: '💰' },
            { label: 'Active Stores', value: stats.stores, emoji: '🏪' },
            { label: 'Total Users', value: stats.users, emoji: '👥' },
          ].map(s => (
            <View key={s.label} style={styles.statCard}>
              <Text style={{ fontSize: 24, marginBottom: 8 }}>{s.emoji}</Text>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.infoBox}>
          <Text style={{ fontSize: 40, marginBottom: spacing.md, textAlign: 'center' }}>🚧</Text>
          <Text style={styles.infoTitle}>Admin Tools Limited</Text>
          <Text style={styles.infoText}>
            For detailed store management, college management, and full order history, please use the Zappit Web Admin Portal on a desktop browser.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgColor },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderColor },
  topBarSubtitle: { fontSize: 11, color: colors.adminAccent, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  topBarTitle: { ...typography.h2, color: colors.textMain },
  logoutBtn: { padding: 8 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.xxl },
  statCard: { width: '47%', backgroundColor: colors.cardBg, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center', borderWidth: 1, borderColor: colors.borderColor },
  statValue: { ...typography.h2, color: colors.adminAccent },
  statLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase', marginTop: 4 },

  infoBox: { backgroundColor: 'rgba(255,255,255,0.03)', padding: spacing.xl, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderColor },
  infoTitle: { ...typography.h3, color: colors.textMain, textAlign: 'center', marginBottom: spacing.sm },
  infoText: { color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
});

export default AdminDashboardScreen;
