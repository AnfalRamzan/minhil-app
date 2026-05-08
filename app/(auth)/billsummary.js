// app/billsummary.js - COMPLETE WITH DIRECT DARAZ LINK FUNCTION

import React, { useState, useEffect } from 'react';
import { 
  View, Text, FlatList, TouchableOpacity, StyleSheet, 
  Alert, ScrollView, ActivityIndicator, Linking 
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { saveBill, formatPKR } from '../../config/firebase';

// ✅ DIRECT DARAZ LINK GENERATOR FUNCTION (YAHI PE DEFINE KARO)
const generateDarazLink = (productName) => {
  if (!productName) return 'https://www.daraz.pk/';
  const searchQuery = encodeURIComponent(productName.trim().toLowerCase());
  return `https://www.daraz.pk/catalog/?q=${searchQuery}&spm=a2a0e.tm80335411.search.1`;
};

export default function BillSummary() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [cart, setCart] = useState([]);
  const [total, setTotal] = useState(0);
  const [originalTotal, setOriginalTotal] = useState(0);
  const [totalDiscount, setTotalDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [finalTotal, setFinalTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [savingsPercentage, setSavingsPercentage] = useState(0);

  useEffect(() => {
    if (params.cart && params.total) {
      try {
        const parsedCart = JSON.parse(params.cart);
        // Add Daraz link to each cart item
        const cartWithLinks = parsedCart.map(item => ({
          ...item,
          marketUrl: generateDarazLink(item.name)
        }));
        setCart(cartWithLinks);
        
        const currentTotal = parseFloat(params.total);
        setTotal(currentTotal);
        
        let original = 0;
        if (params.originalTotal) {
          original = parseFloat(params.originalTotal);
          setOriginalTotal(original);
        } else {
          original = cartWithLinks.reduce((sum, item) => sum + ((item.originalPrice || item.price) * item.quantity), 0);
          setOriginalTotal(original);
        }
        
        const discountAmt = original - currentTotal;
        setTotalDiscount(discountAmt);
        
        const savings = discountAmt > 0 ? (discountAmt / original) * 100 : 0;
        setSavingsPercentage(savings);
      } catch (error) {
        console.log('Parse error:', error);
      }
    }
  }, [params.cart, params.total, params.originalTotal]);

  useEffect(() => {
    const taxAmount = total * 0.05;
    setTax(taxAmount);
    setFinalTotal(total + taxAmount);
  }, [total]);

  const generateBill = async () => {
    if (cart.length === 0) {
      Alert.alert('Error', 'Cart is empty');
      return;
    }

    setLoading(true);

    try {
      const billData = {
        cart: cart.map(item => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.discountedPrice || item.price,
          originalPrice: item.originalPrice || item.price,
          total: (item.discountedPrice || item.price) * item.quantity,
          discount: item.discount || 0,
          discountReason: item.discountReason || 'No discount',
          marketUrl: item.marketUrl || generateDarazLink(item.name)
        })),
        subtotal: total,
        originalSubtotal: originalTotal,
        discountAmount: totalDiscount,
        discountPercentage: savingsPercentage,
        tax: tax,
        total: finalTotal,
        date: new Date().toISOString(),
      };
      
      const result = await saveBill(billData);
      
      if (result.success) {
        router.push({
          pathname: '/invoice',
          params: { 
            billData: JSON.stringify({
              ...billData,
              billNumber: result.billNumber,
              billId: result.billId,
            }),
            cart: JSON.stringify(cart)
          }
        });
      } else {
        Alert.alert('Error', result.error);
      }
    } catch (error) {
      Alert.alert('Error', 'Could not save bill');
    }
    
    setLoading(false);
  };

  const openDarazLink = (url, productName) => {
    const finalUrl = url || generateDarazLink(productName);
    console.log('Opening Daraz URL:', finalUrl);  // ✅ DEBUG: Check if URL is generated
    Linking.openURL(finalUrl).catch(() => {
      Alert.alert('Error', `Cannot open Daraz for ${productName}`);
    });
  };

  const getDiscountColor = (discount) => {
    if (discount >= 20) return '#e67e22';
    if (discount >= 10) return '#f39c12';
    if (discount > 0) return '#34a853';
    return '#999';
  };

  const getReasonIcon = (reason) => {
    if (!reason) return '💰';
    const lowerReason = reason.toLowerCase();
    if (lowerReason.includes('market')) return '🏷️';
    if (lowerReason.includes('stock')) return '📦';
    if (lowerReason.includes('sales') || lowerReason.includes('selling')) return '📉';
    if (lowerReason.includes('demand')) return '🔥';
    return '🤖';
  };

  const renderBillItem = ({ item, index }) => {
    const hasDiscount = item.discount > 0;
    const itemOriginalTotal = (item.originalPrice || item.price) * item.quantity;
    const itemDiscountedTotal = (item.discountedPrice || item.price) * item.quantity;
    const itemSaved = itemOriginalTotal - itemDiscountedTotal;
    
    return (
      <View style={[styles.billItem, index % 2 === 0 && styles.billItemAlt]}>
        <View style={styles.itemLeft}>
          <View style={styles.itemNumber}>
            <Text style={styles.itemNumberText}>{index + 1}</Text>
          </View>
          <View style={styles.itemInfo}>
            <Text style={styles.itemName}>{item.name}</Text>
            <View style={styles.itemMeta}>
              <Text style={styles.itemQty}>Qty: {item.quantity}</Text>
              {hasDiscount && (
                <View style={[styles.discountPill, { backgroundColor: getDiscountColor(item.discount) }]}>
                  <Text style={styles.discountPillText}>
                    {getReasonIcon(item.discountReason)} {item.discount}% OFF
                  </Text>
                </View>
              )}
            </View>
            {hasDiscount && item.discountReason && (
              <Text style={styles.discountReason} numberOfLines={2}>
                📊 {item.discountReason}
              </Text>
            )}
            
            {/* ✅ DARAZ COMPARE BUTTON */}
            <TouchableOpacity 
              style={styles.darazButton}
              onPress={() => openDarazLink(item.marketUrl, item.name)}
            >
              <Text style={styles.darazButtonText}>🧡 Compare {item.name} on Daraz</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.itemDetails}>
          {hasDiscount ? (
            <>
              <Text style={styles.itemOriginalPrice}>{formatPKR(itemOriginalTotal)}</Text>
              <Text style={styles.itemPrice}>{formatPKR(itemDiscountedTotal)}</Text>
              <View style={styles.savedBadge}>
                <Text style={styles.savedBadgeText}>Save {formatPKR(itemSaved)}</Text>
              </View>
            </>
          ) : (
            <Text style={styles.itemPriceRegular}>{formatPKR(itemOriginalTotal)}</Text>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1a73e8" />
        <Text style={styles.loadingText}>Generating Bill...</Text>
      </View>
    );
  }

  if (cart.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <View style={styles.emptyIconCircle}>
          <Text style={styles.emptyIcon}>🛒</Text>
        </View>
        <Text style={styles.emptyTitle}>No Items in Cart</Text>
        <Text style={styles.emptyText}>Please add products from billing screen</Text>
        <TouchableOpacity style={styles.goBackBtn} onPress={() => router.replace('/(tabs)/billing')}>
          <Text style={styles.goBackBtnText}>← Go to Billing</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Text style={styles.headerIcon}>📋</Text>
        </View>
        <Text style={styles.headerTitle}>Bill Summary</Text>
        <Text style={styles.headerSubtitle}>Review your order before generating bill</Text>
      </View>

      {totalDiscount > 0 && (
        <View style={styles.savingsBanner}>
          <Text style={styles.savingsIcon}>🎉</Text>
          <View style={styles.savingsContent}>
            <Text style={styles.savingsTitle}>🤖 AI Smart Savings!</Text>
            <Text style={styles.savingsAmount}>{formatPKR(totalDiscount)}</Text>
            <Text style={styles.savingsPercent}>
              ({savingsPercentage.toFixed(1)}% off on total purchase)
            </Text>
          </View>
        </View>
      )}

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.cardHeaderIcon}>🛒</Text>
            <Text style={styles.cardHeaderText}>Order Items</Text>
          </View>
          <View style={styles.itemCountBadge}>
            <Text style={styles.itemCount}>{cart.length} items</Text>
          </View>
        </View>
        
        <FlatList
          data={cart}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          renderItem={renderBillItem}
          scrollEnabled={false}
        />
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>💰 Amount Summary</Text>
        
        {originalTotal > total && (
          <>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Original Total:</Text>
              <Text style={[styles.summaryValue, styles.strikethrough]}>{formatPKR(originalTotal)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>🤖 AI Discount:</Text>
              <Text style={[styles.summaryValue, styles.discountText]}>-{formatPKR(totalDiscount)}</Text>
            </View>
            <View style={styles.dividerLight} />
          </>
        )}
        
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal:</Text>
          <Text style={styles.summaryValue}>{formatPKR(total)}</Text>
        </View>
        
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Tax (5% GST):</Text>
          <Text style={styles.summaryValue}>{formatPKR(tax)}</Text>
        </View>
        
        <View style={styles.dividerLight} />
        
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Grand Total:</Text>
          <Text style={styles.totalValue}>{formatPKR(finalTotal)}</Text>
        </View>
      </View>

      {cart.some(item => item.discount > 0) && (
        <View style={styles.discountBreakdownCard}>
          <Text style={styles.breakdownTitle}>✨ AI Discount Breakdown</Text>
          {cart.filter(item => item.discount > 0).map((item, idx) => {
            const itemOriginalTotal = (item.originalPrice || item.price) * item.quantity;
            const itemDiscountedTotal = (item.discountedPrice || item.price) * item.quantity;
            const itemSaved = itemOriginalTotal - itemDiscountedTotal;
            return (
              <View key={idx} style={styles.breakdownItem}>
                <View style={styles.breakdownLeft}>
                  <Text style={styles.breakdownProduct}>{item.name}</Text>
                  <Text style={styles.breakdownReason}>
                    {getReasonIcon(item.discountReason)} {item.discountReason || 'AI best price'}
                  </Text>
                </View>
                <View style={styles.breakdownRight}>
                  <View style={[styles.breakdownPercent, { backgroundColor: getDiscountColor(item.discount) }]}>
                    <Text style={styles.breakdownPercentText}>-{item.discount}%</Text>
                  </View>
                  <Text style={styles.breakdownSaved}>Save {formatPKR(itemSaved)}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.aiNoteCard}>
        <Text style={styles.aiNoteIcon}>🧠</Text>
        <View style={styles.aiNoteContent}>
          <Text style={styles.aiNoteTitle}>AI Learning Active</Text>
          <Text style={styles.aiNoteText}>
            This purchase will help AI learn buying patterns for better future recommendations
          </Text>
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.generateBtn} onPress={generateBill} activeOpacity={0.8}>
          <Text style={styles.generateBtnText}>✅ Generate Bill & Save</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.editCartBtn} onPress={() => router.back()}>
          <Text style={styles.editCartBtnText}>✏️ Edit Cart</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f7fa', padding: 20 },
  loadingText: { marginTop: 12, color: '#666', fontSize: 14 },
  emptyIconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#e8f0fe', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyIcon: { fontSize: 50 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#666', marginBottom: 20, textAlign: 'center' },
  goBackBtn: { backgroundColor: '#1a73e8', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  goBackBtnText: { color: '#fff', fontSize: 16, fontWeight: '500' },
  header: { alignItems: 'center', paddingTop: 20, paddingBottom: 16, backgroundColor: '#fff', borderBottomLeftRadius: 24, borderBottomRightRadius: 24, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  iconCircle: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#1a73e8', justifyContent: 'center', alignItems: 'center', marginBottom: 12, shadowColor: '#1a73e8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  headerIcon: { fontSize: 36 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#1a73e8' },
  headerSubtitle: { fontSize: 12, color: '#888', marginTop: 4 },
  savingsBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e6f4ea', marginHorizontal: 16, marginBottom: 16, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#34a853' },
  savingsIcon: { fontSize: 40, marginRight: 12 },
  savingsContent: { flex: 1 },
  savingsTitle: { fontSize: 14, color: '#2e7d32', fontWeight: '600' },
  savingsAmount: { fontSize: 24, fontWeight: 'bold', color: '#34a853' },
  savingsPercent: { fontSize: 12, color: '#2e7d32', marginTop: 2 },
  card: { backgroundColor: '#fff', borderRadius: 20, marginHorizontal: 16, marginBottom: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardHeaderIcon: { fontSize: 20 },
  cardHeaderText: { fontSize: 18, fontWeight: '600', color: '#333' },
  itemCountBadge: { backgroundColor: '#e8f0fe', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  itemCount: { fontSize: 12, color: '#1a73e8', fontWeight: '500' },
  billItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 12, paddingHorizontal: 8, borderRadius: 12, marginBottom: 4 },
  billItemAlt: { backgroundColor: '#f8f9fa' },
  itemLeft: { flexDirection: 'row', alignItems: 'flex-start', flex: 2 },
  itemNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#e8f0fe', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  itemNumberText: { fontSize: 12, fontWeight: 'bold', color: '#1a73e8' },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '500', color: '#333', marginBottom: 4 },
  itemMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  itemQty: { fontSize: 12, color: '#666' },
  discountPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  discountPillText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  discountReason: { fontSize: 10, color: '#666', marginTop: 2 },
  darazButton: { 
    backgroundColor: '#fff3e0', 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 20, 
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#f39c12',
    alignSelf: 'flex-start'
  },
  darazButtonText: { color: '#e67e22', fontSize: 11, fontWeight: '600' },
  itemDetails: { alignItems: 'flex-end', minWidth: 100 },
  itemOriginalPrice: { fontSize: 11, textDecorationLine: 'line-through', color: '#999' },
  itemPrice: { fontSize: 15, fontWeight: 'bold', color: '#e67e22', marginTop: 2 },
  itemPriceRegular: { fontSize: 15, fontWeight: 'bold', color: '#1a73e8' },
  savedBadge: { backgroundColor: '#e6f4ea', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, marginTop: 4 },
  savedBadgeText: { fontSize: 9, color: '#34a853', fontWeight: '500' },
  summaryCard: { backgroundColor: '#fff', borderRadius: 20, marginHorizontal: 16, marginBottom: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  summaryTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  summaryLabel: { fontSize: 14, color: '#666' },
  summaryValue: { fontSize: 14, color: '#333', fontWeight: '500' },
  strikethrough: { textDecorationLine: 'line-through', color: '#999' },
  discountText: { color: '#34a853', fontWeight: 'bold' },
  dividerLight: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 12 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  totalValue: { fontSize: 22, fontWeight: 'bold', color: '#1a73e8' },
  discountBreakdownCard: { backgroundColor: '#fff', borderRadius: 20, marginHorizontal: 16, marginBottom: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  breakdownTitle: { fontSize: 15, fontWeight: '600', color: '#e67e22', marginBottom: 12 },
  breakdownItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  breakdownLeft: { flex: 2 },
  breakdownProduct: { fontSize: 13, fontWeight: '500', color: '#333' },
  breakdownReason: { fontSize: 10, color: '#888', marginTop: 2 },
  breakdownRight: { alignItems: 'flex-end' },
  breakdownPercent: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginBottom: 4 },
  breakdownPercentText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  breakdownSaved: { fontSize: 10, color: '#34a853', fontWeight: '500' },
  aiNoteCard: { backgroundColor: '#e8f0fe', flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 16, padding: 16, borderRadius: 16 },
  aiNoteIcon: { fontSize: 32, marginRight: 12 },
  aiNoteContent: { flex: 1 },
  aiNoteTitle: { fontSize: 14, fontWeight: 'bold', color: '#1a73e8', marginBottom: 4 },
  aiNoteText: { fontSize: 11, color: '#555' },
  buttonContainer: { paddingHorizontal: 16, paddingBottom: 30, gap: 12 },
  generateBtn: { backgroundColor: '#34a853', paddingVertical: 16, borderRadius: 14, alignItems: 'center', shadowColor: '#34a853', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
  generateBtnText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  editCartBtn: { backgroundColor: '#f0f0f0', paddingVertical: 14, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: '#e0e0e0' },
  editCartBtnText: { color: '#666', fontSize: 15, fontWeight: '500' },
});