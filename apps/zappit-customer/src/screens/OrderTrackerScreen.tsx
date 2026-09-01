import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ordersApi } from '../api/orders';
import { colors } from '../theme/colors';
import { typography, spacing, radius } from '../theme/typography';
import { Order } from '../types';

// ── Status steps matching the backend exactly ──────────────────────────────
const STATUS_STEPS = [
  {
    key: 'confirmed',
    label: 'Order Confirmed',
    emoji: '✅',
    desc: 'Your payment was received. Store has been notified.',
    color: '#10B981',
  },
  {
    key: 'preparing',
    label: 'Preparing Your Food',
    emoji: '👨‍🍳',
    desc: 'The store is cooking your order right now.',
    color: '#F59E0B',
  },
  {
    key: 'ready',
    label: 'Ready for Pickup',
    emoji: '📦',
    desc: 'Your order is packed and ready. Waiting for delivery partner.',
    color: '#3B82F6',
  },
  {
    key: 'out_for_delivery',
    label: 'On the Way',
    emoji: '🛵',
    desc: 'Delivery partner is heading to you! Keep your OTP ready.',
    color: '#8B5CF6',
  },
  {
    key: 'picked_up',
    label: 'Picked Up',
    emoji: '🚴',
    desc: 'Delivery partner has picked up your order.',
    color: '#8B5CF6',
  },
  {
    key: 'delivered',
    label: 'Delivered!',
    emoji: '🎉',
    desc: 'Enjoy your meal! Thanks for ordering with Zappit.',
    color: '#10B981',
  },
];

const statusIndex = (status: string) => {
  const idx = STATUS_STEPS.findIndex(s => s.key === status);
  return idx >= 0 ? idx : 0;
};

const OrderTrackerScreen = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { orderIds } = route.params;

  const primaryOrderId = Array.isArray(orderIds) ? orderIds[0] : orderIds;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const pulse = useRef(new Animated.Value(1)).current;

  // Animated pulse for current step
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const fetchOrder = async () => {
    try {
      const data = await ordersApi.getById(primaryOrderId);
      if (data) setOrder(data);
    } catch (e) {
      console.error('OrderTracker fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
    const interval = setInterval(fetchOrder, 5000); // poll every 5s like web
    return () => clearInterval(interval);
  }, [primaryOrderId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={{ fontSize: 32 }}>⚡</Text>
          <Text style={{ color: colors.textMuted, marginTop: 12, fontSize: 15 }}>Loading your order...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>😕</Text>
          <Text style={{ color: colors.textMuted, fontSize: 15 }}>Order not found</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Main', { screen: 'Home' })}
            style={[styles.btn, { marginTop: 20, backgroundColor: colors.primary }]}
          >
            <Text style={{ color: '#0B132B', fontWeight: '800' }}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentStepIdx = statusIndex(order.order_status || order.status || '');
  const currentStep = STATUS_STEPS[currentStepIdx];
  const isCancelled = (order.order_status || order.status) === 'cancelled';
  const isDelivered = (order.order_status || order.status) === 'delivered';
  // OTP from the authenticated orders API — field is delivery_otp
  const otp = (order as any).delivery_otp;
  const showOtp = !!otp && !isDelivered && !isCancelled;

  const orderId = (order as any).id || (order as any)._id || '';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── HEADER ── */}
      <View style={[styles.header, { backgroundColor: isDelivered ? '#10B981' : colors.primaryDark }]}>
        <TouchableOpacity onPress={() => navigation.navigate('Main', { screen: 'Home' })} style={styles.backBtn}>
          <Text style={{ fontSize: 18, color: 'white' }}>✕</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Order ID
          </Text>
          <Text style={{ fontSize: 18, fontWeight: '800', color: 'white' }}>
            #{orderId.slice(-6).toUpperCase()}
          </Text>
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>
            {(order as any).store_name || ''}
          </Text>
        </View>
        {/* Live status pill */}
        <View style={styles.statusPill}>
          {!isDelivered && (
            <Animated.View
              style={[styles.pulseDot, { transform: [{ scale: pulse }] }]}
            />
          )}
          <Text style={{ color: 'white', fontWeight: '700', fontSize: 12 }}>
            {isCancelled ? '❌ Cancelled' : currentStep?.label || 'Processing'}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>

        {/* ── OTP CARD — most important, shown prominently when delivery is active ── */}
        {showOtp && (
          <View style={styles.otpCard}>
            <Text style={styles.otpCardTitle}>🔐 Your Delivery OTP</Text>
            <Text style={styles.otpCardSubtitle}>Share this PIN with your delivery partner to complete delivery</Text>
            <Text style={styles.otpValue}>{otp}</Text>
            <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '600', textAlign: 'center', marginTop: 8 }}>
              Keep this safe — only share when your order arrives
            </Text>
          </View>
        )}

        {/* ── STATUS TIMELINE CARD ── */}
        {!isCancelled && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Live Status</Text>
            {STATUS_STEPS.filter(s => s.key !== 'picked_up').map((step, index) => {
              // Map picked_up to out_for_delivery index for display purposes
              const displayIdx = STATUS_STEPS.filter(s => s.key !== 'picked_up').indexOf(step);
              const effectiveCurrentIdx = currentStepIdx >= STATUS_STEPS.findIndex(s => s.key === 'picked_up')
                ? currentStepIdx - 1
                : currentStepIdx;
              const isDone = displayIdx <= effectiveCurrentIdx;
              const isCurrent = displayIdx === effectiveCurrentIdx;
              const isLast = displayIdx === STATUS_STEPS.filter(s => s.key !== 'picked_up').length - 1;

              return (
                <View key={step.key} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  {/* Icon + connector */}
                  <View style={{ alignItems: 'center', width: 36, flexShrink: 0 }}>
                    <Animated.View style={[
                      styles.stepDot,
                      isDone && { backgroundColor: step.color },
                      isCurrent && {
                        width: 36, height: 36, borderRadius: 18,
                        borderWidth: 3, borderColor: step.color + '40',
                      },
                    ]}>
                      {isDone
                        ? <Text style={{ fontSize: isCurrent ? 16 : 14 }}>{step.emoji}</Text>
                        : <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.borderColor }} />
                      }
                    </Animated.View>
                    {!isLast && (
                      <View style={[
                        styles.connector,
                        { backgroundColor: isDone ? step.color : colors.borderColor },
                      ]} />
                    )}
                  </View>
                  {/* Labels */}
                  <View style={{ flex: 1, paddingTop: 6, paddingBottom: isLast ? 0 : 24, paddingLeft: 12 }}>
                    <Text style={{
                      fontSize: 15,
                      fontWeight: isCurrent ? '800' : isDone ? '600' : '400',
                      color: isDone ? colors.textMain : colors.textMuted,
                    }}>
                      {step.label}
                    </Text>
                    {isCurrent && (
                      <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 3 }}>
                        {step.desc}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {isCancelled && (
          <View style={[styles.card, { borderColor: '#EF4444', borderWidth: 1 }]}>
            <Text style={{ fontSize: 32, textAlign: 'center', marginBottom: 8 }}>❌</Text>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#EF4444', textAlign: 'center' }}>Order Cancelled</Text>
            <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 6 }}>
              Your order has been cancelled. If payment was made, you'll receive a refund within 5-7 business days.
            </Text>
          </View>
        )}

        {/* ── DELIVERY DETAILS ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Delivery Details</Text>
          <Text style={{ fontSize: 14, color: colors.textMuted }}>
            📍 {(order as any).delivery_address || (order as any).address || 'N/A'}
          </Text>
        </View>

        {/* ── ORDER SUMMARY ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Order Summary</Text>
          {((order as any).items || []).map((item: any, i: number) => (
            <View key={i} style={styles.itemRow}>
              <Text style={{ fontSize: 14, color: colors.textMuted, flex: 1 }}>
                {item.qty || item.quantity || 1}× {item.name}
              </Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textMain }}>
                ₹{(item.price || 0) * (item.qty || item.quantity || 1)}
              </Text>
            </View>
          ))}
          <View style={[styles.itemRow, { borderTopWidth: 1, borderTopColor: colors.borderColor, marginTop: 8, paddingTop: 12 }]}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textMain }}>Total Paid</Text>
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.primary }}>
              ₹{(order as any).total_amount || 0}
            </Text>
          </View>
        </View>

        {/* ── CTA on Delivered ── */}
        {isDelivered && (
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('Main', { screen: 'Home' })}
          >
            <Text style={{ color: '#0B132B', fontWeight: '800', fontSize: 16 }}>🏠 Back to Home</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgColor },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.lg,
  },
  backBtn: { padding: 4 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  pulseDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: 'white',
  },

  // OTP Card — premium gold style
  otpCard: {
    backgroundColor: 'rgba(255,193,7,0.1)', borderRadius: radius.lg,
    borderWidth: 2, borderColor: 'rgba(255,193,7,0.4)',
    borderStyle: 'dashed',
    padding: spacing.xl, marginBottom: spacing.lg, alignItems: 'center',
  },
  otpCardTitle: { fontSize: 15, fontWeight: '800', color: colors.primary, marginBottom: 4 },
  otpCardSubtitle: {
    fontSize: 12, color: colors.textMuted, textAlign: 'center',
    marginBottom: 16, lineHeight: 18,
  },
  otpValue: {
    fontSize: 44, fontWeight: '900', color: colors.primary,
    letterSpacing: 10, fontFamily: 'monospace',
  },

  card: {
    backgroundColor: colors.cardBg, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.borderColor,
    padding: spacing.lg, marginBottom: spacing.lg,
  },
  cardTitle: {
    fontSize: 11, fontWeight: '700', color: colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.md,
  },

  // Timeline
  stepDot: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: colors.borderColor,
    alignItems: 'center', justifyContent: 'center',
  },
  connector: { width: 2, height: 24, marginVertical: 3 },

  // Item row
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },

  btn: {
    paddingVertical: 16, borderRadius: radius.lg,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },
});

export default OrderTrackerScreen;
