import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Linking, TextInput, Alert, ActivityIndicator, Share } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ordersApi } from '../api/orders';
import { useCartStore } from '../store/cartStore';
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
  const { orderIds } = route.params || {};

  const primaryOrderId = Array.isArray(orderIds)
    ? orderIds[0]
    : typeof orderIds === 'string'
    ? orderIds.split(',')[0]
    : orderIds;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const pulse = useRef(new Animated.Value(1)).current;

  // Rating & Feedback State
  const [selectedRating, setSelectedRating] = useState<number>(5);
  const [ratingFeedback, setRatingFeedback] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isSubmittingRating, setIsSubmittingRating] = useState<boolean>(false);
  const [hasRatedLocally, setHasRatedLocally] = useState<boolean>(false);

  const reorderItems = useCartStore((s) => s.reorderItems);
  const getCartStoreId = useCartStore((s) => s.getCartStoreId);

  const handleWhatsAppSupport = () => {
    const orderNum = primaryOrderId ? `#${String(primaryOrderId).slice(-6).toUpperCase()}` : '';
    const storeName = (order as any)?.store_name || order?.storeName || '';
    const amount = (order as any)?.total_amount || order?.totalAmount ? ` (₹${(order as any)?.total_amount || order?.totalAmount})` : '';
    const text = encodeURIComponent(
      `Hi Zappit Support, I need help with my Order ${orderNum}${storeName ? ` from ${storeName}` : ''}${amount}.`
    );
    const url = `whatsapp://send?phone=918463037671&text=${text}`;
    Linking.canOpenURL(url).then((supported) => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Linking.openURL(`https://wa.me/918463037671?text=${text}`);
      }
    }).catch(() => {
      Linking.openURL(`https://wa.me/918463037671?text=${text}`);
    });
  };

  const handleShareOrder = async () => {
    try {
      const store = (order as any)?.store_name || order?.storeName || 'Campus Store';
      const orderNum = primaryOrderId ? `#${String(primaryOrderId).slice(-6).toUpperCase()}` : '';
      await Share.share({
        message: `🍔 Tracking my Zappit order ${orderNum} from ${store}! Track live on campus delivery: https://zappit.shop/track/${primaryOrderId}`,
        title: `Zappit Order ${orderNum}`,
      });
    } catch {}
  };

  const getEtaInfo = () => {
    const isOrderCancelled = (order as any)?.order_status === 'cancelled' || order?.status === 'cancelled';
    const isOrderDelivered = (order as any)?.order_status === 'delivered' || order?.status === 'delivered';
    if (isOrderCancelled) return { time: 'Cancelled', desc: 'Order was cancelled', progress: 0 };
    if (isOrderDelivered) return { time: 'Delivered', desc: 'Arrived at your room! Enjoy 🎉', progress: 1 };

    const status = (order as any)?.order_status || order?.status || 'confirmed';
    const prepMins = (order as any)?.prep_time_mins;
    const expectedReadyAt = (order as any)?.expected_ready_at;
    const storeQueue = Number((order as any)?.store_active_orders || 0);

    const queueDesc = storeQueue > 1 ? ` • ${storeQueue} orders in kitchen` : '';

    if (status === 'confirmed') {
      return {
        time: '~15-20 mins',
        desc: `Order received! Kitchen notified${queueDesc} ⚡`,
        progress: 0.2,
      };
    }

    if (status === 'preparing') {
      if (expectedReadyAt && prepMins) {
        const readyTimeMs = new Date(expectedReadyAt).getTime();
        const minsRemaining = Math.max(1, Math.round((readyTimeMs - Date.now()) / 60000));
        const readyTimeStr = new Date(expectedReadyAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const acceptedAtMs = (order as any)?.accepted_at ? new Date((order as any).accepted_at).getTime() : Date.now() - 60000;
        const totalPrepMs = prepMins * 60000;
        const elapsed = Math.max(0, Date.now() - acceptedAtMs);
        const prepProgress = Math.min(0.70, Math.max(0.25, 0.25 + (elapsed / totalPrepMs) * 0.45));

        return {
          time: `~${minsRemaining} mins`,
          desc: `Chef set ${prepMins}m prep time • Ready by ${readyTimeStr}${queueDesc} 👨‍🍳`,
          progress: prepProgress,
        };
      }
      return {
        time: '~12-15 mins',
        desc: `Chef is preparing your food fresh${queueDesc} 👨‍🍳`,
        progress: 0.5,
      };
    }

    if (status === 'ready') {
      return {
        time: '~5-8 mins',
        desc: 'Packed & ready! Waiting for rider pickup 📦',
        progress: 0.75,
      };
    }

    if (status === 'picked_up' || status === 'out_for_delivery') {
      return {
        time: '~3-5 mins',
        desc: 'Rider picked up package & is heading to your block! 🛵',
        progress: 0.90,
      };
    }

    return { time: '~15-20 mins', desc: 'Heading your way', progress: 0.4 };
  };

  const getStepTimestamp = (key: string): string | null => {
    if (!order) return null;
    const format = (iso?: string | null) => {
      if (!iso) return null;
      try {
        return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } catch {
        return null;
      }
    };
    if (key === 'confirmed') return format((order as any).created_at || (order as any).createdAt);
    if (key === 'preparing') return format((order as any).accepted_at);
    if (key === 'ready') return format((order as any).ready_at);
    if (key === 'out_for_delivery' || key === 'picked_up') return format((order as any).picked_up_at);
    if (key === 'delivered') return format((order as any).delivered_at);
    return null;
  };

  const handleReorder = () => {
    if (!order || !order.items || order.items.length === 0) return;
    const currentStoreId = getCartStoreId();
    const orderStoreId = (order as any).store_id || order.storeId || '';
    const orderStoreName = (order as any).store_name || order.storeName || 'Campus Store';

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

  const handleRatingSubmit = async () => {
    if (!primaryOrderId) return;
    setIsSubmittingRating(true);
    try {
      const combinedFeedback = [
        ...selectedTags,
        ratingFeedback.trim(),
      ].filter(Boolean).join(' • ');

      await ordersApi.submitRating(primaryOrderId, selectedRating, combinedFeedback);
      setHasRatedLocally(true);
      Alert.alert('Thank You!', `Your ${selectedRating}-star rating has been submitted.`);
      fetchOrder();
    } catch (err: any) {
      Alert.alert('Rating Error', err?.response?.data?.error || err.message || 'Could not submit rating.');
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

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

        {/* ── LIVE ETA COUNTDOWN & PROGRESS BAR ── */}
        {!isCancelled && !isDelivered && (
          <View style={styles.etaCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={styles.etaLabel}>ESTIMATED ARRIVAL</Text>
                <Text style={styles.etaTime}>{getEtaInfo().time}</Text>
              </View>
              <View style={styles.etaBadge}>
                <Text style={styles.etaBadgeText}>⚡ EXPRESS CAMPUS</Text>
              </View>
            </View>

            {/* Visual Animated Progress Track */}
            <View style={styles.etaProgressBg}>
              <View style={[styles.etaProgressBar, { width: `${Math.round(getEtaInfo().progress * 100)}%` }]} />
            </View>

            <Text style={styles.etaDesc}>
              {getEtaInfo().desc}
            </Text>
          </View>
        )}

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

        {/* ── DELIVERY PARTNER DIRECT CONTACT CARD ── */}
        {!isCancelled && !isDelivered && (currentStep?.key === 'picked_up' || currentStep?.key === 'out_for_delivery' || (order as any).order_status === 'picked_up' || (order as any).order_status === 'out_for_delivery') && (
          <View style={styles.riderCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={styles.riderAvatar}>
                <Text style={{ fontSize: 24 }}>🛵</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.riderName}>Delivery Partner Assigned</Text>
                  <View style={styles.riderOnlineDot} />
                </View>
                <Text style={styles.riderSub}>En route to your hostel block with package</Text>
              </View>
            </View>

            <View style={styles.riderActionRow}>
              <TouchableOpacity
                style={styles.riderCallBtn}
                onPress={() => Linking.openURL(`tel:${(order as any).delivery_phone || '918463037671'}`)}
              >
                <Text style={styles.riderCallBtnText}>📞 Call Partner</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.riderWaBtn}
                onPress={() => {
                  const num = ((order as any).delivery_phone || '918463037671').replace(/\D/g, '');
                  const orderNum = primaryOrderId ? `#${String(primaryOrderId).slice(-6).toUpperCase()}` : '';
                  const msg = encodeURIComponent(`Hi, I am waiting for my Zappit order ${orderNum} at ${(order as any).delivery_address || (order as any).address || 'my room'}.`);
                  Linking.openURL(`https://wa.me/${num}?text=${msg}`);
                }}
              >
                <Text style={styles.riderWaBtnText}>💬 WhatsApp</Text>
              </TouchableOpacity>
            </View>
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
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{
                        fontSize: 15,
                        fontWeight: isCurrent ? '800' : isDone ? '600' : '400',
                        color: isDone ? colors.textMain : colors.textMuted,
                      }}>
                        {step.label}
                      </Text>
                      {getStepTimestamp(step.key) ? (
                        <Text style={styles.stepTimestamp}>{getStepTimestamp(step.key)}</Text>
                      ) : null}
                    </View>
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

        {/* ── WHATSAPP SUPPORT BUTTON (1-TAP) ── */}
        <TouchableOpacity
          style={styles.whatsAppCard}
          onPress={handleWhatsAppSupport}
          activeOpacity={0.8}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={styles.whatsAppIconBg}>
              <Text style={{ fontSize: 20 }}>💬</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textMain }}>Need Help with this Order?</Text>
              <Text style={{ fontSize: 12, color: colors.textMuted }}>Chat directly with Zappit Support on WhatsApp</Text>
            </View>
            <Text style={{ color: '#25D366', fontWeight: '800', fontSize: 14 }}>Chat →</Text>
          </View>
        </TouchableOpacity>

        {/* ── SHARE ORDER TRACKING BUTTON ── */}
        <TouchableOpacity
          style={styles.shareOrderBtn}
          onPress={handleShareOrder}
          activeOpacity={0.8}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={styles.shareIconBg}>
              <Text style={{ fontSize: 18 }}>🔗</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textMain }}>Share Tracking with Roommate</Text>
              <Text style={{ fontSize: 12, color: colors.textMuted }}>Send live order status link on WhatsApp</Text>
            </View>
            <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 14 }}>Share →</Text>
          </View>
        </TouchableOpacity>

        {/* ── POST-DELIVERY STAR RATING (⭐ 1-5 Stars) ── */}
        {isDelivered && (
          ((order as any).rating || hasRatedLocally) ? (
            <View style={[styles.card, { borderColor: '#10B981', borderWidth: 1.5, alignItems: 'center', paddingVertical: spacing.xl }]}>
              <Text style={{ fontSize: 32, marginBottom: 6 }}>🎉</Text>
              <Text style={{ fontSize: 17, fontWeight: '800', color: colors.textMain }}>Thank you for your rating!</Text>
              <Text style={{ fontSize: 20, color: '#F59E0B', marginTop: 6, letterSpacing: 4 }}>
                {'⭐'.repeat(Number((order as any).rating || selectedRating))}
              </Text>
              {(order as any).rating_feedback ? (
                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 8, fontStyle: 'italic' }}>
                  "{(order as any).rating_feedback}"
                </Text>
              ) : null}
            </View>
          ) : (
            <View style={[styles.card, { borderColor: colors.primary, borderWidth: 1.5 }]}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.textMain, textAlign: 'center', marginBottom: 4 }}>
                Rate Your Meal ⭐
              </Text>
              <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: 'center', marginBottom: 16 }}>
                How was your food from {(order as any).store_name || 'the kitchen'}?
              </Text>
              
              {/* Star selector */}
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 16 }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity key={star} onPress={() => setSelectedRating(star)} activeOpacity={0.7}>
                    <Text style={{ fontSize: 36, opacity: star <= selectedRating ? 1 : 0.25 }}>⭐</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Quick feedback chips */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 14 }}>
                {['Fast Delivery ⚡', 'Delicious 😋', 'Hot & Fresh ♨️', 'Good Packaging 📦'].map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    onPress={() => toggleTag(tag)}
                    style={[
                      styles.ratingTag,
                      selectedTags.includes(tag) && styles.ratingTagActive,
                    ]}
                  >
                    <Text style={[
                      styles.ratingTagText,
                      selectedTags.includes(tag) && styles.ratingTagTextActive,
                    ]}>{tag}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Optional note */}
              <TextInput
                style={styles.ratingInput}
                placeholder="Any suggestions for the store? (optional)"
                placeholderTextColor={colors.textMuted}
                value={ratingFeedback}
                onChangeText={setRatingFeedback}
                maxLength={200}
              />

              <TouchableOpacity
                style={[styles.submitRatingBtn, isSubmittingRating && { opacity: 0.6 }]}
                onPress={handleRatingSubmit}
                disabled={isSubmittingRating}
              >
                {isSubmittingRating ? (
                  <ActivityIndicator color="#0B132B" size="small" />
                ) : (
                  <Text style={styles.submitRatingBtnText}>Submit {selectedRating}★ Rating</Text>
                )}
              </TouchableOpacity>
            </View>
          )
        )}

        {/* ── CTA on Delivered: 1-Tap Re-Order & Back to Home ── */}
        {isDelivered && (
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
            <TouchableOpacity
              style={[styles.btn, { flex: 1, backgroundColor: 'rgba(255, 193, 7, 0.15)', borderWidth: 1.5, borderColor: colors.primary }]}
              onPress={handleReorder}
              activeOpacity={0.8}
            >
              <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 15 }}>🔁 Re-Order</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, { flex: 1, backgroundColor: colors.primary }]}
              onPress={() => navigation.navigate('Main', { screen: 'Home' })}
              activeOpacity={0.8}
            >
              <Text style={{ color: '#0B132B', fontWeight: '800', fontSize: 15 }}>🏠 Home</Text>
            </TouchableOpacity>
          </View>
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
  stepTimestamp: { fontSize: 11, fontWeight: '700', color: colors.primary, marginLeft: 8 },

  // Item row
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },

  btn: {
    paddingVertical: 16, borderRadius: radius.lg,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },

  // WhatsApp Support Card
  whatsAppCard: {
    backgroundColor: 'rgba(37, 211, 102, 0.1)',
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(37, 211, 102, 0.4)',
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  whatsAppIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(37, 211, 102, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Rating tags & input
  ratingTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: colors.borderColor,
  },
  ratingTagActive: {
    backgroundColor: 'rgba(255,193,7,0.18)',
    borderColor: colors.primary,
  },
  ratingTagText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  ratingTagTextActive: {
    color: colors.primary,
  },
  ratingInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderColor,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.textMain,
    fontSize: 13,
    marginBottom: spacing.md,
  },
  submitRatingBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitRatingBtnText: {
    color: '#0B132B',
    fontWeight: '800',
    fontSize: 14,
  },

  // Live ETA Card
  etaCard: {
    backgroundColor: '#1E293B',
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(255,193,7,0.3)',
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  etaLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 1,
    marginBottom: 2,
  },
  etaTime: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.textMain,
  },
  etaBadge: {
    backgroundColor: 'rgba(255,193,7,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,193,7,0.3)',
  },
  etaBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
  },
  etaProgressBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    marginVertical: 12,
    overflow: 'hidden',
  },
  etaProgressBar: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  etaDesc: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },

  // Rider Card
  riderCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.borderColor,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  riderAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  riderName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMain,
  },
  riderOnlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  riderSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  riderActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  riderCallBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  riderCallBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0B132B',
  },
  riderWaBtn: {
    flex: 1,
    backgroundColor: 'rgba(37, 211, 102, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(37, 211, 102, 0.4)',
    paddingVertical: 10,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  riderWaBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#25D366',
  },

  // Share order button
  shareOrderBtn: {
    backgroundColor: 'rgba(255, 193, 7, 0.08)',
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 193, 7, 0.25)',
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  shareIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 193, 7, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareOrderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textMain,
  },
  shareOrderSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
});

export default OrderTrackerScreen;
