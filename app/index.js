import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/login');
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <View style={styles.iconCircle}>
          <Text style={styles.logoIcon}>🛒</Text>
        </View>
        <Text style={styles.appName}>
          Billing<Text style={styles.accent}>Ease</Text>
        </Text>
        <Text style={styles.tagline}>AI Powered Billing System</Text>
      </View>
      <ActivityIndicator size="large" color="#fff" style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a73e8', justifyContent: 'center', alignItems: 'center' },
  logoContainer: { alignItems: 'center' },
  iconCircle: { width: 100, height: 100, backgroundColor: '#fff', borderRadius: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  logoIcon: { fontSize: 50 },
  appName: { fontSize: 36, fontWeight: 'bold', color: '#fff', letterSpacing: 2 },
  accent: { color: '#FFD700' },
  tagline: { fontSize: 14, color: '#e8f0fe', marginTop: 8 },
  loader: { position: 'absolute', bottom: 60 },
});