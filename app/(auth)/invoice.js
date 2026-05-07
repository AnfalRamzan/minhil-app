import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Share, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function Invoice() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  // Safe parsing with fallback
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

  // If no data, show message with back option
  if (!billData || !cart || cart.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <View style={styles.errorIconCircle}>
          <Text style={styles.errorIcon}>⚠️</Text>
        </View>
        <Text style={styles.errorText}>No invoice data found</Text>
        <Text style={styles.errorSubText}>Please generate invoice from bill summary</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>← Go Back to Summary</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const formatPrice = (amount) => {
    return `₨ ${amount?.toLocaleString('en-PK') || 0}`;
  };

  const shareInvoice = async () => {
    try {
      let invoiceText = `================================\n`;
      invoiceText += `        BILLING EASE          \n`;
      invoiceText += `================================\n`;
      invoiceText += `Bill No: ${billData.billNumber}\n`;
      invoiceText += `Date: ${new Date(billData.date).toLocaleString()}\n`;
      invoiceText += `--------------------------------\n`;
      invoiceText += `ITEM           QTY   PRICE  TOTAL\n`;
      invoiceText += `--------------------------------\n`;
      
      cart.forEach(item => {
        const name = item.name.substring(0, 15);
        invoiceText += `${name.padEnd(15)} ${item.quantity.toString().padEnd(5)} ${formatPrice(item.price).padEnd(6)} ${formatPrice(item.total)}\n`;
      });
      
      invoiceText += `--------------------------------\n`;
      invoiceText += `Subtotal:                 ${formatPrice(billData.subtotal)}\n`;
      invoiceText += `Tax (5%):                 ${formatPrice(billData.tax)}\n`;
      invoiceText += `--------------------------------\n`;
      invoiceText += `TOTAL:                    ${formatPrice(billData.total)}\n`;
      invoiceText += `================================\n`;
      invoiceText += `   Thank you for shopping!     \n`;
      invoiceText += `================================\n`;
      
      await Share.share({ message: invoiceText });
    } catch (error) {
      Alert.alert('Error', 'Could not share invoice');
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Text style={styles.headerIcon}>🧾</Text>
        </View>
        <Text style={styles.headerTitle}>Invoice</Text>
      </View>

      <View style={styles.invoice}>
        <View style={styles.shopHeader}>
          <Text style={styles.shopIcon}>🛒</Text>
          <Text style={styles.shopName}>BillingEase</Text>
          <Text style={styles.shopAddress}>AI Powered Billing System</Text>
        </View>
        
        <View style={styles.billInfo}>
          <View style={styles.billInfoRow}>
            <Text style={styles.billLabel}>📄 Bill No:</Text>
            <Text style={styles.billValue}>{billData.billNumber}</Text>
          </View>
          <View style={styles.billInfoRow}>
            <Text style={styles.billLabel}>📅 Date:</Text>
            <Text style={styles.billValue}>{new Date(billData.date).toLocaleString()}</Text>
          </View>
        </View>
        
        <View style={styles.divider} />
        
        <View style={styles.tableHeader}>
          <Text style={[styles.col, styles.colItem]}>Item</Text>
          <Text style={[styles.col, styles.colQty]}>Qty</Text>
          <Text style={[styles.col, styles.colPrice]}>Price</Text>
          <Text style={[styles.col, styles.colTotal]}>Total</Text>
        </View>
        
        {cart.map((item, idx) => (
          <View key={idx} style={styles.tableRow}>
            <Text style={[styles.col, styles.colItem]}>{item.name}</Text>
            <Text style={[styles.col, styles.colQty]}>{item.quantity}</Text>
            <Text style={[styles.col, styles.colPrice]}>{formatPrice(item.price)}</Text>
            <Text style={[styles.col, styles.colTotal]}>{formatPrice(item.total)}</Text>
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
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
    padding: 20,
  },
  errorIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fee8e8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  errorIcon: {
    fontSize: 40,
  },
  errorText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#dc3545',
    marginBottom: 8,
  },
  errorSubText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  backBtn: {
    backgroundColor: '#1a73e8',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#1a73e8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerIcon: {
    fontSize: 35,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a73e8',
  },
  invoice: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  shopHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  shopIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  shopName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a73e8',
  },
  shopAddress: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  billInfo: {
    marginBottom: 16,
    gap: 8,
  },
  billInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  billLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    width: 60,
  },
  billValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 12,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    marginBottom: 10,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  col: {
    fontSize: 13,
  },
  colItem: {
    flex: 2,
  },
  colQty: {
    flex: 1,
    textAlign: 'center',
  },
  colPrice: {
    flex: 1,
    textAlign: 'right',
  },
  colTotal: {
    flex: 1,
    textAlign: 'right',
  },
  summary: {
    marginTop: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    color: '#333',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a73e8',
  },
  footer: {
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  thanks: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#34a853',
    marginBottom: 4,
  },
  footerText: {
    fontSize: 12,
    color: '#888',
  },
  shareBtn: {
    backgroundColor: '#34a853',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  shareBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  newBillBtn: {
    backgroundColor: '#1a73e8',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 30,
  },
  newBillBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});