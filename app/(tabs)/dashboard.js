// app/(tabs)/dashboard.js

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
  formatPKR,
} from '../../config/firebase';

import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Dashboard() {
  const router = useRouter();

  const [stats, setStats] = useState({
    todaySales: 0,
    totalBills: 0,
    totalProducts: 0,
  });

  const [totalRevenue, setTotalRevenue] =
    useState(0);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [isDarkMode, setIsDarkMode] =
    useState(false);

  // ================= LOAD SCREEN =================

  useFocusEffect(
    useCallback(() => {
      loadTheme();
      loadDashboardData();
    }, [])
  );

  // ================= LOAD THEME =================

  const loadTheme = async () => {
    try {
      const savedTheme =
        await AsyncStorage.getItem(
          'isDarkMode'
        );

      setIsDarkMode(savedTheme === 'true');
    } catch (error) {
      console.log(
        'Theme load error:',
        error
      );
    }
  };

  // ================= LOAD DATA =================

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      const salesResult =
        await getTodaySales();

      const billsResult =
        await getBills();

      const productsResult =
        await getProducts();

      // Total Revenue
      let revenue = 0;

      if (
        billsResult.success &&
        billsResult.bills?.length > 0
      ) {
        revenue = billsResult.bills.reduce(
          (sum, bill) =>
            sum + (bill.total || 0),
          0
        );
      }

      setStats({
        todaySales:
          salesResult.success
            ? salesResult.total
            : 0,

        totalBills:
          billsResult.success
            ? billsResult.bills.length
            : 0,

        totalProducts:
          productsResult.success
            ? productsResult.products.length
            : 0,
      });

      setTotalRevenue(revenue);
    } catch (error) {
      console.log(
        'Dashboard error:',
        error
      );
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
      console.log(
        'Refresh error:',
        error
      );
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
            backgroundColor:
              isDarkMode
                ? '#121212'
                : '#f5f7fa',
          },
        ]}
      >
        <ActivityIndicator
          size="large"
          color="#1a73e8"
        />

        <Text
          style={[
            styles.loadingText,
            {
              color: isDarkMode
                ? '#aaa'
                : '#666',
            },
          ]}
        >
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
          backgroundColor:
            isDarkMode
              ? '#121212'
              : '#f5f7fa',
        },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* HEADER */}

      <View style={styles.header}>
        <Text style={styles.welcomeText}>
          Welcome Back 👋
        </Text>

        <Text style={styles.dateText}>
          {new Date().toLocaleDateString(
            'en-PK',
            {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }
          )}
        </Text>
      </View>

      {/* STATS */}

      <View style={styles.statsContainer}>
        {/* TODAY SALES */}

        <View style={styles.statCard}>
          <View
            style={[
              styles.iconBox,
              {
                backgroundColor:
                  '#dbeafe',
              },
            ]}
          >
            <Text style={styles.icon}>
              💰
            </Text>
          </View>

          <Text style={styles.statValue}>
            {formatPKR(
              stats.todaySales
            )}
          </Text>

          <Text style={styles.statLabel}>
            Today Sales
          </Text>
        </View>

        {/* TOTAL BILLS */}

        <View style={styles.statCard}>
          <View
            style={[
              styles.iconBox,
              {
                backgroundColor:
                  '#dcfce7',
              },
            ]}
          >
            <Text style={styles.icon}>
              📄
            </Text>
          </View>

          <Text style={styles.statValue}>
            {stats.totalBills}
          </Text>

          <Text style={styles.statLabel}>
            Total Bills
          </Text>
        </View>

        {/* PRODUCTS */}

        <View style={styles.statCard}>
          <View
            style={[
              styles.iconBox,
              {
                backgroundColor:
                  '#fef3c7',
              },
            ]}
          >
            <Text style={styles.icon}>
              📦
            </Text>
          </View>

          <Text style={styles.statValue}>
            {stats.totalProducts}
          </Text>

          <Text style={styles.statLabel}>
            Products
          </Text>
        </View>
      </View>

      {/* REVENUE */}

      <View style={styles.revenueCard}>
        <Text style={styles.revenueTitle}>
          Total Revenue
        </Text>

        <Text style={styles.revenueAmount}>
          {formatPKR(totalRevenue)}
        </Text>

        <Text style={styles.revenueSubText}>
          Overall Lifetime Sales
        </Text>
      </View>

      {/* QUICK ACTIONS */}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Quick Actions
        </Text>

        <View style={styles.actionRow}>
          {/* BILLING */}

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() =>
              router.push(
                '/(tabs)/billing'
              )
            }
          >
            <Text style={styles.actionIcon}>
              🛒
            </Text>

            <Text style={styles.actionText}>
              Billing
            </Text>
          </TouchableOpacity>

          {/* PRODUCTS */}

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() =>
              router.push(
                '/(tabs)/products'
              )
            }
          >
            <Text style={styles.actionIcon}>
              📦
            </Text>

            <Text style={styles.actionText}>
              Products
            </Text>
          </TouchableOpacity>

          {/* HISTORY */}

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() =>
              router.push(
                '/(tabs)/history'
              )
            }
          >
            <Text style={styles.actionIcon}>
              📜
            </Text>

            <Text style={styles.actionText}>
              History
            </Text>
          </TouchableOpacity>
        </View>
      </View>
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

  dateText: {
    color: '#dbeafe',
    marginTop: 5,
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

  section: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginTop: 20,
    marginBottom: 40,
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