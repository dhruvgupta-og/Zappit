import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Image,
  ActivityIndicator, RefreshControl, ScrollView, Dimensions, Animated,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { storesApi } from '../api/stores';
import { useAuthStore } from '../store/authStore';
import { colors } from '../theme/colors';
import { typography, spacing, radius } from '../theme/typography';
import { Store, Banner } from '../types';
import { StoreCardSkeleton } from '../components/Skeleton';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BANNER_HEIGHT = (SCREEN_WIDTH - 40) / 3;
const CATEGORIES = ['All', 'Snacks', 'Meals', 'Drinks', 'Healthy'];
const POPULAR_CRAVINGS = ['Maggi', 'Cold Coffee', 'Sandwich', 'Burger', 'Biryani', 'Chai', 'Rolls', 'Pizza'];

const toTitleCase = (str: string) => {
  return str
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const HomeScreen = ({ navigation }: any) => {
  const [stores, setStores] = useState<Store[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [address, setAddress] = useState('Engineering Block A');
  const [collegeName, setCollegeName] = useState('Campus');
  const [collegeId, setCollegeId] = useState('');
  
  const { profile } = useAuthStore();
  const activeCollegeId = profile?.college_id || collegeId;
  const activeCollegeName = profile?.college_name || profile?.college || collegeName;
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [isEditingAddress, setIsEditingAddress] = useState(false);

  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const [storesData, bannersData] = await Promise.all([
        storesApi.getAll(),
        storesApi.getActiveBanners(),
      ]);
      setStores(storesData);
      setBanners(bannersData);
    } catch (err) {
      console.error('Failed to fetch home data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Load persisted address
    AsyncStorage.getItem('userAddress').then((v) => v && setAddress(v));
    AsyncStorage.getItem('userCollegeName').then((v) => v && setCollegeName(v));
    AsyncStorage.getItem('userCollegeId').then((v) => v && setCollegeId(v));
  }, []);

  // Banner auto-scroll
  useEffect(() => {
    if (banners.length <= 1) return;
    bannerTimer.current = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % banners.length);
    }, 7000);
    return () => { if (bannerTimer.current) clearInterval(bannerTimer.current); };
  }, [banners.length]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredStores = useMemo(() => {
    return stores.filter((store) => {
      const matchesSearch =
        !normalizedQuery ||
        store.name.toLowerCase().includes(normalizedQuery) ||
        (store.menuItemsForSearch &&
          store.menuItemsForSearch.some((item) =>
            item.toLowerCase().includes(normalizedQuery)
          )) ||
        (store.tags &&
          store.tags.some((tag) =>
            tag.toLowerCase().includes(normalizedQuery)
          ));

      const matchesCategory =
        activeCategory === 'All' || (store.tags && store.tags.includes(activeCategory));
      const matchesCollege = 
        !activeCollegeId || !store.college_id || store.college_id === activeCollegeId;

      return matchesSearch && matchesCategory && matchesCollege;
    });
  }, [stores, normalizedQuery, activeCategory, activeCollegeId]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData(false);
  };

  const renderBannerCarousel = () => {
    if (banners.length === 0) return null;
    return (
      <View style={styles.bannerContainer}>
        <ScrollView
          horizontal pagingEnabled showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / (SCREEN_WIDTH - 40));
            setCurrentBannerIndex(idx);
          }}
          contentOffset={{ x: currentBannerIndex * (SCREEN_WIDTH - 40), y: 0 }}
        >
          {banners.map((b, i) => (
            <TouchableOpacity key={b.id || i} activeOpacity={0.9} style={{ width: SCREEN_WIDTH - 40 }}>
              <Image
                source={{ uri: b.image || b.imageUrl }}
                style={styles.bannerImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          ))}
        </ScrollView>
        {/* Dots */}
        <View style={styles.dotsRow}>
          {banners.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                currentBannerIndex === i ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>
      </View>
    );
  };

  const renderStoreCard = ({ item: store }: { item: Store }) => {
    const matchingDishes =
      normalizedQuery && store.menuItemsForSearch
        ? store.menuItemsForSearch
            .filter((dish) => dish.toLowerCase().includes(normalizedQuery))
            .slice(0, 3)
            .map(toTitleCase)
        : [];
    const totalMatchingCount =
      normalizedQuery && store.menuItemsForSearch
        ? store.menuItemsForSearch.filter((dish) =>
            dish.toLowerCase().includes(normalizedQuery)
          ).length
        : 0;

    return (
      <TouchableOpacity
        style={[styles.storeCard, !store.is_open && { opacity: 0.6 }]}
        onPress={() => {
          try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
          navigation.navigate('StoreDetail', { storeId: store.id || store._id });
        }}
        activeOpacity={0.85}
      >
        <View style={styles.storeImageContainer}>
          <Image
            source={{ uri: store.image || 'https://images.unsplash.com/photo-1550547660-d9450f859349?q=80&w=400&auto=format&fit=crop' }}
            style={styles.storeImage}
            resizeMode="cover"
          />
          {!store.is_open && (
            <View style={styles.closedOverlay}>
              <Text style={styles.closedText}>CLOSED</Text>
            </View>
          )}
          {store.rating && (
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={11} color="#F59E0B" style={{ marginRight: 3 }} />
              <Text style={styles.ratingText}>{store.rating}</Text>
            </View>
          )}
        </View>
        <View style={styles.storeInfo}>
          <View style={styles.storeRow}>
            <View style={{ flex: 1, paddingRight: spacing.sm }}>
              <Text style={styles.storeName} numberOfLines={1}>{store.name}</Text>
              {store.is_open && store.active_orders_count !== undefined && (
                <View style={styles.queueRow}>
                  <Ionicons
                    name={store.active_orders_count === 0 ? "flash" : "flame"}
                    size={12}
                    color={store.active_orders_count > 3 ? '#EF4444' : '#10B981'}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[styles.queueText, store.active_orders_count > 3 && styles.queueTextBusy]}>
                    {store.active_orders_count === 0
                      ? '0 orders in queue'
                      : `${store.active_orders_count} orders in kitchen`}
                  </Text>
                </View>
              )}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              {store.delivery_time_mins && (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="time-outline" size={12} color={colors.textMuted} style={{ marginRight: 3 }} />
                  <Text style={styles.deliveryTime}>{store.delivery_time_mins} mins</Text>
                </View>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                <Ionicons name="location-outline" size={11} color={colors.textMuted} style={{ marginRight: 2 }} />
                <Text style={styles.collegeBadge}>{store.college_name || 'All Campuses'}</Text>
              </View>
            </View>
          </View>

          {/* Deep Dish Search Match Badge */}
          {matchingDishes.length > 0 && (
            <View style={styles.dishMatchBadge}>
              <Ionicons name="restaurant" size={12} color={colors.primary} style={{ marginRight: 5 }} />
              <Text style={styles.dishMatchText} numberOfLines={1}>
                Serves: <Text style={styles.dishMatchNames}>{matchingDishes.join(', ')}</Text>
                {totalMatchingCount > 3 ? ` +${totalMatchingCount - 3} more` : ''}
              </Text>
            </View>
          )}

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
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
            <Ionicons name="location-sharp" size={12} color={colors.primary} style={{ marginRight: 4 }} />
            <Text style={styles.headerLabel}>DELIVERING TO</Text>
          </View>
          {isEditingAddress ? (
            <TextInput
              style={[styles.headerAddress, { borderBottomWidth: 1, borderBottomColor: colors.primary, padding: 0 }]}
              value={address}
              onChangeText={setAddress}
              autoFocus
              onBlur={() => {
                setIsEditingAddress(false);
                AsyncStorage.setItem('userAddress', address);
              }}
              onSubmitEditing={() => {
                setIsEditingAddress(false);
                AsyncStorage.setItem('userAddress', address);
              }}
            />
          ) : (
            <TouchableOpacity onPress={() => setIsEditingAddress(true)} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.headerAddress} numberOfLines={1}>{address}</Text>
              <Ionicons name="pencil" size={13} color={colors.textMuted} style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          )}
          <Text style={styles.headerCollege} numberOfLines={1}>{activeCollegeName}</Text>
        </View>
        <TouchableOpacity
          style={styles.profileBtn}
          onPress={() => {
            try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
            navigation.navigate('Profile');
          }}
        >
          <Ionicons name="person" size={18} color="#FFF" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredStores}
        keyExtractor={(item) => item.id || item._id || item.name}
        renderItem={renderStoreCard}
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
              onRefresh();
            }}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <>
            {renderBannerCarousel()}

            {/* Search */}
            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search dishes (Maggi, Coffee...) or stores"
                placeholderTextColor={colors.textMuted}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    try { Haptics.selectionAsync(); } catch {}
                    setSearchQuery('');
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={{ padding: 2 }}
                >
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Popular Campus Craving Chips */}
            <View style={styles.cravingsRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 6 }}>
                {POPULAR_CRAVINGS.map((craving) => {
                  const isSelected = searchQuery.trim().toLowerCase() === craving.toLowerCase();
                  return (
                    <TouchableOpacity
                      key={craving}
                      style={[styles.cravingChip, isSelected && styles.cravingChipActive]}
                      onPress={() => {
                        try { Haptics.selectionAsync(); } catch {}
                        setSearchQuery(isSelected ? '' : craving);
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={isSelected ? "checkmark-circle" : "restaurant-outline"}
                        size={12}
                        color={isSelected ? '#131E3A' : colors.primary}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={[styles.cravingText, isSelected && styles.cravingTextActive]}>
                        {craving}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Categories */}
            <Text style={styles.sectionTitle}>Categories</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.xxl }}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryChip, activeCategory === cat && styles.categoryChipActive]}
                  onPress={() => {
                    try { Haptics.selectionAsync(); } catch {}
                    setActiveCategory(cat);
                  }}
                >
                  <Text style={[styles.categoryText, activeCategory === cat && styles.categoryTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.sectionTitle}>
              {searchQuery.trim()
                ? `Results for "${searchQuery.trim()}"`
                : 'Restaurants near you'}
            </Text>
          </>
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ paddingTop: 8 }}>
              <StoreCardSkeleton />
              <StoreCardSkeleton />
              <StoreCardSkeleton />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons
                name={searchQuery.trim() ? "search-outline" : "restaurant-outline"}
                size={48}
                color={colors.textMuted}
                style={{ marginBottom: 12 }}
              />
              <Text style={styles.emptyTitle}>
                {searchQuery.trim() ? `No results for "${searchQuery.trim()}"` : 'No matches found'}
              </Text>
              <Text style={styles.emptyText}>
                {searchQuery.trim()
                  ? 'No campus stores are serving this dish right now. Try searching for "Maggi" or "Coffee".'
                  : 'Try searching for a different keyword or category.'}
              </Text>
              {Boolean(searchQuery.trim() || activeCategory !== 'All') && (
                <TouchableOpacity
                  style={styles.clearSearchBtn}
                  onPress={() => {
                    try { Haptics.selectionAsync(); } catch {}
                    setSearchQuery('');
                    setActiveCategory('All');
                  }}
                >
                  <Text style={styles.clearSearchText}>Clear Search & Filters</Text>
                </TouchableOpacity>
              )}
            </View>
          )
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgColor },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.xl, paddingTop: 56, paddingBottom: spacing.lg,
    backgroundColor: 'rgba(19,30,58,0.95)', borderBottomWidth: 1, borderBottomColor: colors.borderColor,
  },
  headerLabel: {
    color: colors.primary, fontWeight: '700', fontSize: 11,
    letterSpacing: 0.5, marginBottom: 2,
  },
  headerAddress: { ...typography.h3, color: colors.textMain },
  headerCollege: { fontSize: 12, color: colors.textMuted, fontWeight: '500', marginTop: 1 },
  profileBtn: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primaryDark,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10,
    elevation: 6,
  },

  bannerContainer: {
    marginBottom: spacing.xxl, borderRadius: radius.lg, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6,
    elevation: 4,
  },
  bannerImage: { width: SCREEN_WIDTH - 40, height: BANNER_HEIGHT, borderRadius: radius.lg },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: spacing.sm },
  dot: { height: 5, borderRadius: 10 },
  dotActive: { width: 18, backgroundColor: '#fff' },
  dotInactive: { width: 5, backgroundColor: 'rgba(255,255,255,0.4)' },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.cardBg, padding: spacing.md, paddingHorizontal: spacing.lg,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderColor,
    marginBottom: spacing.md,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.textMain },

  cravingsRow: {
    marginBottom: spacing.xl,
  },
  cravingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderColor: colors.borderColor,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.full,
  },
  cravingChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  cravingText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  cravingTextActive: {
    color: '#131E3A',
    fontWeight: '800',
  },

  sectionTitle: { ...typography.h3, color: colors.textMain, marginBottom: spacing.lg },

  categoryChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.full,
    backgroundColor: colors.bgColor, marginRight: spacing.sm,
  },
  categoryChipActive: { backgroundColor: 'rgba(255,193,7,0.1)' },
  categoryText: { ...typography.buttonSmall, color: colors.textMuted },
  categoryTextActive: { color: colors.primary },

  storeCard: {
    backgroundColor: colors.cardBg, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.borderColor, overflow: 'hidden', marginBottom: spacing.lg,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3,
  },
  storeImageContainer: { position: 'relative', height: 160 },
  storeImage: { width: '100%', height: '100%' },
  closedOverlay: {
    ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  closedText: { color: '#fff', fontWeight: '700', fontSize: 20, padding: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8 },
  ratingBadge: {
    position: 'absolute', top: 12, right: 12,
    backgroundColor: colors.bgColor, paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8,
  },
  ratingText: { fontSize: 14, fontWeight: '600', color: colors.textMain },

  storeInfo: { padding: spacing.lg },
  storeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  storeName: { ...typography.h4, color: colors.textMain, marginRight: spacing.sm },
  queueRow: { marginTop: 3 },
  queueText: { fontSize: 11, fontWeight: '700', color: colors.success },
  queueTextBusy: { color: '#F59E0B' },
  deliveryTime: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },
  collegeBadge: { fontSize: 11, color: colors.primary, fontWeight: '700', marginTop: 2 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full,
    backgroundColor: colors.bgColor,
  },
  tagText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },

  dishMatchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    borderColor: 'rgba(255, 193, 7, 0.3)',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: spacing.sm,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  dishMatchText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
  },
  dishMatchNames: {
    color: colors.textMain,
    fontWeight: '700',
  },

  emptyState: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: spacing.lg },
  emptyTitle: { ...typography.h3, color: colors.textMain, marginBottom: spacing.sm, textAlign: 'center' },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  clearSearchBtn: {
    marginTop: 16,
    backgroundColor: 'rgba(255, 193, 7, 0.15)',
    borderColor: colors.primary,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radius.md,
  },
  clearSearchText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
});

export default HomeScreen;

