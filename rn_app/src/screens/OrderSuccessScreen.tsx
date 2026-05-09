import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { CheckCircle, ArrowRight } from 'lucide-react-native';
import { AppColors } from '../theme/colors';
import { useCart } from '../context/CartContext';

const OrderSuccessScreen = () => {
  const navigation = useNavigation() as any;
  const { clearCart } = useCart();

  useEffect(() => {
    // Clear cart after successful order
    clearCart();
  }, []);

  return (
    <View style={styles.container}>
      <CheckCircle size={100} color={AppColors.success} />
      <Text style={styles.title}>Order Placed!</Text>
      <Text style={styles.subtitle}>Your order has been received and is being prepared by the store.</Text>
      
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Est. Delivery</Text>
          <Text style={styles.statValue}>25 mins</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Order ID</Text>
          <Text style={styles.statValue}>#ZAP-9284</Text>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.trackButton} 
        onPress={() => navigation.navigate('Orders')}
      >
        <Text style={styles.trackText}>Track My Order</Text>
        <ArrowRight size={20} color="black" />
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.homeButton} 
        onPress={() => navigation.navigate('Home')}
      >
        <Text style={styles.homeText}>Back to Home</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  title: {
    color: 'white',
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 30,
  },
  subtitle: {
    color: AppColors.textSecondary,
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 15,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: AppColors.cardBackground,
    padding: 20,
    borderRadius: 20,
    marginTop: 40,
    width: '100%',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
  },
  statLabel: {
    color: AppColors.textSecondary,
    fontSize: 12,
  },
  statValue: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 4,
  },
  divider: {
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  trackButton: {
    backgroundColor: AppColors.primary,
    flexDirection: 'row',
    width: '100%',
    padding: 18,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 50,
  },
  trackText: {
    color: 'black',
    fontSize: 18,
    fontWeight: 'bold',
  },
  homeButton: {
    marginTop: 20,
  },
  homeText: {
    color: AppColors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default OrderSuccessScreen;
