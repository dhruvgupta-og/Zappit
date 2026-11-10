import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  TextInput, Alert, Animated, Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../api/client';
import { paymentApi } from '../api/payment';
import { storesApi } from '../api/stores';
import { College } from '../types';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import { colors } from '../theme/colors';
import { typography, spacing, radius } from '../theme/typography';

interface PaymentSession {
  orderId: string;
  keyId: string;
  amount: number;
  totalToPay: number;
  qrId?: string;
  qrImageUrl?: string;
  dbOrderIds: string[];
}

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
  const [roomDetails, setRoomDetails] = useState('');
  const [selectedBlock, setSelectedBlock] = useState<any>(null);
  const [collegeDetails, setCollegeDetails] = useState<College | null>(null);
  const [additionalNote, setAdditionalNote] = useState('');
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [allFees, setAllFees] = useState<Array<{ name: string; type: string; value: number }>>([]);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponError, setCouponError] = useState('');
  const [applying, setApplying] = useState(false);

  const [processing, setProcessing] = useState(false);
  const [paymentSession, setPaymentSession] = useState<PaymentSession | null>(null);
  const [paymentTab, setPaymentTab] = useState<'apps' | 'qr'>('apps');
  const [paymentHtml, setPaymentHtml] = useState<string | null>(null);
  const [qrSecondsLeft, setQrSecondsLeft] = useState(900);
  const [animationPhase, setAnimationPhase] = useState(0); // 0=none, 1=placed, 2=zapp, 3=confirmed
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;

  // Poll for QR Code Payment whenever session with qrId is active
  useEffect(() => {
    if (!paymentSession?.qrId) return;

    const timer = setInterval(() => {
      setQrSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setPaymentSession(null);
          setPaymentHtml(null);
          setProcessing(false);
          Alert.alert('Payment Expired', 'The payment session has expired. Please try placing your order again.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const pollInterval = setInterval(async () => {
      try {
        const check = await paymentApi.checkQrPayment(paymentSession.qrId!);
        if (check.success && check.paid) {
          clearInterval(pollInterval);
          clearInterval(timer);
          const confirmedOrderIds = check.orderIds || paymentSession.dbOrderIds || [];
          setPaymentSession(null);
          setPaymentHtml(null);
          clearCart();

          // Send confirmation email
          try {
            await apiClient.post('/api/send-order-email', { orderIds: confirmedOrderIds });
          } catch {}

          // Success animation
          setAnimationPhase(1);
          triggerPopAnimation();

          setTimeout(() => {
            setAnimationPhase(2);
            triggerPopAnimation();
          }, 1200);

          setTimeout(() => {
            setAnimationPhase(3);
            triggerPopAnimation();
          }, 2600);

          setTimeout(() => {
            setAnimationPhase(0);
            setProcessing(false);
            navigation.replace('OrderTracker', { orderIds: confirmedOrderIds });
          }, 4200);
        }
      } catch (err) {
        console.warn('[QR Poll Error]:', err);
      }
    }, 2500);

    return () => {
      clearInterval(timer);
      clearInterval(pollInterval);
    };
  }, [paymentSession?.qrId]);

  useEffect(() => {
    AsyncStorage.getItem('userAddress').then((v) => v && setAddress(v));
    paymentApi.getDeliveryFee().then(setDeliveryFee).catch(() => setDeliveryFee(0));
    paymentApi.getAllFees().then(setAllFees).catch(() => setAllFees([]));

    const cid = profile?.college_id;
    if (cid) {
      storesApi.getColleges().then(colleges => {
        const c = colleges.find(x => x.id === cid || x._id === cid);
        if (c) {
          setCollegeDetails(c);
          if (c.blocks && c.blocks.length > 0) {
            setSelectedBlock(c.blocks[0]);
          }
        }
      }).catch(() => {});
    }
  }, [profile?.college_id]);

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

  // Compute all fees against the subtotal (after discount)
  let computedFees = allFees.map(f => ({
    name: f.name,
    type: f.type,
    amount: f.type === 'percent'
      ? Math.round((cartTotal * Number(f.value)) / 100)
      : Number(f.value),
  }));

  if (collegeDetails?.blocks && collegeDetails.blocks.length > 0 && selectedBlock && (selectedBlock.deliveryFee || 0) > 0) {
    computedFees.push({ name: `Block Fee (${selectedBlock.name})`, type: 'flat', amount: selectedBlock.deliveryFee || 0 });
  }

  const totalFeesAmount = computedFees.reduce((s, f) => s + f.amount, 0);
  const totalToPay = Math.max(0, cartTotal + totalFeesAmount - discount);

  const legacyDeliveryFee = computedFees.find(f => f.name?.toLowerCase().includes('delivery'))?.amount || deliveryFee;

  const handleCancelPayment = () => {
    Alert.alert(
      'Cancel Payment?',
      'Are you sure you want to cancel this order?',
      [
        { text: 'Continue Payment', style: 'cancel' },
        {
          text: 'Cancel Order',
          style: 'destructive',
          onPress: () => {
            if (paymentSession?.orderId) {
              apiClient.post('/api/orders/cancel-unpaid', { razorpay_order_id: paymentSession.orderId }).catch(() => {});
            }
            setPaymentSession(null);
            setPaymentHtml(null);
            setProcessing(false);
          },
        },
      ]
    );
  };

  const startPayment = async () => {
    const hasBlocks = collegeDetails?.blocks && collegeDetails.blocks.length > 0;
    if (hasBlocks) {
      if (!roomDetails.trim()) {
        Alert.alert('Address Required', 'Please enter your Room / Floor details.');
        return;
      }
    } else {
      if (!address.trim()) {
        Alert.alert('Address Required', 'Please enter your delivery address.');
        return;
      }
    }
    setProcessing(true);

    try {
      const userCollegeId = profile?.college_id || '';

      // 1. Create order on backend (Edge generates Razorpay Order AND QR in parallel!)
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
        address: hasBlocks ? `${selectedBlock?.name || ''}, ${roomDetails.trim()}` : address.trim(),
        deliveryAddress: hasBlocks ? `${selectedBlock?.name || ''}, ${roomDetails.trim()}` : address.trim(),
        deliveryFee: legacyDeliveryFee,
        coupon_code: appliedCoupon?.code,
        couponCode: appliedCoupon?.code,
        additionalNote: additionalNote.trim(),
        college_id: userCollegeId,
      });

      if (!res.success) throw new Error(res.error || 'Failed to create order');

      const razorpayKey = res.key_id;
      if (!razorpayKey) throw new Error('Payment gateway configuration missing. Please retry.');

      // 2. Generate Razorpay Checkout HTML to load in WebView
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
            <p style="color: #9CA3AF; font-size: 14px;">Select your preferred UPI app below.</p>
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
                      postToApp({ status: 'dismissed', razorpay_order_id: "${res.order_id}" });
                    }
                  }
                };

                var rzp = new Razorpay(options);
                rzp.on('payment.failed', function(response) {
                  var errDesc = response.error ? (response.error.description || response.error.reason || 'Payment failed') : 'Payment failed';
                  postToApp({ status: 'failed', razorpay_order_id: "${res.order_id}", error: errDesc });
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
      setPaymentSession({
        orderId: res.order_id,
        keyId: razorpayKey,
        amount: res.amount,
        totalToPay,
        qrId: res.qr_id,
        qrImageUrl: res.qr_image_url,
        dbOrderIds: res.db_order_ids || [],
      });
      setPaymentTab('apps');
      setQrSecondsLeft(900);
    } catch (err: any) {
      let errMsg = err.response?.data?.error || err.response?.data?.message || err.message || 'Could not start payment';
      if (err.message === 'Network Error' || err.code === 'ECONNABORTED') {
        errMsg = 'Connection timed out or network unavailable. Please verify your internet connection and try again.';
      }
      Alert.alert('Payment Error', errMsg);
    } finally {
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
      if (data.status === 'dismissed') {
        Alert.alert(
          'Payment Paused',
          'Would you like to scan a QR code instead, or cancel the order?',
          [
            { text: 'Scan QR Code 📷', onPress: () => setPaymentTab('qr') },
            {
              text: 'Cancel Order',
              style: 'destructive',
              onPress: () => {
                if (data.razorpay_order_id) {
                  apiClient.post('/api/orders/cancel-unpaid', { razorpay_order_id: data.razorpay_order_id }).catch(() => {});
                }
                setPaymentSession(null);
                setPaymentHtml(null);
                setProcessing(false);
              },
            },
          ]
        );
      } else if (data.status === 'cancelled') {
        setPaymentSession(null);
        setPaymentHtml(null);
        setProcessing(false);
        if (data.razorpay_order_id) {
          apiClient.post('/api/orders/cancel-unpaid', { razorpay_order_id: data.razorpay_order_id }).catch(() => {});
        }
        Alert.alert('Cancelled', 'Payment was cancelled.');
      } else if (data.status === 'failed') {
        setPaymentSession(null);
        setPaymentHtml(null);
        setProcessing(false);
        if (data.razorpay_order_id) {
          apiClient.post('/api/orders/cancel-unpaid', { razorpay_order_id: data.razorpay_order_id }).catch(() => {});
        }
        Alert.alert('Payment Failed', data.error || 'Payment failed.');
      } else if (data.status === 'success') {
        setPaymentSession(null);
        setPaymentHtml(null);
        setAnimationPhase(1);
        triggerPopAnimation();

        // Verify Payment
        try {
          const verifyRes = await paymentApi.verifyPayment({
            razorpay_order_id: data.razorpay_order_id,
            razorpay_payment_id: data.razorpay_payment_id,
            razorpay_signature: data.razorpay_signature,
          });

          if (verifyRes.success) {
            clearCart();
            const orderIds = verifyRes.orderIds;

            // Send order confirmation email
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
          } else if (verifyRes.retryable) {
            setAnimationPhase(0);
            setProcessing(false);
            Alert.alert(
              '⚠️ Almost There!',
              `Your payment was received but we had a brief server issue confirming your order.\n\nYour money is SAFE.\n\nPlease wait 30 seconds and tap "Retry" — or contact support with Payment ID:\n${data.razorpay_payment_id}`,
              [
                {
                  text: 'Retry',
                  onPress: async () => {
                    setProcessing(true);
                    try {
                      const retryRes = await paymentApi.verifyPayment({
                        razorpay_order_id: data.razorpay_order_id,
                        razorpay_payment_id: data.razorpay_payment_id,
                        razorpay_signature: data.razorpay_signature,
                      });
                      if (retryRes.success) {
                        clearCart();
                        navigation.replace('OrderTracker', { orderIds: retryRes.orderIds });
                      } else {
                        Alert.alert('Contact Support', `Payment ID: ${data.razorpay_payment_id}\n\nPlease share this with support.`);
                      }
                    } catch {
                      Alert.alert('Contact Support', `Payment ID: ${data.razorpay_payment_id}`);
                    } finally {
                      setProcessing(false);
                    }
                  }
                },
                { text: 'Copy Payment ID', onPress: () => { } },
              ]
            );
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

  // ── UNIFIED PAYMENT SCREEN (UPI APPS & DYNAMIC QR IN ONE MODAL) ───────────
  if (paymentSession && paymentHtml) {
    const mins = Math.floor(qrSecondsLeft / 60);
    const secs = qrSecondsLeft % 60;
    const timeFormatted = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

    return (
      <View style={{ flex: 1, backgroundColor: colors.bgColor }}>
        <View style={{ height: insets.top, backgroundColor: '#0F172A' }} />

        {/* Top Header */}
        <View style={styles.paymentHeader}>
          <TouchableOpacity onPress={handleCancelPayment} style={styles.cancelPaymentBtn}>
            <Text style={styles.cancelPaymentText}>✕ Cancel</Text>
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.paymentHeaderLabel}>AMOUNT TO PAY</Text>
            <Text style={styles.paymentHeaderAmount}>₹{paymentSession.totalToPay}</Text>
          </View>
          <View style={styles.secureBadge}>
            <Text style={styles.secureBadgeText}>🔒 SECURE</Text>
          </View>
        </View>

        {/* Tab Switcher: UPI Apps vs QR Code */}
        <View style={styles.paymentTabsContainer}>
          <TouchableOpacity
            style={[styles.paymentTabBtn, paymentTab === 'apps' && styles.paymentTabBtnActive]}
            onPress={() => setPaymentTab('apps')}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 15, marginRight: 6 }}>📱</Text>
            <Text style={[styles.paymentTabText, paymentTab === 'apps' && styles.paymentTabTextActive]}>
              UPI Apps
            </Text>
            <Text style={[styles.paymentTabSub, paymentTab === 'apps' && styles.paymentTabSubActive]}>
              (This Phone)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.paymentTabBtn, paymentTab === 'qr' && styles.paymentTabBtnActive]}
            onPress={() => setPaymentTab('qr')}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 15, marginRight: 6 }}>📷</Text>
            <Text style={[styles.paymentTabText, paymentTab === 'qr' && styles.paymentTabTextActive]}>
              Scan QR
            </Text>
            <View style={styles.friendMiniBadge}>
              <Text style={styles.friendMiniBadgeText}>Friend</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Unified Main Body — Both kept mounted so state and webview remain intact */}
        <View style={{ flex: 1 }}>
          {/* UPI Apps View */}
          <View style={[{ flex: 1 }, paymentTab !== 'apps' && { display: 'none' }]}>
            <View style={styles.appsHintBanner}>
              <Text style={styles.appsHintText}>
                💡 Select your UPI app below to pay directly on this device:
              </Text>
              <TouchableOpacity onPress={() => setPaymentTab('qr')}>
                <Text style={styles.appsHintLink}>Friend paying? Show QR →</Text>
              </TouchableOpacity>
            </View>
            <WebView
              originWhitelist={['*']}
              source={{ html: paymentHtml, baseUrl: 'https://checkout.razorpay.com' }}
              onMessage={handleWebViewMessage}
              style={{ flex: 1, backgroundColor: colors.bgColor }}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              thirdPartyCookiesEnabled={true}
              mixedContentMode="always"
              startInLoadingState={true}
              renderLoading={() => (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bgColor, justifyContent: 'center', alignItems: 'center' }]}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={{ color: colors.textMuted, marginTop: 12, fontSize: 13 }}>Loading payment options...</Text>
                </View>
              )}
              onError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                console.warn('WebView error: ', nativeEvent);
                Alert.alert('Payment Error', nativeEvent.description || 'Failed to load payment gateway.');
                setPaymentSession(null);
                setPaymentHtml(null);
                setProcessing(false);
              }}
            />
          </View>

          {/* QR Code View */}
          <View style={[{ flex: 1 }, paymentTab !== 'qr' && { display: 'none' }]}>
            <ScrollView
              contentContainerStyle={{ padding: spacing.xl, alignItems: 'center' }}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.qrCard}>
                <View style={styles.qrBadge}>
                  <Text style={styles.qrBadgeText}>👥 FRIEND OR ANY UPI APP CAN PAY</Text>
                </View>
                <Text style={styles.qrTitle}>Scan UPI QR Code</Text>
                <Text style={styles.qrSubtitle}>
                  Scan with Google Pay, PhonePe, Paytm, BHIM, CRED or any banking app on any phone.
                </Text>

                {/* QR Code Container - Cropped to show ONLY the big, clean QR code */}
                <View style={styles.qrImageContainer}>
                  {paymentSession.qrImageUrl || paymentSession.qrId ? (
                    <View style={styles.qrCropWindow}>
                      <Image
                        source={{
                          uri: paymentSession.qrId
                            ? `https://api.razorpay.com/v1/l/qrcode/${paymentSession.qrId}`
                            : paymentSession.qrImageUrl,
                        }}
                        style={styles.qrCroppedImage}
                        resizeMode="cover"
                      />
                    </View>
                  ) : (
                    <ActivityIndicator size="large" color={colors.primary} />
                  )}
                </View>

                {/* Total to pay amount badge */}
                <View style={styles.qrAmountBox}>
                  <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '700', letterSpacing: 1 }}>
                    EXACT AMOUNT TO PAY
                  </Text>
                  <Text style={{ fontSize: 32, fontWeight: '900', color: colors.primary, marginTop: 4 }}>
                    ₹{paymentSession.totalToPay}
                  </Text>
                </View>

                {/* Live Polling Status */}
                <View style={styles.qrStatusRow}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.qrStatusText}>
                    Listening for payment... ({timeFormatted})
                  </Text>
                </View>

                {/* Supported UPI Badges */}
                <View style={styles.upiBadgesRow}>
                  <View style={styles.upiBadgeItem}><Text style={styles.upiBadgeText}>GPay</Text></View>
                  <View style={styles.upiBadgeItem}><Text style={styles.upiBadgeText}>PhonePe</Text></View>
                  <View style={styles.upiBadgeItem}><Text style={styles.upiBadgeText}>Paytm</Text></View>
                  <View style={styles.upiBadgeItem}><Text style={styles.upiBadgeText}>BHIM</Text></View>
                  <View style={styles.upiBadgeItem}><Text style={styles.upiBadgeText}>Cred</Text></View>
                </View>

                {/* Switch back to UPI Apps */}
                <TouchableOpacity
                  style={styles.switchModeBtn}
                  onPress={() => setPaymentTab('apps')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.switchModeText}>📱 Pay with UPI App on this phone instead</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelQrBtn}
                  onPress={handleCancelPayment}
                >
                  <Text style={styles.cancelQrText}>Cancel Order</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </View>
    );
  }

  // ── MAIN CHECKOUT SCREEN ──────────────────────────────────────────────────
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
          
          {collegeDetails?.blocks && collegeDetails.blocks.length > 0 ? (
            <>
              <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 8 }}>Select Block / Hostel</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
                {collegeDetails.blocks.map((b: any, i: number) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => setSelectedBlock(b)}
                    style={{
                      paddingHorizontal: 16, paddingVertical: 10,
                      borderRadius: radius.md, borderWidth: 1,
                      borderColor: selectedBlock?.name === b.name ? colors.primary : colors.borderColor,
                      backgroundColor: selectedBlock?.name === b.name ? 'rgba(255,193,7,0.1)' : colors.bgColor,
                      marginRight: 8,
                    }}
                  >
                    <Text style={{ color: selectedBlock?.name === b.name ? colors.primary : colors.textMain, fontWeight: '600' }}>
                      {b.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              
              <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 8 }}>Floor & Room No.</Text>
              <View style={styles.inputWrapper}>
                <Text style={{ fontSize: 18, marginRight: 8 }}>🚪</Text>
                <TextInput
                  style={styles.input}
                  value={roomDetails}
                  onChangeText={setRoomDetails}
                  placeholder="e.g. 2nd Floor, Room 204"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </>
          ) : (
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
          )}
        </View>

        {/* Additional Note */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Additional Note</Text>
          <View style={styles.inputWrapper}>
            <Text style={{ fontSize: 18, marginRight: 8 }}>📝</Text>
            <TextInput
              style={styles.input}
              value={additionalNote}
              onChangeText={setAdditionalNote}
              placeholder="e.g. Extra chutney, less spicy"
              placeholderTextColor={colors.textMuted}
              maxLength={150}
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

        {/* Bill Summary */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Bill Summary</Text>
          <View style={styles.billRow}>
            <Text style={styles.billText}>Item Total</Text>
            <Text style={styles.billText}>₹{cartTotal}</Text>
          </View>
          {computedFees.map((fee, i) => (
            <View key={i} style={styles.billRow}>
              <Text style={styles.billText}>{fee.name}</Text>
              <Text style={styles.billText}>₹{fee.amount}</Text>
            </View>
          ))}
          {/* Fallback: show delivery fee if allFees not loaded yet */}
          {computedFees.length === 0 && deliveryFee > 0 && (
            <View style={styles.billRow}>
              <Text style={styles.billText}>Delivery Fee</Text>
              <Text style={styles.billText}>₹{deliveryFee}</Text>
            </View>
          )}
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
          onPress={() => startPayment()}
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

  // Unified Payment Header & Switcher Styles
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderColor,
  },
  cancelPaymentBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  cancelPaymentText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '700',
  },
  paymentHeaderLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  paymentHeaderAmount: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.primary,
  },
  secureBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  secureBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.success,
  },

  paymentTabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    padding: 6,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
    borderRadius: 14,
    gap: 8,
  },
  paymentTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'transparent',
  },
  paymentTabBtnActive: {
    backgroundColor: colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  paymentTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  paymentTabTextActive: {
    color: '#000',
    fontWeight: '800',
  },
  paymentTabSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginLeft: 4,
  },
  paymentTabSubActive: {
    color: '#1E293B',
    fontWeight: '700',
  },
  friendMiniBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 5,
  },
  friendMiniBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.success,
  },

  appsHintBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 193, 7, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 193, 7, 0.2)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
  },
  appsHintText: {
    fontSize: 11,
    color: colors.textMain,
    flex: 1,
    fontWeight: '500',
  },
  appsHintLink: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '800',
    marginLeft: 8,
  },

  // QR Screen Styles
  qrCard: {
    backgroundColor: colors.cardBg, borderRadius: 20,
    padding: 24, width: '100%', maxWidth: 360,
    alignItems: 'center', borderWidth: 1, borderColor: colors.borderColor,
  },
  qrBadge: {
    backgroundColor: 'rgba(255,193,7,0.15)',
    paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 20, marginBottom: 10,
    borderWidth: 1, borderColor: colors.primary,
  },
  qrBadgeText: { color: colors.primary, fontWeight: '800', fontSize: 11, letterSpacing: 1 },
  qrTitle: { fontSize: 22, fontWeight: '900', color: colors.textMain, textAlign: 'center' },
  qrSubtitle: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 6, paddingHorizontal: 10 },
  qrImageContainer: {
    backgroundColor: '#FFFFFF', padding: 10,
    borderRadius: 20, marginVertical: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  qrCropWindow: {
    width: 260,
    height: 260,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#FFFFFF',
  },
  qrCroppedImage: {
    width: 419,
    height: 1021,
    position: 'absolute',
    top: -397,
    left: -80,
  },
  qrAmountBox: {
    alignItems: 'center', backgroundColor: colors.bgColor,
    paddingVertical: 10, paddingHorizontal: 28,
    borderRadius: 12, borderWidth: 1, borderColor: colors.borderColor,
    marginBottom: 8,
  },
  qrStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 8 },
  qrStatusText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  upiBadgesRow: { flexDirection: 'row', gap: 6, marginTop: 4, marginBottom: 16, flexWrap: 'wrap', justifyContent: 'center' },
  upiBadgeItem: {
    backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 8,
    paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: colors.borderColor,
  },
  upiBadgeText: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  switchModeBtn: {
    backgroundColor: 'rgba(255,193,7,0.12)', paddingVertical: 12,
    paddingHorizontal: 16, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.primary,
    width: '100%', alignItems: 'center', marginBottom: 10,
  },
  switchModeText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  cancelQrBtn: { paddingVertical: 8 },
  cancelQrText: { color: colors.error, fontSize: 13, fontWeight: '600' },
});

export default CheckoutScreen;
