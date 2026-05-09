import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Trash2, Plus, Minus, CreditCard } from 'lucide-react-native';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { AppColors } from '../theme/colors';

const CartScreen = () => {
  const navigation = useNavigation() as any;
  const { items, addItem, removeSingleItem, clearCart, totalAmount } = useCart();
  const { user } = useAuth();

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.emptyContainer}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <ArrowLeft size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.title}>Your Cart</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.emptyContent}>
          <Image 
            source={{ uri: 'https://cdn-icons-png.flaticon.com/512/2762/2762885.png' }} 
            style={styles.emptyImage} 
          />
          <Text style={styles.emptyTitle}>Cart is Empty</Text>
          <Text style={styles.emptySubtitle}>Looks like you haven't added anything to your cart yet.</Text>
          <TouchableOpacity style={styles.shopButton} onPress={() => navigation.navigate('Home')}>
            <Text style={styles.shopButtonText}>Browse Stores</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.title}>Your Cart</Text>
        <TouchableOpacity onPress={clearCart}>
          <Trash2 size={24} color={AppColors.error} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Items</Text>
          {items.map(item => (
            <View key={item.id} style={styles.cartItem}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemStore}>{item.storeName}</Text>
                <Text style={styles.itemPrice}>₹{item.price * item.quantity}</Text>
              </View>
              <View style={styles.quantityControl}>
                <TouchableOpacity onPress={() => removeSingleItem(item.id)}><Minus size={16} color={AppColors.primary} /></TouchableOpacity>
                <Text style={styles.quantityText}>{item.quantity}</Text>
                <TouchableOpacity onPress={() => addItem(item, item.storeId, item.storeName)}><Plus size={16} color={AppColors.primary} /></TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Location</Text>
          <View style={styles.locationCard}>
            <Text style={styles.locationTitle}>{user?.collegeName || 'Select College'}</Text>
            <Text style={styles.locationDesc}>{user?.hostel ? `${user.hostel}, Room ${user.roomNumber}` : 'Add address details in profile'}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bill Details</Text>
          <View style={styles.billCard}>
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Item Total</Text>
              <Text style={styles.billValue}>₹{totalAmount}</Text>
            </View>
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Delivery Fee</Text>
              <Text style={[styles.billValue, { color: AppColors.success }]}>FREE</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.billRow}>
              <Text style={styles.totalLabel}>To Pay</Text>
              <Text style={styles.totalValue}>₹{totalAmount}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.checkoutButton} onPress={() => navigation.navigate('OrderSuccess')}>
          <CreditCard size={20} color="black" />
          <Text style={styles.checkoutText}>Place Order • ₹{totalAmount}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  cartItem: {
    backgroundColor: AppColors.cardBackground,
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  itemStore: {
    color: AppColors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  itemPrice: {
    color: AppColors.primary,
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 8,
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 12,
  },
  quantityText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  locationCard: {
    backgroundColor: AppColors.cardBackground,
    padding: 20,
    borderRadius: 20,
  },
  locationTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  locationDesc: {
    color: AppColors.textSecondary,
    fontSize: 14,
    marginTop: 4,
  },
  billCard: {
    backgroundColor: AppColors.cardBackground,
    padding: 20,
    borderRadius: 20,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  billLabel: {
    color: AppColors.textSecondary,
  },
  billValue: {
    color: 'white',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginVertical: 15,
  },
  totalLabel: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  totalValue: {
    color: AppColors.primary,
    fontSize: 22,
    fontWeight: 'bold',
  },
  footer: {
    padding: 20,
    backgroundColor: AppColors.background,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  checkoutButton: {
    backgroundColor: AppColors.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
    borderRadius: 20,
    gap: 10,
  },
  checkoutText: {
    color: 'black',
    fontSize: 18,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  emptyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyImage: {
    width: 200,
    height: 200,
    marginBottom: 20,
    opacity: 0.6,
  },
  emptyTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  emptySubtitle: {
    color: AppColors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
  },
  shopButton: {
    backgroundColor: AppColors.primary,
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 15,
  },
  shopButtonText: {
    color: 'black',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default CartScreen;
