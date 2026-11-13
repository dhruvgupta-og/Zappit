import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useActiveOrderStore } from '../store/activeOrderStore';
import { colors } from '../theme/colors';

const STATUS_DETAILS: Record<
  string,
  { label: string; subtext: string; icon: keyof typeof Ionicons.glyphMap; color: string }
> = {
  placed: {
    label: 'Order Placed',
    subtext: 'Waiting for store confirmation',
    icon: 'time-outline',
    color: '#10B981',
  },
  confirmed: {
    label: 'Order Confirmed',
    subtext: 'Kitchen has accepted your order',
    icon: 'checkmark-circle-outline',
    color: '#10B981',
  },
  accepted: {
    label: 'Preparing Food',
    subtext: 'Chef is cooking your meal',
    icon: 'restaurant-outline',
    color: '#F59E0B',
  },
  preparing: {
    label: 'Cooking Now',
    subtext: 'Food is on the stove',
    icon: 'flame-outline',
    color: '#F59E0B',
  },
  ready: {
    label: 'Ready for Pickup',
    subtext: 'Packed & awaiting delivery partner',
    icon: 'cube-outline',
    color: '#3B82F6',
  },
  picked_up: {
    label: 'On the Way',
    subtext: 'Delivery partner has picked it up',
    icon: 'bicycle-outline',
    color: '#8B5CF6',
  },
  out_for_delivery: {
    label: 'Arriving Soon',
    subtext: 'Keep delivery OTP ready',
    icon: 'navigate-outline',
    color: '#8B5CF6',
  },
};

interface FloatingActiveOrderBarProps {
  bottomOffset?: number;
}

export const FloatingActiveOrderBar: React.FC<FloatingActiveOrderBarProps> = ({
  bottomOffset = 80,
}) => {
  const navigation = useNavigation<any>();
  const { activeOrder, isDismissed, fetchActiveOrder, dismissBar } = useActiveOrderStore();

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(60)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Poll for active orders (smart frequency: 12s when order active, 60s when idle)
  useEffect(() => {
    fetchActiveOrder(true);
    const pollInterval = activeOrder ? 12000 : 60000;
    const interval = setInterval(() => {
      fetchActiveOrder(true);
    }, pollInterval);
    return () => clearInterval(interval);
  }, [fetchActiveOrder, !!activeOrder]);

  // Pulse animation for the live dot
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.5,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);

  // Slide-in / fade-in when activeOrder appears
  const isVisible = Boolean(activeOrder && !isDismissed);
  useEffect(() => {
    if (isVisible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 70,
          friction: 9,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 60,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isVisible, slideAnim, opacityAnim]);

  if (!activeOrder || isDismissed) {
    return null;
  }

  const rawStatus = (
    (activeOrder as any).order_status ||
    activeOrder.status ||
    'confirmed'
  ).toLowerCase();

  const statusConfig = STATUS_DETAILS[rawStatus] || {
    label: 'Order in Progress',
    subtext: 'Tap to view live updates',
    icon: 'time-outline' as keyof typeof Ionicons.glyphMap,
    color: colors.primary,
  };

  const storeName =
    (activeOrder as any).store_name || activeOrder.storeName || 'Campus Store';
  const itemCount = activeOrder.items ? activeOrder.items.length : 0;
  const orderId = activeOrder.id || (activeOrder as any)._id;

  const handlePress = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    navigation.navigate('OrderTracker', { orderIds: orderId });
  };

  const handleDismiss = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    dismissBar();
  };

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          bottom: bottomOffset,
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        style={[
          styles.container,
          { borderColor: `${statusConfig.color}55` },
        ]}
        activeOpacity={0.9}
        onPress={handlePress}
      >
        {/* Pulsing Dot & Icon Badge */}
        <View style={styles.badgeCol}>
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: `${statusConfig.color}22` },
            ]}
          >
            <Ionicons
              name={statusConfig.icon}
              size={18}
              color={statusConfig.color}
            />
          </View>
          <Animated.View
            style={[
              styles.livePulseDot,
              {
                backgroundColor: statusConfig.color,
                transform: [{ scale: pulseAnim }],
              },
            ]}
          />
        </View>

        {/* Text Info */}
        <View style={styles.textContainer}>
          <View style={styles.topRow}>
            <Text style={styles.storeName} numberOfLines={1}>
              {storeName}
            </Text>
            <View
              style={[
                styles.statusTag,
                { backgroundColor: `${statusConfig.color}25` },
              ]}
            >
              <Text
                style={[styles.statusTagText, { color: statusConfig.color }]}
              >
                {statusConfig.label}
              </Text>
            </View>
          </View>
          <Text style={styles.subtext} numberOfLines={1}>
            {statusConfig.subtext}
            {itemCount > 0 ? ` • ${itemCount} item${itemCount > 1 ? 's' : ''}` : ''}
          </Text>
        </View>

        {/* Action Button & Dismiss */}
        <View style={styles.actionCol}>
          <View style={styles.trackPill}>
            <Text style={styles.trackText}>Track</Text>
            <Ionicons name="chevron-forward" size={13} color="#FFF" />
          </View>
          <TouchableOpacity
            style={styles.dismissBtn}
            onPress={handleDismiss}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={14} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 9999,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(19, 30, 58, 0.98)',
    borderRadius: 16,
    borderWidth: 1.5,
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 10,
  },
  badgeCol: {
    position: 'relative',
    marginRight: 12,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  livePulseDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#131E3A',
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  storeName: {
    color: colors.textMain,
    fontSize: 14,
    fontWeight: '700',
    maxWidth: 130,
  },
  statusTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusTagText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  subtext: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
  },
  actionCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trackPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 2,
  },
  trackText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  dismissBtn: {
    padding: 4,
    borderRadius: 10,
  },
});

