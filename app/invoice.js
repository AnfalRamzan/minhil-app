import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Share, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function Invoice() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  let billData = null;
  let cart = [];
  
  try {
    if (params.billData && typeof params.billData === 'string') {
      billData = JSON.parse(params.billData);
    }
    if (params.cart && typeof params.cart === 'string') {
      cart = JSON.parse(params.cart);
    }
  } catch (error) {
    console.log('Parse error:', error);
  }

  if (!billData || !cart || cart.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>No invoice data found</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const formatPrice = (amount) => `₨ ${amount?.toLocaleString('en-PK') || 0}`;

  const shareInvoice = async () => {
    try {
      let invoiceText = `================================\n`;
      invoiceText += `        BILLING EASE          \n`;
      invoiceText += `================================\n`;
      invoiceText += `Bill No: ${billData.billNumber}\n`;
      invoiceText += `Date: ${new Date(billData.date).toLocaleString()}\n`;
      invoiceText += `--------------------------------\n`;
      invoiceText += `ITEM               QTY    TOTAL\n`;
      invoiceText += `--------------------------------\n`;
      
      cart.forEach(item => {
        const name = item.name.substring(0, 18);
        invoiceText += `${name.padEnd(18)} ${item.quantity.toString().padEnd(5)} ${formatPrice(item.total)}\n`;
      });
      
      invoiceText += `--------------------------------\n`;
      invoiceText += `Subtotal:              ${formatPrice(billData.subtotal)}\n`;
      invoiceText += `Tax (5% GST):          ${formatPrice(billData.tax)}\n`;
      invoiceText += `--------------------------------\n`;
      invoiceText += `TOTAL:                 ${formatPrice(billData.total)}\n`;
      invoiceText += `================================\n`;
      invoiceText += `   Thank you for shopping!     \n`;
      invoiceText += `================================\n`;
      
      await Share.share({ message: invoiceText });
    } catch (error) {
      Alert.alert('Error', 'Could not share invoice');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerIcon}>🧾</Text>
        <Text style={styles.headerTitle}>Invoice</Text>
      </View>

      <View style={styles.invoiceCard}>
        <View style={styles.shopInfo}>
          <Text style={styles.shopIcon}>🛒</Text>
          <Text style={styles.shopName}>BillingEase</Text>
          <Text style={styles.shopTagline}>AI Powered Billing System</Text>
        </View>
        
        <View style={styles.billInfo}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Bill No:</Text>
            <Text style={styles.infoValue}>{billData.billNumber}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Date:</Text>
            <Text style={styles.infoValue}>{new Date(billData.date).toLocaleString()}</Text>
          </View>
        </View>
        
        <View style={styles.divider} />
        
        <View style={styles.tableHeader}>
          <Text style={styles.colItem}>Item</Text>
          <Text style={styles.colQty}>Qty</Text>
          <Text style={styles.colTotal}>Total</Text>
        </View>
        
        {cart.map((item, idx) => (
          <View key={idx} style={styles.tableRow}>
            <Text style={styles.rowItem}>{item.name}</Text>
            <Text style={styles.rowQty}>{item.quantity}</Text>
            <Text style={styles.rowTotal}>{formatPrice(item.total)}</Text>
          </View>
        ))}
        
        <View style={styles.divider} />
        
        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal:</Text>
            <Text style={styles.summaryValue}>{formatPrice(billData.subtotal)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tax (5% GST):</Text>
            <Text style={styles.summaryValue}>{formatPrice(billData.tax)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Grand Total:</Text>
            <Text style={styles.totalValue}>{formatPrice(billData.total)}</Text>
          </View>
        </View>
        
        <View style={styles.footer}>
          <Text style={styles.thanks}>✓ Thank you for shopping!</Text>
          <Text style={styles.footerText}>Have a great day! 😊</Text>
        </View>
      </View>
      
      <TouchableOpacity style={styles.shareBtn} onPress={shareInvoice}>
        <Text style={styles.shareBtnText}>📤 Share Invoice</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.newBillBtn} onPress={() => router.replace('/(tabs)/billing')}>
        <Text style={styles.newBillBtnText}>➕ New Bill</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa', padding: 16 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f7fa' },
  errorIcon: { fontSize: 64, marginBottom: 16 },
  errorText: { fontSize: 18, color: '#dc3545', marginBottom: 20 },
  backBtn: { backgroundColor: '#1a73e8', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  backBtnText: { color: '#fff', fontSize: 16, fontWeight: '500' },
  header: { alignItems: 'center', marginBottom: 20 },
  headerIcon: { fontSize: 50, marginBottom: 10 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#1a73e8' },
  invoiceCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, elevation: 4 },
  shopInfo: { alignItems: 'center', marginBottom: 20 },
  shopIcon: { fontSize: 40, marginBottom: 8 },
  shopName: { fontSize: 22, fontWeight: 'bold', color: '#1a73e8' },
  shopTagline: { fontSize: 11, color: '#888', marginTop: 4 },
  billInfo: { marginBottom: 15, gap: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  infoLabel: { fontSize: 13, color: '#666' },
  infoValue: { fontSize: 13, fontWeight: '500', color: '#333' },
  divider: { height: 1, backgroundColor: '#e0e0e0', marginVertical: 12 },
  tableHeader: { flexDirection: 'row', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#e0e0e0', marginBottom: 10 },
  colItem: { flex: 2, fontSize: 13, fontWeight: 'bold', color: '#666' },
  colQty: { flex: 1, fontSize: 13, fontWeight: 'bold', color: '#666', textAlign: 'center' },
  colTotal: { flex: 1, fontSize: 13, fontWeight: 'bold', color: '#666', textAlign: 'right' },
  tableRow: { flexDirection: 'row', paddingVertical: 8 },
  rowItem: { flex: 2, fontSize: 13, color: '#333' },
  rowQty: { flex: 1, fontSize: 13, color: '#666', textAlign: 'center' },
  rowTotal: { flex: 1, fontSize: 13, fontWeight: '500', color: '#1a73e8', textAlign: 'right' },
  summary: { marginTop: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  summaryLabel: { fontSize: 14, color: '#666' },
  summaryValue: { fontSize: 14, color: '#333' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, marginTop: 8, borderTopWidth: 1, borderTopColor: '#e0e0e0' },
  totalLabel: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  totalValue: { fontSize: 20, fontWeight: 'bold', color: '#1a73e8' },
  footer: { alignItems: 'center', marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e0e0e0' },
  thanks: { fontSize: 16, fontWeight: 'bold', color: '#34a853', marginBottom: 4 },
  footerText: { fontSize: 12, color: '#888' },
  shareBtn: { backgroundColor: '#34a853', padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 16 },
  shareBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  newBillBtn: { backgroundColor: '#1a73e8', padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 12, marginBottom: 30 },
  newBillBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});