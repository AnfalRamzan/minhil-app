import React, { useState, useEffect } from 'react';
import { 
  View, Text, FlatList, TouchableOpacity, StyleSheet, 
  Alert, ScrollView, ActivityIndicator 
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

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
        setCart(parsedCart);
        setTotal(parseFloat(params.total));
        
        // Get original total and discount from params if available
        if (params.originalTotal) {
          const original = parseFloat(params.originalTotal);
          setOriginalTotal(original);
          const discountAmt = original - parseFloat(params.total);
          setTotalDiscount(discountAmt);
          const savings = (discountAmt / original) * 100;
          setSavingsPercentage(savings);
        } else {
          // Calculate original total from cart items
          const original = parsedCart.reduce((sum, item) => sum + ((item.originalPrice || item.price) * item.quantity), 0);
          setOriginalTotal(original);
          const discountAmt = original - parseFloat(params.total);
          setTotalDiscount(discountAmt);
          const savings = (discountAmt / original) * 100;
          setSavingsPercentage(savings);
        }
      } catch (error) {
        console.log('Parse error:', error);
        Alert.alert('Error', 'Invalid cart data');
      }
    }
  }, [params.cart, params.total, params.originalTotal]);

  useEffect(() => {
    const taxAmount = total * 0.05;
    setTax(taxAmount);
    setFinalTotal(total + taxAmount);
  }, [total]);

  const formatPrice = (amount) => {
    return `₨ ${amount?.toLocaleString('en-PK') || 0}`;
  };

  const generateBill = async () => {
    if (cart.length === 0) {
      Alert.alert('Error', 'Cart is empty');
      return;
    }

    setLoading(true);

    try {
      const { saveBill } = await import('../config/firebase');
      
      const billData = {
        cart,
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
        // Navigate to invoice with full data including discount info
        router.push({
          pathname: '/invoice',
          params: { 
            billData: JSON.stringify({
              ...billData,
              billNumber: result.billNumber,
              billId: result.billId,
              originalTotal: originalTotal,
              discountAmount: totalDiscount,
              discountPercentage: savingsPercentage
            }),
            cart: JSON.stringify(cart)
          }
        });
      } else {
        Alert.alert('Error', result.error);
      }
    } catch (error) {
      console.log('Save bill error:', error);
      Alert.alert('Error', 'Could not save bill. Please try again.');
    }
    
    setLoading(false);
  };

  const renderBillItem = ({ item, index }) => (
    <View style={[styles.billItem, index % 2 === 0 && styles.billItemAlt]}>
      <View style={styles.itemLeft}>
        <View style={styles.itemNumber}>
          <Text style={styles.itemNumberText}>{index + 1}</Text>
        </View>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{item.name}</Text>
          {item.discount > 0 && (
            <View style={styles.itemDiscountContainer}>
              <Text style={styles.itemDiscount}>-{item.discount}% OFF</Text>
              {item.discountReason && (
                <Text style={styles.itemDiscountReason} numberOfLines={1}>
                  {item.discountReason}
                </Text>
              )}
            </View>
          )}
        </View>
      </View>
      <View style={styles.itemDetails}>
        {item.discount > 0 ? (
          <>
            <Text style={styles.itemOriginalPrice}>{formatPrice(item.originalPrice)}</Text>
            <Text style={styles.itemPrice}>{formatPrice(item.price)}</Text>
          </>
        ) : (
          <Text style={styles.itemPrice}>{formatPrice(item.price)}</Text>
        )}
        <Text style={styles.itemQty}>x{item.quantity}</Text>
        <Text style={styles.itemTotal}>{formatPrice(item.total)}</Text>
      </View>
    </View>
  );

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
        <TouchableOpacity 
          style={styles.goBackBtn}
          onPress={() => router.replace('/(tabs)/billing')}
        >
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

      {/* Savings Banner - Show if discounts applied */}
      {totalDiscount > 0 && (
        <View style={styles.savingsBanner}>
          <Text style={styles.savingsIcon}>🎉</Text>
          <View style={styles.savingsContent}>
            <Text style={styles.savingsTitle}>You Saved!</Text>
            <Text style={styles.savingsAmount}>{formatPrice(totalDiscount)}</Text>
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
        
        {/* Show original price if discount applied */}
        {originalTotal > total && (
          <>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Original Total:</Text>
              <Text style={[styles.summaryValue, styles.strikethrough]}>
                {formatPrice(originalTotal)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Discount:</Text>
              <Text style={[styles.summaryValue, styles.discountText]}>
                -{formatPrice(totalDiscount)}
              </Text>
            </View>
            <View style={styles.dividerLight} />
          </>
        )}
        
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal:</Text>
          <Text style={styles.summaryValue}>{formatPrice(total)}</Text>
        </View>
        
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Tax (5% GST):</Text>
          <Text style={styles.summaryValue}>{formatPrice(tax)}</Text>
        </View>
        
        <View style={styles.dividerLight} />
        
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Grand Total:</Text>
          <Text style={styles.totalValue}>{formatPrice(finalTotal)}</Text>
        </View>
      </View>

      {/* Discount Breakdown Section - Show per item savings */}
      {cart.some(item => item.discount > 0) && (
        <View style={styles.discountBreakdownCard}>
          <Text style={styles.breakdownTitle}>✨ Discount Breakdown</Text>
          {cart.filter(item => item.discount > 0).map((item, idx) => (
            <View key={idx} style={styles.breakdownItem}>
              <View style={styles.breakdownLeft}>
                <Text style={styles.breakdownProduct}>{item.name}</Text>
                <Text style={styles.breakdownReason}>{item.discountReason || 'Special discount applied'}</Text>
              </View>
              <View style={styles.breakdownRight}>
                <Text style={styles.breakdownPercent}>-{item.discount}%</Text>
                <Text style={styles.breakdownSaved}>
                  Saved: {formatPrice((item.originalPrice - item.price) * item.quantity)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={styles.generateBtn} 
          onPress={generateBill}
          activeOpacity={0.8}
        >
          <Text style={styles.generateBtnText}>✅ Generate Bill</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.editCartBtn}
          onPress={() => router.back()}
        >
          <Text style={styles.editCartBtnText}>✏️ Edit Cart</Text>
        </TouchableOpacity>
      </View>
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
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 14,
  },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#e8f0fe',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyIcon: {
    fontSize: 50,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  goBackBtn: {
    backgroundColor: '#1a73e8',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  goBackBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  header: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  iconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#1a73e8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#1a73e8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  headerIcon: {
    fontSize: 36,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a73e8',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  savingsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e6f4ea',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#34a853',
  },
  savingsIcon: {
    fontSize: 40,
    marginRight: 12,
  },
  savingsContent: {
    flex: 1,
  },
  savingsTitle: {
    fontSize: 14,
    color: '#2e7d32',
    fontWeight: '600',
  },
  savingsAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#34a853',
  },
  savingsPercent: {
    fontSize: 12,
    color: '#2e7d32',
    marginTop: 2,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardHeaderIcon: {
    fontSize: 20,
  },
  cardHeaderText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  itemCountBadge: {
    backgroundColor: '#e8f0fe',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  itemCount: {
    fontSize: 12,
    color: '#1a73e8',
    fontWeight: '500',
  },
  billItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginBottom: 4,
  },
  billItemAlt: {
    backgroundColor: '#f8f9fa',
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 2,
  },
  itemNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e8f0fe',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemNumberText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1a73e8',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  itemDiscountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 2,
  },
  itemDiscount: {
    fontSize: 10,
    color: '#e67e22',
    fontWeight: 'bold',
    backgroundColor: '#fff3e0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 6,
  },
  itemDiscountReason: {
    fontSize: 9,
    color: '#34a853',
    flex: 1,
  },
  itemDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemOriginalPrice: {
    fontSize: 11,
    textDecorationLine: 'line-through',
    color: '#999',
    minWidth: 50,
    textAlign: 'right',
  },
  itemPrice: {
    color: '#1a73e8',
    fontSize: 13,
    fontWeight: '500',
    minWidth: 55,
    textAlign: 'right',
  },
  itemQty: {
    color: '#666',
    fontSize: 13,
    minWidth: 35,
    textAlign: 'center',
  },
  itemTotal: {
    fontWeight: 'bold',
    color: '#1a73e8',
    fontSize: 14,
    minWidth: 70,
    textAlign: 'right',
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  strikethrough: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  discountText: {
    color: '#34a853',
    fontWeight: 'bold',
  },
  dividerLight: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a73e8',
  },
  discountBreakdownCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  breakdownTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#e67e22',
    marginBottom: 12,
  },
  breakdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  breakdownLeft: {
    flex: 2,
  },
  breakdownProduct: {
    fontSize: 13,
    fontWeight: '500',
    color: '#333',
  },
  breakdownReason: {
    fontSize: 10,
    color: '#888',
    marginTop: 2,
  },
  breakdownRight: {
    alignItems: 'flex-end',
  },
  breakdownPercent: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#e67e22',
  },
  breakdownSaved: {
    fontSize: 10,
    color: '#34a853',
    marginTop: 2,
  },
  buttonContainer: {
    paddingHorizontal: 16,
    paddingBottom: 30,
    gap: 12,
  },
  generateBtn: {
    backgroundColor: '#34a853',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#34a853',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  generateBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  editCartBtn: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  editCartBtnText: {
    color: '#666',
    fontSize: 15,
    fontWeight: '500',
  },
});