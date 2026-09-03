import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ordersApi } from '../api/orders';
import { colors } from '../theme/colors';
import { typography, spacing, radius } from '../theme/typography';
import { Order } from '../types';

const OrdersScreen = () => {
  const navigation = useNavigation<any>();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchOrders();
    });
    return unsubscribe;
  }, [navigation]);

  const fetchOrders = async () => {
    try {
      const data = await ordersApi.getAll();
      // Sort by newest first
      const sorted = data.sort((a, b) => {
        const d1 = new Date(a.created_at || a.createdAt || 0).getTime();
        const d2 = new Date(b.created_at || b.createdAt || 0).getTime();
        return d2 - d1;
      });
      setOrders(sorted);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'delivered') return colors.success;
    if (status === 'cancelled') return colors.error;
    return colors.primary;
  };

  const renderItem = ({ item }: { item: Order }) => {
    const status = item.order_status || item.status || 'confirmed';
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('OrderTracker', { orderIds: item.id || item._id })}
        activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.storeName}>{item.store_name || item.storeName || 'Store'}</Text>
            <Text style={styles.date}>
              {new Date(item.created_at || item.createdAt!).toLocaleDateString()} at{' '}
              {new Date(item.created_at || item.createdAt!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          <Text style={[styles.statusText, { color: getStatusColor(status) }]}>
            {status.toUpperCase().replace(/_/g, ' ')}
          </Text>
        </View>
      <View style={styles.divider} />
      <View style={styles.itemsWrapper}>
        <Text style={styles.itemsText} numberOfLines={2}>
          {item.items.map((i) => `${i.qty || i.quantity} x ${i.name || (typeof i.menuItem === 'object' ? i.menuItem.name : 'Item')}`).join(', ')}
        </Text>
      </View>
      <View style={styles.footer}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>₹{item.total_amount || item.totalAmount}</Text>
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
  statusText: { fontSize: 12, fontWeight: '800' },
  divider: { height: 1, backgroundColor: colors.borderColor, marginVertical: spacing.md },
  itemsWrapper: { marginBottom: spacing.md },
  itemsText: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  totalValue: { fontSize: 16, color: colors.textMain, fontWeight: '700' },
});

export default OrdersScreen;
