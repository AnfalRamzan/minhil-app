import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { getTodaySales, getBills, getProducts } from '../config/firebase';

export default function Dashboard() {
  const router = useRouter();
  const [stats, setStats] = useState({ todaySales: 0, totalBills: 0, totalProducts: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalRevenue, setTotalRevenue] = useState(0);

  useFocusEffect(
    React.useCallback(() => {
      loadDashboardData();
    }, [])
  );

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    const salesResult = await getTodaySales();
    const billsResult = await getBills();
    const productsResult = await getProducts();
    
    let totalRev = 0;
    if (billsResult.success) {
      totalRev = billsResult.bills.reduce((sum, bill) => sum + (bill.total || 0), 0);
    }
    
    setStats({
      todaySales: salesResult.success ? salesResult.total : 0,
      totalBills: billsResult.success ? billsResult.bills.length : 0,
      totalProducts: productsResult.success ? productsResult.products.length : 0,
    });
    setTotalRevenue(totalRev);
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const formatPrice = (amount) => `₨ ${amount?.toLocaleString('en-PK') || 0}`;

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1a73e8" />
        <Text style={styles.loadingText}>Loading Dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.header}>
        <Text style={styles.welcomeText}>Welcome Back! 👋</Text>
        <Text style={styles.dateText}>{new Date().toLocaleDateString('en-PK')}</Text>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: '#e8f0fe' }]}><Text style={styles.statIconText}>💰</Text></View>
          <Text style={styles.statValue}>{formatPrice(stats.todaySales)}</Text>
          <Text style={styles.statLabel}>Today's Sale</Text>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: '#e6f4ea' }]}><Text style={styles.statIconText}>📄</Text></View>
          <Text style={styles.statValue}>{stats.totalBills}</Text>
          <Text style={styles.statLabel}>Total Bills</Text>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: '#fef7e0' }]}><Text style={styles.statIconText}>📦</Text></View>
          <Text style={styles.statValue}>{stats.totalProducts}</Text>
          <Text style={styles.statLabel}>Products</Text>
        </View>
      </View>

      <View style={styles.revenueCard}>
        <Text style={styles.revenueLabel}>Total Revenue</Text>
        <Text style={styles.revenueValue}>{formatPrice(totalRevenue)}</Text>
        <Text style={styles.revenueSubtext}>Lifetime sales</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(tabs)/billing')}>
            <Text style={styles.actionIcon}>🛒</Text>
            <Text style={styles.actionText}>New Bill</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(tabs)/products')}>
            <Text style={styles.actionIcon}>📦</Text>
            <Text style={styles.actionText}>Add Product</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(tabs)/history')}>
            <Text style={styles.actionIcon}>📜</Text>
            <Text style={styles.actionText}>History</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f7fa' },
  loadingText: { marginTop: 10, color: '#666' },
  header: { backgroundColor: '#1a73e8', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 30, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  welcomeText: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  dateText: { fontSize: 14, color: '#e8f0fe', marginTop: 4 },
  statsContainer: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: -20, marginBottom: 20 },
  statCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, width: '31%', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
  statIcon: { width: 45, height: 45, borderRadius: 23, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  statIconText: { fontSize: 22 },
  statValue: { fontSize: 16, fontWeight: 'bold', color: '#1a73e8' },
  statLabel: { fontSize: 10, color: '#666', marginTop: 4, textAlign: 'center' },
  revenueCard: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 20, borderRadius: 20, padding: 20, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
  revenueLabel: { fontSize: 14, color: '#666', marginBottom: 8 },
  revenueValue: { fontSize: 32, fontWeight: 'bold', color: '#1a73e8', marginBottom: 4 },
  revenueSubtext: { fontSize: 11, color: '#999' },
  section: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 20, borderRadius: 20, padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 16 },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  actionBtn: { alignItems: 'center', padding: 12 },
  actionIcon: { fontSize: 32, backgroundColor: '#f5f7fa', padding: 12, borderRadius: 40, marginBottom: 8 },
  actionText: { fontSize: 12, color: '#666' },
});