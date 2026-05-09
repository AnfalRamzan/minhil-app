// app/login.js - FIXED DROPDOWN RESPONSIVE

import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, 
  StyleSheet, Alert, ActivityIndicator, ScrollView,
  Modal, Dimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import { loginUser, registerUser } from '../config/firebase';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function Login() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('');
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [roleError, setRoleError] = useState('');

  const roleOptions = [
    { id: 'customer', label: '🛒 Customer', description: 'Buy products only' },
    { id: 'shopkeeper', label: '🏪 Shopkeeper', description: 'Full access - Manage store' }
  ];

  const handleLogin = async () => {
    if (!role) {
      setRoleError('Please select account type first');
      return;
    }
    
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setLoading(true);
    const result = await loginUser(email, password);
    if (result.success) {
      if (result.role !== role) {
        Alert.alert('Error', `This account is registered as ${result.role}. Please select correct account type.`);
        setLoading(false);
        return;
      }
      Alert.alert('Success', `Welcome ${result.role === 'shopkeeper' ? 'Shopkeeper' : 'Customer'}!`);
      router.replace('/(tabs)/billing');
    } else {
      Alert.alert('Login Failed', result.error);
    }
    setLoading(false);
  };

  const handleSignup = async () => {
    if (!role) {
      setRoleError('Please select account type');
      return;
    }
    
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }
    
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    const result = await registerUser(email, password, role, {
      name: email.split('@')[0],
    });
    
    if (result.success) {
      Alert.alert('Success', `Account created as ${role === 'shopkeeper' ? 'Shopkeeper' : 'Customer'}! Please login.`);
      setIsLogin(true);
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setRole('');
    } else {
      Alert.alert('Signup Failed', result.error);
    }
    setLoading(false);
  };

  const renderRoleDropdown = () => {
    const selectedRole = roleOptions.find(r => r.id === role);
    
    return (
      <View style={styles.inputWrapper}>
        <Text style={styles.inputLabel}>Account Type <Text style={styles.requiredStar}>*</Text></Text>
        <TouchableOpacity 
          style={[styles.dropdownButton, roleError && styles.dropdownButtonError]}
          onPress={() => setShowRoleDropdown(true)}
        >
          <Text style={[styles.dropdownButtonText, !role && styles.placeholderText]}>
            {selectedRole ? selectedRole.label : 'Select Account Type'}
          </Text>
          <Ionicons name="chevron-down" size={18} color="#999" />
        </TouchableOpacity>
        {roleError ? <Text style={styles.errorText}>{roleError}</Text> : null}
        
        <Modal
          visible={showRoleDropdown}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowRoleDropdown(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowRoleDropdown(false)}
          >
            <View style={styles.dropdownModal}>
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: height * 0.4 }}>
                {roleOptions.map((option) => (
                  <TouchableOpacity
                    key={option.id}
                    style={[
                      styles.dropdownItem,
                      role === option.id && styles.dropdownItemActive
                    ]}
                    onPress={() => {
                      setRole(option.id);
                      setRoleError('');
                      setShowRoleDropdown(false);
                    }}
                  >
                    <Text style={styles.dropdownItemLabel}>{option.label}</Text>
                    <Text style={styles.dropdownItemDesc}>{option.description}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.logoContainer}>
        <View style={styles.iconCircle}>
          <Text style={styles.logoIcon}>🛒</Text>
        </View>
        <Text style={styles.appName}>
          Billing<Text style={styles.accent}>Ease</Text>
        </Text>
        <Text style={styles.tagline}>AI Powered Billing System</Text>
      </View>
      
      <View style={styles.formCard}>
        <Text style={styles.formTitle}>
          {isLogin ? 'Welcome Back!' : 'Create Account'}
        </Text>
        
        {/* ACCOUNT TYPE - FIRST */}
        {renderRoleDropdown()}
        
        {/* EMAIL - SECOND */}
        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>Email Address</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#999" style={styles.inputIcon} />
            <TextInput
              style={styles.inputWithIcon}
              placeholder="Enter your email"
              placeholderTextColor="#aaa"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>
        </View>
        
        {/* PASSWORD - THIRD with EYE ICON */}
        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>Password</Text>
          <View style={styles.passwordContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#999" style={styles.inputIcon} />
            <TextInput
              style={styles.passwordInput}
              placeholder="Enter your password"
              placeholderTextColor="#aaa"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity 
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons 
                name={showPassword ? "eye-off-outline" : "eye-outline"} 
                size={22} 
                color="#666" 
              />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* CONFIRM PASSWORD - Only on Signup with EYE ICON */}
        {!isLogin && (
          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>Confirm Password</Text>
            <View style={styles.passwordContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#999" style={styles.inputIcon} />
              <TextInput
                style={styles.passwordInput}
                placeholder="Re-enter your password"
                placeholderTextColor="#aaa"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
              />
              <TouchableOpacity 
                style={styles.eyeIcon}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <Ionicons 
                  name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} 
                  size={22} 
                  color="#666" 
                />
              </TouchableOpacity>
            </View>
          </View>
        )}
        
        <TouchableOpacity 
          style={styles.button} 
          onPress={isLogin ? handleLogin : handleSignup} 
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {isLogin ? 'Login' : 'Sign Up'}
            </Text>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.switchButton}
          onPress={() => {
            setIsLogin(!isLogin);
            setEmail('');
            setPassword('');
            setConfirmPassword('');
            setRole('');
            setRoleError('');
          }}
        >
          <Text style={styles.switchText}>
            {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Login"}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f0f2f5',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  iconCircle: {
    width: 90,
    height: 90,
    backgroundColor: '#1a73e8',
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1a73e8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  logoIcon: { fontSize: 45 },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1a73e8',
    marginTop: 15,
  },
  accent: { color: '#34a853' },
  tagline: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 24,
  },
  inputWrapper: { marginBottom: 18 },
  inputLabel: { 
    fontSize: 13, 
    fontWeight: '600', 
    color: '#333', 
    marginBottom: 6, 
    marginLeft: 4 
  },
  requiredStar: { color: '#dc3545' },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e8e8e8',
  },
  inputIcon: {
    paddingLeft: 14,
  },
  inputWithIcon: {
    flex: 1,
    padding: 14,
    fontSize: 15,
    color: '#333',
  },
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e8e8e8',
  },
  dropdownButtonError: {
    borderColor: '#dc3545',
  },
  dropdownButtonText: { fontSize: 15, color: '#333' },
  placeholderText: { color: '#aaa' },
  errorText: { fontSize: 11, color: '#dc3545', marginTop: 4, marginLeft: 4 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: width * 0.85,
    maxHeight: height * 0.5,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  dropdownItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownItemActive: {
    backgroundColor: '#e8f0fe',
  },
  dropdownItemLabel: { fontSize: 16, fontWeight: '600', color: '#333' },
  dropdownItemDesc: { fontSize: 11, color: '#888', marginTop: 2 },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e8e8e8',
  },
  passwordInput: {
    flex: 1,
    padding: 14,
    fontSize: 15,
    color: '#333',
  },
  eyeIcon: {
    padding: 12,
  },
  button: {
    backgroundColor: '#1a73e8',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#1a73e8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  switchButton: { marginTop: 20, alignItems: 'center' },
  switchText: { color: '#1a73e8', fontSize: 14, fontWeight: '500' },
});