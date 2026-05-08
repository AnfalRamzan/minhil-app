// app/(tabs)/dashboard.js - COMPLETELY FIXED (NO HARDCODE)

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { getTodaySales, getBills, getProducts, formatPKR } from '../../config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Dashboard() {
  const router = useRouter();
  const [stats, setStats] = useState({
    todaySales: 0,
    totalBills: 0,
    totalProducts: 0,
    totalRevenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [shopName, setShopName] = useState('BillingEase');

  useFocusEffect(
    useCallback(() => {
      loadTheme();
      loadDashboardData();
      loadShopName();
    }, [])
  );

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('isDarkMode');
      setIsDarkMode(savedTheme === 'true');
    } catch (error) {
      console.log('Theme load error:', error);
    }
  };

  const loadShopName = async () => {
    try {
      const name = await AsyncStorage.getItem('shopName');
      if (name) setShopName(name);
    } catch (error) {
      console.log('Shop name error:', error);
    }
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // ✅ REAL DATA FROM FIREBASE - NO HARDCODE
      const salesResult = await getTodaySales();
      const billsResult = await getBills();
      const productsResult = await getProducts();

      // Calculate total revenue from all bills
      let revenue = 0;
      if (billsResult.success && billsResult.bills?.length > 0) {
        revenue = billsResult.bills.reduce((sum, bill) => sum + (bill.total || 0), 0);
      }

      setStats({
        todaySales: salesResult.success ? salesResult.total : 0,
        totalBills: billsResult.success ? billsResult.bills.length : 0,
        totalProducts: productsResult.success ? productsResult.products.length : 0,
        totalRevenue: revenue,
      });
    } catch (error) {
      console.log('Dashboard error:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    await loadShopName();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: isDarkMode ? '#121212' : '#f5f7fa' }]}>
        <ActivityIndicator size="large" color="#1a73e8" />
        <Text style={[styles.loadingText, { color: isDarkMode ? '#aaa' : '#666' }]}>
          Loading Dashboard...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: isDarkMode ? '#121212' : '#f5f7fa' }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header with Shop Name */}
      <View style={styles.header}>
        <Text style={styles.welcomeText}>Welcome Back 👋</Text>
        <Text style={styles.shopNameText}>{shopName}</Text>
        <Text style={styles.dateText}>
          {new Date().toLocaleDateString('en-PK', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </Text>
      </View>

      {/* Stats Cards - REAL DATA */}
      <View style={styles.statsContainer}>
        {/* Today Sales */}
        <View style={styles.statCard}>
          <View style={[styles.iconBox, { backgroundColor: '#dbeafe' }]}>
            <Text style={styles.icon}>💰</Text>
          </View>
          <Text style={styles.statValue}>{formatPKR(stats.todaySales)}</Text>
          <Text style={styles.statLabel}>Today's Sale</Text>
        </View>

        {/* Total Bills */}
        <View style={styles.statCard}>
          <View style={[styles.iconBox, { backgroundColor: '#dcfce7' }]}>
            <Text style={styles.icon}>📄</Text>
          </View>
          <Text style={styles.statValue}>{stats.totalBills}</Text>
          <Text style={styles.statLabel}>Total Bills</Text>
        </View>

        {/* Products */}
        <View style={styles.statCard}>
          <View style={[styles.iconBox, { backgroundColor: '#fef3c7' }]}>
            <Text style={styles.icon}>📦</Text>
          </View>
          <Text style={styles.statValue}>{stats.totalProducts}</Text>
          <Text style={styles.statLabel}>Products</Text>
        </View>
      </View>

      {/* Total Revenue Card - REAL DATA */}
      <View style={styles.revenueCard}>
        <Text style={styles.revenueTitle}>Total Revenue</Text>
        <Text style={styles.revenueAmount}>{formatPKR(stats.totalRevenue)}</Text>
        <Text style={styles.revenueSubText}>Overall Lifetime Sales</Text>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(tabs)/billing')}>
            <Text style={styles.actionIcon}>🛒</Text>
            <Text style={styles.actionText}>Billing</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(tabs)/products')}>
            <Text style={styles.actionIcon}>📦</Text>
            <Text style={styles.actionText}>Products</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(tabs)/history')}>
            <Text style={styles.actionIcon}>📜</Text>
            <Text style={styles.actionText}>History</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(tabs)/profile')}>
            <Text style={styles.actionIcon}>👤</Text>
            <Text style={styles.actionText}>Profile</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* AI Stats Summary */}
      <View style={styles.aiStatsCard}>
        <Text style={styles.aiStatsTitle}>🧠 AI Intelligence</Text>
        <View style={styles.aiStatsRow}>
          <View style={styles.aiStatItem}>
            <Text style={styles.aiStatValue}>{stats.totalBills}</Text>
            <Text style={styles.aiStatLabel}>Bills Processed</Text>
          </View>
          <View style={styles.aiStatItem}>
            <Text style={styles.aiStatValue}>{stats.totalProducts}</Text>
            <Text style={styles.aiStatLabel}>Products Analyzed</Text>
          </View>
        </View>
        <Text style={styles.aiStatsNote}>AI learns from every purchase for better recommendations</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 14 },
  
  header: {
    backgroundColor: '#1a73e8',
    paddingTop: 55,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
  },
  welcomeText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  shopNameText: { color: '#FFD700', fontSize: 16, fontWeight: '500', marginTop: 4 },
  dateText: { color: '#dbeafe', marginTop: 5, fontSize: 13 },
  
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
    paddingVertical: 15,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  iconBox: { width: 45, height: 45, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  icon: { fontSize: 22 },
  statValue: { fontSize: 16, fontWeight: 'bold', color: '#1a73e8' },
  statLabel: { fontSize: 10, color: '#666', marginTop: 4, textAlign: 'center' },
  
  revenueCard: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginTop: 20,
    borderRadius: 22,
    padding: 22,
    alignItems: 'center',
    elevation: 4,
  },
  revenueTitle: { fontSize: 15, color: '#666' },
  revenueAmount: { fontSize: 32, fontWeight: 'bold', color: '#1a73e8', marginTop: 8 },
  revenueSubText: { marginTop: 6, color: '#999', fontSize: 11 },
  
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginTop: 20,
    marginBottom: 15,
    borderRadius: 22,
    padding: 18,
    elevation: 4,
  },
  sectionTitle: { fontSize: 17, fontWeight: 'bold', color: '#333', marginBottom: 18 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-around' },
  actionBtn: { alignItems: 'center' },
  actionIcon: { fontSize: 32, marginBottom: 8 },
  actionText: { fontSize: 12, color: '#444', fontWeight: '500' },
  
  aiStatsCard: {
    backgroundColor: '#e8f0fe',
    marginHorizontal: 15,
    marginBottom: 30,
    borderRadius: 22,
    padding: 18,
  },
  aiStatsTitle: { fontSize: 15, fontWeight: 'bold', color: '#1a73e8', textAlign: 'center', marginBottom: 15 },
  aiStatsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
  aiStatItem: { alignItems: 'center' },
  aiStatValue: { fontSize: 24, fontWeight: 'bold', color: '#1a73e8' },
  aiStatLabel: { fontSize: 10, color: '#666', marginTop: 4 },
  aiStatsNote: { fontSize: 10, color: '#555', textAlign: 'center', marginTop: 8 },
});