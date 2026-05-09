import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { AppColors } from '../theme/colors';
import { ClipboardList, UtensilsCrossed, Settings, LogOut, Clock } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';

const StoreDashboard = () => {
  const { signOut } = useAuth();
  const [isOpen, setIsOpen] = React.useState(true);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Store Manager</Text>
          <Text style={styles.subtitle}>Snack Point</Text>
        </View>
        <TouchableOpacity onPress={signOut}>
          <LogOut size={24} color={AppColors.error} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.statusCard}>
          <View>
            <Text style={styles.statusTitle}>Store Status</Text>
            <Text style={[styles.statusText, { color: isOpen ? AppColors.success : AppColors.error }]}>
              {isOpen ? 'Open & Accepting Orders' : 'Closed'}
            </Text>
          </View>
          <Switch 
            value={isOpen} 
            onValueChange={setIsOpen}
            trackColor={{ false: '#334155', true: '#10B981' }}
          />
        </View>

        <View style={styles.statsRow}>
          <View style={styles.miniStat}>
            <Text style={styles.miniLabel}>Orders Today</Text>
            <Text style={styles.miniValue}>24</Text>
          </View>
          <View style={styles.miniStat}>
            <Text style={styles.miniLabel}>Revenue</Text>
            <Text style={styles.miniValue}>₹3,450</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionGrid}>
          <TouchableOpacity style={styles.actionItem}>
            <ClipboardList size={32} color={AppColors.primary} />
            <Text style={styles.actionLabel}>Manage Orders</Text>
            <View style={styles.badge}><Text style={styles.badgeText}>3</Text></View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionItem}>
            <UtensilsCrossed size={32} color={AppColors.primary} />
            <Text style={styles.actionLabel}>Update Menu</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionItem}>
            <Clock size={32} color={AppColors.primary} />
            <Text style={styles.actionLabel}>History</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionItem}>
            <Settings size={32} color={AppColors.primary} />
            <Text style={styles.actionLabel}>Profile</Text>
          </TouchableOpacity>
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
  statusCard: {
    backgroundColor: AppColors.cardBackground,
    padding: 20,
    borderRadius: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  statusTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusText: {
    fontSize: 14,
    marginTop: 4,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  miniStat: {
    width: '48%',
    backgroundColor: AppColors.cardBackground,
    padding: 15,
    borderRadius: 15,
    alignItems: 'center',
  },
  miniLabel: {
    color: AppColors.textSecondary,
    fontSize: 12,
  },
  miniValue: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 4,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionItem: {
    width: '48%',
    backgroundColor: AppColors.cardBackground,
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 15,
    gap: 10,
    position: 'relative',
  },
  actionLabel: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  badge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: AppColors.error,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default StoreDashboard;
