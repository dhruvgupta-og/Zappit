import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image, TextInput, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, MapPin, Bolt, Star, Clock } from 'lucide-react-native';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { AppColors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';

const CATEGORIES = ['All', 'Snacks', 'Meals', 'Drinks', 'Healthy'];

const HomeScreen = () => {
  const { user } = useAuth();
  const navigation = useNavigation() as any;
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [stores, setStores] = useState<any[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch Banners
    const bannerQuery = query(collection(db, 'banners'), where('isActive', '==', true));
    const unsubscribeBanners = onSnapshot(bannerQuery, (snapshot) => {
      setBanners(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch Stores based on user's college and category
    let storeQuery = collection(db, 'stores') as any;
    
    // In a real app, we'd filter by collegeId if user has one
    // if (user?.collegeId) {
    //   storeQuery = query(collection(db, 'stores'), where('collegeId', '==', user.collegeId));
    // }

    const unsubscribeStores = onSnapshot(storeQuery, (snapshot) => {
      let storeList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Client-side filtering for category (or could be server-side)
      if (selectedCategory !== 'All') {
        storeList = storeList.filter(s => s.category === selectedCategory);
      }
      
      setStores(storeList);
      setLoading(false);
    });

    return () => {
      unsubscribeBanners();
      unsubscribeStores();
    };
  }, [selectedCategory, user?.collegeId]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <View style={styles.locationRow}>
              <MapPin size={12} color={AppColors.primary} />
              <Text style={styles.deliveringTo}>DELIVERING TO</Text>
            </View>
            <TouchableOpacity style={styles.collegeRow}>
              <Text style={styles.collegeName}>{user?.collegeName || 'Campus'}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.boltContainer}>
            <Bolt size={20} color="black" />
          </View>
        </View>

        {/* Banner Slider */}
        <ScrollView 
          horizontal 
          pagingEnabled 
          showsHorizontalScrollIndicator={false} 
          style={styles.bannerContainer}
        >
          {banners.length > 0 ? banners.map(banner => (
            <View key={banner.id} style={styles.banner}>
              <Image source={{ uri: banner.imageUrl || banner.image }} style={styles.bannerImage} />
            </View>
          )) : (
            <View style={styles.banner}>
              <Image source={{ uri: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836' }} style={styles.bannerImage} />
            </View>
          )}
        </ScrollView>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Search size={20} color={AppColors.textSecondary} />
          <TextInput 
            placeholder="Search for snacks or stores..." 
            placeholderTextColor={AppColors.textSecondary}
            style={styles.searchInput}
          />
        </View>

        {/* Categories */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Categories</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity 
              key={cat} 
              onPress={() => setSelectedCategory(cat)}
              style={[
                styles.categoryItem, 
                selectedCategory === cat && styles.categoryItemActive
              ]}
            >
              <Text style={[
                styles.categoryText,
                selectedCategory === cat && styles.categoryTextActive
              ]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Restaurants */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Restaurants near you</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={AppColors.primary} style={{ marginTop: 20 }} />
        ) : stores.length > 0 ? (
          stores.map(store => (
            <TouchableOpacity 
              key={store.id} 
              style={styles.storeCard}
              onPress={() => navigation.navigate('StoreDetails', { storeId: store.id })}
            >
              <Image source={{ uri: store.imageUrl || store.image || 'https://images.unsplash.com/photo-1513104890138-7c749659a591' }} style={styles.storeImage} />
              <View style={styles.ratingBadge}>
                <Star size={12} color={AppColors.primary} fill={AppColors.primary} />
                <Text style={styles.ratingText}>{store.rating || '4.5'}</Text>
              </View>
              <View style={styles.storeDetails}>
                <Text style={styles.storeName}>{store.name}</Text>
                <View style={styles.timeRow}>
                  <Clock size={14} color={AppColors.textSecondary} />
                  <Text style={styles.timeText}>{store.deliveryTime || store.delivery_time_mins || '15-20'} mins</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No stores found in this category.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deliveringTo: {
    color: AppColors.primary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginLeft: 4,
  },
  collegeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  collegeName: {
    color: 'white',
    fontSize: 18,
    fontWeight: '900',
  },
  boltContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AppColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerContainer: {
    height: 180,
    marginBottom: 10,
  },
  banner: {
    width: 350, // Approximation, should be screen width - margin
    height: 160,
    marginHorizontal: 20,
    borderRadius: 20,
    overflow: 'hidden',
    marginTop: 10,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.cardBackground,
    marginHorizontal: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginVertical: 15,
  },
  searchInput: {
    marginLeft: 12,
    color: 'white',
    flex: 1,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  categoriesScroll: {
    paddingLeft: 20,
    marginBottom: 30,
  },
  categoryItem: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    marginRight: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryItemActive: {
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primary,
  },
  categoryText: {
    color: 'rgba(255,255,255,0.7)',
    fontWeight: 'bold',
  },
  categoryTextActive: {
    color: 'black',
  },
  storeCard: {
    backgroundColor: AppColors.cardBackground,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  storeImage: {
    width: '100%',
    height: 160,
  },
  ratingBadge: {
    position: 'absolute',
    top: 15,
    right: 15,
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
    marginLeft: 4,
  },
  storeDetails: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  storeName: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    color: AppColors.textSecondary,
    fontSize: 12,
    marginLeft: 4,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: AppColors.textSecondary,
    textAlign: 'center',
  },
});

export default HomeScreen;
