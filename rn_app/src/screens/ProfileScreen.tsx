import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppColors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { User, Mail, Phone, MapPin, LogOut, ChevronRight, Settings, Globe } from 'lucide-react-native';

const ProfileScreen = () => {
  const { user, signOut } = useAuth();
  const navigation = useNavigation() as any;

  const ProfileItem = ({ icon: Icon, label, value, onPress }: any) => (
    <TouchableOpacity style={styles.item} onPress={onPress}>
      <View style={styles.itemLeft}>
        <View style={styles.iconContainer}>
          <Icon size={20} color={AppColors.primary} />
        </View>
        <View>
          <Text style={styles.itemLabel}>{label}</Text>
          <Text style={styles.itemValue}>{value || 'Not set'}</Text>
        </View>
      </View>
      <ChevronRight size={20} color={AppColors.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>{user?.name?.charAt(0) || 'U'}</Text>
          </View>
          <Text style={styles.userName}>{user?.name || 'User'}</Text>
          <Text style={styles.userEmail}>{user?.email || 'user@example.com'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Information</Text>
          <View style={styles.card}>
            <ProfileItem icon={User} label="Full Name" value={user?.name} />
            <ProfileItem icon={Mail} label="Email Address" value={user?.email} />
            <ProfileItem icon={Phone} label="Phone Number" value={user?.phoneNumber} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Settings</Text>
          <View style={styles.card}>
            <ProfileItem icon={MapPin} label="College" value={user?.collegeName} />
            <ProfileItem icon={Settings} label="Preferences" value="Notifications, Theme" />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>More</Text>
          <View style={styles.card}>
            <ProfileItem 
              icon={Globe} 
              label="Visit Website" 
              value="zappit.in" 
              onPress={() => navigation.navigate('WebView', { url: 'https://zappit.in', title: 'Zappit Website' })} 
            />
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
          <LogOut size={20} color={AppColors.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
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
    alignItems: 'center',
    padding: 40,
    backgroundColor: AppColors.cardBackground,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: AppColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'black',
  },
  userName: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  userEmail: {
    color: AppColors.textSecondary,
    fontSize: 14,
    marginTop: 4,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  card: {
    backgroundColor: AppColors.cardBackground,
    borderRadius: 20,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  itemLabel: {
    color: AppColors.textSecondary,
    fontSize: 12,
  },
  itemValue: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    margin: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 15,
    gap: 10,
  },
  logoutText: {
    color: AppColors.error,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ProfileScreen;
