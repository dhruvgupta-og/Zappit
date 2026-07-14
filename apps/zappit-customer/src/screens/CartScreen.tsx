import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useCartStore } from '../store/cartStore';
import { colors } from '../theme/colors';
import { typography, spacing, radius } from '../theme/typography';
import { paymentApi } from '../api/payment';
import { SafeAreaView } from 'react-native-safe-area-context';

const CartScreen = () => {
  const navigation = useNavigation<any>();
  const cartItems = useCartStore((state) => state.getCartItems());
  const cartTotal = useCartStore((state) => state.getCartTotal());
  const storeName = useCartStore((state) => state.getCartStoreName());
  const storeId = useCartStore((state) => state.getCartStoreId());
  const addToCart = useCartStore((state) => state.addToCart);
  const removeFromCart = useCartStore((state) => state.removeFromCart);
  const clearCart = useCartStore((state) => state.clearCart);

  const [deliveryFee, setDeliveryFee] = useState(0);

  useEffect(() => {
    paymentApi.getDeliveryFee().then(setDeliveryFee).catch(() => setDeliveryFee(20));
  }, []);

  if (cartItems.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Cart</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>🛒</Text>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptyText}>Looks like you haven't added anything yet.</Text>
          <TouchableOpacity style={styles.browseBtn} onPress={() => navigation.navigate('Home')}>
            <Text style={styles.browseBtnText}>Browse Restaurants</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={{ fontSize: 20, color: colors.textMain }}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Cart</Text>
        <TouchableOpacity onPress={() => clearCart()}>
          <Text style={styles.clearText}>Clear</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.xl }}>
        <View style={styles.storeCard}>
          <Text style={styles.storeLabel}>ORDERING FROM</Text>
          <Text style={styles.storeName}>{storeName}</Text>
        </View>

        <View style={styles.itemsCard}>
          {cartItems.map((item) => (
            <View key={item.menuItem.id || item.menuItem._id} style={styles.itemRow}>
              <View style={styles.itemInfo}>
                <View style={[styles.vegIndicator, { borderColor: item.menuItem.isVeg ? colors.vegGreen : colors.nonVegRed }]}>
                  <View style={[styles.vegDot, { backgroundColor: item.menuItem.isVeg ? colors.vegGreen : colors.nonVegRed }]} />
                </View>
                <Text style={styles.itemName}>{item.menuItem.name}</Text>
                <Text style={styles.itemPrice}>₹{item.menuItem.price}</Text>
              </View>
              <View style={styles.qtyControl}>
                <TouchableOpacity onPress={() => removeFromCart(item.menuItem, storeId!)} style={styles.qtyBtn}>
                  <Text style={styles.qtyBtnText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.qtyText}>{item.qty}</Text>
                <TouchableOpacity onPress={() => addToCart(item.menuItem, storeId!, storeName!)} style={styles.qtyBtn}>
                  <Text style={styles.qtyBtnText}>+</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.itemTotal}>₹{item.menuItem.price * item.qty}</Text>
            </View>
          ))}
        </View>

        <View style={styles.billCard}>
          <Text style={styles.billTitle}>Bill Details</Text>
          <View style={[styles.billRow, { marginBottom: 8 }]}>
            <Text style={styles.billText}>Item Total</Text>
            <Text style={styles.billText}>₹{cartTotal}</Text>
          </View>
          <View style={[styles.billRow, { marginBottom: 8 }]}>
            <Text style={styles.billText}>Delivery Fee</Text>
            <Text style={styles.billText}>₹{deliveryFee}</Text>
          </View>
          <View style={{ height: 1, backgroundColor: colors.borderColor, marginVertical: 12 }} />
          <View style={styles.billRow}>
            <Text style={styles.billTextBold}>To Pay</Text>
            <Text style={styles.billTextBold}>₹{cartTotal + deliveryFee}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.checkoutBtn} onPress={() => navigation.navigate('Checkout')} activeOpacity={0.9}>
          <Text style={styles.checkoutBtnText}>Proceed to Checkout • ₹{cartTotal + deliveryFee}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
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
  clearText: { color: colors.error, fontWeight: '600' },
  
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xxl },
  emptyTitle: { ...typography.h2, color: colors.textMain, marginBottom: 8 },
  emptyText: { color: colors.textMuted, marginBottom: spacing.xxl, textAlign: 'center' },
  browseBtn: { backgroundColor: colors.primaryDark, paddingHorizontal: 24, paddingVertical: 14, borderRadius: radius.md },
  browseBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  storeCard: {
    backgroundColor: colors.cardBg, padding: spacing.lg, borderRadius: radius.md,
    marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.borderColor,
  },
  storeLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 4 },
  storeName: { ...typography.h3, color: colors.textMain },

  itemsCard: {
    backgroundColor: colors.cardBg, padding: spacing.lg, borderRadius: radius.md,
    marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.borderColor,
  },
  itemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  itemInfo: { flex: 1 },
  vegIndicator: {
    width: 12, height: 12, borderWidth: 1, borderRadius: 3,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  vegDot: { width: 6, height: 6, borderRadius: 3 },
  itemName: { fontSize: 15, fontWeight: '600', color: colors.textMain, marginBottom: 2 },
  itemPrice: { fontSize: 13, color: colors.textMuted },
  
  qtyControl: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgColor, borderWidth: 1, borderColor: colors.borderColor,
    borderRadius: radius.sm, height: 32, marginHorizontal: spacing.md,
  },
  qtyBtn: { width: 28, height: 32, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { color: colors.primary, fontSize: 18, fontWeight: '600' },
  qtyText: { color: colors.textMain, fontWeight: '700', fontSize: 14, width: 20, textAlign: 'center' },
  itemTotal: { width: 50, textAlign: 'right', fontSize: 15, fontWeight: '600', color: colors.textMain },

  billCard: {
    backgroundColor: colors.cardBg, padding: spacing.lg, borderRadius: radius.md,
    marginBottom: spacing.xxl, borderWidth: 1, borderColor: colors.borderColor,
  },
  billTitle: { fontSize: 15, fontWeight: '700', color: colors.textMain, marginBottom: spacing.md },
  billRow: { flexDirection: 'row', justifyContent: 'space-between' },
  billText: { fontSize: 14, color: colors.textMuted },
  billTextBold: { fontSize: 16, fontWeight: '700', color: colors.textMain },

  footer: {
    padding: spacing.xl, paddingBottom: spacing.xl + 20,
    backgroundColor: colors.cardBg, borderTopWidth: 1, borderTopColor: colors.borderColor,
  },
  checkoutBtn: {
    backgroundColor: colors.primaryDark, borderRadius: radius.md,
    paddingVertical: 16, alignItems: 'center',
  },
  checkoutBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

export default CartScreen;
