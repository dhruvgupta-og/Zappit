import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ordersApi } from '../api/orders';
import { colors } from '../theme/colors';
import { typography, spacing, radius } from '../theme/typography';
import { Order } from '../types';

const STATUS_STEPS = [
  { key: 'placed', label: 'Order Placed' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'out_for_delivery', label: 'Out for Delivery' },
  { key: 'delivered', label: 'Delivered' },
];

const OrderTrackerScreen = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { orderIds } = route.params;

  // For simplicity, we just track the first order if multiple were created
  const primaryOrderId = Array.isArray(orderIds) ? orderIds[0] : orderIds;
  const [order, setOrder] = useState<Order | null>(null);
  
  const [pulse] = useState(new Animated.Value(1));

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.2, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const data = await ordersApi.getById(primaryOrderId);
        setOrder(data);
      } catch (e) {
        console.error(e);
      }
    };
    
    fetchOrder();
    const interval = setInterval(fetchOrder, 10000);
    return () => clearInterval(interval);
  }, [primaryOrderId]);

  if (!order) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={{ color: colors.textMuted }}>Loading order details...</Text>
      </SafeAreaView>
    );
  }

  const currentStepIndex = STATUS_STEPS.findIndex(s => s.key === order.status);
  const isCancelled = order.status === 'cancelled';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate('Main', { screen: 'Home' })} style={styles.backBtn}>
          <Text style={{ fontSize: 20, color: colors.textMain }}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Track Order</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl }}>
        {/* Status Graphic */}
        <View style={styles.graphicContainer}>
          <Animated.View style={[styles.pulseCircle, { transform: [{ scale: pulse }] }]} />
          <View style={styles.iconCircle}>
            <Text style={{ fontSize: 40 }}>
              {isCancelled ? '❌' : order.status === 'delivered' ? '🎉' : '🚴'}
            </Text>
          </View>
          <Text style={styles.statusTitle}>
            {isCancelled ? 'Order Cancelled' : STATUS_STEPS[currentStepIndex]?.label || 'Processing'}
          </Text>
          <Text style={styles.orderId}>ID: {order.id || order._id}</Text>
        </View>

        {/* Timeline */}
        {!isCancelled && (
          <View style={styles.timelineCard}>
            {STATUS_STEPS.map((step, index) => {
              const isPast = index < currentStepIndex;
              const isCurrent = index === currentStepIndex;
              return (
                <View key={step.key} style={styles.timelineStep}>
                  <View style={styles.timelineLeft}>
                    <View style={[
                      styles.dot,
                      isPast && styles.dotPast,
                      isCurrent && styles.dotCurrent,
                    ]}>
                      {isPast && <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>✓</Text>}
                    </View>
                    {index < STATUS_STEPS.length - 1 && (
                      <View style={[styles.line, isPast && styles.linePast]} />
                    )}
                  </View>
                  <Text style={[
                    styles.stepLabel,
                    (isPast || isCurrent) && styles.stepLabelActive,
                    isCurrent && { color: colors.primary, fontWeight: '800' }
                  ]}>
                    {step.label}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Details */}
        <View style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>Delivery Details</Text>
          <Text style={styles.detailsText}>To: {order.delivery_address || order.deliveryAddress}</Text>
          {order.otp && (
            <View style={styles.otpBox}>
              <Text style={styles.otpLabel}>Delivery PIN</Text>
              <Text style={styles.otpValue}>{order.otp}</Text>
            </View>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgColor },
  loadingContainer: { flex: 1, backgroundColor: colors.bgColor, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
  },
  backBtn: { padding: 4 },
  title: { ...typography.h3, color: colors.textMain },

  graphicContainer: { alignItems: 'center', paddingVertical: spacing.xxl, marginBottom: spacing.lg },
  pulseCircle: {
    position: 'absolute', top: 32, width: 120, height: 120,
    borderRadius: 60, backgroundColor: 'rgba(255,193,7,0.15)',
  },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primaryDark,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 15, elevation: 8,
  },
  statusTitle: { ...typography.h1, color: colors.textMain, marginBottom: 4 },
  orderId: { fontSize: 13, color: colors.textMuted, fontFamily: 'monospace' },

  timelineCard: {
    backgroundColor: colors.cardBg, borderRadius: radius.lg, padding: spacing.xxl,
    borderWidth: 1, borderColor: colors.borderColor, marginBottom: spacing.lg,
  },
  timelineStep: { flexDirection: 'row', alignItems: 'flex-start' },
  timelineLeft: { alignItems: 'center', width: 24, marginRight: spacing.md },
  dot: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.borderColor, alignItems: 'center', justifyContent: 'center' },
  dotPast: { backgroundColor: colors.success },
  dotCurrent: { backgroundColor: colors.primary, borderWidth: 4, borderColor: 'rgba(255,193,7,0.3)', width: 20, height: 20, borderRadius: 10 },
  line: { width: 2, height: 30, backgroundColor: colors.borderColor, marginVertical: 4 },
  linePast: { backgroundColor: colors.success },
  stepLabel: { fontSize: 15, color: colors.textMuted, fontWeight: '600', marginTop: -2 },
  stepLabelActive: { color: colors.textMain },

  detailsCard: {
    backgroundColor: colors.cardBg, borderRadius: radius.lg, padding: spacing.lg,
    borderWidth: 1, borderColor: colors.borderColor,
  },
  detailsTitle: { fontSize: 15, fontWeight: '700', color: colors.textMain, marginBottom: 8 },
  detailsText: { fontSize: 14, color: colors.textMuted },
  otpBox: {
    marginTop: spacing.md, backgroundColor: 'rgba(255,193,7,0.1)', padding: spacing.md, borderRadius: radius.md,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,193,7,0.3)'
  },
  otpLabel: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  otpValue: { color: colors.primary, fontWeight: '800', fontSize: 24, letterSpacing: 4 },
});

export default OrderTrackerScreen;
