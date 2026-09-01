import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Image,
  ActivityIndicator, RefreshControl, ScrollView, Dimensions, Animated,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { storesApi } from '../api/stores';
import { colors } from '../theme/colors';
import { typography, spacing, radius } from '../theme/typography';
import { Store, Banner } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BANNER_HEIGHT = (SCREEN_WIDTH - 40) / 3;
const CATEGORIES = ['All', 'Snacks', 'Meals', 'Drinks', 'Healthy'];

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
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [isEditingAddress, setIsEditingAddress] = useState(false);

  const bannerTimer = useRef<NodeJS.Timeout | null>(null);

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

  const filteredStores = useMemo(() => {
    return stores.filter((store) => {
      const matchesSearch =
        store.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        activeCategory === 'All' || (store.tags && store.tags.includes(activeCategory));
      const matchesCollege = 
        !collegeId || !store.college_id || store.college_id === collegeId;
      return matchesSearch && matchesCategory && matchesCollege;
    });
  }, [stores, searchQuery, activeCategory, collegeId]);

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

  const renderStoreCard = ({ item: store }: { item: Store }) => (
    <TouchableOpacity
      style={[styles.storeCard, !store.is_open && { opacity: 0.6 }]}
      onPress={() => navigation.navigate('StoreDetail', { storeId: store.id || store._id })}
      activeOpacity={0.85}
    >
      <View style={styles.storeImageContainer}>
        <Image source={{ uri: store.image }} style={styles.storeImage} />
        {!store.is_open && (
          <View style={styles.closedOverlay}>
            <Text style={styles.closedText}>CLOSED</Text>
          </View>
        )}
        {store.rating && (
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingText}>⭐ {store.rating}</Text>
          </View>
        )}
      </View>
      <View style={styles.storeInfo}>
        <View style={styles.storeRow}>
          <Text style={styles.storeName} numberOfLines={1}>{store.name}</Text>
          <View style={{ alignItems: 'flex-end' }}>
            {store.delivery_time_mins && (
              <Text style={styles.deliveryTime}>🕐 {store.delivery_time_mins} mins</Text>
            )}
            <Text style={styles.collegeBadge}>📍 {store.college_name || 'All Campuses'}</Text>
          </View>
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
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={styles.headerLabel}>📍 DELIVERING TO</Text>
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
            <TouchableOpacity onPress={() => setIsEditingAddress(true)}>
              <Text style={styles.headerAddress} numberOfLines={1}>{address} ✎</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.headerCollege} numberOfLines={1}>{collegeName}</Text>
        </View>
        <TouchableOpacity
          style={styles.profileBtn}
          onPress={() => navigation.navigate('Profile')}
        >
          <Text style={{ fontSize: 18 }}>⚡</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredStores}
        keyExtractor={(item) => item.id || item._id || item.name}
        renderItem={renderStoreCard}
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <>
            {renderBannerCarousel()}

            {/* Search */}
            <View style={styles.searchBar}>
              <Text style={{ fontSize: 16 }}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search for restaurants or dishes..."
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* Categories */}
            <Text style={styles.sectionTitle}>Categories</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.xxl }}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryChip, activeCategory === cat && styles.categoryChipActive]}
                  onPress={() => setActiveCategory(cat)}
                >
                  <Text style={[styles.categoryText, activeCategory === cat && styles.categoryTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.sectionTitle}>Restaurants near you</Text>
          </>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.emptyText}>Loading stores...</Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 48, marginBottom: 16 }}>🔍</Text>
              <Text style={styles.emptyTitle}>No matches found</Text>
              <Text style={styles.emptyText}>Try searching for a different keyword or category.</Text>
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
    marginBottom: spacing.xxl,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.textMain },

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
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)',
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
  storeName: { ...typography.h4, color: colors.textMain, flex: 1, marginRight: spacing.sm },
  deliveryTime: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },
  collegeBadge: { fontSize: 11, color: colors.primary, fontWeight: '700', marginTop: 2 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full,
    backgroundColor: colors.bgColor,
  },
  tagText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },

  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { ...typography.h3, color: colors.textMain, marginBottom: spacing.sm },
  emptyText: { fontSize: 14, color: colors.textMuted },
});

export default HomeScreen;
