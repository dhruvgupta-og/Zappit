import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList,
  ActivityIndicator, TextInput, Alert, Modal, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ordersApi } from '../api/orders';
import { useAuthStore } from '../store/authStore';
import { colors } from '../theme/colors';
import { typography, spacing, radius } from '../theme/typography';
import { Order } from '../types';

const TABS = [
  { key: 'new', label: 'To Pick Up' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Done' },
];

const DeliveryDashboardScreen = () => {
  const { logout } = useAuthStore();

  const [orders, setOrders] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('new');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [otpPromptId, setOtpPromptId] = useState<string | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await ordersApi.getOrders();
      if (res.success) {
        setOrders(res.orders);
      }
    } catch (err) {
      console.error('Failed to fetch delivery orders:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  };

  const getDateObj = (val: any) => {
    if (!val) return new Date(0);
    if (val.toDate) return val.toDate();
    return new Date(val);
  };

  const getItems = (items: any) => {
    if (!items) return [];
    if (Array.isArray(items)) return items;
    return Object.entries(items).map(([id, qty]) => ({ id, name: id, qty, price: 0 }));
  };

  const sortedByTime = (list: any[]) => [...list].sort((a, b) => getDateObj(a.created_at).getTime() - getDateObj(b.created_at).getTime());

  const newOrders = sortedByTime(orders.filter(o => o.order_status === 'ready' || o.order_status === 'out_for_delivery'));
  const activeOrders = sortedByTime(orders.filter(o => o.order_status === 'picked_up'));
  const completedOrders = sortedByTime(orders.filter(o => o.order_status === 'delivered')).reverse();

  const tabOrders = activeTab === 'new' ? newOrders : activeTab === 'active' ? activeOrders : completedOrders;

  const tabCounts: Record<string, number> = {
    new: newOrders.length,
    active: activeOrders.length,
    completed: completedOrders.length,
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      await ordersApi.updateOrderStatus(orderId, status);
      await ordersApi.sendStatusNotification(orderId, status);
      fetchOrders();
    } catch {
      Alert.alert('Error', 'Failed to update order status');
    }
  };

  const handleMarkDelivered = (order: any) => {
    if (order.requires_otp) {
      setOtpPromptId(order.id || order._id);
      setOtpInput('');
    } else {
      updateOrderStatus(order.id || order._id, 'delivered');
    }
  };

  const verifyOtpAndDeliver = async () => {
    if (!otpPromptId || !otpInput.trim()) return;
    setVerifyingOtp(true);
    try {
      const res = await ordersApi.verifyOtp(otpPromptId, otpInput.trim());
      if (res.success) {
        setOtpPromptId(null);
        setOtpInput('');
        fetchOrders();
      } else {
        Alert.alert('Error', 'Invalid OTP');
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Invalid OTP. Please check with customer.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.deliveryAccent} />
        </View>
      </SafeAreaView>
    );
  }

  const renderOrderCard = ({ item: order }: { item: any }) => {
    const orderId = order.id || order._id;
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.storeName}>🏪 {order.store_name || 'Store'}</Text>
            <Text style={styles.orderIdText}>#{String(orderId).slice(-6).toUpperCase()}</Text>
          </View>
          <Text style={styles.timeText}>
            {getDateObj(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>

        <View style={styles.addressBox}>
          <Text style={styles.addressLabel}>DELIVER TO:</Text>
          <Text style={styles.addressText}>📍 {order.address || order.delivery_address || 'Unknown address'}</Text>
          {(order.user_phone || order.user_name) && (
            <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {order.user_name ? (
                <Text style={{ fontSize: 13, color: colors.textMain, fontWeight: '600' }}>
                  👤 {order.user_name}
                </Text>
              ) : null}
              {order.user_phone ? (
                <TouchableOpacity
                  onPress={() => {
                    const { Linking } = require('react-native');
                    Linking.openURL(`tel:${order.user_phone}`);
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16,185,129,0.15)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 }}
                >
                  <Text style={{ fontSize: 13, color: colors.success, fontWeight: '700' }}>
                    📞 {order.user_phone}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        </View>

        <View style={{ marginBottom: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderColor }}>
          <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '700', marginBottom: 4 }}>ORDER ITEMS:</Text>
          {getItems(order.items).map((item: any, i: number) => (
            <Text key={i} style={{ fontSize: 14, color: colors.textMain, marginBottom: 2 }}>
              {item.qty || item.quantity || 1}x {item.name || 'Item'}
            </Text>
          ))}
        </View>

        {order.order_status !== 'delivered' && (
          <View style={styles.actions}>
            {(order.order_status === 'ready' || order.order_status === 'out_for_delivery') && (
              <TouchableOpacity style={[styles.btn, { backgroundColor: colors.deliveryAccent }]}
                onPress={() => updateOrderStatus(orderId, 'picked_up')}>
                <Text style={styles.btnText}>Pick Up Order</Text>
              </TouchableOpacity>
            )}
            {order.order_status === 'picked_up' && (
              <TouchableOpacity style={[styles.btn, { backgroundColor: colors.success }]}
                onPress={() => handleMarkDelivered(order)}>
                <Text style={styles.btnText}>Mark Delivered</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.topBarSubtitle}>🛵 Delivery Partner</Text>
          <Text style={styles.topBarTitle}>Dashboard</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Text style={{ fontSize: 16 }}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {TABS.map(t => (
          <TouchableOpacity key={t.key} onPress={() => setActiveTab(t.key)}
            style={[styles.tab, activeTab === t.key && styles.tabActive]}>
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>
              {t.label} ({tabCounts[t.key]})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <FlatList
        data={tabOrders}
        renderItem={renderOrderCard}
        keyExtractor={item => item.id || item._id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.deliveryAccent} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 40, marginBottom: 8 }}>🍃</Text>
            <Text style={styles.emptyText}>No orders right now</Text>
          </View>
        }
      />

      {/* OTP Modal */}
      <Modal visible={!!otpPromptId} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Enter 4-Digit Delivery PIN</Text>
            <Text style={styles.modalDesc}>Ask the customer for the 4-digit PIN to confirm delivery.</Text>

            <TextInput
              style={styles.otpInput}
              value={otpInput}
              onChangeText={(t) => setOtpInput(t.replace(/\D/g, '').slice(0, 4))}
              placeholder="0000"
              keyboardType="number-pad"
              maxLength={4}
              placeholderTextColor={colors.textMuted}
            />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.borderColor, flex: 1 }]}
                onPress={() => setOtpPromptId(null)}>
                <Text style={{ color: colors.textMain, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.success, flex: 1 }]}
                onPress={verifyOtpAndDeliver} disabled={verifyingOtp}>
                {verifyingOtp ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Verify</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgColor },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderColor },
  topBarSubtitle: { fontSize: 11, color: colors.deliveryAccent, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  topBarTitle: { ...typography.h2, color: colors.textMain },
  logoutBtn: { padding: 8 },

  tabsContainer: { flexDirection: 'row', padding: spacing.md, gap: 8 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: radius.md, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.borderColor },
  tabActive: { backgroundColor: 'rgba(245,158,11,0.15)', borderColor: colors.deliveryAccent },
  tabText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  tabTextActive: { color: colors.deliveryAccent },

  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: colors.textMuted, fontSize: 15 },

  card: { backgroundColor: colors.cardBg, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.borderColor },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md },
  storeName: { ...typography.h4, color: colors.textMain, marginBottom: 2 },
  orderIdText: { fontSize: 12, color: colors.textMuted, fontFamily: 'monospace' },
  timeText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  
  addressBox: { backgroundColor: 'rgba(255,255,255,0.03)', padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.md },
  addressLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '700', marginBottom: 4 },
  addressText: { fontSize: 14, color: colors.textMain, fontWeight: '500' },

  actions: { flexDirection: 'row', justifyContent: 'flex-end', paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderColor },
  btn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: radius.md },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: spacing.xl },
  modalContent: { backgroundColor: colors.cardBg, borderRadius: radius.lg, padding: spacing.xxl },
  modalTitle: { ...typography.h2, color: colors.textMain, marginBottom: 8, textAlign: 'center' },
  modalDesc: { color: colors.textMuted, textAlign: 'center', marginBottom: spacing.lg },
  otpInput: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderColor, fontSize: 32, fontWeight: '800', color: colors.textMain, textAlign: 'center', paddingVertical: spacing.lg, marginBottom: spacing.xl, letterSpacing: 8 },
  modalBtn: { paddingVertical: 14, borderRadius: radius.md, alignItems: 'center' },
});

export default DeliveryDashboardScreen;
