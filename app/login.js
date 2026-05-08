import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, 
  StyleSheet, Alert, ActivityIndicator, ScrollView 
} from 'react-native';
import { useRouter } from 'expo-router';
import { loginUser, registerUser } from '../config/firebase';

export default function Login() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setLoading(true);
    const result = await loginUser(email, password);
    if (result.success) {
      Alert.alert('Success', 'Welcome to BillingEase!');
      router.replace('/(tabs)/billing');
    } else {
      Alert.alert('Login Failed', result.error);
    }
    setLoading(false);
  };

  const handleSignup = async () => {
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
    const result = await registerUser(email, password, {
      name: email.split('@')[0]
    });
    
    if (result.success) {
      Alert.alert('Success', 'Account created! Please login.');
      setIsLogin(true);
      setEmail('');
      setPassword('');
      setConfirmPassword('');
    } else {
      Alert.alert('Signup Failed', result.error);
    }
    setLoading(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>🛒</Text>
      </View>
      
      <Text style={styles.title}>
        Billing<Text style={styles.accent}>Ease</Text>
      </Text>
      
      <View style={styles.formContainer}>
        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>Email Address</Text>
          <TextInput
            style={[styles.input, emailFocused && styles.inputFocused]}
            placeholder="Enter your email"
            placeholderTextColor="#aaa"
            value={email}
            onChangeText={setEmail}
            onFocus={() => setEmailFocused(true)}
            onBlur={() => setEmailFocused(false)}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>
        
        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>Password</Text>
          <TextInput
            style={[styles.input, passwordFocused && styles.inputFocused]}
            placeholder="Enter your password"
            placeholderTextColor="#aaa"
            value={password}
            onChangeText={setPassword}
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
            secureTextEntry
          />
        </View>
        
        {!isLogin && (
          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>Confirm Password</Text>
            <TextInput
              style={[styles.input]}
              placeholder="Re-enter your password"
              placeholderTextColor="#aaa"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
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
  iconContainer: {
    width: 100,
    height: 100,
    backgroundColor: '#1a73e8',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 25,
    shadowColor: '#1a73e8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  icon: {
    fontSize: 50,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#1a73e8',
    marginBottom: 35,
  },
  accent: {
    color: '#34a853',
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  inputWrapper: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#333',
    marginBottom: 6,
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#f8f9fa',
    padding: 14,
    borderRadius: 12,
    fontSize: 15,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    color: '#333',
  },
  inputFocused: {
    borderColor: '#1a73e8',
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#1a73e8',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#1a73e8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  switchButton: {
    marginTop: 18,
    alignItems: 'center',
  },
  switchText: {
    color: '#1a73e8',
    fontSize: 14,
    fontWeight: '500',
  },
});