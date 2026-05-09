import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { ArrowLeft, Star, Clock, Plus, Minus, ShoppingCart } from 'lucide-react-native';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useCart } from '../context/CartContext';
import { AppColors } from '../theme/colors';

const StoreDetailsScreen = () => {
  const route = useRoute() as any;
  const navigation = useNavigation() as any;
  const { storeId } = route.params;
  
  const [store, setStore] = useState<any>(null);
  const [menu, setMenu] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { items, addItem, removeSingleItem, totalAmount } = useCart();

  useEffect(() => {
    const fetchStoreData = async () => {
      try {
        const storeSnap = await getDoc(doc(db, 'stores', storeId));
        if (storeSnap.exists()) {
          setStore({ id: storeSnap.id, ...storeSnap.data() });
          
          const menuSnap = await getDocs(collection(db, 'stores', storeId, 'menu'));
          setMenu(menuSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }
      } catch (error) {
        console.error("Error fetching store data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStoreData();
  }, [storeId]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={AppColors.primary} size="large" />
      </View>
    );
  }

  const cartItemCount = items.filter(i => i.storeId === storeId).reduce((acc, i) => acc + i.quantity, 0);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header Image */}
        <View style={styles.headerImageContainer}>
          <Image source={{ uri: store.imageUrl || store.image }} style={styles.headerImage} />
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <ArrowLeft size={24} color="white" />
          </TouchableOpacity>
        </View>

        {/* Store Info */}
        <View style={styles.infoCard}>
          <Text style={styles.storeName}>{store.name}</Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Star size={16} color={AppColors.primary} fill={AppColors.primary} />
              <Text style={styles.statText}>{store.rating || '4.5'}</Text>
            </View>
            <Text style={styles.dot}>•</Text>
            <View style={styles.stat}>
              <Clock size={16} color={AppColors.textSecondary} />
              <Text style={styles.statText}>{store.deliveryTime || store.delivery_time_mins || '20'} mins</Text>
            </View>
          </View>
          <View style={styles.tagsRow}>
            {store.tags?.map((tag: string) => (
              <View key={tag} style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View>
            ))}
          </View>
        </View>

        {/* Menu Section */}
        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Menu</Text>
          {menu.map(item => {
            const cartItem = items.find(i => i.id === item.id);
            return (
              <View key={item.id} style={styles.menuItem}>
                <View style={styles.menuItemInfo}>
                  <View style={[styles.vegIndicator, { borderColor: item.isVeg ? '#10B981' : '#EF4444' }]}>
                    <View style={[styles.vegDot, { backgroundColor: item.isVeg ? '#10B981' : '#EF4444' }]} />
                  </View>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemPrice}>₹{item.price}</Text>
                  <Text style={styles.itemDesc} numberOfLines={2}>{item.desc}</Text>
                </View>
                <View style={styles.itemActionContainer}>
                  <Image source={{ uri: item.imageUrl || item.image }} style={styles.itemImage} />
                  <View style={styles.actionButtonContainer}>
                    {cartItem ? (
                      <View style={styles.quantityControl}>
                        <TouchableOpacity onPress={() => removeSingleItem(item.id)}><Minus size={16} color={AppColors.primary} /></TouchableOpacity>
                        <Text style={styles.quantityText}>{cartItem.quantity}</Text>
                        <TouchableOpacity onPress={() => addItem(item, storeId, store.name)}><Plus size={16} color={AppColors.primary} /></TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity style={styles.addButton} onPress={() => addItem(item, storeId, store.name)}>
                        <Text style={styles.addButtonText}>ADD</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Floating Cart Bar */}
      {cartItemCount > 0 && (
        <View style={styles.cartBar}>
          <View>
            <Text style={styles.cartCount}>{cartItemCount} Items</Text>
            <Text style={styles.cartTotal}>₹{totalAmount}</Text>
          </View>
          <TouchableOpacity style={styles.viewCartButton} onPress={() => navigation.navigate('Cart')}>
            <Text style={styles.viewCartText}>View Cart</Text>
            <ShoppingCart size={18} color="black" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: AppColors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerImageContainer: {
    height: 220,
    width: '100%',
  },
  headerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 10,
    borderRadius: 20,
  },
  infoCard: {
    backgroundColor: AppColors.cardBackground,
    marginTop: -30,
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  storeName: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 15,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statText: {
    color: 'white',
    fontWeight: '600',
  },
  dot: {
    color: AppColors.textSecondary,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  tagText: {
    color: AppColors.textSecondary,
    fontSize: 12,
  },
  menuSection: {
    padding: 20,
    paddingTop: 30,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    paddingBottom: 20,
  },
  menuItemInfo: {
    flex: 1,
    paddingRight: 15,
  },
  vegIndicator: {
    width: 16,
    height: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderRadius: 4,
  },
  vegDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  itemName: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  itemPrice: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  itemDesc: {
    color: AppColors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  itemActionContainer: {
    width: 110,
    alignItems: 'center',
  },
  itemImage: {
    width: 110,
    height: 110,
    borderRadius: 15,
  },
  actionButtonContainer: {
    marginTop: -20,
    width: 90,
    height: 36,
  },
  addButton: {
    backgroundColor: AppColors.cardBackground,
    borderWidth: 1,
    borderColor: AppColors.primary,
    borderRadius: 8,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },
  addButtonText: {
    color: AppColors.primary,
    fontWeight: 'bold',
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: AppColors.cardBackground,
    borderWidth: 1,
    borderColor: AppColors.primary,
    borderRadius: 8,
    height: '100%',
    paddingHorizontal: 10,
  },
  quantityText: {
    color: AppColors.primary,
    fontWeight: 'bold',
  },
  cartBar: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: AppColors.primary,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 10,
  },
  cartCount: {
    color: 'black',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  cartTotal: {
    color: 'black',
    fontSize: 18,
    fontWeight: 'bold',
  },
  viewCartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewCartText: {
    color: 'black',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default StoreDetailsScreen;
