import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator, Alert, TextInput, Modal, Switch, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { adminApi } from '../api/admin';
import { colors } from '../theme/colors';
import { typography, spacing, radius } from '../theme/typography';

// ── Tabs ──
const TABS = [
  { key: 'overview', label: '📊 Overview' },
  { key: 'analytics', label: '📈 Analytics & Metrics' },
  { key: 'orders', label: '📦 Orders' },
  { key: 'stores', label: '🏪 Stores' },
  { key: 'colleges', label: '🎓 Colleges' },
  { key: 'banners', label: '🖼️ Banners' },
  { key: 'coupons', label: '🏷️ Coupons' },
  { key: 'notifications', label: '📢 Notify' },
  { key: 'control', label: '🛑 App Control' },
];

const ORDER_STATUS_OPTIONS = ['confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'];
const STATUS_COLORS: Record<string, string> = {
  confirmed: '#F59E0B', preparing: '#3B82F6', ready: '#8B5CF6',
  out_for_delivery: '#10B981', delivered: '#22C55E', cancelled: '#EF4444',
};

// ── Helpers ──
const fmt = (n: number) => n?.toLocaleString('en-IN') || '0';

// ── Modal Form Helpers ──
const emptyCollege = () => ({ name: '', city: '', isActive: true, blocks: [] });
const emptyStore = (colleges: any[]) => ({ name: '', description: '', college_id: colleges[0]?.id || '', is_open: true, image: '' });
const emptyBanner = () => ({ imageUrl: '', coupon_code: '', isActive: true });
const emptyCoupon = () => ({ code: '', discount: '', type: 'flat', minOrder: '', maxUses: '' });

// ─────────────────────────────────────────────────────────────────────────────
const AdminDashboardScreen = () => {
  const { logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data
  const [stats, setStats] = useState({ orders: 0, revenue: 0, stores: 0, users: 0 });
  const [orders, setOrders] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [colleges, setColleges] = useState<any[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);

  // Filters
  const [orderSearch, setOrderSearch] = useState('');
  const [collegeFilter, setCollegeFilter] = useState('all');

  // Notification broadcast state
  const [notifTitle, setNotifTitle] = useState('');
  const [notifBody, setNotifBody] = useState('');
  const [notifCollege, setNotifCollege] = useState('');
  const [notifSending, setNotifSending] = useState(false);

  // Fees List Config (delivery fee, platform fee, etc.)
  const [feesList, setFeesList] = useState<Array<{ name: string; type: string; value: string }>>([]);
  const [savingFees, setSavingFees] = useState(false);
  const [newFee, setNewFee] = useState({ name: '', type: 'flat', value: '' });

  // Maintenance Mode
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [savingMaintenance, setSavingMaintenance] = useState(false);

  // Analytics state
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsDateRange, setAnalyticsDateRange] = useState('all');
  const [analyticsStoreFilter, setAnalyticsStoreFilter] = useState('all');
  const [analyticsCategory, setAnalyticsCategory] = useState('orders'); // orders, customers, delivery, store, finance, growth, live, targets

  // Modals
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState('');
  const [formData, setFormData] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const fetchAnalytics = useCallback(async (range = analyticsDateRange, stId = analyticsStoreFilter) => {
    setAnalyticsLoading(true);
    try {
      const res = await adminApi.getAnalytics({
        dateRange: range,
        storeId: stId !== 'all' ? stId : undefined,
      });
      if (res.success) {
        setAnalyticsData(res);
      }
    } catch (err) {
      console.warn('Analytics fetch error:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [analyticsDateRange, analyticsStoreFilter]);

  // ── Fetch all data ──
  const fetchAll = useCallback(async () => {
    try {
      const [statsRes, ordersRes, storesRes, collegesRes, bannersRes, couponsRes, feesRes] = await Promise.allSettled([
        adminApi.getDashboardStats(),
        adminApi.getAllOrders(),
        adminApi.getAllStores(),
        adminApi.getColleges(),
        adminApi.getBanners(),
        adminApi.getCoupons(),
        adminApi.getFees(),
      ]);

      if (feesRes.status === 'fulfilled' && feesRes.value.success) {
        const list = feesRes.value.data?.list || [];
        setFeesList(list.map((f: any) => ({ name: f.name || '', type: f.type || 'flat', value: String(f.value ?? '') })));
      }

      // Load maintenance mode
      try {
        const maintenanceRes = await adminApi.getMaintenance();
        setIsMaintenance(maintenanceRes.isMaintenanceMode === true);
      } catch (e) { /* ignore */ }

      if (statsRes.status === 'fulfilled' && statsRes.value.success) {
        setStats({
          orders: statsRes.value.totalOrders || 0,
          revenue: statsRes.value.totalRevenue || 0,
          stores: statsRes.value.totalStores || 0,
          users: statsRes.value.totalUsers || 0,
        });
      }
      if (ordersRes.status === 'fulfilled' && ordersRes.value.success)
        setOrders(ordersRes.value.orders || []);
      if (storesRes.status === 'fulfilled' && storesRes.value.success)
        setStores(storesRes.value.stores?.map((s: any) => ({ id: s._id || s.id, ...s })) || []);
      if (collegesRes.status === 'fulfilled' && collegesRes.value.success)
        setColleges(collegesRes.value.colleges?.map((c: any) => ({ id: c._id || c.id, ...c })) || []);
      if (bannersRes.status === 'fulfilled' && bannersRes.value.success)
        setBanners(bannersRes.value.banners?.map((b: any) => ({ id: b._id || b.id, ...b })) || []);
      if (couponsRes.status === 'fulfilled' && couponsRes.value.success)
        setCoupons(couponsRes.value.coupons || []);

      // Also trigger analytics fetch
      fetchAnalytics();
    } catch (e) {
      console.error('Admin fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [fetchAnalytics]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    await fetchAnalytics();
    setRefreshing(false);
  };

  // ── Open modal ──
  const openModal = (type: string, existing?: any) => {
    setModalType(type);
    if (type === 'college') setFormData(existing || emptyCollege());
    if (type === 'store') setFormData(existing || emptyStore(colleges));
    if (type === 'banner') setFormData(existing || emptyBanner());
    if (type === 'coupon') setFormData(existing || emptyCoupon());
    if (type === 'storeOwner') setFormData({ email: '', password: '' });
    setModalVisible(true);
  };

  const closeModal = () => { setModalVisible(false); setFormData({}); };

  // ── Save ──
  const handleSave = async () => {
    setSaving(true);
    try {
      if (modalType === 'college') {
        await adminApi.saveCollege(formData);
        Alert.alert('Saved', 'College saved successfully.');
      } else if (modalType === 'store') {
        await adminApi.saveStore(formData);
        Alert.alert('Saved', 'Store saved successfully.');
      } else if (modalType === 'banner') {
        await adminApi.saveBanner(formData);
        Alert.alert('Saved', 'Banner saved successfully.');
      } else if (modalType === 'coupon') {
        await adminApi.saveCoupon(formData);
        Alert.alert('Saved', 'Coupon saved successfully.');
      } else if (modalType === 'storeOwner') {
        if (!formData.email || !formData.password) {
          Alert.alert('Error', 'Email and password are required.');
          return;
        }
        const res = await adminApi.createStoreOwner(formData.email, formData.password);
        if (res.success) Alert.alert('Created', `Store owner created!\nStore: ${res.store?.name}`);
        else Alert.alert('Error', res.error || 'Failed to create store owner.');
      }
      closeModal();
      fetchAll();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || err.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──
  const confirmDelete = (collection: string, id: string, name: string) => {
    Alert.alert(`Delete ${name}?`, 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            if (collection === 'colleges') await adminApi.deleteCollege(id);
            else if (collection === 'stores') await adminApi.deleteStore(id);
            else if (collection === 'banners') await adminApi.deleteBanner(id);
            else if (collection === 'coupons') await adminApi.deleteCoupon(id);
            fetchAll();
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to delete.');
          }
        }
      },
    ]);
  };

  // ── Update Order Status ──
  const changeOrderStatus = (order: any) => {
    const orderId = order.id || order._id;
    Alert.alert('Update Status', 'Choose new status:', [
      ...ORDER_STATUS_OPTIONS.map(s => ({
        text: s.replace(/_/g, ' ').toUpperCase(),
        onPress: async () => {
          try {
            await adminApi.updateOrderStatus(orderId, s);
            fetchAll();
          } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.error || 'Failed to update.');
          }
        }
      })),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // ─── Filtered Orders ───
  const filteredOrders = orders.filter(o => {
    const id = (o.id || o._id || '').toLowerCase();
    const q = orderSearch.toLowerCase();
    const matchSearch = !q || id.includes(q) || (o.delivery_address || '').toLowerCase().includes(q);
    const matchCollege = collegeFilter === 'all' || o.college_id === collegeFilter;
    return matchSearch && matchCollege;
  });

  // ─── Loading ───
  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.adminAccent} />
          <Text style={{ color: colors.textMuted, marginTop: spacing.md }}>Loading Admin Data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Render ───
  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* TOP BAR */}
      <View style={s.topBar}>
        <View>
          <Text style={s.topBarSubtitle}>👑 Super Admin</Text>
          <Text style={s.topBarTitle}>Control Panel</Text>
        </View>
        <TouchableOpacity onPress={() => Alert.alert('Sign Out', 'Are you sure?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign Out', style: 'destructive', onPress: logout },
        ])} style={s.logoutBtn}>
          <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '600' }}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* TABS */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBar} contentContainerStyle={s.tabBarContent}>
        {TABS.map(t => (
          <TouchableOpacity key={t.key} onPress={() => setActiveTab(t.key)}
            style={[s.tab, activeTab === t.key && s.tabActive]}>
            <Text style={[s.tabText, activeTab === t.key && s.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* CONTENT */}
      {activeTab === 'overview' && (
        <ScrollView contentContainerStyle={s.page}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.adminAccent} />}>

          <View style={s.statsGrid}>
            {[
              { label: 'Total Orders', value: fmt(stats.orders), emoji: '📦', color: '#F59E0B' },
              { label: 'Revenue', value: `₹${fmt(stats.revenue)}`, emoji: '💰', color: '#10B981' },
              { label: 'Delivered', value: fmt(orders.filter(o => o.order_status === 'delivered').length), emoji: '🎉', color: '#34D399' },
              { label: 'Stores', value: fmt(stats.stores), emoji: '🏪', color: '#3B82F6' },
              { label: 'Users', value: fmt(stats.users), emoji: '👥', color: '#8B5CF6' },
            ].map(stat => (
              <View key={stat.label} style={s.statCard}>
                <Text style={{ fontSize: 28 }}>{stat.emoji}</Text>
                <Text style={[s.statValue, { color: stat.color }]}>{stat.value}</Text>
                <Text style={s.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>🔥 Today's Live Orders</Text>
            {orders.slice(0, 5).map((o: any) => {
              const id = (o.id || o._id || '').slice(-6).toUpperCase();
              const st = o.order_status || 'unknown';
              return (
                <View key={o.id || o._id} style={[s.row, { marginBottom: spacing.sm }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowTitle}>#{id}</Text>
                    <Text style={s.rowSub}>{o.delivery_address || 'No address'}</Text>
                  </View>
                  <View style={[s.badge, { backgroundColor: (STATUS_COLORS[st] || '#666') + '22' }]}>
                    <Text style={[s.badgeText, { color: STATUS_COLORS[st] || '#999' }]}>{st.replace(/_/g, ' ')}</Text>
                  </View>
                </View>
              );
            })}
            {orders.length === 0 && <Text style={s.empty}>No orders yet</Text>}
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>💸 Fees & Charges</Text>
            <Text style={[s.rowSub, { marginBottom: spacing.md }]}>
              Manage delivery fee, platform fee, and other charges. These are applied to ALL customer orders.
            </Text>

            {/* Existing fees list */}
            {feesList.map((fee, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <View style={{ flex: 1, backgroundColor: colors.bgColor, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderColor, paddingHorizontal: spacing.md, paddingVertical: 8 }}>
                  <Text style={{ color: colors.textMain, fontWeight: '600', fontSize: 13 }}>{fee.name}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                    {fee.type === 'percent' ? `${fee.value}%` : `₹${fee.value}`} ({fee.type})
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    const updated = feesList.filter((_, idx) => idx !== i);
                    setFeesList(updated);
                  }}
                  style={{ padding: 8 }}
                >
                  <Text style={{ color: '#EF4444', fontSize: 18, fontWeight: '700' }}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            {feesList.length === 0 && (
              <Text style={[s.rowSub, { marginBottom: spacing.md, fontStyle: 'italic' }]}>No fees configured. Add one below.</Text>
            )}

            {/* Add new fee row */}
            <View style={{ borderTopWidth: 1, borderTopColor: colors.borderColor, paddingTop: spacing.md, marginTop: spacing.sm }}>
              <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 8 }}>ADD NEW FEE</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                <View style={{ flex: 2, backgroundColor: colors.bgColor, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderColor, paddingHorizontal: spacing.sm }}>
                  <TextInput
                    style={[s.formInput, { paddingVertical: 8 }]}
                    value={newFee.name}
                    onChangeText={v => setNewFee(prev => ({ ...prev, name: v }))}
                    placeholder="Name (e.g. Delivery Fee)"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <TouchableOpacity
                  onPress={() => setNewFee(prev => ({ ...prev, type: prev.type === 'flat' ? 'percent' : 'flat' }))}
                  style={{ backgroundColor: colors.bgColor, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderColor, paddingHorizontal: 10, justifyContent: 'center' }}
                >
                  <Text style={{ color: colors.adminAccent, fontWeight: '700', fontSize: 12 }}>
                    {newFee.type === 'flat' ? '₹ Flat' : '% Pct'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgColor, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderColor, paddingHorizontal: spacing.md }}>
                  <Text style={{ color: colors.textMuted, marginRight: 4 }}>{newFee.type === 'flat' ? '₹' : '%'}</Text>
                  <TextInput
                    style={[s.formInput, { flex: 1, paddingVertical: 8 }]}
                    value={newFee.value}
                    onChangeText={v => setNewFee(prev => ({ ...prev, value: v }))}
                    placeholder="Amount"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                  />
                </View>
                <TouchableOpacity
                  style={[s.addBtn, { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.md, marginBottom: 0 }]}
                  onPress={() => {
                    if (!newFee.name.trim() || !newFee.value.trim()) {
                      Alert.alert('Missing fields', 'Please enter a name and value.');
                      return;
                    }
                    setFeesList(prev => [...prev, { ...newFee }]);
                    setNewFee({ name: '', type: 'flat', value: '' });
                  }}
                >
                  <Text style={s.addBtnText}>+ Add</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Save all fees button */}
            <TouchableOpacity
              style={[s.addBtn, { marginTop: spacing.md, paddingVertical: 14, borderRadius: radius.md, marginBottom: 0, alignItems: 'center' }]}
              disabled={savingFees}
              onPress={async () => {
                setSavingFees(true);
                try {
                  const listToSave = feesList.map(f => ({
                    name: f.name.trim(),
                    type: f.type,
                    value: Number(f.value) || 0,
                  }));
                  await adminApi.saveFees(listToSave);
                  Alert.alert('✅ Saved', 'Fees updated successfully. All customers will see the new charges.');
                } catch (e: any) {
                  Alert.alert('Error', e.message || 'Failed to save fees.');
                } finally {
                  setSavingFees(false);
                }
              }}
            >
              {savingFees
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.addBtnText}>💾 Save All Fees</Text>}
            </TouchableOpacity>
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>🏪 Registered Stores ({stores.length})</Text>
            {stores.slice(0, 5).map((st: any) => (
              <View key={st.id || st._id} style={[s.row, { marginBottom: spacing.sm }]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle}>{st.name}</Text>
                  <Text style={s.rowSub}>{st.college_name || 'No college'}</Text>
                </View>
                <View style={[s.badge, { backgroundColor: st.is_open ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)' }]}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: st.is_open ? '#10B981' : '#EF4444' }}>
                    {st.is_open ? 'OPEN' : 'CLOSED'}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[s.card, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
            onPress={async () => {
              try {
                const res = await adminApi.flushCache();
                Alert.alert('✅ Cache Cleared', 'Colleges, banners and stores cache has been flushed. Changes will now appear immediately in the app.');
              } catch (e: any) {
                Alert.alert('Error', e.message || 'Failed to flush cache.');
              }
            }}>
            <View>
              <Text style={s.cardTitle}>🔄 Flush App Cache</Text>
              <Text style={s.rowSub}>Force refresh colleges, banners & stores in customer app</Text>
            </View>
            <Text style={{ color: colors.adminAccent, fontSize: 20 }}>→</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ─── 8-PILLAR METRICS & ANALYTICS TAB ─── */}
      {activeTab === 'analytics' && (
        <ScrollView contentContainerStyle={s.page}
          refreshControl={<RefreshControl refreshing={analyticsLoading} onRefresh={() => fetchAnalytics()} tintColor={colors.adminAccent} />}>

          {/* GLOBAL DATE FILTERS */}
          <View style={{ marginBottom: spacing.md }}>
            <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 }}>
              📅 Global Time Filter
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {[
                { key: 'today', label: 'Today' },
                { key: 'yesterday', label: 'Yesterday' },
                { key: 'this_week', label: 'This Week' },
                { key: 'last_week', label: 'Last Week' },
                { key: 'this_month', label: 'This Month' },
                { key: 'last_month', label: 'Last Month' },
                { key: 'all', label: 'All Time' },
              ].map(f => (
                <TouchableOpacity
                  key={f.key}
                  style={[s.filterChip, analyticsDateRange === f.key && s.filterChipActive]}
                  onPress={() => {
                    setAnalyticsDateRange(f.key);
                    fetchAnalytics(f.key, analyticsStoreFilter);
                  }}
                >
                  <Text style={[s.filterChipText, analyticsDateRange === f.key && s.filterChipTextActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* STORE FILTER */}
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 }}>
              🏪 Store Filter
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              <TouchableOpacity
                style={[s.filterChip, analyticsStoreFilter === 'all' && s.filterChipActive]}
                onPress={() => {
                  setAnalyticsStoreFilter('all');
                  fetchAnalytics(analyticsDateRange, 'all');
                }}
              >
                <Text style={[s.filterChipText, analyticsStoreFilter === 'all' && s.filterChipTextActive]}>All Stores</Text>
              </TouchableOpacity>
              {stores.map(st => {
                const sId = st.id || st._id;
                return (
                  <TouchableOpacity
                    key={sId}
                    style={[s.filterChip, analyticsStoreFilter === sId && s.filterChipActive]}
                    onPress={() => {
                      setAnalyticsStoreFilter(sId);
                      fetchAnalytics(analyticsDateRange, sId);
                    }}
                  >
                    <Text style={[s.filterChipText, analyticsStoreFilter === sId && s.filterChipTextActive]}>
                      {st.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* CATEGORY SWITCHER (8 METRICS) */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.lg }} contentContainerStyle={{ gap: 8 }}>
            {[
              { key: 'orders', label: '1. Orders 📦' },
              { key: 'customers', label: '2. Customers 👥' },
              { key: 'delivery', label: '3. Delivery 🛵' },
              { key: 'store', label: '4. Stores 🏪' },
              { key: 'finance', label: '5. Finance 💰' },
              { key: 'growth', label: '6. Growth 🚀' },
              { key: 'live', label: '7. Live Ops 🔥' },
              { key: 'targets', label: '8. Targets 🎯' },
            ].map(cat => (
              <TouchableOpacity
                key={cat.key}
                style={[s.tab, analyticsCategory === cat.key && s.tabActive, { borderRadius: 12, paddingVertical: 8 }]}
                onPress={() => setAnalyticsCategory(cat.key)}
              >
                <Text style={[s.tabText, analyticsCategory === cat.key && s.tabTextActive, { fontWeight: '700' }]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {analyticsLoading && (
            <View style={{ paddingVertical: 30, alignItems: 'center' }}>
              <ActivityIndicator color={colors.adminAccent} size="small" />
              <Text style={{ color: colors.textMuted, marginTop: 8, fontSize: 13 }}>Recalculating metrics...</Text>
            </View>
          )}

          {/* 1. ORDERS METRICS */}
          {analyticsCategory === 'orders' && (
            <View>
              <View style={s.card}>
                <Text style={s.cardTitle}>📦 Order Volumes & Breakdown</Text>
                <View style={s.statsGrid}>
                  <View style={s.statCard}><Text style={[s.statValue, { color: '#F59E0B' }]}>{analyticsData?.orders?.totalOrdersPlaced ?? orders.length}</Text><Text style={s.statLabel}>Total Placed</Text></View>
                  <View style={s.statCard}><Text style={[s.statValue, { color: '#10B981' }]}>{analyticsData?.orders?.completedOrders ?? orders.filter(o => o.order_status === 'delivered').length}</Text><Text style={s.statLabel}>Completed</Text></View>
                  <View style={s.statCard}><Text style={[s.statValue, { color: '#3B82F6' }]}>{analyticsData?.orders?.acceptedOrders ?? 0}</Text><Text style={s.statLabel}>Accepted</Text></View>
                  <View style={s.statCard}><Text style={[s.statValue, { color: '#8B5CF6' }]}>{analyticsData?.orders?.preparingOrders ?? 0}</Text><Text style={s.statLabel}>Preparing</Text></View>
                  <View style={s.statCard}><Text style={[s.statValue, { color: '#EC4899' }]}>{analyticsData?.orders?.readyOrders ?? 0}</Text><Text style={s.statLabel}>Ready Pickup</Text></View>
                  <View style={s.statCard}><Text style={[s.statValue, { color: '#06B6D4' }]}>{analyticsData?.orders?.outForDeliveryOrders ?? 0}</Text><Text style={s.statLabel}>Out for Delivery</Text></View>
                  <View style={s.statCard}><Text style={[s.statValue, { color: '#EF4444' }]}>{analyticsData?.orders?.cancelledOrders ?? 0}</Text><Text style={s.statLabel}>Cancelled</Text></View>
                  <View style={s.statCard}><Text style={[s.statValue, { color: '#EF4444' }]}>{analyticsData?.orders?.cancellationRate ?? '0'}%</Text><Text style={s.statLabel}>Cancel Rate</Text></View>
                </View>
              </View>

              <View style={s.card}>
                <Text style={s.cardTitle}>📊 Order Value & Basket Size</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.borderColor }}>
                  <Text style={{ color: colors.textMuted }}>Average Order Value (AOV)</Text>
                  <Text style={{ color: colors.textMain, fontWeight: '700' }}>₹{analyticsData?.orders?.averageOrderValue ?? 0}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
                  <Text style={{ color: colors.textMuted }}>Average Items per Order</Text>
                  <Text style={{ color: colors.textMain, fontWeight: '700' }}>{analyticsData?.orders?.averageItemsPerOrder ?? '0.0'} items</Text>
                </View>
              </View>

              <View style={s.card}>
                <Text style={s.cardTitle}>📅 Orders by Weekday</Text>
                {Object.entries(analyticsData?.orders?.ordersByWeekday || { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 }).map(([day, cnt]) => (
                  <View key={day} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
                    <Text style={{ color: colors.textMain, fontWeight: '600' }}>{day}</Text>
                    <Text style={{ color: colors.adminAccent, fontWeight: '700' }}>{String(cnt)} orders</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* 2. CUSTOMERS METRICS */}
          {analyticsCategory === 'customers' && (
            <View>
              <View style={s.card}>
                <Text style={s.cardTitle}>👥 Customer Base & Retention</Text>
                <View style={s.statsGrid}>
                  <View style={s.statCard}><Text style={[s.statValue, { color: '#8B5CF6' }]}>{analyticsData?.customers?.totalRegisteredUsers ?? stats.users}</Text><Text style={s.statLabel}>Registered</Text></View>
                  <View style={s.statCard}><Text style={[s.statValue, { color: '#10B981' }]}>{analyticsData?.customers?.uniqueOrderingCustomers ?? 0}</Text><Text style={s.statLabel}>Unique Buyers</Text></View>
                  <View style={s.statCard}><Text style={[s.statValue, { color: '#3B82F6' }]}>{analyticsData?.customers?.repeatCustomers ?? 0}</Text><Text style={s.statLabel}>Repeat Buyers</Text></View>
                  <View style={s.statCard}><Text style={[s.statValue, { color: '#F59E0B' }]}>{analyticsData?.customers?.repeatRate ?? '0'}%</Text><Text style={s.statLabel}>Repeat Rate</Text></View>
                </View>
              </View>

              <View style={s.card}>
                <Text style={s.cardTitle}>⚡ Active Customer Velocity</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.borderColor }}>
                  <Text style={{ color: colors.textMuted }}>Daily Active Buyers (1d)</Text>
                  <Text style={{ color: colors.textMain, fontWeight: '700' }}>{analyticsData?.customers?.activeDaily ?? 0}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.borderColor }}>
                  <Text style={{ color: colors.textMuted }}>Weekly Active Buyers (7d)</Text>
                  <Text style={{ color: colors.textMain, fontWeight: '700' }}>{analyticsData?.customers?.activeWeekly ?? 0}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.borderColor }}>
                  <Text style={{ color: colors.textMuted }}>Monthly Active Buyers (30d)</Text>
                  <Text style={{ color: colors.textMain, fontWeight: '700' }}>{analyticsData?.customers?.activeMonthly ?? 0}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.borderColor }}>
                  <Text style={{ color: colors.textMuted }}>Signup-to-Order Conversion</Text>
                  <Text style={{ color: '#10B981', fontWeight: '700' }}>{analyticsData?.customers?.conversionRate ?? '0'}%</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
                  <Text style={{ color: colors.textMuted }}>Orders per Active Customer</Text>
                  <Text style={{ color: colors.textMain, fontWeight: '700' }}>{analyticsData?.customers?.ordersPerActiveCustomer ?? '1.0'}</Text>
                </View>
              </View>
            </View>
          )}

          {/* 3. DELIVERY METRICS */}
          {analyticsCategory === 'delivery' && (
            <View>
              <View style={s.card}>
                <Text style={s.cardTitle}>🛵 Fleet & SLA Performance</Text>
                <View style={s.statsGrid}>
                  <View style={s.statCard}><Text style={[s.statValue, { color: '#F59E0B' }]}>{analyticsData?.delivery?.totalRiders ?? 0}</Text><Text style={s.statLabel}>Active Riders</Text></View>
                  <View style={s.statCard}><Text style={[s.statValue, { color: '#10B981' }]}>{analyticsData?.delivery?.completedDeliveries ?? 0}</Text><Text style={s.statLabel}>Completed</Text></View>
                  <View style={s.statCard}><Text style={[s.statValue, { color: '#3B82F6' }]}>{analyticsData?.delivery?.onTimeDeliveryRate ?? '95'}%</Text><Text style={s.statLabel}>On-Time Rate</Text></View>
                  <View style={s.statCard}><Text style={[s.statValue, { color: '#8B5CF6' }]}>{analyticsData?.delivery?.ordersPerRider ?? '0'}</Text><Text style={s.statLabel}>Orders/Rider</Text></View>
                </View>
              </View>

              <View style={s.card}>
                <Text style={s.cardTitle}>⏱️ Turnaround & Payouts</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.borderColor }}>
                  <Text style={{ color: colors.textMuted }}>Average Delivery Time</Text>
                  <Text style={{ color: colors.textMain, fontWeight: '700' }}>{analyticsData?.delivery?.avgDeliveryTime ?? '18 mins'}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.borderColor }}>
                  <Text style={{ color: colors.textMuted }}>Average Store Prep Time</Text>
                  <Text style={{ color: colors.textMain, fontWeight: '700' }}>{analyticsData?.delivery?.avgPrepTime ?? '12 mins'}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.borderColor }}>
                  <Text style={{ color: colors.textMuted }}>Estimated Rider Payouts</Text>
                  <Text style={{ color: '#F59E0B', fontWeight: '700' }}>₹{analyticsData?.delivery?.riderEstimatedPayout ?? 0}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
                  <Text style={{ color: colors.textMuted }}>Average Payout per Delivery</Text>
                  <Text style={{ color: colors.textMain, fontWeight: '700' }}>₹{analyticsData?.delivery?.avgPayoutPerDelivery ?? 20}</Text>
                </View>
              </View>
            </View>
          )}

          {/* 4. STORE PERFORMANCE */}
          {analyticsCategory === 'store' && (
            <View>
              <View style={s.card}>
                <Text style={s.cardTitle}>🏪 Store Operations Breakdown</Text>
                <Text style={[s.rowSub, { marginBottom: spacing.md }]}>Total Active Outlets: {analyticsData?.storePerformance?.totalActiveStores ?? stores.length}</Text>
                {Object.entries(analyticsData?.storePerformance?.storeStats || {}).map(([sName, stat]: [string, any]) => (
                  <View key={sName} style={{ paddingVertical: 10, borderBottomWidth: 1, borderColor: colors.borderColor }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ color: colors.textMain, fontWeight: '700', fontSize: 14 }}>{sName}</Text>
                      <Text style={{ color: '#10B981', fontWeight: '700' }}>₹{stat.sales}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: colors.textMuted, fontSize: 12 }}>Orders: {stat.totalOrders} (Delivered: {stat.delivered})</Text>
                      <Text style={{ color: colors.adminAccent, fontSize: 12, fontWeight: '600' }}>Acceptance: {stat.acceptanceRate}%</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* 5. FINANCE METRICS */}
          {analyticsCategory === 'finance' && (
            <View>
              <View style={s.card}>
                <Text style={s.cardTitle}>💰 Financial Statement & Margins</Text>
                <View style={s.statsGrid}>
                  <View style={s.statCard}><Text style={[s.statValue, { color: '#10B981' }]}>₹{fmt(analyticsData?.finance?.gmv ?? 0)}</Text><Text style={s.statLabel}>GMV</Text></View>
                  <View style={s.statCard}><Text style={[s.statValue, { color: '#8B5CF6' }]}>₹{fmt(analyticsData?.finance?.totalContribution ?? 0)}</Text><Text style={s.statLabel}>Net Margin</Text></View>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.borderColor }}>
                  <Text style={{ color: colors.textMuted }}>Delivery Fees Collected</Text>
                  <Text style={{ color: colors.textMain, fontWeight: '700' }}>₹{analyticsData?.finance?.deliveryFeesCollected ?? 0}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.borderColor }}>
                  <Text style={{ color: colors.textMuted }}>Platform Fees Collected</Text>
                  <Text style={{ color: colors.textMain, fontWeight: '700' }}>₹{analyticsData?.finance?.platformFeesCollected ?? 0}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.borderColor }}>
                  <Text style={{ color: colors.textMuted }}>Estimated Store Commission (10%)</Text>
                  <Text style={{ color: '#10B981', fontWeight: '700' }}>₹{analyticsData?.finance?.storeCommission ?? 0}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.borderColor }}>
                  <Text style={{ color: colors.textMuted }}>Discounts & Coupons Funded</Text>
                  <Text style={{ color: '#EF4444', fontWeight: '700' }}>-₹{analyticsData?.finance?.zappitDiscounts ?? 0}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.borderColor }}>
                  <Text style={{ color: colors.textMuted }}>Payment Gateway Fees (2%)</Text>
                  <Text style={{ color: '#EF4444', fontWeight: '700' }}>-₹{analyticsData?.finance?.paymentGatewayFees ?? 0}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
                  <Text style={{ color: colors.textMuted }}>Contribution per Delivered Order</Text>
                  <Text style={{ color: colors.adminAccent, fontWeight: '700', fontSize: 16 }}>₹{analyticsData?.finance?.contributionPerOrder ?? 0}</Text>
                </View>
              </View>
            </View>
          )}

          {/* 6. GROWTH & MARKETING */}
          {analyticsCategory === 'growth' && (
            <View>
              <View style={s.card}>
                <Text style={s.cardTitle}>🚀 Growth & Acquisition</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.borderColor }}>
                  <Text style={{ color: colors.textMuted }}>Campus Students Reached (Est)</Text>
                  <Text style={{ color: colors.textMain, fontWeight: '700' }}>{analyticsData?.growth?.estimatedStudentsReached ?? 0}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.borderColor }}>
                  <Text style={{ color: colors.textMuted }}>Orders with Coupons / Referrals</Text>
                  <Text style={{ color: colors.adminAccent, fontWeight: '700' }}>{analyticsData?.growth?.couponUsageCount ?? 0}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.borderColor }}>
                  <Text style={{ color: colors.textMuted }}>Est. Referral Orders</Text>
                  <Text style={{ color: '#F59E0B', fontWeight: '700' }}>{analyticsData?.growth?.referralUsage ?? 0}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
                  <Text style={{ color: colors.textMuted }}>Customer Acquisition Cost (CAC)</Text>
                  <Text style={{ color: '#10B981', fontWeight: '700' }}>₹{analyticsData?.growth?.cac ?? 0}</Text>
                </View>
              </View>
            </View>
          )}

          {/* 7. LIVE OPERATIONS */}
          {analyticsCategory === 'live' && (
            <View>
              <View style={s.card}>
                <Text style={s.cardTitle}>🔥 Live Operations (Today)</Text>
                <View style={s.statsGrid}>
                  <View style={s.statCard}><Text style={[s.statValue, { color: '#F59E0B' }]}>{analyticsData?.liveOperations?.ordersReceivedToday ?? 0}</Text><Text style={s.statLabel}>Received Today</Text></View>
                  <View style={s.statCard}><Text style={[s.statValue, { color: '#10B981' }]}>{analyticsData?.liveOperations?.completedOrdersToday ?? 0}</Text><Text style={s.statLabel}>Completed</Text></View>
                  <View style={s.statCard}><Text style={[s.statValue, { color: '#EF4444' }]}>{analyticsData?.liveOperations?.liveAwaitingAcceptance ?? 0}</Text><Text style={s.statLabel}>Pending Accept</Text></View>
                  <View style={s.statCard}><Text style={[s.statValue, { color: '#3B82F6' }]}>{analyticsData?.liveOperations?.livePreparing ?? 0}</Text><Text style={s.statLabel}>In Kitchen</Text></View>
                  <View style={s.statCard}><Text style={[s.statValue, { color: '#8B5CF6' }]}>{analyticsData?.liveOperations?.liveReady ?? 0}</Text><Text style={s.statLabel}>Ready Pickup</Text></View>
                  <View style={s.statCard}><Text style={[s.statValue, { color: '#06B6D4' }]}>{analyticsData?.liveOperations?.liveOutForDelivery ?? 0}</Text><Text style={s.statLabel}>Out for Delivery</Text></View>
                </View>
              </View>
            </View>
          )}

          {/* 8. TARGETS & ALERTS */}
          {analyticsCategory === 'targets' && (
            <View>
              <View style={s.card}>
                <Text style={s.cardTitle}>🎯 Operational Targets & Thresholds</Text>
                {[
                  { label: 'Daily Order Target', target: '100 orders', status: 'In Progress' },
                  { label: 'Weekly Order Target', target: '700 orders', status: 'In Progress' },
                  { label: 'Monthly Active Customers', target: '500 users', status: 'Active' },
                  { label: 'Target Repeat Rate', target: '40.0%', status: 'Healthy' },
                  { label: 'Max Cancellation Rate Allowed', target: '5.0%', status: 'Within Limits' },
                  { label: 'Min On-Time Delivery Rate', target: '95.0%', status: 'Target Met' },
                  { label: 'Target Order Value (AOV)', target: '₹180', status: 'Tracked' },
                ].map((t, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.borderColor }}>
                    <View>
                      <Text style={{ color: colors.textMain, fontWeight: '600' }}>{t.label}</Text>
                      <Text style={{ color: colors.textMuted, fontSize: 12 }}>Target: {t.target}</Text>
                    </View>
                    <View style={[s.badge, { backgroundColor: 'rgba(16,185,129,0.15)', alignSelf: 'center' }]}>
                      <Text style={{ color: '#10B981', fontSize: 11, fontWeight: '700' }}>{t.status}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

        </ScrollView>
      )}

      {activeTab === 'orders' && (
        <View style={{ flex: 1 }}>
          <View style={s.searchRow}>
            <TextInput style={s.searchInput} value={orderSearch} onChangeText={setOrderSearch}
              placeholder="Search order ID or address..." placeholderTextColor={colors.textMuted} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 42 }} contentContainerStyle={{ paddingHorizontal: spacing.md, gap: 8, paddingVertical: 6 }}>
            {[{ id: 'all', name: 'All Colleges' }, ...colleges].map(c => (
              <TouchableOpacity key={c.id || 'all'}
                style={[s.filterChip, collegeFilter === (c.id || 'all') && s.filterChipActive]}
                onPress={() => setCollegeFilter(c.id || 'all')}>
                <Text style={[s.filterChipText, collegeFilter === (c.id || 'all') && s.filterChipTextActive]}>
                  {c.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <FlatList
            data={filteredOrders}
            keyExtractor={item => item.id || item._id}
            contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.adminAccent} />}
            ListEmptyComponent={<View style={s.emptyState}><Text style={s.empty}>No orders found</Text></View>}
            renderItem={({ item: o }) => {
              const id = (o.id || o._id || '').slice(-6).toUpperCase();
              const st = o.order_status || 'unknown';
              const items = Array.isArray(o.items) ? o.items : [];
              const total = items.reduce((sum: number, i: any) => sum + ((i.price || 0) * (i.qty || i.quantity || 1)), 0);
              return (
                <TouchableOpacity style={s.orderCard} onPress={() => changeOrderStatus(o)}>
                  <View style={s.orderHeader}>
                    <Text style={s.orderIdText}>#{id}</Text>
                    <View style={[s.badge, { backgroundColor: (STATUS_COLORS[st] || '#666') + '22' }]}>
                      <Text style={[s.badgeText, { color: STATUS_COLORS[st] || '#999' }]}>{st.replace(/_/g, ' ')}</Text>
                    </View>
                  </View>
                  {o.delivery_address ? <Text style={s.rowSub}>📍 {o.delivery_address}</Text> : null}
                  <Text style={s.rowSub}>🏫 {o.college_name || o.college_id || '-'}  |  🏪 {o.store_name || '-'}</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderColor }}>
                    <Text style={{ color: colors.textMuted, fontSize: 13 }}>{items.length} item(s)</Text>
                    <Text style={{ color: colors.adminAccent, fontWeight: '700', fontSize: 15 }}>₹{total}</Text>
                  </View>
                  <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 4 }}>Tap to change status</Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}

      {activeTab === 'stores' && (
        <View style={{ flex: 1 }}>
          <View style={s.actionBar}>
            <TouchableOpacity style={s.addBtn} onPress={() => openModal('store')}>
              <Text style={s.addBtnText}>+ Add Store</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.addBtn, { backgroundColor: 'rgba(139,92,246,0.15)', borderColor: colors.adminAccent }]}
              onPress={() => openModal('storeOwner')}>
              <Text style={[s.addBtnText, { color: colors.adminAccent }]}>+ Create Owner</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={stores}
            keyExtractor={item => item.id || item._id}
            contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.adminAccent} />}
            ListEmptyComponent={<View style={s.emptyState}><Text style={s.empty}>No stores yet</Text></View>}
            renderItem={({ item: st }) => (
              <View style={s.listCard}>
                <View style={{ flex: 1 }}>
                  <Text style={s.listTitle}>{st.name}</Text>
                  <Text style={s.rowSub}>{st.college_name || 'No college'}</Text>
                  {st.description ? <Text style={[s.rowSub, { marginTop: 2 }]}>{st.description}</Text> : null}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 8 }}>
                  <View style={[s.badge, { backgroundColor: st.is_open ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)' }]}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: st.is_open ? '#10B981' : '#EF4444' }}>
                      {st.is_open ? 'OPEN' : 'CLOSED'}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity onPress={() => openModal('store', { id: st.id || st._id, ...st })}>
                      <Text style={{ color: colors.adminAccent, fontSize: 13, fontWeight: '600' }}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => confirmDelete('stores', st.id || st._id, st.name)}>
                      <Text style={{ color: '#EF4444', fontSize: 13, fontWeight: '600' }}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          />
        </View>
      )}

      {activeTab === 'colleges' && (
        <View style={{ flex: 1 }}>
          <View style={s.actionBar}>
            <TouchableOpacity style={s.addBtn} onPress={() => openModal('college')}>
              <Text style={s.addBtnText}>+ Add College</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={colleges}
            keyExtractor={item => item.id || item._id}
            contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.adminAccent} />}
            ListEmptyComponent={<View style={s.emptyState}><Text style={s.empty}>No colleges yet</Text></View>}
            renderItem={({ item: col }) => (
              <View style={s.listCard}>
                <View style={{ flex: 1 }}>
                  <Text style={s.listTitle}>{col.name}</Text>
                  {col.city ? <Text style={s.rowSub}>{col.city}</Text> : null}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 8 }}>
                  <Switch
                    value={col.isActive !== false}
                    onValueChange={async (val) => {
                      try {
                        await adminApi.saveCollege({ id: col.id || col._id, ...col, isActive: val });
                        fetchAll();
                      } catch (e) { Alert.alert('Error', 'Failed to update.'); }
                    }}
                    trackColor={{ false: '#374151', true: 'rgba(139,92,246,0.3)' }}
                    thumbColor={col.isActive !== false ? colors.adminAccent : '#9CA3AF'}
                  />
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity onPress={() => openModal('college', { id: col.id || col._id, ...col })}>
                      <Text style={{ color: colors.adminAccent, fontSize: 13, fontWeight: '600' }}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => confirmDelete('colleges', col.id || col._id, col.name)}>
                      <Text style={{ color: '#EF4444', fontSize: 13, fontWeight: '600' }}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          />
        </View>
      )}

      {activeTab === 'banners' && (
        <View style={{ flex: 1 }}>
          <View style={s.actionBar}>
            <TouchableOpacity style={s.addBtn} onPress={() => openModal('banner')}>
              <Text style={s.addBtnText}>+ Add Banner</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={banners}
            keyExtractor={item => item.id || item._id}
            contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.adminAccent} />}
            ListEmptyComponent={<View style={s.emptyState}><Text style={s.empty}>No banners yet</Text></View>}
            renderItem={({ item: b }) => (
              <View style={s.listCard}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.listTitle, { fontSize: 12, fontFamily: 'monospace' }]} numberOfLines={1}>{b.imageUrl || b.image || 'No image URL'}</Text>
                  {b.coupon_code ? <Text style={s.rowSub}>🏷️ Coupon: {b.coupon_code}</Text> : null}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 8 }}>
                  <Switch
                    value={b.isActive !== false}
                    onValueChange={async (val) => {
                      try { await adminApi.saveBanner({ id: b.id || b._id, ...b, isActive: val }); fetchAll(); }
                      catch (e) { Alert.alert('Error', 'Failed to update.'); }
                    }}
                    trackColor={{ false: '#374151', true: 'rgba(139,92,246,0.3)' }}
                    thumbColor={b.isActive !== false ? colors.adminAccent : '#9CA3AF'}
                  />
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity onPress={() => openModal('banner', { id: b.id || b._id, ...b })}>
                      <Text style={{ color: colors.adminAccent, fontSize: 13, fontWeight: '600' }}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => confirmDelete('banners', b.id || b._id, 'Banner')}>
                      <Text style={{ color: '#EF4444', fontSize: 13, fontWeight: '600' }}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          />
        </View>
      )}

      {activeTab === 'coupons' && (
        <View style={{ flex: 1 }}>
          <View style={s.actionBar}>
            <TouchableOpacity style={s.addBtn} onPress={() => openModal('coupon')}>
              <Text style={s.addBtnText}>+ Add Coupon</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={coupons}
            keyExtractor={item => item.code || item._id}
            contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.adminAccent} />}
            ListEmptyComponent={<View style={s.emptyState}><Text style={s.empty}>No coupons yet</Text></View>}
            renderItem={({ item: c }) => (
              <View style={s.listCard}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.listTitle, { color: colors.adminAccent }]}>{c.code}</Text>
                  <Text style={s.rowSub}>
                    {c.type === 'flat' ? `₹${c.discount} off` : `${c.discount}% off`}
                    {c.minOrder ? ` • Min ₹${c.minOrder}` : ''}
                  </Text>
                  {c.maxUses ? <Text style={s.rowSub}>Uses: {c.usedCount || 0}/{c.maxUses}</Text> : null}
                </View>
                <TouchableOpacity onPress={() => confirmDelete('coupons', c.code, c.code)}>
                  <Text style={{ color: '#EF4444', fontSize: 13, fontWeight: '600' }}>Delete</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        </View>
      )}

      {activeTab === 'notifications' && (
        <ScrollView contentContainerStyle={s.page}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.adminAccent} />}>

          <View style={s.card}>
            <Text style={s.cardTitle}>📢 Send Push Notification</Text>
            <Text style={[s.rowSub, { marginBottom: spacing.md }]}>
              Send a notification to all customers, or target a specific college.
            </Text>

            <Text style={s.formLabel}>Title *</Text>
            <TextInput
              style={s.formInput}
              value={notifTitle}
              onChangeText={setNotifTitle}
              placeholder="e.g. 🎉 Special Offer Today!"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={s.formLabel}>Message *</Text>
            <TextInput
              style={[s.formInput, { height: 100, textAlignVertical: 'top', paddingTop: 12 }]}
              value={notifBody}
              onChangeText={setNotifBody}
              placeholder="e.g. Get 20% off all orders this weekend. Use code SAVE20!"
              placeholderTextColor={colors.textMuted}
              multiline
            />

            <Text style={s.formLabel}>Target College (optional — leave blank for all)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.lg }}>
              <TouchableOpacity
                style={[s.chip, !notifCollege && s.chipActive]}
                onPress={() => setNotifCollege('')}>
                <Text style={[s.chipText, !notifCollege && s.chipTextActive]}>🌍 All Colleges</Text>
              </TouchableOpacity>
              {colleges.map(col => {
                const cId = col.id || col._id;
                return (
                  <TouchableOpacity key={cId}
                    style={[s.chip, notifCollege === cId && s.chipActive]}
                    onPress={() => setNotifCollege(notifCollege === cId ? '' : cId)}>
                    <Text style={[s.chipText, notifCollege === cId && s.chipTextActive]}>🎓 {col.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={[s.addBtn, { paddingVertical: 14, borderRadius: 14 }]}
              disabled={notifSending || !notifTitle.trim() || !notifBody.trim()}
              onPress={async () => {
                setNotifSending(true);
                try {
                  const res = await adminApi.sendBroadcastNotification(
                    notifTitle.trim(),
                    notifBody.trim(),
                    notifCollege || undefined
                  );
                  if (res.success) {
                    Alert.alert(
                      '✅ Notifications Sent!',
                      `Successfully sent to ${res.sent} user(s).\n${res.failed ? `${res.failed} failed.` : ''}`,
                    );
                    setNotifTitle('');
                    setNotifBody('');
                    setNotifCollege('');
                  } else {
                    Alert.alert('Info', res.message || 'No users found to notify.');
                  }
                } catch (err: any) {
                  Alert.alert('Error', err?.response?.data?.error || err.message || 'Failed to send.');
                } finally {
                  setNotifSending(false);
                }
              }}>
              {notifSending
                ? <ActivityIndicator color={colors.adminAccent} />
                : <Text style={[s.addBtnText, { fontSize: 15 }]}>📤 Send Notification</Text>
              }
            </TouchableOpacity>
          </View>

          <View style={[s.card, { backgroundColor: 'rgba(255,193,7,0.05)' }]}>
            <Text style={s.cardTitle}>ℹ️ How Push Notifications Work</Text>
            <Text style={[s.rowSub, { lineHeight: 20 }]}>
              {'• Customers receive notifications when they open the app for the first time and grant permission.\n\n• Order status updates (Preparing, Ready, etc.) are sent automatically.\n\n• Broadcast notifications go to all registered customers — use responsibly!'}
            </Text>
          </View>
        </ScrollView>
      )}

      {activeTab === 'control' && (
        <ScrollView contentContainerStyle={s.page}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.adminAccent} />}>

          <View style={[s.card, {
            borderWidth: 2,
            borderColor: isMaintenance ? '#EF4444' : '#10B981',
            backgroundColor: isMaintenance ? 'rgba(239,68,68,0.06)' : 'rgba(16,185,129,0.06)',
          }]}>
            <Text style={s.cardTitle}>🛑 Maintenance Mode</Text>
            <Text style={[s.rowSub, { marginBottom: spacing.lg }]}>
              When ON, the customer app is blocked and shows a maintenance screen. Orders stop immediately.
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg }}>
              <View style={{ flex: 1 }}>
                <Text style={[s.listTitle, { color: isMaintenance ? '#EF4444' : '#10B981', fontSize: 18 }]}>
                  {isMaintenance ? '🔴 Orders STOPPED' : '🟢 Orders OPEN'}
                </Text>
                <Text style={s.rowSub}>
                  {isMaintenance ? 'Customers see maintenance screen' : 'Customers can order normally'}
                </Text>
              </View>
              <Switch
                value={isMaintenance}
                onValueChange={async (val) => {
                  setSavingMaintenance(true);
                  setIsMaintenance(val);
                  try {
                    await adminApi.setMaintenance(val);
                    Alert.alert(
                      val ? '🔴 Maintenance ON' : '🟢 Maintenance OFF',
                      val ? 'Customer app is now blocked.' : 'Customer app is now accessible.'
                    );
                  } catch (e: any) {
                    Alert.alert('Error', e.message || 'Failed to update.');
                    setIsMaintenance(!val);
                  } finally {
                    setSavingMaintenance(false);
                  }
                }}
                trackColor={{ false: '#374151', true: 'rgba(239,68,68,0.5)' }}
                thumbColor={isMaintenance ? '#EF4444' : '#10B981'}
                disabled={savingMaintenance}
              />
            </View>

            {savingMaintenance && (
              <ActivityIndicator color={colors.adminAccent} style={{ marginTop: 8 }} />
            )}
          </View>
        </ScrollView>
      )}

      {/* ── MODAL FORM ── */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.modalTitle}>
                {modalType === 'college' ? '🎓 ' : modalType === 'store' ? '🏪 ' : modalType === 'banner' ? '🖼️ ' : modalType === 'coupon' ? '🏷️ ' : '👤 '}
                {formData.id ? 'Edit' : 'Add'} {modalType === 'storeOwner' ? 'Store Owner' : modalType.charAt(0).toUpperCase() + modalType.slice(1)}
              </Text>

              {/* COLLEGE FORM */}
              {modalType === 'college' && (
                <>
                  <Text style={s.formLabel}>College Name *</Text>
                  <TextInput style={s.formInput} value={formData.name} onChangeText={v => setFormData((p: any) => ({ ...p, name: v }))}
                    placeholder="e.g. IIT Delhi" placeholderTextColor={colors.textMuted} />
                  <Text style={s.formLabel}>City</Text>
                  <TextInput style={s.formInput} value={formData.city} onChangeText={v => setFormData((p: any) => ({ ...p, city: v }))}
                    placeholder="e.g. New Delhi" placeholderTextColor={colors.textMuted} />
                  <View style={s.switchRow}>
                    <Text style={s.formLabel}>Active</Text>
                    <Switch value={formData.isActive !== false} onValueChange={v => setFormData((p: any) => ({ ...p, isActive: v }))}
                      trackColor={{ false: '#374151', true: 'rgba(139,92,246,0.3)' }} thumbColor={formData.isActive !== false ? colors.adminAccent : '#9CA3AF'} />
                  </View>

                  <Text style={[s.formLabel, { marginTop: spacing.md }]}>Delivery Blocks (Optional)</Text>
                  <Text style={[s.rowSub, { marginBottom: spacing.md }]}>Add blocks/hostels for address selection and block-specific delivery fees.</Text>
                  
                  {(formData.blocks || []).map((b: any, i: number) => (
                    <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                      <TextInput 
                        style={[s.formInput, { flex: 2, marginBottom: 0 }]} 
                        value={b.name} 
                        onChangeText={v => {
                          const newBlocks = [...formData.blocks];
                          newBlocks[i].name = v;
                          setFormData((p: any) => ({ ...p, blocks: newBlocks }));
                        }} 
                        placeholder="Block Name" 
                        placeholderTextColor={colors.textMuted} 
                      />
                      <TextInput 
                        style={[s.formInput, { flex: 1, marginBottom: 0 }]} 
                        value={String(b.deliveryFee ?? 0)} 
                        onChangeText={v => {
                          const newBlocks = [...formData.blocks];
                          newBlocks[i].deliveryFee = Number(v) || 0;
                          setFormData((p: any) => ({ ...p, blocks: newBlocks }));
                        }} 
                        placeholder="Fee (₹)" 
                        placeholderTextColor={colors.textMuted} 
                        keyboardType="numeric" 
                      />
                      <TouchableOpacity onPress={() => {
                        const newBlocks = formData.blocks.filter((_: any, idx: number) => idx !== i);
                        setFormData((p: any) => ({ ...p, blocks: newBlocks }));
                      }}>
                        <Text style={{ color: colors.error, fontSize: 24 }}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  
                  <TouchableOpacity style={[s.addBtn, { backgroundColor: 'rgba(139,92,246,0.15)', marginTop: 8 }]} onPress={() => {
                    const newBlocks = [...(formData.blocks || []), { name: '', deliveryFee: 0 }];
                    setFormData((p: any) => ({ ...p, blocks: newBlocks }));
                  }}>
                    <Text style={[s.addBtnText, { color: colors.adminAccent }]}>+ Add Block</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* STORE FORM */}
              {modalType === 'store' && (
                <>
                  <Text style={s.formLabel}>Store Name *</Text>
                  <TextInput style={s.formInput} value={formData.name} onChangeText={v => setFormData((p: any) => ({ ...p, name: v }))}
                    placeholder="e.g. Campus Cafe" placeholderTextColor={colors.textMuted} />
                  <Text style={s.formLabel}>Description</Text>
                  <TextInput style={s.formInput} value={formData.description} onChangeText={v => setFormData((p: any) => ({ ...p, description: v }))}
                    placeholder="Short description" placeholderTextColor={colors.textMuted} />
                  <Text style={s.formLabel}>Image URL</Text>
                  <TextInput style={s.formInput} value={formData.image} onChangeText={v => setFormData((p: any) => ({ ...p, image: v }))}
                    placeholder="https://..." placeholderTextColor={colors.textMuted} autoCapitalize="none" />
                  <Text style={s.formLabel}>College</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
                    {colleges.map(col => {
                      const active = formData.college_id === (col.id || col._id);
                      return (
                        <TouchableOpacity key={col.id || col._id}
                          style={[s.chip, active && s.chipActive]}
                          onPress={() => setFormData((p: any) => ({ ...p, college_id: col.id || col._id, college_name: col.name }))}>
                          <Text style={[s.chipText, active && s.chipTextActive]}>{col.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                  <View style={s.switchRow}>
                    <Text style={s.formLabel}>Open</Text>
                    <Switch value={formData.is_open !== false} onValueChange={v => setFormData((p: any) => ({ ...p, is_open: v }))}
                      trackColor={{ false: '#374151', true: 'rgba(139,92,246,0.3)' }} thumbColor={formData.is_open !== false ? colors.adminAccent : '#9CA3AF'} />
                  </View>
                </>
              )}

              {/* BANNER FORM */}
              {modalType === 'banner' && (
                <>
                  <Text style={s.formLabel}>Image URL *</Text>
                  <TextInput style={s.formInput} value={formData.imageUrl} onChangeText={v => setFormData((p: any) => ({ ...p, imageUrl: v }))}
                    placeholder="https://..." placeholderTextColor={colors.textMuted} autoCapitalize="none" />
                  <Text style={s.formLabel}>Coupon Code (optional)</Text>
                  <TextInput style={s.formInput} value={formData.coupon_code} onChangeText={v => setFormData((p: any) => ({ ...p, coupon_code: v.toUpperCase() }))}
                    placeholder="e.g. SAVE20" placeholderTextColor={colors.textMuted} autoCapitalize="characters" />
                  <View style={s.switchRow}>
                    <Text style={s.formLabel}>Active</Text>
                    <Switch value={formData.isActive !== false} onValueChange={v => setFormData((p: any) => ({ ...p, isActive: v }))}
                      trackColor={{ false: '#374151', true: 'rgba(139,92,246,0.3)' }} thumbColor={formData.isActive !== false ? colors.adminAccent : '#9CA3AF'} />
                  </View>
                </>
              )}

              {/* COUPON FORM */}
              {modalType === 'coupon' && (
                <>
                  <Text style={s.formLabel}>Coupon Code *</Text>
                  <TextInput style={s.formInput} value={formData.code} onChangeText={v => setFormData((p: any) => ({ ...p, code: v.toUpperCase() }))}
                    placeholder="e.g. SAVE50" placeholderTextColor={colors.textMuted} autoCapitalize="characters" />
                  <Text style={s.formLabel}>Discount Type</Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: spacing.md }}>
                    {['flat', 'percent'].map(t => (
                      <TouchableOpacity key={t} style={[s.chip, formData.type === t && s.chipActive]}
                        onPress={() => setFormData((p: any) => ({ ...p, type: t }))}>
                        <Text style={[s.chipText, formData.type === t && s.chipTextActive]}>{t === 'flat' ? '₹ Flat' : '% Percent'}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={s.formLabel}>Discount Amount *</Text>
                  <TextInput style={s.formInput} value={String(formData.discount || '')} onChangeText={v => setFormData((p: any) => ({ ...p, discount: v }))}
                    placeholder="e.g. 50" placeholderTextColor={colors.textMuted} keyboardType="numeric" />
                  <Text style={s.formLabel}>Min Order Amount</Text>
                  <TextInput style={s.formInput} value={String(formData.minOrder || '')} onChangeText={v => setFormData((p: any) => ({ ...p, minOrder: v }))}
                    placeholder="e.g. 200" placeholderTextColor={colors.textMuted} keyboardType="numeric" />
                  <Text style={s.formLabel}>Max Uses</Text>
                  <TextInput style={s.formInput} value={String(formData.maxUses || '')} onChangeText={v => setFormData((p: any) => ({ ...p, maxUses: v }))}
                    placeholder="e.g. 100" placeholderTextColor={colors.textMuted} keyboardType="numeric" />
                </>
              )}

              {/* STORE OWNER FORM */}
              {modalType === 'storeOwner' && (
                <>
                  <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: spacing.lg, lineHeight: 20 }}>
                    Creates a new Firebase account + Store + Staff profile automatically.
                  </Text>
                  <Text style={s.formLabel}>Email *</Text>
                  <TextInput style={s.formInput} value={formData.email} onChangeText={v => setFormData((p: any) => ({ ...p, email: v }))}
                    placeholder="owner@store.com" placeholderTextColor={colors.textMuted} autoCapitalize="none" keyboardType="email-address" />
                  <Text style={s.formLabel}>Password *</Text>
                  <TextInput style={s.formInput} value={formData.password} onChangeText={v => setFormData((p: any) => ({ ...p, password: v }))}
                    placeholder="Minimum 6 characters" placeholderTextColor={colors.textMuted} secureTextEntry />
                </>
              )}

              <View style={{ flexDirection: 'row', gap: 12, marginTop: spacing.lg }}>
                <TouchableOpacity style={[s.modalBtn, { backgroundColor: colors.borderColor, flex: 1 }]} onPress={closeModal}>
                  <Text style={{ color: colors.textMain, fontWeight: '700' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.modalBtn, { backgroundColor: colors.adminAccent, flex: 1 }]} onPress={handleSave} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Save</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// ── Styles ──
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgColor },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderColor },
  topBarSubtitle: { fontSize: 11, color: colors.adminAccent, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  topBarTitle: { ...typography.h2, color: colors.textMain },
  logoutBtn: { padding: 8 },

  tabBar: { maxHeight: 46, borderBottomWidth: 1, borderBottomColor: colors.borderColor },
  tabBarContent: { paddingHorizontal: spacing.md, gap: 6, paddingVertical: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.borderColor },
  tabActive: { backgroundColor: 'rgba(139,92,246,0.15)', borderColor: colors.adminAccent },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.adminAccent },

  page: { padding: spacing.lg, paddingBottom: 40 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.xl },
  statCard: { width: '47%', backgroundColor: colors.cardBg, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center', borderWidth: 1, borderColor: colors.borderColor },
  statValue: { ...typography.h2, marginTop: 4 },
  statLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase', marginTop: 2 },

  card: { backgroundColor: colors.cardBg, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.borderColor },
  cardTitle: { ...typography.h4, color: colors.textMain, marginBottom: spacing.md },

  row: { flexDirection: 'row', alignItems: 'center' },
  rowTitle: { fontSize: 15, fontWeight: '600', color: colors.textMain },
  rowSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  empty: { color: colors.textMuted, textAlign: 'center', paddingVertical: 20 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },

  searchRow: { padding: spacing.md, paddingBottom: 4 },
  searchInput: { backgroundColor: colors.cardBg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderColor, paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: 14, color: colors.textMain },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.borderColor },
  filterChipActive: { backgroundColor: 'rgba(139,92,246,0.15)', borderColor: colors.adminAccent },
  filterChipText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  filterChipTextActive: { color: colors.adminAccent },

  actionBar: { flexDirection: 'row', gap: 10, padding: spacing.md, paddingBottom: 4 },
  addBtn: { flex: 1, backgroundColor: 'rgba(139,92,246,0.1)', borderWidth: 1, borderColor: colors.adminAccent, borderRadius: radius.md, paddingVertical: 10, alignItems: 'center' },
  addBtnText: { color: colors.adminAccent, fontWeight: '700', fontSize: 14 },

  orderCard: { backgroundColor: colors.cardBg, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.borderColor },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  orderIdText: { fontSize: 15, fontWeight: '700', color: colors.textMain, fontFamily: 'monospace' },

  listCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cardBg, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.borderColor },
  listTitle: { fontSize: 15, fontWeight: '600', color: colors.textMain },

  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.borderColor, marginRight: 8 },
  chipActive: { backgroundColor: 'rgba(139,92,246,0.15)', borderColor: colors.adminAccent },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  chipTextActive: { color: colors.adminAccent },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.xxl, paddingBottom: 40, maxHeight: '90%' },
  modalTitle: { ...typography.h2, color: colors.textMain, marginBottom: spacing.lg },
  formLabel: { ...typography.label, color: colors.textMuted, marginBottom: 4, marginTop: spacing.sm },
  formInput: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderColor, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 15, color: colors.textMain, marginBottom: spacing.sm },
  modalBtn: { paddingVertical: 14, borderRadius: radius.md, alignItems: 'center' },
});

export default AdminDashboardScreen;

