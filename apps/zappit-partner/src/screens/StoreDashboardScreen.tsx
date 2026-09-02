import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList,
  ActivityIndicator, TextInput, Alert, Switch, Modal, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ordersApi } from '../api/orders';
import { storesApi } from '../api/stores';
import { menuApi } from '../api/menu';
import { useAuthStore } from '../store/authStore';
import { colors } from '../theme/colors';
import { typography, spacing, radius } from '../theme/typography';
import { Order, MenuItem } from '../types';

// ── Constants ──
const ORDER_SUB_TABS = [
  { key: 'new', label: '🆕 New' },
  { key: 'preparing', label: '👨‍🍳 Prep' },
  { key: 'ready', label: '🛵 Ready' },
  { key: 'done', label: '✅ Done' },
];

const MAIN_TABS = [
  { key: 'orders', label: '📦 Orders' },
  { key: 'menu', label: '🍽️ Menu' },
  { key: 'analytics', label: '📊 Stats' },
];

const CATEGORIES = ['Snacks', 'Beverages', 'Main Course', 'Desserts', 'Combos', 'Other'];

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  confirmed: { bg: '#FFF7ED', text: '#C2410C', label: '🆕 New Order' },
  preparing: { bg: '#FEF9C3', text: '#854D0E', label: '👨‍🍳 Preparing' },
  ready: { bg: '#E0F2FE', text: '#075985', label: '✅ Ready' },
  out_for_delivery: { bg: '#D1FAE5', text: '#065F46', label: '🛵 Out for Delivery' },
  picked_up: { bg: '#DBEAFE', text: '#1E3A8A', label: '🚴 En Route' },
  delivered: { bg: '#DCFCE7', text: '#14532D', label: '✅ Delivered' },
  cancelled: { bg: '#FEE2E2', text: '#991B1B', label: 'Cancelled' },
};

const StoreDashboardScreen = () => {
  const profile = useAuthStore(s => s.profile);
  const logout = useAuthStore(s => s.logout);
  const staffStoreId = (profile as any)?.store_id;

  const [ordersDateFilter, setOrdersDateFilter] = useState<'today' | 'all'>('today');
  const [isOpen, setIsOpen] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('orders');
  const [orderSubTab, setOrderSubTab] = useState('new');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Menu form state
  const [showMenuForm, setShowMenuForm] = useState(false);
  const [menuForm, setMenuForm] = useState({ name: '', price: '', desc: '', category: 'Snacks', isVeg: true });
  const [editingMenuId, setEditingMenuId] = useState<string | null>(null);
  const [menuSaving, setMenuSaving] = useState(false);
  const [menuCategoryFilter, setMenuCategoryFilter] = useState('All');
  const [timeFilter, setTimeFilter] = useState('today');

  const prevOrderCount = useRef(-1);

  // ── Init: set loading false once staffStoreId is resolved from authStore ──
  useEffect(() => {
    // staffStoreId comes from authStore profile which is resolved asynchronously.
    // Once it's available (or confirmed to be absent), we can clear the loading state.
    setLoading(false);
  }, [staffStoreId]);

  // ── Fetch data ──
  const fetchOrders = useCallback(async () => {
    if (!staffStoreId) return;
    try {
      const res = await ordersApi.getOrders(staffStoreId);
      if (res.success) {
        const filtered = res.orders.filter(
          (o: any) => o.payment_status === 'completed' || o.payment_status === 'paid' || o.payment_status === 'pending'
        );
        setOrders(filtered);

        // New order notification
        const newCount = filtered.filter((o: any) => o.order_status === 'confirmed').length;
        if (newCount > prevOrderCount.current && prevOrderCount.current !== -1) {
          Alert.alert('🔔 New Order!', 'A new order has been received.');
        }
        prevOrderCount.current = newCount;
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    }
  }, [staffStoreId]);

  const fetchStoreData = useCallback(async () => {
    if (!staffStoreId) {
      console.log('[StoreDashboard] fetchStoreData skipped: no staffStoreId');
      return;
    }
    try {
      console.log('[StoreDashboard] fetching store data for', staffStoreId);
      const res = await storesApi.getStoreById(staffStoreId);
      console.log('[StoreDashboard] store res:', res.success, 'menu count:', (res.menu || []).length);
      if (res.success) {
        setIsOpen(res.store.is_open !== false);
        const items = (res.menu || []).map((m: any) => ({ ...m, id: m._id || m.id }));
        setMenuItems(items);
      }
    } catch (err) {
      console.error('[StoreDashboard] Failed to fetch store:', err);
    }
  }, [staffStoreId]);

  useEffect(() => {
    if (!staffStoreId) return;
    fetchOrders();
    fetchStoreData();
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, [staffStoreId, fetchOrders, fetchStoreData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchOrders(), fetchStoreData()]);
    setRefreshing(false);
  };

  // ── Helpers ──
  const getDateObj = (val: any) => {
    if (!val) return new Date(0);
    if (val.toDate) return val.toDate();
    return new Date(val);
  };

  const getItems = (items: any) => {
    if (!items) return [];
    if (Array.isArray(items)) return items;
    return Object.entries(items).map(([id, qty]) => ({ id, name: id, qty, price: 0 }));
  };

  const getOrderSubtotal = (order: any) => {
    const itemsList = getItems(order.items);
    return itemsList.reduce((sum: number, item: any) => sum + ((item.price || 0) * (item.qty || item.quantity || 1)), 0);
  };

  // ── Order Buckets ──
  const filterOrdersByDate = (list: any[]) => {
    if (ordersDateFilter === 'today') {
      const todayStr = new Date().toDateString();
      return list.filter(o => getDateObj(o.created_at).toDateString() === todayStr);
    }
    return list;
  };

  const activeAndCompleted = orders.filter(o => o.order_status !== 'cancelled' && o.order_status !== 'pending');

  // Active orders (new, preparing, ready) should ALWAYS show, regardless of date, so they don't get lost
  const newOrders = activeAndCompleted.filter(o => o.order_status === 'confirmed');
  const preparingOrders = activeAndCompleted.filter(o => o.order_status === 'preparing');
  const readyOrders = activeAndCompleted.filter(o => ['ready', 'out_for_delivery', 'picked_up'].includes(o.order_status));
  
  // Completed orders can be filtered by date
  const completedOrders = filterOrdersByDate(activeAndCompleted.filter(o => ['delivered', 'completed'].includes(o.order_status)));

  const tabOrders = orderSubTab === 'new' ? newOrders
    : orderSubTab === 'preparing' ? preparingOrders
    : orderSubTab === 'ready' ? readyOrders
    : completedOrders;

  const tabCounts: Record<string, number> = {
    new: newOrders.length,
    preparing: preparingOrders.length,
    ready: readyOrders.length,
    done: completedOrders.length,
  };

  // ── Analytics ──
  const getFilteredAnalyticsOrders = () => {
    return activeAndCompleted.filter(o => {
      const orderDate = getDateObj(o.created_at);
      const now = new Date();
      if (timeFilter === 'today') return orderDate.toDateString() === now.toDateString();
      if (timeFilter === 'week') {
        const weekAgo = new Date(); weekAgo.setDate(now.getDate() - 7);
        return orderDate >= weekAgo;
      }
      if (timeFilter === 'month') return orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear();
      return true;
    });
  };

  const analyticsOrders = getFilteredAnalyticsOrders();

  const totalRevenue = analyticsOrders.reduce((s, o) => s + getOrderSubtotal(o), 0);

  const dishStats = analyticsOrders.reduce((acc: any, o: any) => {
    getItems(o.items).forEach((item: any) => {
      if (item?.name) {
        if (!acc[item.name]) acc[item.name] = { count: 0, revenue: 0 };
        const qty = item.qty || item.quantity || 1;
        acc[item.name].count += qty;
        acc[item.name].revenue += (item.price || 0) * qty;
      }
    });
    return acc;
  }, {});
  const topDishes = Object.entries(dishStats).sort((a: any, b: any) => b[1].count - a[1].count).slice(0, 10);

  // ── Actions ──
  const toggleStoreStatus = async () => {
    if (!staffStoreId) return;
    const newStatus = !isOpen;
    try {
      await storesApi.updateStore({ id: staffStoreId, is_open: newStatus });
      setIsOpen(newStatus);
    } catch {
      Alert.alert('Error', 'Failed to toggle store status.');
    }
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    // Optimistic update
    setOrders(prev => prev.map(o => (o.id === orderId || o._id === orderId) ? { ...o, order_status: status } : o));
    try {
      await ordersApi.updateOrderStatus(orderId, status);
      await ordersApi.sendStatusNotification(orderId, status);
    } catch {
      Alert.alert('Error', 'Failed to update order status.');
      fetchOrders(); // Revert
    }
  };

  const saveMenuItem = async () => {
    if (!menuForm.name || !menuForm.price || !staffStoreId) {
      Alert.alert('Missing Info', 'Please fill in name and price.');
      return;
    }
    setMenuSaving(true);
    const data: any = { ...menuForm, price: Number(menuForm.price), is_available: true, store_id: staffStoreId };
    if (editingMenuId) data.id = editingMenuId;
    try {
      const res = await menuApi.saveMenuItem(data);
      if (!res.success) {
        Alert.alert('Error', res.error || 'Unknown error');
        return;
      }
      setMenuForm({ name: '', price: '', desc: '', category: 'Snacks', isVeg: true });
      setEditingMenuId(null);
      setShowMenuForm(false);
      fetchStoreData();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || err.message || 'Failed to save.');
    } finally {
      setMenuSaving(false);
    }
  };

  const deleteMenuItem = (id: string) => {
    Alert.alert('Delete Item', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await menuApi.deleteMenuItem(id);
            fetchStoreData();
          } catch {
            Alert.alert('Error', 'Failed to delete item.');
          }
        }
      },
    ]);
  };

  const toggleAvailability = async (item: any) => {
    try {
      await menuApi.toggleAvailability(item.id || item._id, !item.is_available);
      fetchStoreData();
    } catch {
      Alert.alert('Error', 'Failed to toggle availability.');
    }
  };

  // ── Loading State ──
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.storeAccent} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Render: Order Card ──
  const renderOrderCard = ({ item: order }: { item: any }) => {
    const statusInfo = STATUS_COLORS[order.order_status] || { bg: '#333', text: '#fff', label: order.order_status };
    const items = getItems(order.items);
    const orderId = order.id || order._id;

    return (
      <View style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.orderIdText}>#{(orderId || '').slice(-6).toUpperCase()}</Text>
            <Text style={styles.orderTime}>
              {getDateObj(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
            <Text style={[styles.statusBadgeText, { color: statusInfo.text }]}>{statusInfo.label}</Text>
          </View>
        </View>

        <View style={styles.orderItems}>
          {items.map((item: any, i: number) => (
            <Text key={i} style={styles.orderItemText}>
              {item.qty || item.quantity || 1}x {item.name || 'Item'}
              {item.price ? ` — ₹${item.price}` : ''}
            </Text>
          ))}
        </View>

        {order.delivery_address && (
          <Text style={styles.orderAddress}>📍 {order.delivery_address}</Text>
        )}

        <View style={styles.orderFooter}>
          <Text style={styles.orderTotal}>₹{getOrderSubtotal(order)}</Text>

          {order.order_status === 'confirmed' && (
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.storeAccent }]}
              onPress={() => updateOrderStatus(orderId, 'preparing')}>
              <Text style={styles.actionBtnText}>Start Preparing</Text>
            </TouchableOpacity>
          )}
          {order.order_status === 'preparing' && (
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#3B82F6' }]}
              onPress={() => updateOrderStatus(orderId, 'ready')}>
              <Text style={styles.actionBtnText}>Mark Ready</Text>
            </TouchableOpacity>
          )}
          {order.order_status === 'ready' && (
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#8B5CF6' }]}
              onPress={() => updateOrderStatus(orderId, 'out_for_delivery')}>
              <Text style={styles.actionBtnText}>Hand to Delivery</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  // ── Render: Menu Item ──
  const renderMenuItem = ({ item }: { item: any }) => (
    <View style={styles.menuCard}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={[styles.vegBadge, { borderColor: item.isVeg ? colors.vegGreen : colors.nonVegRed }]}>
            <View style={[styles.vegDot, { backgroundColor: item.isVeg ? colors.vegGreen : colors.nonVegRed }]} />
          </View>
          <Text style={styles.menuItemName}>{item.name}</Text>
        </View>
        <Text style={styles.menuItemPrice}>₹{item.price}</Text>
        {item.desc && <Text style={styles.menuItemDesc}>{item.desc}</Text>}
        <Text style={styles.menuItemCategory}>{item.category || 'Uncategorized'}</Text>
      </View>
      <View style={styles.menuActions}>
        <Switch
          value={item.is_available !== false}
          onValueChange={() => toggleAvailability(item)}
          trackColor={{ false: '#374151', true: 'rgba(16,185,129,0.3)' }}
          thumbColor={item.is_available !== false ? colors.storeAccent : '#9CA3AF'}
        />
        <TouchableOpacity onPress={() => {
          setMenuForm({
            name: item.name, price: String(item.price), desc: item.desc || '',
            category: item.category || 'Snacks', isVeg: item.isVeg !== false,
          });
          setEditingMenuId(item.id || item._id);
          setShowMenuForm(true);
        }}>
          <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => deleteMenuItem(item.id || item._id)}>
          <Text style={{ color: colors.error, fontSize: 13, fontWeight: '600' }}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── TOP BAR ── */}
      <View style={styles.topBar}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.topBarSubtitle}>🏪 Store Partner</Text>
          <Text style={styles.topBarTitle} numberOfLines={1}>{(profile as any)?.store_name || 'Dashboard'}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={toggleStoreStatus} style={[styles.statusToggle, { backgroundColor: isOpen ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)' }]}>
            <View style={[styles.statusDot, { backgroundColor: isOpen ? '#86EFAC' : '#FCA5A5' }]} />
            <Text style={[styles.statusToggleText, { color: isOpen ? '#86EFAC' : '#FCA5A5' }]}>{isOpen ? 'OPEN' : 'CLOSED'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
            <Text style={{ fontSize: 16 }}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── STATS ROW ── */}
      <View style={styles.statsRow}>
        {[
          { label: 'Orders', value: orders.length, emoji: '📦' },
          { label: 'Revenue', value: `₹${todayRevenue}`, emoji: '💰' },
          { label: 'New', value: newOrders.length, emoji: '🆕' },
          { label: 'Menu', value: menuItems.length, emoji: '🍽️' },
        ].map(s => (
          <View key={s.label} style={styles.statCard}>
            <Text style={{ fontSize: 16 }}>{s.emoji}</Text>
            <Text style={styles.statValue}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* ── MAIN TABS ── */}
      <View style={styles.mainTabs}>
        {MAIN_TABS.map(t => (
          <TouchableOpacity key={t.key} onPress={() => setActiveTab(t.key)}
            style={[styles.mainTab, activeTab === t.key && styles.mainTabActive]}>
            <Text style={[styles.mainTabText, activeTab === t.key && styles.mainTabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── ORDERS TAB ── */}
      {activeTab === 'orders' && (
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: spacing.md }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subTabsScroll} contentContainerStyle={styles.subTabsContainer}>
              {ORDER_SUB_TABS.map(t => (
                <TouchableOpacity key={t.key} onPress={() => setOrderSubTab(t.key)}
                  style={[styles.subTab, orderSubTab === t.key && styles.subTabActive]}>
                  <Text style={[styles.subTabText, orderSubTab === t.key && styles.subTabTextActive]}>
                    {t.label} ({tabCounts[t.key]})
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            {orderSubTab === 'completed' && (
              <TouchableOpacity
                style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: colors.borderColor }}
                onPress={() => setOrdersDateFilter(prev => prev === 'today' ? 'all' : 'today')}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.storeAccent }}>
                  {ordersDateFilter === 'today' ? 'TODAY' : 'ALL TIME'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          <FlatList
            data={tabOrders}
            renderItem={renderOrderCard}
            keyExtractor={item => item.id || item._id}
            contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.storeAccent} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={{ fontSize: 40, marginBottom: 8 }}>📭</Text>
                <Text style={styles.emptyText}>No orders in this category</Text>
              </View>
            }
          />
        </View>
      )}

      {/* ── MENU TAB ── */}
      {activeTab === 'menu' && (
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, gap: 12 }}>
            <TouchableOpacity style={[styles.addMenuBtn, { flex: 1, marginBottom: 0 }]} onPress={() => {
              setMenuForm({ name: '', price: '', desc: '', category: 'Snacks', isVeg: true });
              setEditingMenuId(null);
              setShowMenuForm(true);
            }}>
              <Text style={styles.addMenuBtnText}>+ Add Item</Text>
            </TouchableOpacity>
          </View>

          <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {['All', ...CATEGORIES].map(cat => (
                <TouchableOpacity key={cat} onPress={() => setMenuCategoryFilter(cat)}
                  style={[styles.catChip, menuCategoryFilter === cat && styles.catChipActive]}>
                  <Text style={[styles.catChipText, menuCategoryFilter === cat && styles.catChipTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <FlatList
            data={menuItems.filter(item => menuCategoryFilter === 'All' || item.category === menuCategoryFilter)}
            renderItem={renderMenuItem}
            keyExtractor={item => item.id || item._id}
            contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.storeAccent} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={{ fontSize: 40, marginBottom: 8 }}>🍽️</Text>
                <Text style={styles.emptyText}>No menu items yet</Text>
              </View>
            }
          />
        </View>
      )}

      {/* ── ANALYTICS TAB ── */}
      {activeTab === 'analytics' && (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.storeAccent} />}>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 8, marginBottom: spacing.md }}>
            {[
              { key: 'today', label: 'Today' },
              { key: 'week', label: 'Week' },
              { key: 'month', label: 'Month' },
              { key: 'all', label: 'All Time' },
            ].map(t => (
              <TouchableOpacity key={t.key} onPress={() => setTimeFilter(t.key as any)}
                style={[styles.subTab, timeFilter === t.key && styles.subTabActive]}>
                <Text style={[styles.subTabText, timeFilter === t.key && styles.subTabTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.analyticsCard}>
            <Text style={styles.analyticsTitle}>📊 Summary</Text>
            <View style={styles.analyticsRow}>
              <View style={styles.analyticsStat}>
                <Text style={styles.analyticsStatValue}>₹{totalRevenue}</Text>
                <Text style={styles.analyticsStatLabel}>Revenue</Text>
              </View>
              <View style={styles.analyticsStat}>
                <Text style={styles.analyticsStatValue}>{analyticsOrders.length}</Text>
                <Text style={styles.analyticsStatLabel}>Orders</Text>
              </View>
              <View style={styles.analyticsStat}>
                <Text style={styles.analyticsStatValue}>{analyticsOrders.filter(o => ['delivered', 'completed'].includes(o.order_status)).length}</Text>
                <Text style={styles.analyticsStatLabel}>Delivered</Text>
              </View>
            </View>
          </View>

          <View style={styles.analyticsCard}>
            <Text style={styles.analyticsTitle}>🏆 Top Selling Dishes</Text>
            {topDishes.length === 0 ? (
              <Text style={styles.emptyText}>No data yet</Text>
            ) : (
              topDishes.map(([name, stats]: [string, any], i) => (
                <View key={name} style={styles.dishRow}>
                  <Text style={styles.dishRank}>#{i + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dishName}>{name}</Text>
                    <Text style={styles.dishStat}>{stats.count} sold • ₹{stats.revenue}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}

      {/* ── MENU FORM MODAL ── */}
      <Modal visible={showMenuForm} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingMenuId ? 'Edit Item' : 'Add New Item'}</Text>

            <Text style={styles.formLabel}>Name *</Text>
            <TextInput style={styles.formInput} value={menuForm.name} onChangeText={t => setMenuForm(p => ({ ...p, name: t }))}
              placeholder="e.g. Paneer Tikka" placeholderTextColor={colors.textMuted} />

            <Text style={styles.formLabel}>Price (₹) *</Text>
            <TextInput style={styles.formInput} value={menuForm.price} onChangeText={t => setMenuForm(p => ({ ...p, price: t }))}
              placeholder="e.g. 120" placeholderTextColor={colors.textMuted} keyboardType="numeric" />

            <Text style={styles.formLabel}>Description</Text>
            <TextInput style={styles.formInput} value={menuForm.desc} onChangeText={t => setMenuForm(p => ({ ...p, desc: t }))}
              placeholder="Optional description" placeholderTextColor={colors.textMuted} />

            <Text style={styles.formLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity key={cat} onPress={() => setMenuForm(p => ({ ...p, category: cat }))}
                  style={[styles.catChip, menuForm.category === cat && styles.catChipActive]}>
                  <Text style={[styles.catChipText, menuForm.category === cat && styles.catChipTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg }}>
              <Text style={styles.formLabel}>Vegetarian</Text>
              <Switch value={menuForm.isVeg} onValueChange={v => setMenuForm(p => ({ ...p, isVeg: v }))}
                trackColor={{ false: '#374151', true: 'rgba(16,185,129,0.3)' }} thumbColor={menuForm.isVeg ? colors.vegGreen : '#9CA3AF'} />
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.borderColor, flex: 1 }]}
                onPress={() => setShowMenuForm(false)}>
                <Text style={{ color: colors.textMain, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.storeAccent, flex: 1 }]}
                onPress={saveMenuItem} disabled={menuSaving}>
                {menuSaving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// ── Styles ──
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgColor },

  // Top Bar
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderColor },
  topBarSubtitle: { fontSize: 11, color: colors.storeAccent, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  topBarTitle: { ...typography.h2, color: colors.textMain },
  statusToggle: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusToggleText: { fontWeight: '800', fontSize: 12 },
  logoutBtn: { padding: 8 },

  // Stats
  statsRow: { flexDirection: 'row', padding: spacing.md, gap: 8 },
  statCard: { flex: 1, backgroundColor: colors.cardBg, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: colors.borderColor },
  statValue: { ...typography.h3, color: colors.textMain, marginTop: 2 },
  statLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase' },

  // Main Tabs
  mainTabs: { flexDirection: 'row', paddingHorizontal: spacing.md, gap: 8, marginBottom: 4 },
  mainTab: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radius.md, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.borderColor },
  mainTabActive: { backgroundColor: colors.storeAccent, borderColor: colors.storeAccent },
  mainTabText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  mainTabTextActive: { color: '#fff' },

  // Order Sub Tabs
  subTabsScroll: { maxHeight: 44 },
  subTabsContainer: { paddingHorizontal: spacing.md, gap: 8, paddingVertical: 6 },
  subTab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.borderColor },
  subTabActive: { backgroundColor: 'rgba(16,185,129,0.15)', borderColor: colors.storeAccent },
  subTabText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  subTabTextActive: { color: colors.storeAccent },

  // Order Card
  orderCard: { backgroundColor: colors.cardBg, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.borderColor },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  orderIdText: { ...typography.h4, color: colors.textMain, fontFamily: 'monospace' },
  orderTime: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  orderItems: { marginBottom: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderColor },
  orderItemText: { fontSize: 14, color: colors.textMain, marginBottom: 2 },
  orderAddress: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.sm },
  orderFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderColor },
  orderTotal: { ...typography.h3, color: colors.storeAccent },
  actionBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // Menu Card
  menuCard: { flexDirection: 'row', backgroundColor: colors.cardBg, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.borderColor },
  vegBadge: { width: 16, height: 16, borderRadius: 3, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  vegDot: { width: 8, height: 8, borderRadius: 4 },
  menuItemName: { ...typography.h4, color: colors.textMain },
  menuItemPrice: { color: colors.storeAccent, fontWeight: '700', fontSize: 15, marginTop: 2 },
  menuItemDesc: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  menuItemCategory: { fontSize: 11, color: colors.primary, fontWeight: '600', marginTop: 4 },
  menuActions: { alignItems: 'flex-end', justifyContent: 'space-between', paddingLeft: spacing.md },

  // Add Menu Button
  addMenuBtn: { backgroundColor: colors.storeAccent, marginHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: 4, paddingVertical: 10, borderRadius: radius.md, alignItems: 'center' },
  addMenuBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  // Analytics
  analyticsCard: { backgroundColor: colors.cardBg, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.borderColor },
  analyticsTitle: { ...typography.h4, color: colors.textMain, marginBottom: spacing.md },
  analyticsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  analyticsStat: { alignItems: 'center' },
  analyticsStatValue: { ...typography.h2, color: colors.storeAccent },
  analyticsStatLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600', marginTop: 2 },
  dishRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderColor },
  dishRank: { fontSize: 14, fontWeight: '800', color: colors.primary, width: 30 },
  dishName: { fontSize: 15, fontWeight: '600', color: colors.textMain },
  dishStat: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  // Empty State
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: colors.textMuted, fontSize: 15 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.xxl, paddingBottom: 40 },
  modalTitle: { ...typography.h2, color: colors.textMain, marginBottom: spacing.lg },
  formLabel: { ...typography.label, color: colors.textMuted, marginBottom: 4, marginTop: spacing.sm },
  formInput: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderColor, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 15, color: colors.textMain, marginBottom: spacing.sm },
  catChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.borderColor, marginRight: 8 },
  catChipActive: { backgroundColor: 'rgba(16,185,129,0.15)', borderColor: colors.storeAccent },
  catChipText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  catChipTextActive: { color: colors.storeAccent },
  modalBtn: { paddingVertical: 14, borderRadius: radius.md, alignItems: 'center' },
});

export default StoreDashboardScreen;
