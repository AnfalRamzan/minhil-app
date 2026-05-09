// app/(tabs)/dashboard.js - WITH ROLE-BASED ACCESS & COMPLETED ORDER STATS

import React, {
  useState,
  useCallback,
} from 'react';

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';

import {
  useRouter,
  useFocusEffect,
} from 'expo-router';

import {
  getTodaySales,
  getBills,
  getProducts,
  getCustomerStats,
  formatPKR,
  getUserRole,
  getCurrentUser,
  getDashboardStats,
} from '../../config/firebase';

import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Dashboard() {
  const router = useRouter();

  const [stats, setStats] = useState({
    todaySales: 0,
    totalBills: 0,
    totalProducts: 0,
  });

  const [totalRevenue, setTotalRevenue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [userRole, setUserRole] = useState('customer');
  const [customerStats, setCustomerStats] = useState({
    myOrders: 0,
    myTotalSpent: 0,
    myItems: 0,
  });
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);

  // ================= LOAD SCREEN =================

  useFocusEffect(
    useCallback(() => {
      loadTheme();
      loadUserRole();
      loadDashboardData();
    }, [])
  );

  // ================= LOAD USER ROLE =================

  const loadUserRole = async () => {
    const result = await getUserRole();
    if (result.success) {
      setUserRole(result.role);
    }
  };

  // ================= LOAD THEME =================

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('isDarkMode');
      setIsDarkMode(savedTheme === 'true');
    } catch (error) {
      console.log('Theme load error:', error);
    }
  };

  // ================= LOAD DATA (Role Based) =================

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const currentUser = getCurrentUser();

      if (userRole === 'shopkeeper') {
        // SHOPKEEPER - Full stats
        const dashboardStats = await getDashboardStats();
        
        setStats({
          todaySales: dashboardStats.success ? dashboardStats.stats.todaySales : 0,
          totalBills: dashboardStats.success ? dashboardStats.stats.totalBills : 0,
          totalProducts: dashboardStats.success ? dashboardStats.stats.totalProducts : 0,
        });
        setTotalRevenue(dashboardStats.success ? dashboardStats.stats.totalRevenue : 0);
        setPendingOrdersCount(dashboardStats.success ? dashboardStats.stats.pendingBills : 0);
      } else {
        // CUSTOMER - Only completed orders stats
        const customerStatsResult = await getCustomerStats();
        
        if (customerStatsResult.success) {
          setCustomerStats({
            myOrders: customerStatsResult.stats.totalOrders,
            myTotalSpent: customerStatsResult.stats.totalSpent,
            myItems: customerStatsResult.stats.totalItems,
          });
        }
        
        // Get product count for customer
        const productsResult = await getProducts();
        setStats({
          todaySales: 0,
          totalBills: 0,
          totalProducts: productsResult.success ? productsResult.products.length : 0,
        });
      }
    } catch (error) {
      console.log('Dashboard error:', error);
    } finally {
      setLoading(false);
    }
  };

  // ================= REFRESH =================

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await loadDashboardData();
    } catch (error) {
      console.log('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // ================= LOADING =================

  if (loading) {
    return (
      <View
        style={[
          styles.centerContainer,
          {
            backgroundColor: isDarkMode ? '#121212' : '#f5f7fa',
          },
        ]}
      >
        <ActivityIndicator size="large" color="#1a73e8" />
        <Text style={[styles.loadingText, { color: isDarkMode ? '#aaa' : '#666' }]}>
          Loading Dashboard...
        </Text>
      </View>
    );
  }

  // ================= UI =================

  return (
    <ScrollView
      style={[
        styles.container,
        {
          backgroundColor: isDarkMode ? '#121212' : '#f5f7fa',
        },
      ]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.welcomeText}>
          Welcome Back 👋
        </Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>
            {userRole === 'shopkeeper' ? '🏪 Shopkeeper Dashboard' : '🛒 Customer Dashboard'}
          </Text>
        </View>
        <Text style={styles.dateText}>
          {new Date().toLocaleDateString('en-PK', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </Text>
      </View>

      {userRole === 'shopkeeper' ? (
        // ================= SHOPKEEPER VIEW (Full Stats) =================
        <>
          <View style={styles.statsContainer}>
            {/* TODAY SALES */}
            <View style={styles.statCard}>
              <View style={[styles.iconBox, { backgroundColor: '#dbeafe' }]}>
                <Text style={styles.icon}>💰</Text>
              </View>
              <Text style={styles.statValue}>{formatPKR(stats.todaySales)}</Text>
              <Text style={styles.statLabel}>Today's Sales</Text>
            </View>

            {/* TOTAL BILLS */}
            <View style={styles.statCard}>
              <View style={[styles.iconBox, { backgroundColor: '#dcfce7' }]}>
                <Text style={styles.icon}>📄</Text>
              </View>
              <Text style={styles.statValue}>{stats.totalBills}</Text>
              <Text style={styles.statLabel}>Total Bills</Text>
            </View>

            {/* PRODUCTS */}
            <View style={styles.statCard}>
              <View style={[styles.iconBox, { backgroundColor: '#fef3c7' }]}>
                <Text style={styles.icon}>📦</Text>
              </View>
              <Text style={styles.statValue}>{stats.totalProducts}</Text>
              <Text style={styles.statLabel}>Products</Text>
            </View>
          </View>

          {/* REVENUE - Shopkeeper only */}
          <View style={styles.revenueCard}>
            <Text style={styles.revenueTitle}>Total Revenue</Text>
            <Text style={styles.revenueAmount}>{formatPKR(totalRevenue)}</Text>
            <Text style={styles.revenueSubText}>Overall Lifetime Sales</Text>
          </View>

          {/* Pending Orders Count */}
          {pendingOrdersCount > 0 && (
            <View style={styles.pendingCard}>
              <Text style={styles.pendingIcon}>⏳</Text>
              <Text style={styles.pendingTitle}>{pendingOrdersCount} Pending Orders</Text>
              <Text style={styles.pendingSubText}>Generate bills to update stock</Text>
            </View>
          )}
        </>
      ) : (
        // ================= CUSTOMER VIEW (Personal Stats Only - Completed Orders) =================
        <>
          <View style={styles.statsContainer}>
            {/* MY ORDERS (Completed only) */}
            <View style={styles.statCard}>
              <View style={[styles.iconBox, { backgroundColor: '#dbeafe' }]}>
                <Text style={styles.icon}>📦</Text>
              </View>
              <Text style={styles.statValue}>{customerStats.myOrders}</Text>
              <Text style={styles.statLabel}>Orders Completed</Text>
            </View>

            {/* TOTAL SPENT (Completed only) */}
            <View style={styles.statCard}>
              <View style={[styles.iconBox, { backgroundColor: '#dcfce7' }]}>
                <Text style={styles.icon}>💰</Text>
              </View>
              <Text style={styles.statValue}>{formatPKR(customerStats.myTotalSpent)}</Text>
              <Text style={styles.statLabel}>Total Spent</Text>
            </View>

            {/* ITEMS BOUGHT (Completed only) */}
            <View style={styles.statCard}>
              <View style={[styles.iconBox, { backgroundColor: '#fef3c7' }]}>
                <Text style={styles.icon}>🛍️</Text>
              </View>
              <Text style={styles.statValue}>{customerStats.myItems}</Text>
              <Text style={styles.statLabel}>Items Bought</Text>
            </View>
          </View>

          {/* CUSTOMER MESSAGE */}
          <View style={styles.customerMessageCard}>
            <Text style={styles.customerMessageIcon}>🛒</Text>
            <Text style={styles.customerMessageTitle}>Welcome to BillingEase!</Text>
            <Text style={styles.customerMessageText}>
              Browse products, add to cart, and place orders easily.
              Your order history and spending are shown above.
              {'\n\n'}✨ Stats shown are for completed orders only.
            </Text>
          </View>
        </>
      )}

      {/* QUICK ACTIONS - Role Based */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>

        <View style={styles.actionRow}>
          {/* BILLING - Everyone can access but different buttons */}
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(tabs)/billing')}>
            <Text style={styles.actionIcon}>🛒</Text>
            <Text style={styles.actionText}>Shop / Billing</Text>
          </TouchableOpacity>

          {/* PRODUCTS - Everyone can view */}
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(tabs)/products')}>
            <Text style={styles.actionIcon}>📦</Text>
            <Text style={styles.actionText}>Products</Text>
          </TouchableOpacity>

          {/* HISTORY - Role based (customer sees own, shopkeeper sees all) */}
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(tabs)/history')}>
            <Text style={styles.actionIcon}>📜</Text>
            <Text style={styles.actionText}>History</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Shopkeeper Only - Additional Actions */}
      {userRole === 'shopkeeper' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Admin Actions</Text>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(tabs)/profile')}>
              <Text style={styles.actionIcon}>⚙️</Text>
              <Text style={styles.actionText}>Settings</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(tabs)/profile')}>
              <Text style={styles.actionIcon}>📊</Text>
              <Text style={styles.actionText}>Data Mgmt</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

// ================= STYLES =================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    marginTop: 10,
    fontSize: 14,
  },

  header: {
    backgroundColor: '#1a73e8',
    paddingTop: 65,
    paddingBottom: 35,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
  },

  welcomeText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },

  roleBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 15,
    marginTop: 8,
  },

  roleBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },

  dateText: {
    color: '#dbeafe',
    marginTop: 8,
    fontSize: 14,
  },

  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -25,
    paddingHorizontal: 15,
  },

  statCard: {
    backgroundColor: '#fff',
    width: '31%',
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    elevation: 4,
  },

  iconBox: {
    width: 50,
    height: 50,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },

  icon: {
    fontSize: 24,
  },

  statValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1a73e8',
  },

  statLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 5,
    textAlign: 'center',
  },

  revenueCard: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginTop: 20,
    borderRadius: 22,
    padding: 25,
    alignItems: 'center',
    elevation: 4,
  },

  revenueTitle: {
    fontSize: 16,
    color: '#666',
  },

  revenueAmount: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#1a73e8',
    marginTop: 10,
  },

  revenueSubText: {
    marginTop: 6,
    color: '#999',
    fontSize: 12,
  },

  pendingCard: {
    backgroundColor: '#fff3e0',
    marginHorizontal: 15,
    marginTop: 15,
    borderRadius: 22,
    padding: 20,
    alignItems: 'center',
    elevation: 4,
    borderWidth: 1,
    borderColor: '#f39c12',
  },

  pendingIcon: {
    fontSize: 32,
    marginBottom: 8,
  },

  pendingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f39c12',
    marginBottom: 4,
  },

  pendingSubText: {
    fontSize: 11,
    color: '#e67e22',
  },

  customerMessageCard: {
    backgroundColor: '#e8f0fe',
    marginHorizontal: 15,
    marginTop: 20,
    borderRadius: 22,
    padding: 20,
    alignItems: 'center',
    elevation: 2,
  },

  customerMessageIcon: {
    fontSize: 40,
    marginBottom: 10,
  },

  customerMessageTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a73e8',
    marginBottom: 8,
  },

  customerMessageText: {
    fontSize: 13,
    color: '#555',
    textAlign: 'center',
    lineHeight: 18,
  },

  section: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginTop: 20,
    marginBottom: 20,
    borderRadius: 22,
    padding: 20,
    elevation: 4,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },

  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },

  actionBtn: {
    alignItems: 'center',
  },

  actionIcon: {
    fontSize: 34,
    marginBottom: 10,
  },

  actionText: {
    fontSize: 13,
    color: '#444',
    fontWeight: '500',
  },
});