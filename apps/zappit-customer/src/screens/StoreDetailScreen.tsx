import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, ScrollView, Image, TouchableOpacity,
  Platform,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { storesApi } from '../api/stores';
import { useCartStore } from '../store/cartStore';
import { colors } from '../theme/colors';
import { typography, spacing, radius } from '../theme/typography';
import { Store, MenuItem } from '../types';

const StoreDetailScreen = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { storeId } = route.params;

  const [store, setStore] = useState<Store | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  const cartItems = useCartStore((state) => state.items);
  const addToCart = useCartStore((state) => state.addToCart);
  const removeFromCart = useCartStore((state) => state.removeFromCart);
  const getCartCount = useCartStore((state) => state.getCartCount);
  const getCartTotal = useCartStore((state) => state.getCartTotal);

  useEffect(() => {
    const fetchStore = async () => {
      try {
        const { store: s, menu: m } = await storesApi.getById(storeId);
        setStore(s);
        setMenu(m);
      } catch (err) {
        console.error('Failed to fetch store details', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStore();
  }, [storeId]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!store) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={{ color: colors.textMain }}>Store not found.</Text>
      </View>
    );
  }

  const cartCount = getCartCount();

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: cartCount > 0 ? 120 : spacing.xxl }}
      >
        {/* Cover Image */}
        <View style={styles.coverContainer}>
          <Image source={{ uri: store.image }} style={styles.coverImage} />
          <View style={[styles.headerOverlay, { paddingTop: Math.max(insets.top, 16) }]}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
              <Text style={{ fontSize: 18, color: '#fff' }}>←</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn}>
              <Text style={{ fontSize: 18, color: '#fff' }}>ℹ️</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Info Card */}
        <View style={styles.infoWrapper}>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.storeName}>{store.name}</Text>
                <View style={styles.statsRow}>
                  {store.rating && (
                    <Text style={styles.statText}>
                      <Text style={{ color: colors.success }}>⭐ {store.rating}</Text>
                    </Text>
                  )}
                  {store.rating && <Text style={styles.statDot}> • </Text>}
                  {store.delivery_time_mins && (
                    <Text style={styles.statText}>🕐 {store.delivery_time_mins} mins</Text>
                  )}
                </View>
              </View>
              {!store.is_open && (
                <View style={styles.closedBadge}>
                  <Text style={styles.closedBadgeText}>CLOSED</Text>
                </View>
              )}
            </View>
            {store.tags && store.tags.length > 0 && (
              <View style={styles.tagsRow}>
                {store.tags.map((tag) => (
                  <View key={tag} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {!store.is_open && (
          <View style={styles.closedNotice}>
            <Text style={styles.closedNoticeText}>This store is currently not accepting orders.</Text>
          </View>
        )}

        {/* Menu Section */}
        <View style={styles.menuContainer}>
          <Text style={styles.menuTitle}>Menu</Text>
          {menu.map((item) => {
            const itemId = item.id || item._id;
            const sId = store.id || store._id;
            const inCart = cartItems[`${sId}_${itemId}`];

            return (
              <View
                key={itemId}
                style={[styles.menuItem, !store.is_open && { opacity: 0.6 }]}
              >
                <View style={styles.menuItemInfo}>
                  {/* Veg/Non-veg indicator */}
                  <View style={[styles.vegIndicator, { borderColor: item.isVeg ? colors.vegGreen : colors.nonVegRed }]}>
                    <View style={[styles.vegDot, { backgroundColor: item.isVeg ? colors.vegGreen : colors.nonVegRed }]} />
                  </View>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemPrice}>₹{item.price}</Text>
                  <Text style={styles.itemDesc} numberOfLines={2}>{item.desc || item.description}</Text>
                </View>
                <View style={styles.menuItemRight}>
                  <Image source={{ uri: item.image }} style={styles.itemImage} />
                  <View style={styles.actionContainer}>
                    {store.is_open ? (
                      inCart ? (
                        <View style={styles.qtyControl}>
                          <TouchableOpacity onPress={() => removeFromCart(item, sId!)} style={styles.qtyBtn}>
                            <Text style={styles.qtyBtnText}>-</Text>
                          </TouchableOpacity>
                          <Text style={styles.qtyText}>{inCart.qty}</Text>
                          <TouchableOpacity onPress={() => addToCart(item, sId!, store.name)} style={styles.qtyBtn}>
                            <Text style={styles.qtyBtnText}>+</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.addBtn}
                          onPress={() => addToCart(item, sId!, store.name)}
                        >
                          <Text style={styles.addBtnText}>ADD</Text>
                        </TouchableOpacity>
                      )
                    ) : (
                      <View style={styles.closedItemBadge}>
                        <Text style={styles.closedItemText}>CLOSED</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Sticky Cart Footer */}
      {cartCount > 0 && (
        <View style={[styles.cartFooter, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <TouchableOpacity
            style={styles.cartBtn}
            onPress={() => navigation.navigate('Cart')}
            activeOpacity={0.9}
          >
            <View>
              <Text style={styles.cartItemsText}>{cartCount} ITEM{cartCount > 1 ? 'S' : ''}</Text>
              <Text style={styles.cartTotalText}>₹{getCartTotal()}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.cartActionText}>Proceed to Pay</Text>
              <Text style={{ color: '#fff', fontSize: 16, marginLeft: 8 }}>→</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgColor },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bgColor },
  coverContainer: { height: 220, position: 'relative' },
  coverImage: { width: '100%', height: '100%' },
  headerOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.lg,
    paddingBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },

  infoWrapper: { marginTop: -40, paddingHorizontal: spacing.xl, zIndex: 10 },
  infoCard: {
    backgroundColor: colors.cardBg, borderRadius: radius.lg, padding: spacing.lg,
    borderWidth: 1, borderColor: colors.borderColor,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  storeName: { ...typography.h2, color: colors.textMain, marginBottom: 4 },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  statText: { fontSize: 14, color: colors.textMuted, fontWeight: '600' },
  statDot: { color: colors.textMuted, marginHorizontal: 4 },
  closedBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  closedBadgeText: { color: '#991B1B', fontSize: 12, fontWeight: '800' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { backgroundColor: colors.bgColor, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  tagText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },

  closedNotice: {
    margin: spacing.xl, backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
    padding: spacing.md, borderRadius: radius.md, alignItems: 'center',
  },
  closedNoticeText: { color: colors.error, fontWeight: '700', fontSize: 14 },

  menuContainer: { padding: spacing.xl },
  menuTitle: { ...typography.h3, color: colors.textMain, marginBottom: spacing.lg },
  menuItem: {
    flexDirection: 'row', justifyContent: 'space-between',
    borderBottomWidth: 1, borderBottomColor: colors.borderColor,
    paddingBottom: spacing.xxl, marginBottom: spacing.xxl,
  },
  menuItemInfo: { flex: 1, paddingRight: spacing.lg },
  vegIndicator: {
    width: 16, height: 16, borderWidth: 1, borderRadius: 4,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm,
  },
  vegDot: { width: 8, height: 8, borderRadius: 4 },
  itemName: { ...typography.h4, color: colors.textMain, marginBottom: 4 },
  itemPrice: { fontSize: 15, fontWeight: '600', color: colors.textMain, marginBottom: spacing.sm },
  itemDesc: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },

  menuItemRight: { width: 110, alignItems: 'center' },
  itemImage: { width: 110, height: 100, borderRadius: radius.md, backgroundColor: colors.borderColor },
  actionContainer: { position: 'absolute', bottom: -14, width: 96 },
  addBtn: {
    backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.primary,
    borderRadius: radius.sm, height: 36, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 2,
  },
  addBtnText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  qtyControl: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.primary,
    borderRadius: radius.sm, height: 36, paddingHorizontal: 4,
  },
  qtyBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { color: colors.primary, fontSize: 18, fontWeight: '600' },
  qtyText: { color: colors.primary, fontWeight: '800', fontSize: 15 },
  closedItemBadge: {
    backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0',
    borderRadius: radius.sm, height: 36, alignItems: 'center', justifyContent: 'center',
  },
  closedItemText: { color: '#94A3B8', fontSize: 11, fontWeight: '800' },

  cartFooter: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'transparent', paddingHorizontal: spacing.xl,
  },
  cartBtn: {
    backgroundColor: colors.primaryDark, borderRadius: radius.lg,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.lg,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 6,
  },
  cartItemsText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  cartTotalText: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 2 },
  cartActionText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

export default StoreDetailScreen;
