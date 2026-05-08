import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, TouchableOpacity, StyleSheet, Alert, 
  Image, ScrollView, Switch, Modal, TextInput, ActivityIndicator 
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { logoutUser, getTodaySales, getBills, getProducts, getCurrentUser, getUserData, updateUserProfile, getDashboardStats } from '../../config/firebase';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Profile() {
  const router = useRouter();
  const [profileImage, setProfileImage] = useState(null);
  const [notifications, setNotifications] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [shopName, setShopName] = useState('');
  const [showAbout, setShowAbout] = useState(false);
  const [stats, setStats] = useState({ todaySales: 0, totalBills: 0, totalProducts: 0, totalRevenue: 0 });
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
  const [showEditSettingsModal, setShowEditSettingsModal] = useState(false);
  const [taxRate, setTaxRate] = useState('5');
  const [currency, setCurrency] = useState('PKR');
  const [language, setLanguage] = useState('English');
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [showDateFormatModal, setShowDateFormatModal] = useState(false);
  const [appVersion, setAppVersion] = useState('2.0.0');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exporting, setExporting] = useState(false);

  const languages = ['English', 'Urdu', 'Arabic'];
  const currencies = ['PKR', 'USD', 'EUR', 'GBP'];
  const dateFormats = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];

  useFocusEffect(
    useCallback(() => {
      loadAllData();
    }, [])
  );

  const loadAllData = async () => {
    setLoading(true);
    await loadStats();
    await loadUserData();
    await loadPreferences();
    await loadAppSettings();
    setLoading(false);
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
      } else {
        // Fallback to individual calls
        const salesResult = await getTodaySales();
        const billsResult = await getBills();
        const productsResult = await getProducts();
        
        setStats({
          todaySales: salesResult.success ? salesResult.total : 0,
          totalBills: billsResult.success ? billsResult.bills.length : 0,
          totalProducts: productsResult.success ? productsResult.products.length : 0,
          totalRevenue: 0,
        });
      }
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
        
        const userData = await getUserData(user.uid);
        if (userData.success && userData.userData) {
          setUserName(userData.userData.name || user.displayName || '');
          setUserPhone(userData.userData.phone || '');
          setUserAddress(userData.userData.address || '');
        }
        
        const savedShopName = await AsyncStorage.getItem('shopName');
        setShopName(savedShopName || 'My Store');
        
        const savedImage = await AsyncStorage.getItem('profileImage');
        if (savedImage) setProfileImage(savedImage);
      }
    } catch (error) {
      console.log('Load user data error:', error);
    }
  };

  const loadPreferences = async () => {
    try {
      const savedNotifications = await AsyncStorage.getItem('notifications');
      const savedDarkMode = await AsyncStorage.getItem('darkMode');
      const savedAutoPrint = await AsyncStorage.getItem('autoPrint');
      
      if (savedNotifications !== null) setNotifications(savedNotifications === 'true');
      if (savedDarkMode !== null) setDarkMode(savedDarkMode === 'true');
      if (savedAutoPrint !== null) setAutoPrint(savedAutoPrint === 'true');
      
      // Apply theme immediately
      applyTheme(savedDarkMode === 'true');
    } catch (error) {
      console.log('Load preferences error:', error);
    }
  };

  const loadAppSettings = async () => {
    try {
      const savedTaxRate = await AsyncStorage.getItem('taxRate');
      const savedCurrency = await AsyncStorage.getItem('currency');
      const savedLanguage = await AsyncStorage.getItem('language');
      const savedDateFormat = await AsyncStorage.getItem('dateFormat');
      const savedVersion = await AsyncStorage.getItem('appVersion');
      
      if (savedTaxRate) setTaxRate(savedTaxRate);
      if (savedCurrency) setCurrency(savedCurrency);
      if (savedLanguage) setLanguage(savedLanguage);
      if (savedDateFormat) setDateFormat(savedDateFormat);
      if (savedVersion) setAppVersion(savedVersion);
    } catch (error) {
      console.log('Load app settings error:', error);
    }
  };

  const applyTheme = (isDark) => {
    // This will apply theme globally
    // You can implement actual theme switching here
    console.log('Theme applied:', isDark ? 'Dark Mode' : 'Light Mode');
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
    
    // Show appropriate message
    if (value) {
      Alert.alert('✅ Notifications Enabled', 'You will receive:\n• Bill updates\n• Special offers\n• Stock alerts\n• Payment reminders');
    } else {
      Alert.alert('🔕 Notifications Disabled', 'You won\'t receive any notifications. You can enable them anytime from settings.');
    }
  };

  const toggleDarkMode = async (value) => {
    setDarkMode(value);
    await AsyncStorage.setItem('darkMode', value.toString());
    applyTheme(value);
    Alert.alert('🎨 Theme Updated', value ? 'Dark mode enabled' : 'Light mode enabled');
  };

  const toggleAutoPrint = async (value) => {
    setAutoPrint(value);
    await AsyncStorage.setItem('autoPrint', value.toString());
    
    if (value) {
      Alert.alert('🖨️ Auto Print Enabled', 'Bills will be automatically printed after generation.\n\nMake sure your printer is connected and configured.');
    } else {
      Alert.alert('🖨️ Auto Print Disabled', 'You will need to manually print bills after generation.');
    }
  };

  const saveAppSettings = async () => {
    try {
      await AsyncStorage.setItem('taxRate', taxRate);
      await AsyncStorage.setItem('currency', currency);
      await AsyncStorage.setItem('language', language);
      await AsyncStorage.setItem('dateFormat', dateFormat);
      await AsyncStorage.setItem('appVersion', appVersion);
      
      Alert.alert('Success', 'App settings saved successfully!\nRestart the app for changes to take effect.');
      setShowEditSettingsModal(false);
    } catch (error) {
      Alert.alert('Error', 'Could not save settings');
    }
  };

  const exportData = async () => {
    setExporting(true);
    try {
      const billsResult = await getBills();
      const productsResult = await getProducts();
      
      const exportData = {
        bills: billsResult.success ? billsResult.bills : [],
        products: productsResult.success ? productsResult.products : [],
        shopName: shopName,
        exportDate: new Date().toISOString(),
        totalSales: stats.totalRevenue,
        totalBills: stats.totalBills,
      };
      
      const jsonString = JSON.stringify(exportData, null, 2);
      
      // For demo, show preview
      Alert.alert(
        '📤 Data Exported',
        `Exported ${exportData.bills.length} bills and ${exportData.products.length} products.\n\nData size: ${Math.round(jsonString.length / 1024)} KB`,
        [{ text: 'OK', onPress: () => setShowExportModal(false) }]
      );
    } catch (error) {
      Alert.alert('Error', 'Could not export data');
    }
    setExporting(false);
  };

  const clearAllData = async () => {
    Alert.alert(
      '⚠️ Clear All Data',
      'This will clear all local data including:\n• Profile info\n• Settings\n• Cached images\n\nCloud data will remain safe.\n\nAre you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.clear();
            setProfileImage(null);
            setShopName('My Store');
            setNotifications(true);
            setDarkMode(false);
            setAutoPrint(false);
            setTaxRate('5');
            setCurrency('PKR');
            setLanguage('English');
            setDateFormat('DD/MM/YYYY');
            Alert.alert('Success', 'All local data cleared successfully!');
            setShowDataManagement(false);
          }
        }
      ]
    );
  };

  const formatPrice = (amount) => {
    const symbol = currency === 'PKR' ? '₨' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '£';
    return `${symbol} ${amount?.toLocaleString() || 0}`;
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1a73e8" />
        <Text style={styles.loadingText}>Loading Profile...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, darkMode && styles.darkContainer]} showsVerticalScrollIndicator={false}>
      {/* Header Section */}
      <View style={[styles.header, darkMode && styles.darkHeader]}>
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
        
        <Text style={[styles.shopName, darkMode && styles.darkText]}>{shopName}</Text>
        
        <TouchableOpacity style={styles.editShopButton} onPress={() => {
          setTempShopName(shopName);
          setEditShopModal(true);
        }}>
          <Text style={styles.editShopText}>✏️ Edit Shop Name</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.editProfileButton} onPress={() => setEditProfileModal(true)}>
          <Text style={styles.editProfileText}>👤 Edit Profile</Text>
        </TouchableOpacity>
        
        <Text style={styles.userEmail}>{userEmail}</Text>
      </View>

      {/* Stats Section */}
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

      {/* Preferences Section */}
      <View style={[styles.menuSection, darkMode && styles.darkMenuSection]}>
        <Text style={[styles.sectionTitle, darkMode && styles.darkSectionTitle]}>⚙️ Preferences</Text>
        
        <View style={styles.menuItem}>
          <View style={styles.menuIcon}>
            <Text style={styles.menuIconText}>🔔</Text>
          </View>
          <Text style={[styles.menuText, darkMode && styles.darkMenuText]}>Notifications</Text>
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
          <Text style={[styles.menuText, darkMode && styles.darkMenuText]}>Dark Mode</Text>
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
          <Text style={[styles.menuText, darkMode && styles.darkMenuText]}>Auto Print Bill</Text>
          <Switch
            value={autoPrint}
            onValueChange={toggleAutoPrint}
            trackColor={{ false: '#ddd', true: '#1a73e8' }}
          />
        </View>
      </View>

      {/* General Section */}
      <View style={[styles.menuSection, darkMode && styles.darkMenuSection]}>
        <Text style={[styles.sectionTitle, darkMode && styles.darkSectionTitle]}>📱 General</Text>
        
        <TouchableOpacity style={styles.menuItem} onPress={() => setShowEditSettingsModal(true)}>
          <View style={styles.menuIcon}>
            <Text style={styles.menuIconText}>⚙️</Text>
          </View>
          <Text style={[styles.menuText, darkMode && styles.darkMenuText]}>App Settings</Text>
          <Text style={styles.menuArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => setShowSecurity(true)}>
          <View style={styles.menuIcon}>
            <Text style={styles.menuIconText}>🔒</Text>
          </View>
          <Text style={[styles.menuText, darkMode && styles.darkMenuText]}>Security</Text>
          <Text style={styles.menuArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => setShowDataManagement(true)}>
          <View style={styles.menuIcon}>
            <Text style={styles.menuIconText}>📊</Text>
          </View>
          <Text style={[styles.menuText, darkMode && styles.darkMenuText]}>Data Management</Text>
          <Text style={styles.menuArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => setShowExportModal(true)}>
          <View style={styles.menuIcon}>
            <Text style={styles.menuIconText}>📤</Text>
          </View>
          <Text style={[styles.menuText, darkMode && styles.darkMenuText]}>Export Data</Text>
          <Text style={styles.menuArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => setShowAbout(true)}>
          <View style={styles.menuIcon}>
            <Text style={styles.menuIconText}>ℹ️</Text>
          </View>
          <Text style={[styles.menuText, darkMode && styles.darkMenuText]}>About</Text>
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

      {/* ========== MODALS ========== */}

      {/* Edit Shop Name Modal */}
      <Modal visible={editShopModal} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, darkMode && styles.darkModalContent]}>
            <Text style={[styles.modalTitle, darkMode && styles.darkText]}>Edit Shop Name</Text>
            <TextInput
              style={[styles.modalInput, darkMode && styles.darkModalInput]}
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
          <View style={[styles.modalContent, darkMode && styles.darkModalContent]}>
            <Text style={[styles.modalTitle, darkMode && styles.darkText]}>Edit Profile</Text>
            
            <TextInput
              style={[styles.modalInput, darkMode && styles.darkModalInput]}
              placeholder="Full Name"
              placeholderTextColor="#aaa"
              value={userName}
              onChangeText={setUserName}
            />
            
            <TextInput
              style={[styles.modalInput, darkMode && styles.darkModalInput]}
              placeholder="Phone Number"
              placeholderTextColor="#aaa"
              value={userPhone}
              onChangeText={setUserPhone}
              keyboardType="phone-pad"
            />
            
            <TextInput
              style={[styles.modalInput, styles.textArea, darkMode && styles.darkModalInput]}
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

      {/* App Settings Modal - Dynamic */}
      <Modal visible={showEditSettingsModal} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, darkMode && styles.darkModalContent, { maxHeight: '85%' }]}>
            <Text style={[styles.modalTitle, darkMode && styles.darkText]}>App Settings</Text>
            
            {/* Tax Rate */}
            <TouchableOpacity style={styles.settingItem} onPress={() => {
              Alert.alert('Tax Rate', 'Set GST percentage', [
                { text: 'Cancel', style: 'cancel' },
                { text: '5%', onPress: () => setTaxRate('5') },
                { text: '10%', onPress: () => setTaxRate('10') },
                { text: '15%', onPress: () => setTaxRate('15') },
                { text: '18%', onPress: () => setTaxRate('18') },
              ]);
            }}>
              <Text style={[styles.settingLabel, darkMode && styles.darkMenuText]}>Tax Rate (GST)</Text>
              <Text style={[styles.settingValue, darkMode && styles.darkMenuText]}>{taxRate}%</Text>
            </TouchableOpacity>
            
            {/* Currency */}
            <TouchableOpacity style={styles.settingItem} onPress={() => setShowCurrencyModal(true)}>
              <Text style={[styles.settingLabel, darkMode && styles.darkMenuText]}>Currency</Text>
              <Text style={[styles.settingValue, darkMode && styles.darkMenuText]}>{currency}</Text>
            </TouchableOpacity>
            
            {/* Language */}
            <TouchableOpacity style={styles.settingItem} onPress={() => setShowLanguageModal(true)}>
              <Text style={[styles.settingLabel, darkMode && styles.darkMenuText]}>Language</Text>
              <Text style={[styles.settingValue, darkMode && styles.darkMenuText]}>{language}</Text>
            </TouchableOpacity>
            
            {/* Date Format */}
            <TouchableOpacity style={styles.settingItem} onPress={() => setShowDateFormatModal(true)}>
              <Text style={[styles.settingLabel, darkMode && styles.darkMenuText]}>Date Format</Text>
              <Text style={[styles.settingValue, darkMode && styles.darkMenuText]}>{dateFormat}</Text>
            </TouchableOpacity>
            
            {/* Invoice Format */}
            <View style={styles.settingItem}>
              <Text style={[styles.settingLabel, darkMode && styles.darkMenuText]}>Invoice Format</Text>
              <Text style={[styles.settingValue, darkMode && styles.darkMenuText]}>Standard</Text>
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.saveBtn} onPress={saveAppSettings}>
                <Text style={styles.saveBtnText}>Save Settings</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowEditSettingsModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Currency Modal */}
      <Modal visible={showCurrencyModal} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, darkMode && styles.darkModalContent]}>
            <Text style={[styles.modalTitle, darkMode && styles.darkText]}>Select Currency</Text>
            {currencies.map((curr) => (
              <TouchableOpacity
                key={curr}
                style={styles.optionItem}
                onPress={() => {
                  setCurrency(curr);
                  setShowCurrencyModal(false);
                }}
              >
                <Text style={[styles.optionText, darkMode && styles.darkMenuText]}>{curr}</Text>
                {currency === curr && <Text style={styles.checkMark}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Language Modal */}
      <Modal visible={showLanguageModal} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, darkMode && styles.darkModalContent]}>
            <Text style={[styles.modalTitle, darkMode && styles.darkText]}>Select Language</Text>
            {languages.map((lang) => (
              <TouchableOpacity
                key={lang}
                style={styles.optionItem}
                onPress={() => {
                  setLanguage(lang);
                  setShowLanguageModal(false);
                  Alert.alert('Language Changed', `App language will change to ${lang} on restart`);
                }}
              >
                <Text style={[styles.optionText, darkMode && styles.darkMenuText]}>{lang}</Text>
                {language === lang && <Text style={styles.checkMark}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Date Format Modal */}
      <Modal visible={showDateFormatModal} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, darkMode && styles.darkModalContent]}>
            <Text style={[styles.modalTitle, darkMode && styles.darkText]}>Select Date Format</Text>
            {dateFormats.map((format) => (
              <TouchableOpacity
                key={format}
                style={styles.optionItem}
                onPress={() => {
                  setDateFormat(format);
                  setShowDateFormatModal(false);
                }}
              >
                <Text style={[styles.optionText, darkMode && styles.darkMenuText]}>{format}</Text>
                {dateFormat === format && <Text style={styles.checkMark}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Security Modal */}
      <Modal visible={showSecurity} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, darkMode && styles.darkModalContent]}>
            <Text style={[styles.modalTitle, darkMode && styles.darkText]}>🔒 Security</Text>
            
            <View style={styles.settingItem}>
              <Text style={[styles.settingLabel, darkMode && styles.darkMenuText]}>Biometric Login</Text>
              <TouchableOpacity onPress={() => Alert.alert('Coming Soon', 'Biometric login will be available in next update')}>
                <Text style={[styles.settingValue, { color: '#1a73e8' }]}>Setup →</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.settingItem}>
              <Text style={[styles.settingLabel, darkMode && styles.darkMenuText]}>PIN Protection</Text>
              <TouchableOpacity onPress={() => Alert.alert('Coming Soon', 'PIN protection will be available in next update')}>
                <Text style={[styles.settingValue, { color: '#1a73e8' }]}>Enable →</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.settingItem}>
              <Text style={[styles.settingLabel, darkMode && styles.darkMenuText]}>Session Timeout</Text>
              <TouchableOpacity onPress={() => {
                Alert.alert('Session Timeout', 'Select timeout duration', [
                  { text: '1 minute', onPress: () => Alert.alert('Info', 'Will be implemented in next update') },
                  { text: '5 minutes', onPress: () => Alert.alert('Info', 'Will be implemented in next update') },
                  { text: '15 minutes', onPress: () => Alert.alert('Info', 'Will be implemented in next update') },
                  { text: '30 minutes', onPress: () => Alert.alert('Info', 'Will be implemented in next update') },
                  { text: 'Cancel', style: 'cancel' },
                ]);
              }}>
                <Text style={[styles.settingValue, { color: '#1a73e8' }]}>30 minutes →</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.settingItem}>
              <Text style={[styles.settingLabel, darkMode && styles.darkMenuText]}>Data Encryption</Text>
              <Text style={[styles.settingValue, darkMode && styles.darkMenuText]}>Enabled ✓</Text>
            </View>
            
            <TouchableOpacity style={styles.closeButton} onPress={() => setShowSecurity(false)}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Data Management Modal */}
      <Modal visible={showDataManagement} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, darkMode && styles.darkModalContent]}>
            <Text style={[styles.modalTitle, darkMode && styles.darkText]}>📊 Data Management</Text>
            
            <TouchableOpacity style={styles.dataOption} onPress={clearAllData}>
              <Text style={styles.dataOptionText}>🗑️ Clear Local Data</Text>
              <Text style={styles.dataOptionSub}>Remove all cached and saved data</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.dataOption} onPress={exportData}>
              <Text style={styles.dataOptionText}>📤 Export All Data (JSON)</Text>
              <Text style={styles.dataOptionSub}>Export bills and products to file</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.dataOption} onPress={() => Alert.alert('Backup', 'Cloud backup will be available in next update')}>
              <Text style={styles.dataOptionText}>☁️ Backup to Cloud</Text>
              <Text style={styles.dataOptionSub}>Coming soon</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.dataOption} onPress={() => Alert.alert('Restore', 'Data restore will be available in next update')}>
              <Text style={styles.dataOptionText}>🔄 Restore from Backup</Text>
              <Text style={styles.dataOptionSub}>Coming soon</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.closeButton} onPress={() => setShowDataManagement(false)}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Export Modal */}
      <Modal visible={showExportModal} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, darkMode && styles.darkModalContent]}>
            <Text style={[styles.modalTitle, darkMode && styles.darkText]}>📤 Export Data</Text>
            <Text style={styles.exportText}>Export your data for backup or analysis</Text>
            
            <TouchableOpacity style={styles.exportOption} onPress={exportData} disabled={exporting}>
              <Text style={styles.exportOptionText}>
                {exporting ? '⏳ Exporting...' : '📄 Export as JSON'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.exportOption} onPress={() => Alert.alert('Coming Soon', 'CSV export will be available soon')}>
              <Text style={styles.exportOptionText}>📊 Export as CSV</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.exportOption} onPress={() => Alert.alert('Coming Soon', 'PDF report will be available soon')}>
              <Text style={styles.exportOptionText}>📑 Export as PDF</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowExportModal(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* About Modal - Dynamic */}
      <Modal visible={showAbout} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, darkMode && styles.darkModalContent]}>
            <Text style={[styles.modalTitle, darkMode && styles.darkText]}>About BillingEase</Text>
            <View style={styles.aboutLogo}>
              <Text style={styles.aboutLogoIcon}>🧠</Text>
            </View>
            <Text style={[styles.aboutName, darkMode && styles.darkText]}>BillingEase</Text>
            <Text style={styles.aboutVersion}>Version {appVersion}</Text>
            <Text style={styles.aboutBuild}>Build 105 | May 2026</Text>
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
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  darkContainer: {
    backgroundColor: '#1a1a2e',
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
  darkHeader: {
    backgroundColor: '#0f4c81',
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
  darkMenuSection: {
    backgroundColor: '#16213e',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a73e8',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  darkSectionTitle: {
    color: '#4fc3f7',
    borderBottomColor: '#333',
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
  darkMenuText: {
    color: '#e0e0e0',
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
  darkText: {
    color: '#fff',
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
  darkModalContent: {
    backgroundColor: '#1a1a2e',
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
  darkModalInput: {
    backgroundColor: '#2a2a3e',
    borderColor: '#444',
    color: '#fff',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
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
    alignItems: 'center',
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
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  optionText: {
    fontSize: 16,
    color: '#333',
  },
  checkMark: {
    fontSize: 18,
    color: '#34a853',
    fontWeight: 'bold',
  },
  dataOption: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  dataOptionText: {
    fontSize: 16,
    color: '#1a73e8',
    fontWeight: '500',
  },
  dataOptionSub: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
  exportText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  exportOption: {
    backgroundColor: '#e8f0fe',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  exportOptionText: {
    fontSize: 16,
    color: '#1a73e8',
    fontWeight: '500',
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
    marginTop: 10,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
});