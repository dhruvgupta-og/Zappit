import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { AppColors } from '../theme/colors';
import { Users, ShoppingBag, Truck, BarChart3, Settings, LogOut } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';

const AdminDashboard = () => {
  const { signOut } = useAuth();

  const StatCard = ({ title, value, icon: Icon, color }: any) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View>
        <Text style={styles.statLabel}>{title}</Text>
        <Text style={styles.statValue}>{value}</Text>
      </View>
      <Icon size={24} color={color} />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Admin Panel</Text>
        <TouchableOpacity onPress={signOut}>
          <LogOut size={24} color={AppColors.error} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.statsGrid}>
          <StatCard title="Total Users" value="1,284" icon={Users} color="#6366F1" />
          <StatCard title="Total Stores" value="42" icon={ShoppingBag} color="#F59E0B" />
          <StatCard title="Active Orders" value="86" icon={Truck} color="#10B981" />
          <StatCard title="Revenue" value="₹45,290" icon={BarChart3} color="#EC4899" />
        </View>

        <Text style={styles.sectionTitle}>Management</Text>
        <View style={styles.menuGrid}>
          <TouchableOpacity style={styles.menuItem}>
            <Users size={32} color="white" />
            <Text style={styles.menuLabel}>Users</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem}>
            <ShoppingBag size={32} color="white" />
            <Text style={styles.menuLabel}>Stores</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem}>
            <Truck size={32} color="white" />
            <Text style={styles.menuLabel}>Deliveries</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem}>
            <Settings size={32} color="white" />
            <Text style={styles.menuLabel}>Settings</Text>
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
  content: {
    padding: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  statCard: {
    width: '48%',
    backgroundColor: AppColors.cardBackground,
    padding: 15,
    borderRadius: 15,
    marginBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderLeftWidth: 4,
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
  sectionTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  menuItem: {
    width: '48%',
    backgroundColor: AppColors.cardBackground,
    padding: 25,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 15,
    gap: 10,
  },
  menuLabel: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default AdminDashboard;
