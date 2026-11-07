import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList,
  ActivityIndicator, TextInput, Alert, Modal, RefreshControl, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ordersApi } from '../api/orders';
import { useAuthStore } from '../store/authStore';
import { colors } from '../theme/colors';
import { typography, spacing, radius } from '../theme/typography';
import { Order } from '../types';
import { playOrderAlert } from '../utils/notifications';

const TABS = [
  { key: 'new', label: '🛵 Ready Pickup' },
  { key: 'active', label: '🚴 En Route' },
  { key: 'completed', label: '✅ Delivered' },
];

const PAYOUT_PER_DELIVERY = 20; // ₹20 fixed rider payout per campus trip

const DeliveryDashboardScreen = () => {
  const profile = useAuthStore(s => s.profile);
  const logout = useAuthStore(s => s.logout);

  const [orders, setOrders] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('new');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Rider duty & search
  const [isOnDuty, setIsOnDuty] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [completedFilter, setCompletedFilter] = useState<'today' | 'all'>('today');

  // OTP Verification state
  const [otpPromptId, setOtpPromptId] = useState<string | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  const prevPickupCount = useRef(-1);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await ordersApi.getOrders();
      if (res.success) {
        setOrders(res.orders || []);

        // Alert on new ready pickup orders
        const pickupOrders = (res.orders || []).filter(
          (o: any) => o.order_status === 'ready' || o.order_status === 'out_for_delivery'
        );
        if (pickupOrders.length > prevPickupCount.current && prevPickupCount.current !== -1) {
          playOrderAlert('🛵 NEW CAMPUS DELIVERY READY! 🛵', 'An order is ready for pickup at store. Check "Ready Pickup" tab.');
          Alert.alert('🛵 New Pickup Ready!', 'A student order is ready for pickup at the store.');
        }
        prevPickupCount.current = pickupOrders.length;
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

  // ── Helpers ──
  const getDateObj = (val: any): Date => {
    if (!val) return new Date(0);
    if (val.toDate) return val.toDate();
    return new Date(val);
  };

  const isToday = (dateVal: any): boolean => {
    const d = getDateObj(dateVal);
    const now = new Date();
    return d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();
  };

  const getTimeAgo = (dateVal: any): string => {
    const diffMs = Math.max(0, Date.now() - getDateObj(dateVal).getTime());
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const getItems = (items: any) => {
    if (!items) return [];
    if (Array.isArray(items)) return items;
    return Object.entries(items).map(([id, qty]) => ({ id, name: id, qty, price: 0 }));
  };

  // ── Metrics & Tabs ──
  const sortedByTime = (list: any[]) =>
    [...list].sort((a, b) => getDateObj(b.created_at).getTime() - getDateObj(a.created_at).getTime());

  const newOrders = sortedByTime(orders.filter(o => o.order_status === 'ready' || o.order_status === 'out_for_delivery'));
  const activeOrders = sortedByTime(orders.filter(o => o.order_status === 'picked_up'));
  const allCompletedOrders = sortedByTime(orders.filter(o => ['delivered', 'completed'].includes(o.order_status)));

  const todayCompletedOrders = allCompletedOrders.filter(o => isToday(o.created_at));
  const todayEarnings = todayCompletedOrders.length * PAYOUT_PER_DELIVERY;
  const lifetimeEarnings = allCompletedOrders.length * PAYOUT_PER_DELIVERY;

  const displayCompletedOrders = completedFilter === 'today' ? todayCompletedOrders : allCompletedOrders;

  const tabOrders = activeTab === 'new' ? newOrders
    : activeTab === 'active' ? activeOrders
    : displayCompletedOrders;

  const tabCounts: Record<string, number> = {
    new: newOrders.length,
    active: activeOrders.length,
    completed: completedFilter === 'today' ? todayCompletedOrders.length : allCompletedOrders.length,
  };

  // Filter by search query
  const filteredOrders = tabOrders.filter(o => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const id = String(o.id || o._id || '').toLowerCase();
    const store = String(o.store_name || '').toLowerCase();
    const student = String(o.user_name || '').toLowerCase();
    const phone = String(o.user_phone || '');
    const addr = String(o.address || o.delivery_address || '').toLowerCase();
    return id.includes(q) || store.includes(q) || student.includes(q) || phone.includes(q) || addr.includes(q);
  });

  // ── Actions ──
  const updateOrderStatus = async (orderId: string, status: string) => {
    // Optimistic update
    setOrders(prev => prev.map(o => (o.id === orderId || o._id === orderId) ? { ...o, order_status: status } : o));
    try {
      await ordersApi.updateOrderStatus(orderId, status);
      await ordersApi.sendStatusNotification(orderId, status);
      fetchOrders();
    } catch {
      Alert.alert('Error', 'Failed to update delivery status');
      fetchOrders();
    }
  };

  const handleMarkDelivered = (order: any) => {
    setOtpPromptId(order.id || order._id);
    setOtpInput('');
  };

  const verifyOtpAndDeliver = async () => {
    if (!otpPromptId) return;
    if (!otpInput.trim() || otpInput.trim().length !== 4) {
      Alert.alert('PIN Required', 'Please enter the 4-digit PIN provided by the student.');
      return;
    }
    setVerifyingOtp(true);
    try {
      const res = await ordersApi.verifyOtp(otpPromptId, otpInput.trim());
      if (res.success) {
        setOtpPromptId(null);
        setOtpInput('');
        Alert.alert('✅ Order Delivered!', 'Delivery confirmed and ₹20 payout recorded.');
        fetchOrders();
      } else {
        Alert.alert('PIN Mismatch', res.error || 'Invalid 4-digit PIN. Please verify with the customer.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Invalid PIN. Please check with customer.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const manualConfirmBypass = (orderId: string) => {
    Alert.alert(
      'Manual Completion',
      'Use this only if the student did not receive their PIN or has no network. Confirm delivery?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Delivery',
          style: 'default',
          onPress: async () => {
            setOtpPromptId(null);
            await updateOrderStatus(orderId, 'delivered');
          },
        },
      ]
    );
  };

  const openMapsNavigation = (address: string) => {
    if (!address) {
      Alert.alert('No Address', 'No delivery address recorded for this order.');
      return;
    }
    const query = encodeURIComponent(address);
    const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Map Error', 'Could not open maps application.');
    });
  };

  const exportToExcel = async () => {
    if (allCompletedOrders.length === 0) {
      Alert.alert('No Data', 'There are no completed trips to export.');
      return;
    }
    try {
      const headerString = 'Order ID,Date,Store,Customer Name,Phone,Delivery Address,Payout (INR)\n';
      const rowString = allCompletedOrders.map(order => {
        const orderId = order.id || order._id || '';
        const dateStr = getDateObj(order.created_at).toLocaleString();
        const storeName = (order.store_name || 'Store').replace(/"/g, '""');
        const cName = (order.user_name || 'Student').replace(/"/g, '""');
        const cPhone = order.user_phone || '';
        const addr = (order.address || order.delivery_address || 'Campus').replace(/"/g, '""');
        return `"${orderId}","${dateStr}","${storeName}","${cName}","${cPhone}","${addr}",20`;
      }).join('\n');

      const totalPayout = allCompletedOrders.length * 20;
      const csvString = `${headerString}${rowString}\nTOTAL EARNINGS,,,,,,₹${totalPayout}`;

      try {
        const FS = require('expo-file-system');
        const Share = require('expo-sharing');
        if (FS?.documentDirectory) {
          const fileName = `rider_payouts_${Date.now()}.csv`;
          const fileUri = FS.documentDirectory + fileName;
          await FS.writeAsStringAsync(fileUri, csvString, { encoding: FS.EncodingType.UTF8 });
          if (await Share.isAvailableAsync()) {
            await Share.shareAsync(fileUri, {
              mimeType: 'text/csv',
              dialogTitle: 'Save or Share Rider Payout CSV',
            });
            return;
          }
        }
      } catch (_) {}

      const { Share } = require('react-native');
      await Share.share({
        title: `Rider Payout Report (${allCompletedOrders.length} trips - ₹${totalPayout})`,
        message: csvString,
      });
    } catch (error: any) {
      console.error('Export error:', error);
      Alert.alert('Export Failed', error?.message || 'Could not export delivery data.');
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
    const timeAgo = getTimeAgo(order.created_at);
    const destinationAddress = order.address || order.delivery_address || 'Campus delivery';

    return (
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.storeName}>🏪 {order.store_name || 'Campus Store'}</Text>
            </View>
            <Text style={styles.orderIdText}>#{String(orderId).slice(-6).toUpperCase()}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <View style={styles.payoutBadge}>
              <Text style={styles.payoutBadgeText}>+₹{PAYOUT_PER_DELIVERY} PAYOUT</Text>
            </View>
            <Text style={styles.timeText}>⏱️ {timeAgo}</Text>
          </View>
        </View>

        {/* Deliver To Address Box */}
        <View style={styles.addressBox}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Text style={styles.addressLabel}>DELIVER TO STUDENT:</Text>
            {/* Maps Launch Button */}
            <TouchableOpacity
              style={styles.mapsBtn}
              onPress={() => openMapsNavigation(destinationAddress)}
            >
              <Text style={styles.mapsBtnText}>🗺️ Open Maps</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.addressText}>📍 {destinationAddress}</Text>

          {/* Customer Name & Phone */}
          {(order.user_phone || order.user_name) && (
            <View style={styles.customerRow}>
              {order.user_name ? (
                <Text style={styles.customerNameText}>👤 {order.user_name}</Text>
              ) : null}
              {order.user_phone ? (
                <TouchableOpacity
                  onPress={() => Linking.openURL(`tel:${order.user_phone}`)}
                  style={styles.phoneCallBadge}
                >
                  <Text style={styles.phoneCallBadgeText}>📞 {order.user_phone}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}

          {/* Customer Note if any */}
          {order.additional_note ? (
            <View style={styles.noteBox}>
              <Text style={styles.noteTitle}>NOTE:</Text>
              <Text style={styles.noteContent}>"{order.additional_note}"</Text>
            </View>
          ) : null}
        </View>

        {/* Order Items Summary */}
        <View style={styles.itemsSummary}>
          <Text style={styles.itemsTitle}>
            PACKAGE ITEMS ({getItems(order.items).length}):
          </Text>
          {getItems(order.items).map((item: any, i: number) => (
            <Text key={i} style={styles.itemRowText}>
              • {item.qty || item.quantity || 1}× {item.name || 'Item'}
            </Text>
          ))}
        </View>

        {/* Action Buttons */}
        {order.order_status !== 'delivered' && (
          <View style={styles.actions}>
            {(order.order_status === 'ready' || order.order_status === 'out_for_delivery') && (
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.deliveryAccent }]}
                onPress={() => updateOrderStatus(orderId, 'picked_up')}
              >
                <Text style={styles.btnText}>🚴 Pick Up Package</Text>
              </TouchableOpacity>
            )}

            {order.order_status === 'picked_up' && (
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.success }]}
                onPress={() => handleMarkDelivered(order)}
              >
                <Text style={styles.btnText}>✅ Confirm Delivery (PIN)</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {order.order_status === 'delivered' && (
          <View style={styles.deliveredRow}>
            <Text style={styles.deliveredText}>✓ Delivered Successfully</Text>
            <Text style={styles.deliveredEarnText}>+₹{PAYOUT_PER_DELIVERY} Earned</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── TOP BAR ── */}
      <View style={styles.topBar}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.topBarSubtitle}>🛵 Campus Delivery Partner</Text>
          <Text style={styles.topBarTitle} numberOfLines={1}>
            {(profile as any)?.name ? `Rider ${(profile as any).name}` : 'Rider Dashboard'}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {/* Duty Status Button */}
          <TouchableOpacity
            onPress={() => setIsOnDuty(!isOnDuty)}
            style={[
              styles.dutyToggle,
              { backgroundColor: isOnDuty ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)' },
            ]}
          >
            <View
              style={[
                styles.dutyDot,
                { backgroundColor: isOnDuty ? '#86EFAC' : '#FCA5A5' },
              ]}
            />
            <Text
              style={[
                styles.dutyToggleText,
                { color: isOnDuty ? '#86EFAC' : '#FCA5A5' },
              ]}
            >
              {isOnDuty ? 'ON DUTY' : 'OFF DUTY'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
            <Text style={{ fontSize: 16 }}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── EARNINGS & METRICS BANNER ── */}
      <View style={styles.metricsRow}>
        <View style={[styles.metricCard, { borderLeftColor: colors.deliveryAccent, borderLeftWidth: 3 }]}>
          <Text style={styles.metricLabel}>Today's Payout</Text>
          <Text style={[styles.metricValue, { color: colors.deliveryAccent }]}>₹{todayEarnings}</Text>
          <Text style={styles.metricSub}>{todayCompletedOrders.length} trips completed</Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Total Lifetime</Text>
          <Text style={styles.metricValue}>₹{lifetimeEarnings}</Text>
          <Text style={styles.metricSub}>{allCompletedOrders.length} total trips</Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Active Trips</Text>
          <Text style={[styles.metricValue, { color: activeOrders.length > 0 ? '#34D399' : colors.textMain }]}>
            {activeOrders.length}
          </Text>
          <Text style={styles.metricSub}>En route</Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>To Pick Up</Text>
          <Text style={[styles.metricValue, { color: newOrders.length > 0 ? '#F59E0B' : colors.textMain }]}>
            {newOrders.length}
          </Text>
          <Text style={styles.metricSub}>Ready at stores</Text>
        </View>
      </View>

      {/* ── TABS ── */}
      <View style={styles.tabsContainer}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            onPress={() => setActiveTab(t.key)}
            style={[styles.tab, activeTab === t.key && styles.tabActive]}
          >
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>
              {t.label} ({tabCounts[t.key]})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search Input Bar */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="🔍 Search by store, block/room, student name or #ID..."
          placeholderTextColor={colors.textMuted}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 6 }}>
            <Text style={{ color: colors.textMuted, fontWeight: '700' }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Completed Sub-filter & Export */}
      {activeTab === 'completed' && (
        <View style={styles.completedHeaderRow}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={() => setCompletedFilter('today')}
              style={[styles.chip, completedFilter === 'today' && styles.chipActive]}
            >
              <Text style={[styles.chipText, completedFilter === 'today' && styles.chipTextActive]}>
                Today ({todayCompletedOrders.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setCompletedFilter('all')}
              style={[styles.chip, completedFilter === 'all' && styles.chipActive]}
            >
              <Text style={[styles.chipText, completedFilter === 'all' && styles.chipTextActive]}>
                All Time ({allCompletedOrders.length})
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={exportToExcel} style={styles.exportChip}>
            <Text style={styles.exportChipText}>📊 Export CSV</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── ORDERS LIST ── */}
      <FlatList
        data={filteredOrders}
        renderItem={renderOrderCard}
        keyExtractor={item => item.id || item._id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.deliveryAccent} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 48, marginBottom: 8 }}>🛵</Text>
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'No matching deliveries found' : 'No tasks in this category'}
            </Text>
            <Text style={styles.emptyText}>
              {searchQuery
                ? 'Try searching by a different room, student name or order ID'
                : 'When stores finish preparing orders, they will appear here ready for pickup.'}
            </Text>
          </View>
        }
      />

      {/* ── PIN / OTP VERIFICATION MODAL ── */}
      <Modal visible={!!otpPromptId} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Enter Student's 4-Digit PIN</Text>
            <Text style={styles.modalDesc}>
              Ask the student at the door for their 4-digit PIN to confirm delivery and credit your ₹{PAYOUT_PER_DELIVERY} payout.
            </Text>

            <TextInput
              style={styles.otpInput}
              value={otpInput}
              onChangeText={(t) => setOtpInput(t.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••"
              keyboardType="number-pad"
              maxLength={4}
              placeholderTextColor={colors.textMuted}
              autoFocus
            />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.borderColor, flex: 1 }]}
                onPress={() => setOtpPromptId(null)}
              >
                <Text style={{ color: colors.textMain, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.success, flex: 1 }]}
                onPress={verifyOtpAndDeliver}
                disabled={verifyingOtp}
              >
                {verifyingOtp ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '800' }}>Confirm PIN</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Manual Emergency Bypass Button */}
            {otpPromptId && (
              <TouchableOpacity
                style={styles.bypassBtn}
                onPress={() => manualConfirmBypass(otpPromptId)}
              >
                <Text style={styles.bypassBtnText}>Customer didn't receive PIN? Complete Manually</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgColor },

  // Top Bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderColor,
  },
  topBarSubtitle: { fontSize: 11, color: colors.deliveryAccent, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  topBarTitle: { ...typography.h2, color: colors.textMain },
  dutyToggle: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6 },
  dutyDot: { width: 8, height: 8, borderRadius: 4 },
  dutyToggleText: { fontWeight: '800', fontSize: 11, letterSpacing: 0.5 },
  logoutBtn: { padding: 8 },

  // Metrics Banner
  metricsRow: { flexDirection: 'row', padding: spacing.md, gap: 8 },
  metricCard: {
    flex: 1,
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.borderColor,
  },
  metricValue: { fontSize: 18, fontWeight: '800', color: colors.textMain, marginTop: 2 },
  metricLabel: { fontSize: 9, color: colors.textMuted, fontWeight: '700', textTransform: 'uppercase' },
  metricSub: { fontSize: 10, color: colors.textMuted, marginTop: 2 },

  // Tabs
  tabsContainer: { flexDirection: 'row', paddingHorizontal: spacing.md, gap: 8, marginBottom: 4 },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.borderColor,
  },
  tabActive: { backgroundColor: 'rgba(245,158,11,0.15)', borderColor: colors.deliveryAccent },
  tabText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  tabTextActive: { color: colors.deliveryAccent },

  // Search Bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginVertical: 4,
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderColor,
    paddingHorizontal: spacing.md,
  },
  searchInput: { flex: 1, height: 40, fontSize: 13, color: colors.textMain },

  // Completed Header Row
  completedHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.borderColor,
  },
  chipActive: { backgroundColor: 'rgba(245,158,11,0.15)', borderColor: colors.deliveryAccent },
  chipText: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  chipTextActive: { color: colors.deliveryAccent, fontWeight: '700' },
  exportChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderWidth: 1,
    borderColor: colors.storeAccent,
  },
  exportChipText: { fontSize: 11, fontWeight: '700', color: colors.storeAccent },

  // Delivery Card
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderColor,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  storeName: { fontSize: 15, fontWeight: '700', color: colors.textMain },
  orderIdText: { fontSize: 12, color: colors.textMuted, fontFamily: 'monospace', marginTop: 2 },
  payoutBadge: { backgroundColor: 'rgba(245,158,11,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  payoutBadgeText: { color: colors.deliveryAccent, fontSize: 11, fontWeight: '800' },
  timeText: { fontSize: 11, color: colors.textMuted, marginTop: 3 },

  // Address Box
  addressBox: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  addressLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '800', textTransform: 'uppercase' },
  addressText: { fontSize: 14, color: colors.textMain, fontWeight: '700', marginTop: 4, lineHeight: 20 },
  mapsBtn: {
    backgroundColor: 'rgba(59,130,246,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.3)',
  },
  mapsBtnText: { color: '#60A5FA', fontSize: 11, fontWeight: '800' },

  // Customer Row
  customerRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  customerNameText: { fontSize: 13, color: colors.textMain, fontWeight: '700' },
  phoneCallBadge: {
    backgroundColor: 'rgba(16,185,129,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
  },
  phoneCallBadgeText: { fontSize: 12, color: colors.storeAccent, fontWeight: '800' },

  // Note Box
  noteBox: {
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
    padding: 6,
    borderRadius: 4,
    marginTop: 8,
  },
  noteTitle: { fontSize: 10, fontWeight: '800', color: '#F59E0B' },
  noteContent: { fontSize: 12, color: '#FDE68A', fontStyle: 'italic' },

  // Items Summary
  itemsSummary: {
    marginBottom: spacing.sm,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.borderColor,
  },
  itemsTitle: { fontSize: 10, color: colors.textMuted, fontWeight: '700', marginBottom: 2 },
  itemRowText: { fontSize: 13, color: colors.textMain, paddingVertical: 1 },

  // Actions
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderColor,
  },
  btn: { paddingHorizontal: 20, paddingVertical: 11, borderRadius: radius.md },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  deliveredRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderColor,
  },
  deliveredText: { color: colors.storeAccent, fontWeight: '700', fontSize: 13 },
  deliveredEarnText: { color: colors.deliveryAccent, fontWeight: '800', fontSize: 13 },

  // Empty State
  emptyState: { alignItems: 'center', paddingVertical: 50 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.textMain, marginBottom: 4 },
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: 20 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: spacing.xl },
  modalContent: { backgroundColor: colors.cardBg, borderRadius: radius.lg, padding: spacing.xxl, borderWidth: 1, borderColor: colors.borderColor },
  modalTitle: { ...typography.h3, color: colors.textMain, marginBottom: 6, textAlign: 'center' },
  modalDesc: { color: colors.textMuted, textAlign: 'center', marginBottom: spacing.lg, fontSize: 13, lineHeight: 18 },
  otpInput: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderColor,
    fontSize: 32,
    fontWeight: '800',
    color: colors.textMain,
    textAlign: 'center',
    paddingVertical: spacing.md,
    marginBottom: spacing.xl,
    letterSpacing: 12,
  },
  modalBtn: { paddingVertical: 14, borderRadius: radius.md, alignItems: 'center' },
  bypassBtn: { marginTop: spacing.md, paddingVertical: 8, alignItems: 'center' },
  bypassBtnText: { color: colors.textMuted, fontSize: 12, textDecorationLine: 'underline' },
});

export default DeliveryDashboardScreen;
