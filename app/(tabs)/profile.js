import React, { useState, useEffect } from 'react';
import { 
  View, Text, TouchableOpacity, StyleSheet, Alert, 
  Image, ScrollView, Switch, Modal, TextInput, ActivityIndicator 
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { logoutUser, getTodaySales, getBills, getProducts, getCurrentUser, getUserData, updateUserProfile } from '../config/firebase';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Profile() {
  const router = useRouter();
  const [profileImage, setProfileImage] = useState(null);
  const [notifications, setNotifications] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [shopName, setShopName] = useState('');
  const [showAbout, setShowAbout] = useState(false);
  const [stats, setStats] = useState({ todaySales: 0, totalBills: 0, totalProducts: 0 });
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  const [editShopModal, setEditShopModal] = useState(false);
  const [tempShopName, setTempShopName] = useState('');
  const [editProfileModal, setEditProfileModal] = useState(false);
  const [userName, setUserName] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [userAddress, setUserAddress] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [autoPrint, setAutoPrint] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);
  const [showDataManagement, setShowDataManagement] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      loadAllData();
    }, [])
  );

  const loadAllData = async () => {
    setLoading(true);
    await loadStats();
    await loadUserData();
    await loadPreferences();
    setLoading(false);
  };

  const loadStats = async () => {
    try {
      const salesResult = await getTodaySales();
      const billsResult = await getBills();
      const productsResult = await getProducts();
      
      setStats({
        todaySales: salesResult.success ? salesResult.total : 0,
        totalBills: billsResult.success ? billsResult.bills.length : 0,
        totalProducts: productsResult.success ? productsResult.products.length : 0,
      });
    } catch (error) {
      console.log('Load stats error:', error);
    }
  };

  const loadUserData = async () => {
    try {
      const user = getCurrentUser();
      if (user) {
        setUserEmail(user.email);
        setUserName(user.displayName || '');
        
        // Load user data from Firestore
        const userData = await getUserData(user.uid);
        if (userData.success && userData.userData) {
          setUserName(userData.userData.name || user.displayName || '');
          setUserPhone(userData.userData.phone || '');
          setUserAddress(userData.userData.address || '');
        }
        
        // Load shop name from AsyncStorage
        const savedShopName = await AsyncStorage.getItem('shopName');
        if (savedShopName) {
          setShopName(savedShopName);
        } else {
          setShopName('My Store');
        }
        
        // Load profile image from AsyncStorage
        const savedImage = await AsyncStorage.getItem('profileImage');
        if (savedImage) {
          setProfileImage(savedImage);
        }
        
        // Load notification preference
        const savedNotifications = await AsyncStorage.getItem('notifications');
        if (savedNotifications !== null) {
          setNotifications(savedNotifications === 'true');
        }
      }
    } catch (error) {
      console.log('Load user data error:', error);
    }
  };

  const loadPreferences = async () => {
    try {
      const savedDarkMode = await AsyncStorage.getItem('darkMode');
      const savedAutoPrint = await AsyncStorage.getItem('autoPrint');
      if (savedDarkMode !== null) setDarkMode(savedDarkMode === 'true');
      if (savedAutoPrint !== null) setAutoPrint(savedAutoPrint === 'true');
    } catch (error) {
      console.log('Load preferences error:', error);
    }
  };

  const saveShopName = async () => {
    if (tempShopName.trim()) {
      setShopName(tempShopName);
      await AsyncStorage.setItem('shopName', tempShopName);
      setEditShopModal(false);
      Alert.alert('Success', 'Shop name updated successfully!');
    } else {
      Alert.alert('Error', 'Please enter a shop name');
    }
  };

  const saveUserProfile = async () => {
    if (!userName.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }
    
    try {
      const user = getCurrentUser();
      if (user) {
        const result = await updateUserProfile(user.uid, {
          name: userName,
          phone: userPhone,
          address: userAddress,
          updatedAt: new Date().toISOString()
        });
        
        if (result.success) {
          setEditProfileModal(false);
          Alert.alert('Success', 'Profile updated successfully!');
        } else {
          Alert.alert('Error', result.error);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Could not update profile');
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
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        setProfileImage(imageUri);
        await AsyncStorage.setItem('profileImage', imageUri);
        Alert.alert('Success', 'Profile image updated successfully!');
      }
    } catch (error) {
      console.log('Image picker error:', error);
      Alert.alert('Error', 'Could not pick image. Please try again.');
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logoutUser();
          await AsyncStorage.clear();
          router.replace('/login');
        }
      }
    ]);
  };

  const toggleNotifications = async (value) => {
    setNotifications(value);
    await AsyncStorage.setItem('notifications', value.toString());
    if (value) {
      Alert.alert('Notifications Enabled', 'You will receive bill updates and offers');
    } else {
      Alert.alert('Notifications Disabled', 'You won\'t receive any notifications');
    }
  };

  const toggleDarkMode = async (value) => {
    setDarkMode(value);
    await AsyncStorage.setItem('darkMode', value.toString());
    Alert.alert('Theme Updated', value ? 'Dark mode enabled' : 'Light mode enabled');
  };

  const toggleAutoPrint = async (value) => {
    setAutoPrint(value);
    await AsyncStorage.setItem('autoPrint', value.toString());
    Alert.alert('Auto Print', value ? 'Auto print enabled for bills' : 'Auto print disabled');
  };

  const clearAllData = async () => {
    Alert.alert(
      'Clear Data',
      'This will clear all local data. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.clear();
            Alert.alert('Success', 'All local data cleared');
            setShowDataManagement(false);
          }
        }
      ]
    );
  };

  const formatPrice = (amount) => `₨ ${amount?.toLocaleString('en-PK') || 0}`;

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1a73e8" />
        <Text style={styles.loadingText}>Loading Profile...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.imageContainer} onPress={pickImage}>
          {profileImage ? (
            <Image source={{ uri: profileImage }} style={styles.profileImage} />
          ) : (
            <View style={styles.profileImagePlaceholder}>
              <Text style={styles.profileImageText}>🛒</Text>
            </View>
          )}
          <View style={styles.cameraIcon}>
            <Text style={styles.cameraIconText}>📷</Text>
          </View>
        </TouchableOpacity>
        
        <Text style={styles.shopName}>{shopName}</Text>
        
        <TouchableOpacity 
          style={styles.editShopButton} 
          onPress={() => {
            setTempShopName(shopName);
            setEditShopModal(true);
          }}
        >
          <Text style={styles.editShopText}>✏️ Edit Shop Name</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.editProfileButton} 
          onPress={() => setEditProfileModal(true)}
        >
          <Text style={styles.editProfileText}>👤 Edit Profile</Text>
        </TouchableOpacity>
        
        <Text style={styles.userEmail}>{userEmail}</Text>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{formatPrice(stats.todaySales)}</Text>
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

      <View style={styles.menuSection}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        
        <View style={styles.menuItem}>
          <View style={styles.menuIcon}>
            <Text style={styles.menuIconText}>🔔</Text>
          </View>
          <Text style={styles.menuText}>Notifications</Text>
          <Switch
            value={notifications}
            onValueChange={toggleNotifications}
            trackColor={{ false: '#ddd', true: '#1a73e8' }}
            thumbColor={notifications ? '#fff' : '#f4f3f4'}
          />
        </View>

        <View style={styles.menuItem}>
          <View style={styles.menuIcon}>
            <Text style={styles.menuIconText}>🌙</Text>
          </View>
          <Text style={styles.menuText}>Dark Mode</Text>
          <Switch
            value={darkMode}
            onValueChange={toggleDarkMode}
            trackColor={{ false: '#ddd', true: '#1a73e8' }}
          />
        </View>

        <View style={styles.menuItem}>
          <View style={styles.menuIcon}>
            <Text style={styles.menuIconText}>🖨️</Text>
          </View>
          <Text style={styles.menuText}>Auto Print Bill</Text>
          <Switch
            value={autoPrint}
            onValueChange={toggleAutoPrint}
            trackColor={{ false: '#ddd', true: '#1a73e8' }}
          />
        </View>
      </View>

      <View style={styles.menuSection}>
        <Text style={styles.sectionTitle}>General</Text>
        
        <TouchableOpacity style={styles.menuItem} onPress={() => setShowSettings(true)}>
          <View style={styles.menuIcon}>
            <Text style={styles.menuIconText}>⚙️</Text>
          </View>
          <Text style={styles.menuText}>App Settings</Text>
          <Text style={styles.menuArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => setShowSecurity(true)}>
          <View style={styles.menuIcon}>
            <Text style={styles.menuIconText}>🔒</Text>
          </View>
          <Text style={styles.menuText}>Security</Text>
          <Text style={styles.menuArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => setShowDataManagement(true)}>
          <View style={styles.menuIcon}>
            <Text style={styles.menuIconText}>📊</Text>
          </View>
          <Text style={styles.menuText}>Data Management</Text>
          <Text style={styles.menuArrow}>→</Text>
        </TouchableOpacity>

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
            <Text style={styles.modalTitle}>Edit Shop Name</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter shop name"
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

      {/* Edit Profile Modal */}
      <Modal visible={editProfileModal} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder="Full Name"
              placeholderTextColor="#aaa"
              value={userName}
              onChangeText={setUserName}
            />
            
            <TextInput
              style={styles.modalInput}
              placeholder="Phone Number"
              placeholderTextColor="#aaa"
              value={userPhone}
              onChangeText={setUserPhone}
              keyboardType="phone-pad"
            />
            
            <TextInput
              style={[styles.modalInput, styles.textArea]}
              placeholder="Shop Address"
              placeholderTextColor="#aaa"
              value={userAddress}
              onChangeText={setUserAddress}
              multiline={true}
              numberOfLines={3}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.saveBtn} onPress={saveUserProfile}>
                <Text style={styles.saveBtnText}>Save Changes</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditProfileModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Settings Modal */}
      <Modal visible={showSettings} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>App Settings</Text>
            
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Currency</Text>
              <Text style={styles.settingValue}>Pakistani Rupee (PKR)</Text>
            </View>
            
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Tax Rate</Text>
              <Text style={styles.settingValue}>5% GST</Text>
            </View>
            
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Invoice Format</Text>
              <Text style={styles.settingValue}>Standard</Text>
            </View>
            
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Language</Text>
              <Text style={styles.settingValue}>English</Text>
            </View>
            
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Date Format</Text>
              <Text style={styles.settingValue}>DD/MM/YYYY</Text>
            </View>
            
            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={() => setShowSettings(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Security Modal */}
      <Modal visible={showSecurity} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Security</Text>
            
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Biometric Login</Text>
              <Text style={styles.settingValue}>Coming Soon</Text>
            </View>
            
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>PIN Protection</Text>
              <Text style={styles.settingValue}>Coming Soon</Text>
            </View>
            
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Session Timeout</Text>
              <Text style={styles.settingValue}>30 minutes</Text>
            </View>
            
            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={() => setShowSecurity(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Data Management Modal */}
      <Modal visible={showDataManagement} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Data Management</Text>
            
            <TouchableOpacity style={styles.dataOption} onPress={clearAllData}>
              <Text style={styles.dataOptionText}>🗑️ Clear Local Data</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.dataOption}>
              <Text style={styles.dataOptionText}>📤 Export Data (CSV)</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.dataOption}>
              <Text style={styles.dataOptionText}>💾 Backup Data</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={() => setShowDataManagement(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* About Modal */}
      <Modal visible={showAbout} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>About BillingEase</Text>
            <View style={styles.aboutLogo}>
              <Text style={styles.aboutLogoIcon}>🛒</Text>
            </View>
            <Text style={styles.aboutName}>BillingEase</Text>
            <Text style={styles.aboutVersion}>Version 2.0.0</Text>
            <Text style={styles.aboutBuild}>Build 101 | March 2025</Text>
            <Text style={styles.aboutDescription}>
              AI Powered Smart Billing System for Modern Retail Stores
            </Text>
            <View style={styles.featuresList}>
              <Text style={styles.featureItem}>✓ AI Product Suggestions</Text>
              <Text style={styles.featureItem}>✓ Smart Discount System</Text>
              <Text style={styles.featureItem}>✓ Auto Billing</Text>
              <Text style={styles.featureItem}>✓ Bill History</Text>
              <Text style={styles.featureItem}>✓ Inventory Management</Text>
              <Text style={styles.featureItem}>✓ Real-time Analytics</Text>
            </View>
            <Text style={styles.copyright}>© 2025 BillingEase. All rights reserved.</Text>
            <Text style={styles.credits}>Made with ❤️ in Pakistan</Text>
            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={() => setShowAbout(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
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
  imageContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#fff',
  },
  profileImagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  profileImageText: {
    fontSize: 45,
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  cameraIconText: {
    fontSize: 14,
  },
  shopName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  editShopButton: {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
  },
  editShopText: {
    fontSize: 12,
    color: '#fff',
  },
  editProfileButton: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#fff',
    borderRadius: 20,
  },
  editProfileText: {
    fontSize: 12,
    color: '#1a73e8',
    fontWeight: '600',
  },
  userEmail: {
    fontSize: 12,
    color: '#e8f0fe',
    marginTop: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    marginTop: -25,
    marginBottom: 20,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    minWidth: 100,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a73e8',
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
  menuSection: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a73e8',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuIcon: {
    width: 40,
  },
  menuIconText: {
    fontSize: 22,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 8,
  },
  menuArrow: {
    fontSize: 16,
    color: '#ccc',
  },
  logoutItem: {
    borderBottomWidth: 0,
  },
  logoutText: {
    color: '#dc3545',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    width: '90%',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#1a73e8',
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 15,
    backgroundColor: '#f8f9fa',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: '#34a853',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#dc3545',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  settingLabel: {
    fontSize: 16,
    color: '#333',
  },
  settingValue: {
    fontSize: 16,
    color: '#666',
  },
  dataOption: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  dataOptionText: {
    fontSize: 16,
    color: '#1a73e8',
  },
  aboutLogo: {
    alignItems: 'center',
    marginBottom: 16,
  },
  aboutLogoIcon: {
    fontSize: 60,
  },
  aboutName: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#1a73e8',
  },
  aboutVersion: {
    fontSize: 14,
    textAlign: 'center',
    color: '#666',
    marginTop: 4,
  },
  aboutBuild: {
    fontSize: 11,
    textAlign: 'center',
    color: '#999',
    marginBottom: 20,
  },
  aboutDescription: {
    fontSize: 14,
    textAlign: 'center',
    color: '#555',
    marginBottom: 20,
    lineHeight: 20,
  },
  featuresList: {
    marginBottom: 20,
  },
  featureItem: {
    fontSize: 13,
    color: '#34a853',
    marginBottom: 6,
    textAlign: 'center',
  },
  copyright: {
    fontSize: 10,
    textAlign: 'center',
    color: '#999',
    marginBottom: 4,
  },
  credits: {
    fontSize: 10,
    textAlign: 'center',
    color: '#bbb',
    marginBottom: 16,
  },
  closeButton: {
    backgroundColor: '#1a73e8',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
});