import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { AppColors } from '../theme/colors';
import { Navigation, Package, History, LogOut, MapPin } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';

const DeliveryDashboard = () => {
  const { signOut } = useAuth();
  const [isOnline, setIsOnline] = React.useState(true);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Delivery Hero</Text>
          <Text style={styles.subtitle}>Ready to Zapp?</Text>
        </View>
        <TouchableOpacity onPress={signOut}>
          <LogOut size={24} color={AppColors.error} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.onlineCard}>
          <View style={styles.row}>
            <View style={[styles.dot, { backgroundColor: isOnline ? AppColors.success : AppColors.error }]} />
            <Text style={styles.onlineText}>{isOnline ? 'You are Online' : 'You are Offline'}</Text>
          </View>
          <Switch 
            value={isOnline} 
            onValueChange={setIsOnline}
            trackColor={{ false: '#334155', true: '#10B981' }}
          />
        </View>

        <View style={styles.activeTask}>
          <Text style={styles.taskLabel}>ACTIVE TASK</Text>
          {isOnline ? (
            <View style={styles.taskCard}>
              <View style={styles.taskHeader}>
                <Package size={20} color={AppColors.primary} />
                <Text style={styles.orderId}>Order #1284</Text>
                <View style={styles.timeBadge}><Text style={styles.timeText}>5m</Text></View>
              </View>
              <View style={styles.locationRow}>
                <MapPin size={16} color={AppColors.textSecondary} />
                <Text style={styles.locationText}>Snack Point → Girls Hostel 1</Text>
              </View>
              <TouchableOpacity style={styles.navButton}>
                <Navigation size={18} color="black" />
                <Text style={styles.navText}>Start Navigation</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.emptyTask}>
              <Text style={styles.emptyText}>Go online to receive orders</Text>
            </View>
          )}
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Today's Earnings</Text>
            <Text style={styles.statValue}>₹450</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Orders</Text>
            <Text style={styles.statValue}>8</Text>
          </View>
        </View>
      </ScrollView>
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
    fontSize: 24,
    fontWeight: 'bold',
  },
  subtitle: {
    color: AppColors.textSecondary,
    fontSize: 14,
  },
  content: {
    padding: 20,
  },
  onlineCard: {
    backgroundColor: AppColors.cardBackground,
    padding: 20,
    borderRadius: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  onlineText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  activeTask: {
    marginBottom: 30,
  },
  taskLabel: {
    color: AppColors.primary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 15,
  },
  taskCard: {
    backgroundColor: AppColors.cardBackground,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,193,7,0.2)',
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  orderId: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  timeBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  timeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  locationText: {
    color: AppColors.textSecondary,
    fontSize: 14,
  },
  navButton: {
    backgroundColor: AppColors.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 15,
    borderRadius: 15,
    gap: 10,
  },
  navText: {
    color: 'black',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyTask: {
    height: 150,
    backgroundColor: AppColors.cardBackground,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: AppColors.textSecondary,
  },
  emptyText: {
    color: AppColors.textSecondary,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '48%',
    backgroundColor: AppColors.cardBackground,
    padding: 20,
    borderRadius: 20,
  },
  statLabel: {
    color: AppColors.textSecondary,
    fontSize: 12,
  },
  statValue: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 5,
  },
});

export default DeliveryDashboard;
