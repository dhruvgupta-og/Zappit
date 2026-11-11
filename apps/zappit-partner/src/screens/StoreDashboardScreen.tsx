import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList,
  ActivityIndicator, TextInput, Alert, Switch, Modal, RefreshControl, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ordersApi } from '../api/orders';
import { storesApi } from '../api/stores';
import { menuApi } from '../api/menu';
import { useAuthStore } from '../store/authStore';
import { colors } from '../theme/colors';
import { typography, spacing, radius } from '../theme/typography';
import { Order, MenuItem } from '../types';
import { playOrderAlert, startKitchenAlarm, stopKitchenAlarm } from '../utils/notifications';

// ── Constants ──
const ORDER_SUB_TABS = [
  { key: 'new', label: '🆕 New' },
  { key: 'preparing', label: '👨‍🍳 In Prep' },
  { key: 'ready', label: '🛵 Ready' },
  { key: 'done', label: '✅ Done' },
];

const MAIN_TABS = [
  { key: 'orders', label: '📦 Orders' },
  { key: 'menu', label: '🍽️ Menu' },
  { key: 'analytics', label: '📊 Earnings & Stats' },
];

const CATEGORIES = ['Snacks', 'Beverages', 'Main Course', 'Desserts', 'Combos', 'Other'];

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  confirmed: { bg: 'rgba(245,158,11,0.15)', text: '#F59E0B', label: '🆕 New Order' },
  preparing: { bg: 'rgba(59,130,246,0.15)', text: '#60A5FA', label: '👨‍🍳 Preparing' },
  ready: { bg: 'rgba(16,185,129,0.15)', text: '#34D399', label: '🛵 Ready for Rider' },
  out_for_delivery: { bg: 'rgba(139,92,246,0.15)', text: '#A78BFA', label: '🚴 Out for Delivery' },
  picked_up: { bg: 'rgba(139,92,246,0.15)', text: '#A78BFA', label: '🚴 En Route' },
  delivered: { bg: 'rgba(16,185,129,0.2)', text: '#10B981', label: '✅ Delivered' },
  cancelled: { bg: 'rgba(239,68,68,0.15)', text: '#F87171', label: 'Cancelled' },
};

const StoreDashboardScreen = () => {
  const profile = useAuthStore(s => s.profile);
  const logout = useAuthStore(s => s.logout);
  const staffStoreId = (profile as any)?.store_id;

  const [isOpen, setIsOpen] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('orders');
  const [orderSubTab, setOrderSubTab] = useState('new');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Advanced store controls
  const [orderSearch, setOrderSearch] = useState('');
  const [soundAlerts, setSoundAlerts] = useState(true);
  const [isAlarmSilenced, setIsAlarmSilenced] = useState(false);
  const [ordersDateFilter, setOrdersDateFilter] = useState<'today' | 'all'>('today');

  // Menu form state
  const [showMenuForm, setShowMenuForm] = useState(false);
  const [menuForm, setMenuForm] = useState({ name: '', price: '', desc: '', category: 'Snacks', isVeg: true });
  const [editingMenuId, setEditingMenuId] = useState<string | null>(null);
  const [menuSaving, setMenuSaving] = useState(false);

  // Kitchen Prep Time Modal
  const [prepModalOrder, setPrepModalOrder] = useState<any | null>(null);
  const [menuCategoryFilter, setMenuCategoryFilter] = useState('All');
  const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'month' | 'all'>('today');

  const prevOrderCount = useRef(-1);

  useEffect(() => {
    setLoading(false);
  }, [staffStoreId]);

  // ── Fetch orders ──
  const fetchOrders = useCallback(async () => {
    if (!staffStoreId) return;
    try {
      const res = await ordersApi.getOrders(staffStoreId);
      if (res.success) {
        const filtered = (res.orders || []).filter(
          (o: any) => o.payment_status === 'completed' || o.payment_status === 'paid'
        );
        setOrders(filtered);

        // Loud kitchen repeating buzzer alert for waiting orders
        const waitingConfirmed = filtered.filter((o: any) => o.order_status === 'confirmed');
        const waitingCount = waitingConfirmed.length;

        if (waitingCount > 0 && soundAlerts && !isAlarmSilenced) {
          startKitchenAlarm(waitingCount);
        } else if (waitingCount === 0) {
          stopKitchenAlarm();
          setIsAlarmSilenced(false);
        }

        if (waitingCount > prevOrderCount.current && prevOrderCount.current !== -1) {
          Alert.alert('🔔 New Student Order!', `${waitingCount} order(s) waiting in your kitchen queue.`);
        }
        prevOrderCount.current = waitingCount;
      }
    } catch (err) {
      console.error('[StoreDashboard] Failed to fetch orders:', err);
    }
  }, [staffStoreId, soundAlerts, isAlarmSilenced]);

  // ── Fetch store data & menu ──
  const fetchStoreData = useCallback(async () => {
    if (!staffStoreId) return;
    try {
      const res = await storesApi.getStoreById(staffStoreId);
      if (res.success) {
        setIsOpen(res.store?.is_open !== false);
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
    return () => {
      clearInterval(interval);
      stopKitchenAlarm();
    };
  }, [staffStoreId, fetchOrders, fetchStoreData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchOrders(), fetchStoreData()]);
    setRefreshing(false);
  };

  // ── Helpers ──
  const getDateObj = (val: any): Date => {
    if (!val) return new Date(0);
    if (val.toDate) return val.toDate();
    return new Date(val);
  };

  const isToday = (dateVal: any): boolean => {
    const d = getDateObj(dateVal);
    const now = new Date();
    return d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();
  };

  const getTimeAgo = (dateVal: any): string => {
    const diffMs = Math.max(0, Date.now() - getDateObj(dateVal).getTime());
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const getItems = (items: any) => {
    if (!items) return [];
    if (Array.isArray(items)) return items;
    return Object.entries(items).map(([id, qty]) => ({ id, name: id, qty, price: 0 }));
  };

  const getOrderSubtotal = (order: any): number => {
    if (order.total_amount !== undefined && order.total_amount > 0) {
      return Number(order.total_amount);
    }
    const itemsList = getItems(order.items);
    return itemsList.reduce((sum: number, item: any) => sum + ((item.price || 0) * (item.qty || item.quantity || 1)), 0);
  };

  // ── Orders & Metrics Calculation ──
  const activeAndCompleted = orders.filter(o => o.order_status !== 'cancelled' && o.order_status !== 'pending');

  const todayOrdersList = activeAndCompleted.filter(o => isToday(o.created_at));
  const todayEarnings = todayOrdersList.reduce((sum, o) => sum + getOrderSubtotal(o), 0);
  const totalLifetimeEarnings = activeAndCompleted.reduce((sum, o) => sum + getOrderSubtotal(o), 0);
  const todayDeliveredCount = todayOrdersList.filter(o => ['delivered', 'completed'].includes(o.order_status)).length;
  const totalLifetimeDelivered = activeAndCompleted.filter(o => ['delivered', 'completed'].includes(o.order_status)).length;
  const inKitchenCount = activeAndCompleted.filter(o => ['confirmed', 'preparing'].includes(o.order_status)).length;
  const avgOrderValue = todayOrdersList.length > 0
    ? Math.round(todayEarnings / todayOrdersList.length)
    : (activeAndCompleted.length > 0 ? Math.round(totalLifetimeEarnings / activeAndCompleted.length) : 0);

  // Sub-tabs
  const newOrders = activeAndCompleted.filter(o => o.order_status === 'confirmed');
  const preparingOrders = activeAndCompleted.filter(o => o.order_status === 'preparing');
  const readyOrders = activeAndCompleted.filter(o => ['ready', 'out_for_delivery', 'picked_up'].includes(o.order_status));
  const completedOrders = activeAndCompleted.filter(o => ['delivered', 'completed'].includes(o.order_status));

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

  // Filtered by search query
  const filteredTabOrders = tabOrders.filter(o => {
    if (!orderSearch.trim()) return true;
    const q = orderSearch.toLowerCase().trim();
    const id = String(o.id || o._id || '').toLowerCase();
    const userName = String(o.user_name || '').toLowerCase();
    const userPhone = String(o.user_phone || '');
    const addr = String(o.delivery_address || o.address || '').toLowerCase();
    const itemMatch = getItems(o.items).some((it: any) => String(it.name || '').toLowerCase().includes(q));
    return id.includes(q) || userName.includes(q) || userPhone.includes(q) || addr.includes(q) || itemMatch;
  });

  // ── Analytics Tab Calculation ──
  const getFilteredAnalyticsOrders = () => {
    return activeAndCompleted.filter(o => {
      const orderDate = getDateObj(o.created_at);
      const now = new Date();
      if (timeFilter === 'today') return isToday(orderDate);
      if (timeFilter === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        return orderDate >= weekAgo;
      }
      if (timeFilter === 'month') {
        return orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear();
      }
      return true;
    });
  };

  const analyticsOrders = getFilteredAnalyticsOrders();
  const analyticsRevenue = analyticsOrders.reduce((s, o) => s + getOrderSubtotal(o), 0);

  const dishStats = analyticsOrders.reduce((acc: any, o: any) => {
    getItems(o.items).forEach((item: any) => {
      if (item?.name) {
        if (!acc[item.name]) acc[item.name] = { count: 0, revenue: 0 };
        const qty = Number(item.qty || item.quantity || 1);
        acc[item.name].count += qty;
        acc[item.name].revenue += (Number(item.price) || 0) * qty;
      }
    });
    return acc;
  }, {});

  const topDishes = Object.entries(dishStats).sort((a: any, b: any) => b[1].count - a[1].count).slice(0, 8);
  const maxDishCount = topDishes.length > 0 ? (topDishes[0][1] as any).count : 1;

  // ── Actions ──
  const toggleStoreStatus = async () => {
    if (!staffStoreId) return;
    const newStatus = !isOpen;
    try {
      await storesApi.updateStore({ id: staffStoreId, is_open: newStatus });
      setIsOpen(newStatus);
    } catch {
      Alert.alert('Error', 'Failed to toggle store online/offline status.');
    }
  };

  const updateOrderStatus = async (orderId: string, status: string, prepTimeMins?: number) => {
    // If accepting order, stop kitchen alarm
    if (status === 'preparing') {
      const remainingWaiting = orders.filter(o => o.order_status === 'confirmed' && o.id !== orderId && o._id !== orderId).length;
      if (remainingWaiting === 0) {
        stopKitchenAlarm();
        setIsAlarmSilenced(false);
      }
    }
    // Optimistic update
    setOrders(prev => prev.map(o => {
      if (o.id === orderId || o._id === orderId) {
        return {
          ...o,
          order_status: status,
          prep_time_mins: prepTimeMins || o.prep_time_mins,
          expected_ready_at: prepTimeMins ? new Date(Date.now() + prepTimeMins * 60000).toISOString() : o.expected_ready_at,
          accepted_at: status === 'preparing' ? new Date().toISOString() : o.accepted_at,
          ready_at: status === 'ready' ? new Date().toISOString() : o.ready_at,
        };
      }
      return o;
    }));
    try {
      await ordersApi.updateOrderStatus(orderId, status, prepTimeMins ? { prep_time_mins: prepTimeMins } : undefined);
      await ordersApi.sendStatusNotification(orderId, status);
    } catch {
      Alert.alert('Error', 'Failed to update order status.');
      fetchOrders();
    }
  };

  const toggleAvailability = async (item: any) => {
    const nextVal = !item.is_available;
    // Optimistic update
    setMenuItems(prev => prev.map(m => (m.id === item.id || m._id === item.id) ? { ...m, is_available: nextVal } : m));
    try {
      await menuApi.toggleAvailability(item.id || item._id, nextVal);
    } catch {
      Alert.alert('Error', 'Failed to update stock availability.');
      fetchStoreData();
    }
  };

  const saveMenuItem = async () => {
    if (!menuForm.name || !menuForm.price || !staffStoreId) {
      Alert.alert('Missing Info', 'Please fill in item name and price.');
      return;
    }
    setMenuSaving(true);
    const data: any = {
      ...menuForm,
      price: Number(menuForm.price),
      is_available: true,
      store_id: staffStoreId,
    };
    if (editingMenuId) data.id = editingMenuId;
    try {
      const res = await menuApi.saveMenuItem(data);
      if (!res.success) {
        Alert.alert('Error', res.error || 'Failed to save item');
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
    Alert.alert('Delete Dish', 'Are you sure you want to remove this item from your store menu?', [
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

  const exportToExcel = async () => {
    if (analyticsOrders.length === 0) {
      Alert.alert('No Data', 'There are no orders to export for the selected period.');
      return;
    }
    try {
      const headerString = 'Order ID,Date,Status,Customer Name,Phone,Items,Subtotal\n';
      const rowString = analyticsOrders.map(order => {
        const orderId = order.id || order._id || '';
        const dateStr = getDateObj(order.created_at).toLocaleString();
        const status = order.order_status || '';
        const cName = (order.user_name || 'Student').replace(/"/g, '""');
        const cPhone = order.user_phone || '';
        const items = getItems(order.items)
          .map((item: any) => `${item.qty || item.quantity || 1}x ${item.name || 'Item'}`)
          .join(' | ')
          .replace(/"/g, '""');
        const subtotal = getOrderSubtotal(order);
        return `"${orderId}","${dateStr}","${status}","${cName}","${cPhone}","${items}","${subtotal}"`;
      }).join('\n');

      const csvString = `${headerString}${rowString}`;

      try {
        const FS = require('expo-file-system');
        const Share = require('expo-sharing');
        if (FS?.documentDirectory) {
          const fileName = `store_earnings_${Date.now()}.csv`;
          const fileUri = FS.documentDirectory + fileName;
          await FS.writeAsStringAsync(fileUri, csvString, { encoding: FS.EncodingType.UTF8 });
          if (await Share.isAvailableAsync()) {
            await Share.shareAsync(fileUri, {
              mimeType: 'text/csv',
              dialogTitle: 'Save or Share Earnings CSV',
            });
            return;
          }
        }
      } catch (_) {}

      const { Share } = require('react-native');
      await Share.share({
        title: `Store Earnings (${analyticsOrders.length} orders)`,
        message: csvString,
      });
    } catch (error: any) {
      console.error('Export error:', error);
      Alert.alert('Export Failed', error?.message || 'Could not export data.');
    }
  };

  // ── Render: Order Card ──
  const renderOrderCard = ({ item: order }: { item: any }) => {
    const statusInfo = STATUS_COLORS[order.order_status] || { bg: '#333', text: '#fff', label: order.order_status };
    const items = getItems(order.items);
    const orderId = order.id || order._id;
    const timeAgo = getTimeAgo(order.created_at);

    return (
      <View style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.orderIdText}>#{String(orderId).slice(-6).toUpperCase()}</Text>
              <View style={styles.paidBadge}>
                <Text style={styles.paidBadgeText}>✓ PAID</Text>
              </View>
            </View>
            <Text style={styles.orderTime}>
              ⏱️ {timeAgo} • {getDateObj(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
            <Text style={[styles.statusBadgeText, { color: statusInfo.text }]}>{statusInfo.label}</Text>
          </View>
        </View>

        {/* Customer Info & Direct Call */}
        {(order.user_name || order.user_phone) && (
          <View style={styles.customerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.customerName}>👤 {order.user_name || 'Campus Student'}</Text>
              {order.address || order.delivery_address ? (
                <Text style={styles.customerAddress} numberOfLines={1}>
                  📍 {order.delivery_address || order.address}
                </Text>
              ) : null}
            </View>
            {order.user_phone ? (
              <TouchableOpacity
                style={styles.callBtn}
                onPress={() => Linking.openURL(`tel:${order.user_phone}`)}
              >
                <Text style={styles.callBtnText}>📞 Call</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        {/* Special Cooking Note */}
        {order.additional_note ? (
          <View style={styles.noteBox}>
            <Text style={styles.noteTitle}>📝 COOKING NOTE:</Text>
            <Text style={styles.noteContent}>"{order.additional_note}"</Text>
          </View>
        ) : null}

        {/* Items List */}
        <View style={styles.orderItems}>
          {items.map((item: any, i: number) => (
            <View key={i} style={styles.itemRow}>
              <Text style={styles.itemQty}>{item.qty || item.quantity || 1}×</Text>
              <Text style={styles.itemName} numberOfLines={1}>{item.name || 'Dish'}</Text>
              <Text style={styles.itemPrice}>₹{(Number(item.price) || 0) * (Number(item.qty || item.quantity || 1))}</Text>
            </View>
          ))}
        </View>

        {/* Footer Actions */}
        <View style={styles.orderFooter}>
          <View>
            <Text style={styles.footerLabel}>ORDER TOTAL</Text>
            <Text style={styles.orderTotal}>₹{getOrderSubtotal(order)}</Text>
          </View>

          {order.order_status === 'confirmed' && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.storeAccent }]}
              onPress={() => setPrepModalOrder(order)}
            >
              <Text style={styles.actionBtnText}>👨‍🍳 Accept & Set Prep</Text>
            </TouchableOpacity>
          )}

          {order.order_status === 'preparing' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {order.prep_time_mins ? (
                <View style={styles.prepBadge}>
                  <Text style={styles.prepBadgeText}>⏱️ {order.prep_time_mins}m Prep</Text>
                </View>
              ) : null}
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#3B82F6' }]}
                onPress={() => updateOrderStatus(orderId, 'ready')}
              >
                <Text style={styles.actionBtnText}>🛵 Mark Ready</Text>
              </TouchableOpacity>
            </View>
          )}

          {order.order_status === 'ready' && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#8B5CF6' }]}
              onPress={() => updateOrderStatus(orderId, 'out_for_delivery')}
            >
              <Text style={styles.actionBtnText}>📦 Hand to Rider</Text>
            </TouchableOpacity>
          )}

          {order.order_status === 'delivered' && (
            <View style={styles.deliveredBadge}>
              <Text style={styles.deliveredBadgeText}>Delivered ✓</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  // ── Render: Menu Item ──
  const renderMenuItem = ({ item }: { item: any }) => {
    const isAvail = item.is_available !== false;
    return (
      <View style={[styles.menuCard, !isAvail && styles.menuCardUnavailable]}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <View style={[styles.vegBadge, { borderColor: item.isVeg ? colors.vegGreen : colors.nonVegRed }]}>
              <View style={[styles.vegDot, { backgroundColor: item.isVeg ? colors.vegGreen : colors.nonVegRed }]} />
            </View>
            <Text style={[styles.menuItemName, !isAvail && { color: colors.textMuted }]}>{item.name}</Text>
            {!isAvail && (
              <View style={styles.soldOutBadge}>
                <Text style={styles.soldOutText}>SOLD OUT</Text>
              </View>
            )}
          </View>
          <Text style={styles.menuItemPrice}>₹{item.price}</Text>
          {item.desc ? <Text style={styles.menuItemDesc} numberOfLines={2}>{item.desc}</Text> : null}
          <Text style={styles.menuItemCategory}>{item.category || 'Snacks'}</Text>
        </View>

        <View style={styles.menuActions}>
          <View style={{ alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ fontSize: 10, color: isAvail ? colors.storeAccent : colors.textMuted, fontWeight: '700', marginBottom: 2 }}>
              {isAvail ? 'IN STOCK' : 'OUT'}
            </Text>
            <Switch
              value={isAvail}
              onValueChange={() => toggleAvailability(item)}
              trackColor={{ false: '#374151', true: 'rgba(16,185,129,0.3)' }}
              thumbColor={isAvail ? colors.storeAccent : '#9CA3AF'}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity onPress={() => {
              setMenuForm({
                name: item.name, price: String(item.price), desc: item.desc || '',
                category: item.category || 'Snacks', isVeg: item.isVeg !== false,
              });
              setEditingMenuId(item.id || item._id);
              setShowMenuForm(true);
            }}>
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => deleteMenuItem(item.id || item._id)}>
              <Text style={{ color: colors.error, fontSize: 13, fontWeight: '700' }}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.storeAccent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── TOP BAR ── */}
      <View style={styles.topBar}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.topBarSubtitle}>🏪 Campus Store Partner</Text>
          <Text style={styles.topBarTitle} numberOfLines={1}>
            {(profile as any)?.store_name || 'Kitchen Dashboard'}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {/* Sound Alert Toggle */}
          <TouchableOpacity
            onPress={() => {
              if (soundAlerts) {
                stopKitchenAlarm();
              }
              setSoundAlerts(!soundAlerts);
            }}
            style={[styles.iconButton, soundAlerts && styles.iconButtonActive]}
          >
            <Text style={{ fontSize: 16 }}>{soundAlerts ? '🔔' : '🔕'}</Text>
          </TouchableOpacity>

          {/* Store Open/Close Toggle */}
          <TouchableOpacity
            onPress={toggleStoreStatus}
            style={[styles.statusToggle, { backgroundColor: isOpen ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)' }]}
          >
            <View style={[styles.statusDot, { backgroundColor: isOpen ? '#86EFAC' : '#FCA5A5' }]} />
            <Text style={[styles.statusToggleText, { color: isOpen ? '#86EFAC' : '#FCA5A5' }]}>
              {isOpen ? 'ONLINE' : 'OFFLINE'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
            <Text style={{ fontSize: 16 }}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── EMERGENCY KITCHEN LOUD ALARM BANNER ── */}
      {newOrders.length > 0 && (
        <View style={styles.emergencyAlarmBanner}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={styles.alarmRedDot} />
              <Text style={styles.emergencyAlarmTitle}>
                {newOrders.length} NEW ORDER{newOrders.length > 1 ? 'S' : ''} WAITING!
              </Text>
            </View>
            <Text style={styles.emergencyAlarmSub}>
              {isAlarmSilenced || !soundAlerts ? '🔕 Buzzer silenced' : '🔊 Loud buzzer sounding until accepted'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.silenceAlarmBtn, isAlarmSilenced && { backgroundColor: 'rgba(255,255,255,0.1)' }]}
            onPress={() => {
              if (isAlarmSilenced) {
                setIsAlarmSilenced(false);
                if (soundAlerts) startKitchenAlarm(newOrders.length);
              } else {
                setIsAlarmSilenced(true);
                stopKitchenAlarm();
              }
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.silenceAlarmBtnText}>
              {isAlarmSilenced ? '🔔 Unmute' : '🔕 Silence'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── ADVANCED METRICS BANNER ── */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { borderLeftColor: colors.storeAccent, borderLeftWidth: 3 }]}>
          <Text style={styles.statLabel}>Today's Earnings</Text>
          <Text style={[styles.statValue, { color: colors.storeAccent }]}>₹{todayEarnings}</Text>
          <Text style={styles.statSubText}>{todayOrdersList.length} orders today</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total Orders</Text>
          <Text style={styles.statValue}>{activeAndCompleted.length}</Text>
          <Text style={styles.statSubText}>Lifetime completed</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statLabel}>In Kitchen</Text>
          <Text style={[styles.statValue, { color: inKitchenCount > 0 ? '#F59E0B' : colors.textMain }]}>
            {inKitchenCount}
          </Text>
          <Text style={styles.statSubText}>{newOrders.length} awaiting</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Avg Ticket</Text>
          <Text style={styles.statValue}>₹{avgOrderValue}</Text>
          <Text style={styles.statSubText}>Per order</Text>
        </View>
      </View>

      {/* ── MAIN TABS ── */}
      <View style={styles.mainTabs}>
        {MAIN_TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            onPress={() => setActiveTab(t.key)}
            style={[styles.mainTab, activeTab === t.key && styles.mainTabActive]}
          >
            <Text style={[styles.mainTabText, activeTab === t.key && styles.mainTabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── ORDERS TAB ── */}
      {activeTab === 'orders' && (
        <View style={{ flex: 1 }}>
          {/* Sub Tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subTabsScroll} contentContainerStyle={styles.subTabsContainer}>
            {ORDER_SUB_TABS.map(t => (
              <TouchableOpacity
                key={t.key}
                onPress={() => setOrderSubTab(t.key)}
                style={[styles.subTab, orderSubTab === t.key && styles.subTabActive]}
              >
                <Text style={[styles.subTabText, orderSubTab === t.key && styles.subTabTextActive]}>
                  {t.label} ({tabCounts[t.key]})
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Search Bar */}
          <View style={styles.searchBarContainer}>
            <TextInput
              style={styles.searchInput}
              value={orderSearch}
              onChangeText={setOrderSearch}
              placeholder="🔍 Search orders by student, phone, dish or #ID..."
              placeholderTextColor={colors.textMuted}
            />
            {orderSearch.length > 0 && (
              <TouchableOpacity onPress={() => setOrderSearch('')} style={styles.clearSearchBtn}>
                <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Orders FlatList */}
          <FlatList
            data={filteredTabOrders}
            renderItem={renderOrderCard}
            keyExtractor={item => item.id || item._id}
            contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.storeAccent} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={{ fontSize: 44, marginBottom: 8 }}>👨‍🍳</Text>
                <Text style={styles.emptyTitle}>
                  {orderSearch ? 'No matching orders found' : 'Queue is all clear'}
                </Text>
                <Text style={styles.emptyText}>
                  {orderSearch ? 'Try a different student name or order ID' : 'New student orders will appear here automatically'}
                </Text>
              </View>
            }
          />
        </View>
      )}

      {/* ── MENU TAB ── */}
      {activeTab === 'menu' && (
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, gap: 12 }}>
            <TouchableOpacity
              style={[styles.addMenuBtn, { flex: 1, marginBottom: 0 }]}
              onPress={() => {
                setMenuForm({ name: '', price: '', desc: '', category: 'Snacks', isVeg: true });
                setEditingMenuId(null);
                setShowMenuForm(true);
              }}
            >
              <Text style={styles.addMenuBtnText}>+ Add New Dish</Text>
            </TouchableOpacity>
          </View>

          {/* Category Filter Pills */}
          <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {['All', ...CATEGORIES].map(cat => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setMenuCategoryFilter(cat)}
                  style={[styles.catChip, menuCategoryFilter === cat && styles.catChipActive]}
                >
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
                <Text style={styles.emptyTitle}>No menu items found</Text>
                <Text style={styles.emptyText}>Add your first dish to start receiving campus orders</Text>
              </View>
            }
          />
        </View>
      )}

      {/* ── ANALYTICS TAB ── */}
      {activeTab === 'analytics' && (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.storeAccent} />}
        >
          {/* Time Filter Pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 8, marginBottom: spacing.md }}>
            {[
              { key: 'today', label: "Today's Summary" },
              { key: 'week', label: 'Last 7 Days' },
              { key: 'month', label: 'This Month' },
              { key: 'all', label: 'All Time Lifetime' },
            ].map(t => (
              <TouchableOpacity
                key={t.key}
                onPress={() => setTimeFilter(t.key as any)}
                style={[styles.subTab, timeFilter === t.key && styles.subTabActive]}
              >
                <Text style={[styles.subTabText, timeFilter === t.key && styles.subTabTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Revenue Summary Card */}
          <View style={styles.analyticsCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
              <Text style={styles.analyticsTitle}>💰 Financial Performance</Text>
              <View style={styles.periodPill}>
                <Text style={styles.periodPillText}>{timeFilter.toUpperCase()}</Text>
              </View>
            </View>

            <View style={styles.analyticsRow}>
              <View style={styles.analyticsStat}>
                <Text style={styles.analyticsStatValue}>₹{analyticsRevenue}</Text>
                <Text style={styles.analyticsStatLabel}>Net Revenue</Text>
              </View>
              <View style={styles.analyticsStat}>
                <Text style={styles.analyticsStatValue}>{analyticsOrders.length}</Text>
                <Text style={styles.analyticsStatLabel}>Paid Orders</Text>
              </View>
              <View style={styles.analyticsStat}>
                <Text style={styles.analyticsStatValue}>
                  {analyticsOrders.filter(o => ['delivered', 'completed'].includes(o.order_status)).length}
                </Text>
                <Text style={styles.analyticsStatLabel}>Delivered</Text>
              </View>
            </View>
          </View>

          {/* Export Button */}
          <TouchableOpacity onPress={exportToExcel} style={styles.exportBtn}>
            <Text style={styles.exportBtnText}>📥 Export Orders to Excel / CSV</Text>
          </TouchableOpacity>

          {/* Top Selling Dishes */}
          <View style={styles.analyticsCard}>
            <Text style={styles.analyticsTitle}>🏆 Top Selling Dishes</Text>
            {topDishes.length === 0 ? (
              <Text style={styles.emptyText}>No sales recorded for this period</Text>
            ) : (
              topDishes.map(([name, stats]: [string, any], i) => {
                const pct = Math.round((stats.count / maxDishCount) * 100);
                return (
                  <View key={name} style={styles.dishLeaderboardRow}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Text style={styles.dishName}>#{i + 1} {name}</Text>
                      <Text style={styles.dishStatHighlight}>₹{stats.revenue} ({stats.count} sold)</Text>
                    </View>
                    <View style={styles.progressBarTrack}>
                      <View style={[styles.progressBarFill, { width: `${pct}%` }]} />
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      )}

      {/* ── MENU FORM MODAL ── */}
      <Modal visible={showMenuForm} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingMenuId ? 'Edit Dish' : 'Add New Dish'}</Text>

            <Text style={styles.formLabel}>Dish Name *</Text>
            <TextInput
              style={styles.formInput}
              value={menuForm.name}
              onChangeText={t => setMenuForm(p => ({ ...p, name: t }))}
              placeholder="e.g. Cheese Burger / Cold Coffee"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.formLabel}>Price (₹) *</Text>
            <TextInput
              style={styles.formInput}
              value={menuForm.price}
              onChangeText={t => setMenuForm(p => ({ ...p, price: t }))}
              placeholder="e.g. 99"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
            />

            <Text style={styles.formLabel}>Description</Text>
            <TextInput
              style={styles.formInput}
              value={menuForm.desc}
              onChangeText={t => setMenuForm(p => ({ ...p, desc: t }))}
              placeholder="Short description (ingredients, size)"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.formLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setMenuForm(p => ({ ...p, category: cat }))}
                  style={[styles.catChip, menuForm.category === cat && styles.catChipActive]}
                >
                  <Text style={[styles.catChipText, menuForm.category === cat && styles.catChipTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg }}>
              <Text style={styles.formLabel}>Vegetarian (Green mark)</Text>
              <Switch
                value={menuForm.isVeg}
                onValueChange={v => setMenuForm(p => ({ ...p, isVeg: v }))}
                trackColor={{ false: '#374151', true: 'rgba(16,185,129,0.3)' }}
                thumbColor={menuForm.isVeg ? colors.vegGreen : '#9CA3AF'}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.borderColor, flex: 1 }]}
                onPress={() => setShowMenuForm(false)}
              >
                <Text style={{ color: colors.textMain, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.storeAccent, flex: 1 }]}
                onPress={saveMenuItem}
                disabled={menuSaving}
              >
                {menuSaving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Save Dish</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── KITCHEN PREP TIME MODAL ── */}
      <Modal visible={!!prepModalOrder} animationType="fade" transparent onRequestClose={() => setPrepModalOrder(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.prepModalCard}>
            <View style={styles.prepModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.prepModalTitle}>👨‍🍳 Set Kitchen Prep Time</Text>
                <Text style={styles.prepModalSubtitle}>
                  Order #{prepModalOrder ? String(prepModalOrder.id || prepModalOrder._id).slice(-6).toUpperCase() : ''} • {prepModalOrder ? getItems(prepModalOrder.items).length : 0} items
                </Text>
              </View>
              <TouchableOpacity onPress={() => setPrepModalOrder(null)} style={styles.prepModalCloseBtn}>
                <Text style={{ color: colors.textMuted, fontSize: 18, fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.prepModalHint}>
              Select estimated time to cook & pack. Customer and rider will see this real-time countdown.
            </Text>

            <View style={styles.prepChipsGrid}>
              {[
                { mins: 10, label: '⚡ 10 mins', sub: 'Quick Snack / Drink' },
                { mins: 15, label: '🍲 15 mins', sub: 'Standard Meal' },
                { mins: 20, label: '🍔 20 mins', sub: 'Fresh Cook' },
                { mins: 25, label: '⏰ 25 mins', sub: 'Kitchen Rush' },
                { mins: 35, label: '⏳ 35 mins', sub: 'Large Batch' },
              ].map((item) => (
                <TouchableOpacity
                  key={item.mins}
                  style={styles.prepChip}
                  onPress={() => {
                    if (prepModalOrder) {
                      const oId = prepModalOrder.id || prepModalOrder._id;
                      updateOrderStatus(oId, 'preparing', item.mins);
                      setPrepModalOrder(null);
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.prepChipLabel}>{item.label}</Text>
                  <Text style={styles.prepChipSub}>{item.sub}</Text>
                </TouchableOpacity>
              ))}
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
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderColor,
  },
  topBarSubtitle: { fontSize: 11, color: colors.storeAccent, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  topBarTitle: { ...typography.h2, color: colors.textMain },
  statusToggle: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusToggleText: { fontWeight: '800', fontSize: 11, letterSpacing: 0.5 },
  iconButton: { padding: 8, borderRadius: 10, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.borderColor },
  iconButtonActive: { borderColor: colors.storeAccent },
  logoutBtn: { padding: 8 },

  // Stats Row
  statsRow: { flexDirection: 'row', padding: spacing.md, gap: 8 },
  statCard: {
    flex: 1,
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.borderColor,
  },
  statValue: { fontSize: 17, fontWeight: '800', color: colors.textMain, marginTop: 2 },
  statLabel: { fontSize: 9, color: colors.textMuted, fontWeight: '700', textTransform: 'uppercase' },
  statSubText: { fontSize: 10, color: colors.textMuted, marginTop: 2 },

  // Main Tabs
  mainTabs: { flexDirection: 'row', paddingHorizontal: spacing.md, gap: 8, marginBottom: 4 },
  mainTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.borderColor,
  },
  mainTabActive: { backgroundColor: colors.storeAccent, borderColor: colors.storeAccent },
  mainTabText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  mainTabTextActive: { color: '#fff' },

  // Sub Tabs
  subTabsScroll: { maxHeight: 44 },
  subTabsContainer: { paddingHorizontal: spacing.md, gap: 8, paddingVertical: 6 },
  subTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.borderColor,
  },
  subTabActive: { backgroundColor: 'rgba(16,185,129,0.15)', borderColor: colors.storeAccent },
  subTabText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  subTabTextActive: { color: colors.storeAccent, fontWeight: '700' },

  // Search Bar
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginVertical: 4,
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderColor,
    paddingHorizontal: spacing.md,
  },
  searchInput: { flex: 1, height: 40, fontSize: 13, color: colors.textMain },
  clearSearchBtn: { padding: 6 },

  // Order Card
  orderCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderColor,
  },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  orderIdText: { fontSize: 16, fontWeight: '800', color: colors.textMain, fontFamily: 'monospace' },
  paidBadge: { backgroundColor: 'rgba(16,185,129,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  paidBadgeText: { color: colors.storeAccent, fontSize: 10, fontWeight: '800' },
  orderTime: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },

  // Customer row
  customerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    padding: 8,
    borderRadius: radius.sm,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  customerName: { fontSize: 13, fontWeight: '700', color: colors.textMain },
  customerAddress: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  callBtn: {
    backgroundColor: 'rgba(16,185,129,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
  },
  callBtnText: { color: colors.storeAccent, fontSize: 12, fontWeight: '700' },

  // Note Box
  noteBox: {
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
    padding: 8,
    borderRadius: radius.sm,
    marginBottom: 8,
  },
  noteTitle: { fontSize: 11, fontWeight: '800', color: '#F59E0B' },
  noteContent: { fontSize: 12, color: '#FDE68A', fontStyle: 'italic', marginTop: 1 },

  // Items
  orderItems: { marginBottom: spacing.sm, paddingTop: 4, borderTopWidth: 1, borderTopColor: colors.borderColor },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 2 },
  itemQty: { width: 28, fontSize: 13, fontWeight: '800', color: colors.storeAccent },
  itemName: { flex: 1, fontSize: 13, color: colors.textMain },
  itemPrice: { fontSize: 13, fontWeight: '700', color: colors.textMuted },

  // Order Footer
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderColor,
  },
  footerLabel: { fontSize: 9, color: colors.textMuted, fontWeight: '700', textTransform: 'uppercase' },
  orderTotal: { fontSize: 18, fontWeight: '800', color: colors.storeAccent },
  actionBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10 },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  deliveredBadge: { backgroundColor: 'rgba(16,185,129,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  deliveredBadgeText: { color: colors.storeAccent, fontWeight: '700', fontSize: 12 },

  // Menu Card
  menuCard: {
    flexDirection: 'row',
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderColor,
  },
  menuCardUnavailable: { opacity: 0.65 },
  vegBadge: { width: 14, height: 14, borderRadius: 3, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  vegDot: { width: 6, height: 6, borderRadius: 3 },
  menuItemName: { fontSize: 15, fontWeight: '700', color: colors.textMain },
  soldOutBadge: { backgroundColor: 'rgba(239,68,68,0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  soldOutText: { color: '#EF4444', fontSize: 9, fontWeight: '800' },
  menuItemPrice: { color: colors.storeAccent, fontWeight: '700', fontSize: 15, marginTop: 2 },
  menuItemDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  menuItemCategory: { fontSize: 11, color: colors.primary, fontWeight: '600', marginTop: 4 },
  menuActions: { alignItems: 'flex-end', justifyContent: 'space-between', paddingLeft: spacing.sm },

  // Add Menu Button
  addMenuBtn: {
    backgroundColor: colors.storeAccent,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    paddingVertical: 10,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  addMenuBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  // Analytics
  analyticsCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderColor,
  },
  analyticsTitle: { ...typography.h4, color: colors.textMain },
  periodPill: { backgroundColor: 'rgba(16,185,129,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  periodPillText: { color: colors.storeAccent, fontSize: 10, fontWeight: '800' },
  analyticsRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: spacing.sm },
  analyticsStat: { alignItems: 'center' },
  analyticsStatValue: { fontSize: 24, fontWeight: '800', color: colors.storeAccent },
  analyticsStatLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '600', marginTop: 2 },
  exportBtn: {
    backgroundColor: colors.cardBg,
    padding: 13,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.storeAccent,
  },
  exportBtnText: { color: colors.storeAccent, fontWeight: '800', fontSize: 14 },
  dishLeaderboardRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderColor },
  dishName: { fontSize: 14, fontWeight: '700', color: colors.textMain },
  dishStatHighlight: { fontSize: 12, fontWeight: '700', color: colors.storeAccent },
  progressBarTrack: { height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', marginTop: 4 },
  progressBarFill: { height: '100%', backgroundColor: colors.storeAccent, borderRadius: 3 },

  // Empty State
  emptyState: { alignItems: 'center', paddingVertical: 50 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.textMain, marginBottom: 4 },
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.xxl, paddingBottom: 40 },
  modalTitle: { ...typography.h2, color: colors.textMain, marginBottom: spacing.lg },
  formLabel: { ...typography.label, color: colors.textMuted, marginBottom: 4, marginTop: spacing.sm },
  formInput: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderColor,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.textMain,
    marginBottom: spacing.sm,
  },
  catChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.borderColor, marginRight: 8 },
  catChipActive: { backgroundColor: 'rgba(16,185,129,0.15)', borderColor: colors.storeAccent },
  catChipText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  catChipTextActive: { color: colors.storeAccent },
  modalBtn: { paddingVertical: 14, borderRadius: radius.md, alignItems: 'center' },

  // Emergency Alarm Banner
  emergencyAlarmBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderBottomWidth: 1.5,
    borderTopWidth: 1.5,
    borderColor: '#EF4444',
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  alarmRedDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  emergencyAlarmTitle: {
    color: '#EF4444',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  emergencyAlarmSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    marginTop: 2,
  },
  silenceAlarmBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
    borderWidth: 1,
    borderColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  silenceAlarmBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
  },

  // Kitchen Prep Time Modal & Badges
  prepBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: '#3B82F6',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.sm,
  },
  prepBadgeText: {
    color: '#60A5FA',
    fontSize: 11,
    fontWeight: '800',
  },
  prepModalCard: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.xl,
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: colors.borderColor,
  },
  prepModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  prepModalTitle: {
    ...typography.h3,
    color: colors.textMain,
    fontWeight: '900',
  },
  prepModalSubtitle: {
    fontSize: 13,
    color: colors.storeAccent,
    fontWeight: '700',
    marginTop: 2,
  },
  prepModalCloseBtn: {
    padding: 6,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  prepModalHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginVertical: spacing.md,
    lineHeight: 18,
  },
  prepChipsGrid: {
    flexDirection: 'column',
    gap: 10,
    marginTop: spacing.xs,
  },
  prepChip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.borderColor,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  prepChipLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textMain,
  },
  prepChipSub: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
});

export default StoreDashboardScreen;
