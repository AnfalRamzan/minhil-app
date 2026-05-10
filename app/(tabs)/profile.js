// app/(tabs)/profile.js - COMPLETE FIXED VERSION WITH FIREBASE SYNC

import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, TouchableOpacity, StyleSheet, Alert, 
  Image, ScrollView, Modal, TextInput, ActivityIndicator 
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { 
  logoutUser, 
  getProducts, 
  getCurrentUser, 
  getUserData, 
  updateUserProfile, 
  formatPKR,
  getUserRole,
  getCustomerStats,
  getDashboardStats,
  clearAllDatabaseData,
  updateProfileImage,
  getProfileImage,
  setCurrentUserForNotifications
} from '../../config/firebase';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Profile() {
  const router = useRouter();
  const [profileImage, setProfileImage] = useState(null);
  const [shopName, setShopName] = useState('');
  const [showAbout, setShowAbout] = useState(false);
  const [stats, setStats] = useState({ todaySales: 0, totalBills: 0, totalProducts: 0, totalRevenue: 0 });
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  const [editShopModal, setEditShopModal] = useState(false);
  const [tempShopName, setTempShopName] = useState('');
  const [userRole, setUserRole] = useState('customer');
  const [loggingOut, setLoggingOut] = useState(false);
  const [clearingData, setClearingData] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  const [customerPersonalStats, setCustomerPersonalStats] = useState({
    myOrders: 0,
    myTotalSpent: 0,
    myItems: 0,
    myPendingOrders: 0
  });

  useFocusEffect(
    useCallback(() => {
      loadProfileData();
    }, [])
  );

  const loadProfileData = async () => {
    setLoading(true);
    try {
      const roleResult = await getUserRole();
      const role = roleResult.success ? roleResult.role : 'customer';
      setUserRole(role);
      
      if (role === 'shopkeeper') {
        await loadStats();
      } else {
        await loadCustomerStats();
      }
      
      await loadUserData();
    } catch (error) {
      console.log('Profile load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const dashboardStats = await getDashboardStats();
      if (dashboardStats.success) {
        setStats({
          todaySales: dashboardStats.stats.todaySales || 0,
          totalBills: dashboardStats.stats.totalBills || 0,
          totalProducts: dashboardStats.stats.totalProducts || 0,
          totalRevenue: dashboardStats.stats.totalRevenue || 0,
        });
      }
    } catch (error) {
      console.log('Load stats error:', error);
    }
  };

  const loadCustomerStats = async () => {
    try {
      const customerStats = await getCustomerStats();
      if (customerStats.success) {
        setCustomerPersonalStats({
          myOrders: customerStats.stats.totalOrders || 0,
          myTotalSpent: customerStats.stats.totalSpent || 0,
          myItems: customerStats.stats.totalItems || 0,
          myPendingOrders: customerStats.stats.pendingOrders || 0
        });
      }
      
      const productsResult = await getProducts();
      setStats({
        todaySales: 0,
        totalBills: 0,
        totalProducts: productsResult.success ? productsResult.products.length : 0,
        totalRevenue: 0,
      });
    } catch (error) {
      console.log('Load customer stats error:', error);
    }
  };

  const loadUserData = async () => {
    try {
      const user = getCurrentUser();
      if (user) {
        setUserEmail(user.email);
        
        // Load shop name from Firebase first
        const userData = await getUserData(user.uid);
        if (userData.success && userData.userData?.shopName) {
          setShopName(userData.userData.shopName);
          await AsyncStorage.setItem('shopName', userData.userData.shopName);
        } else {
          // Fallback to AsyncStorage
          let savedShopName = await AsyncStorage.getItem('shopName');
          if (!savedShopName) {
            savedShopName = userRole === 'shopkeeper' ? 'My Store' : 'My Account';
          }
          setShopName(savedShopName);
        }
        
        // Load profile image from Firebase
        const imageResult = await getProfileImage(user.uid);
        if (imageResult.success && imageResult.imageUri) {
          setProfileImage(imageResult.imageUri);
          await AsyncStorage.setItem('profileImage', imageResult.imageUri);
        } else {
          // Fallback to AsyncStorage
          const savedImage = await AsyncStorage.getItem('profileImage');
          if (savedImage) setProfileImage(savedImage);
        }
      }
    } catch (error) {
      console.log('Load user data error:', error);
    }
  };

  const saveShopName = async () => {
    if (tempShopName.trim()) {
      setShopName(tempShopName);
      await AsyncStorage.setItem('shopName', tempShopName);
      
      const user = getCurrentUser();
      if (user) {
        await updateUserProfile(user.uid, { shopName: tempShopName });
      }
      
      setEditShopModal(false);
      Alert.alert('Success', userRole === 'shopkeeper' ? 'Shop name updated!' : 'Name updated!');
    } else {
      Alert.alert('Error', 'Please enter a name');
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant permission to access photos');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setUploadingImage(true);
        const imageUri = result.assets[0].uri;
        setProfileImage(imageUri);
        
        // Save to AsyncStorage
        await AsyncStorage.setItem('profileImage', imageUri);
        
        // Save to Firebase
        const user = getCurrentUser();
        if (user) {
          const updateResult = await updateProfileImage(user.uid, imageUri);
          if (!updateResult.success) {
            console.log('Failed to save image to Firebase:', updateResult.error);
          }
        }
        
        Alert.alert('Success', 'Profile image updated successfully!');
      }
    } catch (error) {
      console.log('Image picker error:', error);
      Alert.alert('Error', 'Could not pick image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  const removeProfileImage = async () => {
    Alert.alert(
      'Remove Image',
      'Are you sure you want to remove your profile image?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setProfileImage(null);
            await AsyncStorage.removeItem('profileImage');
            
            const user = getCurrentUser();
            if (user) {
              await updateProfileImage(user.uid, null);
            }
            
            Alert.alert('Success', 'Profile image removed');
          }
        }
      ]
    );
  };

  const handleClearDatabase = () => {
    Alert.alert(
      '⚠️ DELETE ALL DATA',
      'This action will permanently delete:\n\n❌ All Products\n❌ All Orders/Bills\n❌ All Purchase Patterns\n❌ All Sales Records\n\nThis cannot be undone!\n\nAre you absolutely sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'YES, DELETE ALL', 
          style: 'destructive',
          onPress: async () => {
            setClearingData(true);
            try {
              const result = await clearAllDatabaseData();
              if (result.success) {
                Alert.alert(
                  '✅ Success', 
                  'All data has been cleared successfully!\n\nPlease refresh the app.',
                  [{ text: 'OK', onPress: () => loadProfileData() }]
                );
              } else {
                Alert.alert('Error', result.error || 'Failed to clear data');
              }
            } catch (error) {
              Alert.alert('Error', 'Something went wrong');
            } finally {
              setClearingData(false);
            }
          }
        }
      ]
    );
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          // Clear notification user
          setCurrentUserForNotifications(null);
          await logoutUser();
          await AsyncStorage.clear();
          router.replace('/login');
          setLoggingOut(false);
        }
      }
    ]);
  };

  if (loading || loggingOut || clearingData || uploadingImage) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1a73e8" />
        <Text style={styles.loadingText}>
          {uploadingImage ? 'Uploading Image...' : 
           clearingData ? 'Clearing Data...' : 
           loggingOut ? 'Logging out...' : 'Loading Profile...'}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header Section */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.imageContainer} onPress={pickImage} onLongPress={removeProfileImage}>
          {profileImage ? (
            <Image source={{ uri: profileImage }} style={styles.profileImage} />
          ) : (
            <View style={styles.profileImagePlaceholder}>
              <Text style={styles.profileImageText}>
                {userRole === 'shopkeeper' ? '🏪' : '🛒'}
              </Text>
            </View>
          )}
          <View style={styles.cameraIcon}>
            <Text style={styles.cameraIconText}>📷</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.hintText}>(Tap to change, Long press to remove)</Text>
        
        <Text style={styles.shopName}>{shopName}</Text>
        
        <TouchableOpacity style={styles.editShopButton} onPress={() => {
          setTempShopName(shopName);
          setEditShopModal(true);
        }}>
          <Text style={styles.editShopText}>
            {userRole === 'shopkeeper' ? '✏️ Edit Shop Name' : '✏️ Edit Name'}
          </Text>
        </TouchableOpacity>
        
        <Text style={styles.userEmail}>{userEmail}</Text>
        
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>
            {userRole === 'shopkeeper' ? '🏪 Shopkeeper Account' : '🛒 Customer Account'}
          </Text>
        </View>
      </View>

      {/* STATS SECTION - ROLE BASED */}
      {userRole === 'shopkeeper' ? (
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{formatPKR(stats.todaySales)}</Text>
            <Text style={styles.statLabel}>Today's Sale</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.totalBills}</Text>
            <Text style={styles.statLabel}>Total Bills</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.totalProducts}</Text>
            <Text style={styles.statLabel}>Products</Text>
          </View>
        </View>
      ) : (
        <View style={styles.customerStatsContainer}>
          <View style={styles.customerStatCard}>
            <Text style={styles.customerStatNumber}>{customerPersonalStats.myOrders}</Text>
            <Text style={styles.customerStatLabel}>My Orders</Text>
            <Text style={styles.customerStatSub}>(Completed)</Text>
          </View>
          <View style={styles.customerStatCard}>
            <Text style={styles.customerStatNumber}>{formatPKR(customerPersonalStats.myTotalSpent)}</Text>
            <Text style={styles.customerStatLabel}>Total Spent</Text>
            <Text style={styles.customerStatSub}>(Lifetime)</Text>
          </View>
          <View style={styles.customerStatCard}>
            <Text style={styles.customerStatNumber}>{customerPersonalStats.myItems}</Text>
            <Text style={styles.customerStatLabel}>Items Bought</Text>
            <Text style={styles.customerStatSub}>(Total Qty)</Text>
          </View>
        </View>
      )}

      {/* Pending Orders Note for Customer */}
      {userRole === 'customer' && customerPersonalStats.myPendingOrders > 0 && (
        <View style={styles.pendingInfoCard}>
          <Text style={styles.pendingInfoIcon}>⏳</Text>
          <Text style={styles.pendingInfoText}>
            You have {customerPersonalStats.myPendingOrders} pending order(s)
          </Text>
          <Text style={styles.pendingInfoSub}>
            These will be counted after shopkeeper processes them
          </Text>
        </View>
      )}

      {/* Menu Section */}
      <View style={styles.menuSection}>
        <Text style={styles.sectionTitle}>📱 Menu</Text>

        {/* CLEAR DATABASE BUTTON - ONLY FOR SHOPKEEPER */}
        {userRole === 'shopkeeper' && (
          <TouchableOpacity 
            style={[styles.menuItem, styles.dangerItem]} 
            onPress={handleClearDatabase}
            disabled={clearingData}
          >
            <View style={styles.menuIcon}>
              <Text style={styles.menuIconText}>🗑️</Text>
            </View>
            <Text style={[styles.menuText, styles.dangerText]}>
              {clearingData ? 'Clearing Database...' : 'Clear All Database'}
            </Text>
            <Text style={styles.menuArrow}>→</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.menuItem} onPress={() => setShowAbout(true)}>
          <View style={styles.menuIcon}>
            <Text style={styles.menuIconText}>ℹ️</Text>
          </View>
          <Text style={styles.menuText}>About</Text>
          <Text style={styles.menuArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuItem, styles.logoutItem]} onPress={handleLogout}>
          <View style={styles.menuIcon}>
            <Text style={styles.menuIconText}>🚪</Text>
          </View>
          <Text style={[styles.menuText, styles.logoutText]}>Logout</Text>
          <Text style={styles.menuArrow}>→</Text>
        </TouchableOpacity>
      </View>

      {/* Edit Shop Name Modal */}
      <Modal visible={editShopModal} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {userRole === 'shopkeeper' ? 'Edit Shop Name' : 'Edit Name'}
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder={userRole === 'shopkeeper' ? "Enter shop name" : "Enter your name"}
              placeholderTextColor="#aaa"
              value={tempShopName}
              onChangeText={setTempShopName}
              autoFocus={true}
              maxLength={30}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.saveBtn} onPress={saveShopName}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditShopModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* About Modal */}
      <Modal visible={showAbout} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>About BillingEase</Text>
            <View style={styles.aboutLogo}>
              <Text style={styles.aboutLogoIcon}>🧠</Text>
            </View>
            <Text style={styles.aboutName}>BillingEase</Text>
            <Text style={styles.aboutVersion}>Version 2.0.0</Text>
            <Text style={styles.aboutDescription}>
              AI Powered Smart Billing System for Modern Retail Stores
            </Text>
            <View style={styles.featuresList}>
              <Text style={styles.featureItem}>🧠 AI Market-Aware Discounts</Text>
              <Text style={styles.featureItem}>📊 Real-time Price Comparison</Text>
              <Text style={styles.featureItem}>🔄 AI Learning from Purchases</Text>
              <Text style={styles.featureItem}>🎯 Smart Product Suggestions</Text>
              <Text style={styles.featureItem}>📈 Real-time Analytics</Text>
              <Text style={styles.featureItem}>☁️ Cloud Sync & Backup</Text>
              <Text style={styles.featureItem}>👥 Role-Based Access</Text>
            </View>
            <Text style={styles.copyright}>© 2025-2026 BillingEase</Text>
            <Text style={styles.credits}>Developed with ❤️ in Pakistan</Text>
            <TouchableOpacity style={styles.closeButton} onPress={() => setShowAbout(false)}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f7fa' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#666' },
  
  header: {
    backgroundColor: '#1a73e8',
    paddingTop: 50,
    paddingBottom: 30,
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  imageContainer: { position: 'relative', marginBottom: 8 },
  profileImage: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: '#fff' },
  profileImagePlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#fff' },
  profileImageText: { fontSize: 45 },
  cameraIcon: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#fff', borderRadius: 20, padding: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 },
  cameraIconText: { fontSize: 14 },
  hintText: { fontSize: 10, color: 'rgba(255,255,255,0.7)', marginBottom: 8 },
  shopName: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginTop: 8 },
  editShopButton: { marginTop: 6, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20 },
  editShopText: { fontSize: 12, color: '#fff' },
  userEmail: { fontSize: 12, color: '#e8f0fe', marginTop: 8 },
  roleBadge: { marginTop: 10, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 15 },
  roleBadgeText: { fontSize: 11, color: '#fff', fontWeight: '500' },
  
  // Shopkeeper Stats
  statsContainer: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 20, marginTop: -25, marginBottom: 20 },
  statCard: { backgroundColor: '#fff', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3, minWidth: 100 },
  statNumber: { fontSize: 18, fontWeight: 'bold', color: '#1a73e8' },
  statLabel: { fontSize: 11, color: '#666', marginTop: 4 },
  
  // Customer Personal Stats
  customerStatsContainer: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 20, marginTop: -25, marginBottom: 20 },
  customerStatCard: { backgroundColor: '#fff', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3, minWidth: 105 },
  customerStatNumber: { fontSize: 18, fontWeight: 'bold', color: '#34a853' },
  customerStatLabel: { fontSize: 11, color: '#666', marginTop: 4 },
  customerStatSub: { fontSize: 9, color: '#999', marginTop: 2 },
  
  // Pending Info Card for Customer
  pendingInfoCard: { backgroundColor: '#fff3e0', marginHorizontal: 20, marginBottom: 20, borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#f39c12' },
  pendingInfoIcon: { fontSize: 24, marginBottom: 6 },
  pendingInfoText: { fontSize: 13, color: '#e67e22', fontWeight: '500', textAlign: 'center' },
  pendingInfoSub: { fontSize: 10, color: '#999', marginTop: 4, textAlign: 'center' },
  
  // Menu Section
  menuSection: { backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 16, paddingHorizontal: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1a73e8', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  menuIcon: { width: 40 },
  menuIconText: { fontSize: 22 },
  menuText: { flex: 1, fontSize: 16, color: '#333', marginLeft: 8 },
  menuArrow: { fontSize: 16, color: '#ccc' },
  logoutItem: { borderBottomWidth: 0 },
  logoutText: { color: '#dc3545' },
  dangerItem: { borderBottomWidth: 1, borderBottomColor: '#fee8e8' },
  dangerText: { color: '#dc3545', fontWeight: '500' },
  
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 24, padding: 24, width: '90%' },
  modalTitle: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 20, color: '#1a73e8' },
  modalInput: { borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 15, backgroundColor: '#f8f9fa' },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 10 },
  saveBtn: { flex: 1, backgroundColor: '#34a853', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cancelBtn: { flex: 1, backgroundColor: '#dc3545', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  cancelBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  
  // About Modal Styles
  aboutLogo: { alignItems: 'center', marginBottom: 16 },
  aboutLogoIcon: { fontSize: 60 },
  aboutName: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', color: '#1a73e8' },
  aboutVersion: { fontSize: 14, textAlign: 'center', color: '#666', marginTop: 4 },
  aboutDescription: { fontSize: 14, textAlign: 'center', color: '#555', marginBottom: 20, lineHeight: 20 },
  featuresList: { marginBottom: 20 },
  featureItem: { fontSize: 13, color: '#34a853', marginBottom: 6, textAlign: 'center' },
  copyright: { fontSize: 10, textAlign: 'center', color: '#999', marginBottom: 4 },
  credits: { fontSize: 10, textAlign: 'center', color: '#bbb', marginBottom: 16 },
  closeButton: { backgroundColor: '#1a73e8', paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  closeButtonText: { color: '#fff', fontSize: 16, fontWeight: '500' },
});