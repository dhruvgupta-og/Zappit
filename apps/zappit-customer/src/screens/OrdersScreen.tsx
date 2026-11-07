import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ordersApi } from '../api/orders';
import { useCartStore } from '../store/cartStore';
import { colors } from '../theme/colors';
import { typography, spacing, radius } from '../theme/typography';
import { Order } from '../types';

const STATUS_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
  confirmed:        { label: 'Confirmed',       color: colors.primary,   emoji: '✅' },
  preparing:        { label: 'Preparing',        color: '#F59E0B',        emoji: '👨‍🍳' },
  ready:            { label: 'Ready',            color: '#3B82F6',        emoji: '📦' },
  out_for_delivery: { label: 'Out for Delivery', color: '#8B5CF6',        emoji: '🛵' },
  picked_up:        { label: 'On the Way',       color: '#8B5CF6',        emoji: '🛵' },
  delivered:        { label: 'Delivered',        color: colors.success,   emoji: '🎉' },
  pending:          { label: 'Payment Pending',  color: '#F59E0B',        emoji: '⏳' },
  cancelled:        { label: 'Cancelled',        color: colors.error,     emoji: '❌' },
};

const OrdersScreen = () => {
  const navigation = useNavigation<any>();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const reorderItems = useCartStore((s) => s.reorderItems);
  const getCartStoreId = useCartStore((s) => s.getCartStoreId);

  const handleReorder = (order: Order) => {
    const currentStoreId = getCartStoreId();
    const orderStoreId = (order as any).store_id || order.storeId || '';
    const orderStoreName = (order as any).store_name || order.storeName || 'Campus Store';

    if (!order.items || order.items.length === 0) {
      Alert.alert('Cannot Re-order', 'No items found in this order.');
      return;
    }

    const doReorder = () => {
      reorderItems(order.items, orderStoreId, orderStoreName);
      navigation.navigate('CartStack');
    };

    if (currentStoreId && currentStoreId !== orderStoreId) {
      Alert.alert(
        'Replace Current Cart?',
        `Your cart currently contains items from another store. Replace them with items from ${orderStoreName}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Replace & Re-Order', style: 'destructive', onPress: doReorder },
        ]
      );
    } else {
      doReorder();
    }
  };

  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await ordersApi.getAll();
      const sorted = data.sort((a, b) => {
        const d1 = new Date((a as any).created_at || a.createdAt || 0).getTime();
        const d2 = new Date((b as any).created_at || b.createdAt || 0).getTime();
        return d2 - d1;
      });
      setOrders(sorted);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchOrders();
    });
    return unsubscribe;
  }, [navigation, fetchOrders]);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(() => fetchOrders(true), 10000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const renderItem = ({ item }: { item: Order }) => {
    const status = (item as any).order_status || item.status || 'confirmed';
    const cfg = STATUS_CONFIG[status] || { label: status.replace(/_/g, ' ').toUpperCase(), color: colors.primary, emoji: '📋' };
    const isActive = !['delivered', 'cancelled'].includes(status);

    return (
      <TouchableOpacity
        style={[styles.card, isActive && { borderColor: cfg.color, borderWidth: 1.5 }]}
        onPress={() => navigation.navigate('OrderTracker', { orderIds: item.id || item._id })}
        activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.storeName}>{(item as any).store_name || item.storeName || 'Store'}</Text>
            <Text style={styles.date}>
              {new Date((item as any).created_at || item.createdAt!).toLocaleDateString()} at{' '}
              {new Date((item as any).created_at || item.createdAt!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${cfg.color}22`, borderColor: cfg.color }]}>
            <Text style={{ fontSize: 10, marginRight: 3 }}>{cfg.emoji}</Text>
            <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.itemsWrapper}>
          <Text style={styles.itemsText} numberOfLines={2}>
            {item.items.map((i: any) => `${i.qty || i.quantity || 1} × ${i.name || 'Item'}`).join(', ')}
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>₹{(item as any).total_amount || item.totalAmount}</Text>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.reorderBtn}
            onPress={() => handleReorder(item)}
            activeOpacity={0.7}
          >
            <Text style={styles.reorderBtnText}>🔁 Re-Order</Text>
          </TouchableOpacity>

          {isActive ? (
            <View style={styles.trackPill}>
              <Text style={{ fontSize: 12, color: cfg.color, fontWeight: '700' }}>
                Track Live →
              </Text>
            </View>
          ) : (
            <Text style={{ fontSize: 12, color: colors.textMuted }}>
              Details →
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Orders</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 40, marginBottom: 16 }}>📦</Text>
          <Text style={styles.emptyTitle}>No orders yet</Text>
          <Text style={styles.emptyText}>When you place orders, they will appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(i) => i.id || i._id!}
          renderItem={renderItem}
          contentContainerStyle={{ padding: spacing.xl, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgColor },
  header: { padding: spacing.xl, paddingBottom: spacing.sm },
  title: { ...typography.h2, color: colors.textMain },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xxl },
  emptyTitle: { ...typography.h3, color: colors.textMain, marginBottom: 8 },
  emptyText: { color: colors.textMuted, textAlign: 'center' },

  card: {
    backgroundColor: colors.cardBg, borderRadius: radius.md, padding: spacing.lg,
    marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.borderColor,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  storeName: { fontSize: 16, fontWeight: '700', color: colors.textMain, marginBottom: 2 },
  date: { fontSize: 12, color: colors.textMuted },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1,
  },
  statusText: { fontSize: 11, fontWeight: '800' },
  divider: { height: 1, backgroundColor: colors.borderColor, marginVertical: spacing.md },
  itemsWrapper: { marginBottom: spacing.md },
  itemsText: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  totalValue: { fontSize: 16, color: colors.textMain, fontWeight: '700' },
  actionsRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  reorderBtn: {
    backgroundColor: 'rgba(255, 193, 7, 0.15)', borderWidth: 1, borderColor: colors.primary,
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.full,
  },
  reorderBtnText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  trackPill: {
    backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full,
  },
});

export default OrdersScreen;
