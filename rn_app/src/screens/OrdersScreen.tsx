import React from 'react';
import { View, Text, StyleSheet, FlatList, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppColors } from '../theme/colors';
import { Receipt, Clock, CheckCircle } from 'lucide-react-native';

const OrdersScreen = () => {
  const orders = [
    { id: '1', storeName: 'Snack Point', date: 'Oct 24, 2026', total: 150, status: 'Delivered', items: '2x Samosa, 1x Tea' },
    { id: '2', storeName: 'Campus Meals', date: 'Oct 23, 2026', total: 240, status: 'Delivered', items: '1x Veg Thali' },
  ];

  const OrderCard = ({ order }: any) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.storeName}>{order.storeName}</Text>
          <Text style={styles.orderDate}>{order.date}</Text>
        </View>
        <View style={styles.statusBadge}>
          <CheckCircle size={12} color={AppColors.success} />
          <Text style={styles.statusText}>{order.status}</Text>
        </View>
      </View>
      <View style={styles.divider} />
      <Text style={styles.itemsText}>{order.items}</Text>
      <View style={styles.cardFooter}>
        <Text style={styles.totalLabel}>Total Amount</Text>
        <Text style={styles.totalValue}>₹{order.total}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Orders</Text>
      </View>
      {orders.length > 0 ? (
        <FlatList
          data={orders}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <OrderCard order={item} />}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Receipt size={60} color={AppColors.textSecondary} />
          <Text style={styles.emptyText}>No orders yet</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  header: {
    padding: 20,
  },
  title: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  list: {
    padding: 20,
  },
  card: {
    backgroundColor: AppColors.cardBackground,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  storeName: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  orderDate: {
    color: AppColors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  statusText: {
    color: AppColors.success,
    fontSize: 12,
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginVertical: 15,
  },
  itemsText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 15,
  },
  totalLabel: {
    color: AppColors.textSecondary,
    fontSize: 12,
  },
  totalValue: {
    color: AppColors.primary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  emptyText: {
    color: AppColors.textSecondary,
    fontSize: 18,
    marginTop: 20,
  },
});

export default OrdersScreen;
