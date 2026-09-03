import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  TextInput, Alert, Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../api/client';
import { paymentApi } from '../api/payment';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import { colors } from '../theme/colors';
import { typography, spacing, radius } from '../theme/typography';

const CheckoutScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  
  const itemsMap = useCartStore((state) => state.items);
  const cartItems = Object.values(itemsMap);
  const cartTotal = useCartStore((state) => state.getCartTotal());
  const storeId = useCartStore((state) => state.getCartStoreId());
  const storeName = useCartStore((state) => state.getCartStoreName());
  const clearCart = useCartStore((state) => state.clearCart);
  
  const { profile } = useAuthStore();

  const [address, setAddress] = useState('Engineering Block A');
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponError, setCouponError] = useState('');
  const [applying, setApplying] = useState(false);
  
  const [processing, setProcessing] = useState(false);
  const [paymentHtml, setPaymentHtml] = useState<string | null>(null);
  const [animationPhase, setAnimationPhase] = useState(0); // 0=none,1=placed,2=zapp,3=confirmed
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    AsyncStorage.getItem('userAddress').then((v) => v && setAddress(v));
    paymentApi.getDeliveryFee().then(setDeliveryFee).catch(() => setDeliveryFee(0));
  }, []);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setApplying(true);
    setCouponError('');
    try {
      const res = await paymentApi.verifyCoupon(couponCode.toUpperCase().trim());
      if (res.success && res.coupon) {
        if (res.coupon.active === false) {
          setCouponError('This coupon is inactive');
        } else {
          setAppliedCoupon(res.coupon);
          setCouponCode('');
        }
      } else {
        setCouponError('Invalid coupon code');
      }
    } catch (err: any) {
      setCouponError(err.response?.data?.error || 'Invalid coupon');
    } finally {
      setApplying(false);
    }
  };

  const discount = appliedCoupon ? Math.round((cartTotal * appliedCoupon.discount_percent) / 100) : 0;
  const totalToPay = Math.max(0, cartTotal + deliveryFee - discount);

  const startPayment = async () => {
    if (!address.trim()) {
      Alert.alert('Address Required', 'Please enter your delivery address.');
      return;
    }
    setProcessing(true);
    
    try {
      const userCollegeId = (await AsyncStorage.getItem('userCollegeId')) || '';

      // 1. Create order on backend
      const res = await paymentApi.createOrder({
        amount: cartTotal,
        items: cartItems.map(c => ({
          id: c.menuItem.id || c.menuItem._id,
          _id: c.menuItem.id || c.menuItem._id,
          name: c.menuItem.name,
          price: c.menuItem.price,
          qty: c.qty,
          storeId: c.storeId,
          storeName: c.storeName,
        })),
        storeId: storeId!,
        storeName: storeName!,
        address: address.trim(),
        deliveryAddress: address.trim(),
        deliveryFee,
        coupon_code: appliedCoupon?.code,
        couponCode: appliedCoupon?.code,
        college_id: userCollegeId,
      });

      if (!res.success) throw new Error(res.error || 'Failed to create order');

      const razorpayKey = res.key_id || 'rzp_test_T0gdDL6JAF6MCI';

      // 2. Generate Razorpay Checkout HTML to load in WebView with full error handling
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <style>
              body { background-color: #0B132B; color: #FFC107; font-family: -apple-system, sans-serif; display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; margin: 0; padding: 20px; text-align: center; }
              .spinner { border: 4px solid rgba(255,193,7,0.2); border-left-color: #FFC107; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin-bottom: 20px; }
              @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            </style>
          </head>
          <body>
            <div class="spinner"></div>
            <h2>Opening Secure Payment...</h2>
            <p style="color: #9CA3AF; font-size: 14px;">Please complete the payment below.</p>
            <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
            <script>
              function postToApp(data) {
                if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                  window.ReactNativeWebView.postMessage(JSON.stringify(data));
                }
              }

              try {
                var options = {
                  key: "${razorpayKey}",
                  amount: "${res.amount}",
                  currency: "${res.currency || 'INR'}",
                  name: "Zappit",
                  description: "Campus Delivery",
                  order_id: "${res.order_id}",
                  prefill: {
                    name: "${(profile?.name || '').replace(/"/g, '\\"')}",
                    email: "${(profile?.email || '').replace(/"/g, '\\"')}",
                    contact: "${(profile?.phone || '').replace(/"/g, '\\"')}"
                  },
                  theme: { color: "#FFC107" },
                  handler: function(response) {
                    postToApp({
                      status: 'success',
                      razorpay_order_id: response.razorpay_order_id,
                      razorpay_payment_id: response.razorpay_payment_id,
                      razorpay_signature: response.razorpay_signature
                    });
                  },
                  modal: {
                    ondismiss: function() {
                      postToApp({ status: 'cancelled' });
                    }
                  }
                };

                var rzp = new Razorpay(options);
                rzp.on('payment.failed', function(response) {
                  var errDesc = response.error ? (response.error.description || response.error.reason || 'Payment failed') : 'Payment failed';
                  postToApp({ status: 'failed', error: errDesc });
                });
                rzp.open();
              } catch (err) {
                postToApp({ status: 'failed', error: err.message || 'Could not open payment gateway' });
              }
            </script>
          </body>
        </html>
      `;
      setPaymentHtml(html);
    } catch (err: any) {
      Alert.alert('Payment Error', err.message || 'Could not start payment');
      setProcessing(false);
    }
  };

  const triggerPopAnimation = () => {
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.4);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleWebViewMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.status === 'cancelled') {
        setPaymentHtml(null);
        setProcessing(false);
        Alert.alert('Cancelled', 'Payment was cancelled.');
      } else if (data.status === 'failed') {
        setPaymentHtml(null);
        setProcessing(false);
        Alert.alert('Payment Failed', data.error || 'Payment failed.');
      } else if (data.status === 'success') {
        // Immediately show animation screen to avoid form flicker
        setPaymentHtml(null);
        setAnimationPhase(1);
        triggerPopAnimation();

        // 3. Verify Payment
        try {
          const verifyRes = await paymentApi.verifyPayment({
            razorpay_order_id: data.razorpay_order_id,
            razorpay_payment_id: data.razorpay_payment_id,
            razorpay_signature: data.razorpay_signature,
          });
          
          if (verifyRes.success) {
            clearCart();
            const orderIds = verifyRes.orderIds;

            // Send order confirmation email with OTP & receipt
            try {
              await apiClient.post('/api/send-order-email', { orderIds });
            } catch (emailErr) {
              console.warn('[Zappit] Email send failed (non-critical):', emailErr);
            }

            // Phase 2: ZAPP!
            setTimeout(() => {
              setAnimationPhase(2);
              triggerPopAnimation();
            }, 1200);

            // Phase 3: Confirmed!
            setTimeout(() => {
              setAnimationPhase(3);
              triggerPopAnimation();
            }, 2600);

            // Redirect to order tracker
            setTimeout(() => {
              setAnimationPhase(0);
              setProcessing(false);
              navigation.replace('OrderTracker', { orderIds });
            }, 4200);
          } else {
            throw new Error('Verification failed on server');
          }
        } catch (vErr: any) {
          setAnimationPhase(0);
          setProcessing(false);
          Alert.alert('Verification Failed', vErr.message);
        }
      }
    } catch (e) {
      console.error('WebView message parse error', e);
    }
  };

  // ── PAYMENT SUCCESS ANIMATION SCREEN ──────────────────────────────────────
  if (animationPhase > 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgColor, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }], alignItems: 'center' }}>

          {animationPhase === 1 && (
            <>
              <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(16,185,129,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 20, borderWidth: 3, borderColor: 'rgba(16,185,129,0.4)' }}>
                <Text style={{ fontSize: 44 }}>✅</Text>
              </View>
              <Text style={{ fontSize: 26, fontWeight: '900', color: colors.textMain, marginBottom: 8 }}>Order Placed!</Text>
              <Text style={{ fontSize: 15, color: colors.textMuted }}>Hang tight...</Text>
            </>
          )}

          {animationPhase === 2 && (
            <>
              <Text style={{ fontSize: 96, lineHeight: 110 }}>💥</Text>
              <Text style={{ fontSize: 48, fontWeight: '900', color: colors.primary, fontStyle: 'italic', letterSpacing: 4, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 4 }}>ZAPP!</Text>
            </>
          )}

          {animationPhase === 3 && (
            <>
              <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: colors.primaryDark, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                <Text style={{ fontSize: 44 }}>⚡</Text>
              </View>
              <Text style={{ fontSize: 26, fontWeight: '900', color: colors.textMain, marginBottom: 8 }}>Confirmed!</Text>
              <Text style={{ fontSize: 14, color: colors.textMuted }}>Redirecting to tracker...</Text>
              <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
            </>
          )}

        </Animated.View>
      </View>
    );
  }

  if (paymentHtml) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgColor }}>
        <View style={{ height: insets.top, backgroundColor: colors.bgColor }} />
        <WebView
          originWhitelist={['*']}
          source={{ html: paymentHtml, baseUrl: 'https://checkout.razorpay.com' }}
          onMessage={handleWebViewMessage}
          style={{ flex: 1 }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          thirdPartyCookiesEnabled={true}
          mixedContentMode="always"
          startInLoadingState={true}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.warn('WebView error: ', nativeEvent);
            Alert.alert('Payment Error', nativeEvent.description || 'Failed to load payment gateway.');
            setPaymentHtml(null);
            setProcessing(false);
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { marginTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={{ fontSize: 20, color: colors.textMain }}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Checkout</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.xl, paddingBottom: 120 }}>
        {/* Delivery Address */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Delivery Address</Text>
          <View style={styles.inputWrapper}>
            <Text style={{ fontSize: 18, marginRight: 8 }}>📍</Text>
            <TextInput
              style={styles.input}
              value={address}
              onChangeText={(txt) => {
                setAddress(txt);
                AsyncStorage.setItem('userAddress', txt);
              }}
              placeholder="Hostel / Room details"
              placeholderTextColor={colors.textMuted}
            />
          </View>
        </View>

        {/* Coupon */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Offers & Coupons</Text>
          {!appliedCoupon ? (
            <>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={[styles.inputWrapper, { flex: 1, marginBottom: 0 }]}>
                  <Text style={{ fontSize: 16, marginRight: 8 }}>🏷️</Text>
                  <TextInput
                    style={styles.input}
                    value={couponCode}
                    onChangeText={setCouponCode}
                    placeholder="Enter code"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="characters"
                  />
                </View>
                <TouchableOpacity
                  style={styles.applyBtn}
                  onPress={handleApplyCoupon}
                  disabled={applying}
                >
                  {applying ? <ActivityIndicator color="#fff" /> : <Text style={styles.applyBtnText}>Apply</Text>}
                </TouchableOpacity>
              </View>
              {couponError ? <Text style={styles.errorText}>{couponError}</Text> : null}
            </>
          ) : (
            <View style={styles.appliedCouponBox}>
              <View>
                <Text style={styles.appliedCode}>{appliedCoupon.code} Applied!</Text>
                <Text style={styles.appliedDesc}>{appliedCoupon.discount_percent}% Discount</Text>
              </View>
              <TouchableOpacity onPress={() => setAppliedCoupon(null)}>
                <Text style={styles.removeText}>Remove</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Bill */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Bill Summary</Text>
          <View style={styles.billRow}>
            <Text style={styles.billText}>Item Total</Text>
            <Text style={styles.billText}>₹{cartTotal}</Text>
          </View>
          <View style={styles.billRow}>
            <Text style={styles.billText}>Delivery Fee</Text>
            <Text style={styles.billText}>₹{deliveryFee}</Text>
          </View>
          {appliedCoupon && (
            <View style={styles.billRow}>
              <Text style={styles.discountText}>Coupon Discount ({appliedCoupon.discount_percent}%)</Text>
              <Text style={styles.discountText}>-₹{discount}</Text>
            </View>
          )}
          <View style={styles.divider} />
          <View style={styles.billRow}>
            <Text style={styles.totalText}>To Pay</Text>
            <Text style={styles.totalAmount}>₹{totalToPay}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <View>
          <Text style={styles.footerLabel}>TO PAY</Text>
          <Text style={styles.footerTotal}>₹{totalToPay}</Text>
        </View>
        <TouchableOpacity
          style={[styles.payBtn, processing && { opacity: 0.7 }]}
          onPress={startPayment}
          disabled={processing}
        >
          {processing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.payBtnText}>Pay Securely  →</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgColor },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.borderColor,
  },
  backBtn: { padding: 4 },
  title: { ...typography.h3, color: colors.textMain },

  card: {
    backgroundColor: colors.cardBg, padding: spacing.lg, borderRadius: radius.md,
    marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.borderColor,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.textMain, marginBottom: spacing.md },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgColor, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.borderColor, paddingHorizontal: spacing.md,
  },
  input: { flex: 1, paddingVertical: 12, color: colors.textMain, fontSize: 15 },
  
  applyBtn: {
    backgroundColor: colors.primaryDark, borderRadius: radius.md,
    paddingHorizontal: spacing.lg, justifyContent: 'center', alignItems: 'center',
  },
  applyBtnText: { color: '#fff', fontWeight: '700' },
  errorText: { color: colors.error, fontSize: 12, marginTop: 8, fontWeight: '600' },

  appliedCouponBox: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: spacing.md, borderRadius: radius.md,
    borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  appliedCode: { color: colors.primary, fontWeight: '800', fontSize: 14 },
  appliedDesc: { color: colors.success, fontSize: 12, fontWeight: '600', marginTop: 2 },
  removeText: { color: colors.error, fontWeight: '700', fontSize: 13 },

  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  billText: { fontSize: 14, color: colors.textMuted },
  discountText: { fontSize: 14, color: colors.success, fontWeight: '600' },
  divider: { height: 1, backgroundColor: colors.borderColor, marginVertical: spacing.md },
  totalText: { fontSize: 16, fontWeight: '700', color: colors.textMain },
  totalAmount: { fontSize: 18, fontWeight: '800', color: colors.primary },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.cardBg, padding: spacing.xl,
    borderTopWidth: 1, borderTopColor: colors.borderColor,
  },
  footerLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 2 },
  footerTotal: { fontSize: 20, fontWeight: '800', color: colors.textMain },
  payBtn: {
    backgroundColor: colors.primaryDark, borderRadius: radius.md,
    paddingHorizontal: 24, paddingVertical: 14,
  },
  payBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

export default CheckoutScreen;
