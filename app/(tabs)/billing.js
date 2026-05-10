// app/(tabs)/billing.js - WITH AI SUGGESTIONS

import { useFocusEffect } from 'expo-router';
import { useState, useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  Dimensions,
  ScrollView
} from 'react-native';
import {
  getProducts,
  formatPKR,
  getUserRole,
  saveBill,
  getBills,
  confirmBillAndUpdateStock,
  updateBillStatus,
  validateCartStock,
  recordPurchaseCombination,
  getLearnedSuggestions,
  loadPurchasePatterns
} from '../../config/firebase';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function Billing() {
  const [products, setProducts] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [cart, setCart] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userRole, setUserRole] = useState('customer');
  const [pendingOrders, setPendingOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [generatingBill, setGeneratingBill] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showCartModal, setShowCartModal] = useState(false);
  
  // AI Suggestions States
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionLoading, setSuggestionLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadInitialData();
      loadPurchasePatterns();
    }, [])
  );

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const roleResult = await getUserRole();
      const role = roleResult.success ? roleResult.role : 'customer';
      setUserRole(role);
      
      if (role === 'shopkeeper') {
        await loadPendingOrders();
      } else {
        await loadProducts();
      }
    } catch (error) {
      console.log('Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    const result = await getProducts();
    if (result.success) {
      const normalized = result.products.map(p => ({
        ...p,
        price: p.pricePKR || p.price || 0,
        discountedPrice: p.discountedPrice || p.pricePKR || p.price,
        discountPercent: p.discountPercent || 0
      }));
      setProducts(normalized);
    }
  };

  const loadPendingOrders = async () => {
    const result = await getBills();
    if (result.success) {
      const pending = result.bills.filter(bill => bill.status === 'pending');
      pending.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setPendingOrders(pending);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (userRole === 'shopkeeper') {
      await loadPendingOrders();
    } else {
      await loadProducts();
    }
    setRefreshing(false);
  };

  useEffect(() => {
    const newTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    setTotal(newTotal);
  }, [cart]);

  // ================= AI SUGGESTIONS FUNCTION =================
  const getAISuggestions = async (productId) => {
    if (!productId) return;
    
    setSuggestionLoading(true);
    try {
      const suggestions = await getLearnedSuggestions(productId, cart, products);
      console.log('🤖 AI Suggestions found:', suggestions.length);
      
      if (suggestions.length > 0) {
        setAiSuggestions(suggestions);
        setShowSuggestions(true);
      } else {
        // Fallback: suggest products from same category
        const currentProduct = products.find(p => p.id === productId);
        if (currentProduct && currentProduct.category) {
          const categoryProducts = products.filter(p => 
            p.category === currentProduct.category && 
            p.id !== productId && 
            !cart.some(c => c.id === p.id)
          );
          if (categoryProducts.length > 0) {
            const fallbackSuggestions = categoryProducts.slice(0, 3);
            setAiSuggestions(fallbackSuggestions.map(p => ({
              ...p, 
              reason: `📁 From ${currentProduct.category} category`,
              discountPercent: p.discountPercent || 0,
              discountedPrice: p.discountedPrice || p.price
            })));
            setShowSuggestions(true);
          }
        }
      }
    } catch (error) {
      console.log('Suggestion error:', error);
    } finally {
      setSuggestionLoading(false);
    }
  };

  const addSuggestionToCart = (product) => {
    const availableStock = product.stock || 0;
    const existingItem = cart.find(i => i.id === product.id);
    const currentQty = existingItem ? existingItem.quantity : 0;
    
    if (availableStock > 0 && currentQty + 1 > availableStock) {
      Alert.alert('Stock Limit', `Only ${availableStock} items available`);
      return;
    }
    
    const finalPrice = product.discountedPrice || product.price;
    const discountPercent = product.discountPercent || 0;
    
    if (existingItem) {
      setCart(cart.map(i => i.id === product.id ? {
        ...i,
        quantity: i.quantity + 1,
        total: finalPrice * (i.quantity + 1)
      } : i));
    } else {
      setCart([...cart, {
        id: product.id,
        name: product.name,
        price: finalPrice,
        originalPrice: product.price,
        discountPercent: discountPercent,
        quantity: 1,
        total: finalPrice,
        stock: product.stock || 0
      }]);
    }
    
    Alert.alert('✅ Added!', `${product.name} added to cart`);
    setShowSuggestions(false);
  };

  // Shopkeeper Functions
  const confirmOrder = async (order) => {
    Alert.alert(
      'Confirm Order',
      `Order #${order.billNumber}\nTotal: ${formatPKR(order.total)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setGeneratingBill(true);
            try {
              const result = await confirmBillAndUpdateStock(order.id, order.cart || []);
              if (result.success) {
                await recordPurchaseCombination(order.cart || []);
                Alert.alert('Success', 'Order confirmed!');
                await loadPendingOrders();
                setShowOrderModal(false);
              } else {
                Alert.alert('Error', result.error);
              }
            } catch (error) {
              Alert.alert('Error', 'Something went wrong');
            } finally {
              setGeneratingBill(false);
            }
          }
        }
      ]
    );
  };

  const rejectOrder = async (order) => {
    Alert.alert(
      'Reject Order',
      `Reject Order #${order.billNumber}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setGeneratingBill(true);
            try {
              const result = await updateBillStatus(order.id, 'rejected');
              if (result.success) {
                Alert.alert('Order Rejected');
                await loadPendingOrders();
                setShowOrderModal(false);
              }
            } finally {
              setGeneratingBill(false);
            }
          }
        }
      ]
    );
  };

  // Customer Functions
  const addToCart = () => {
    if (!selectedProduct) {
      Alert.alert('Error', 'Please select a product first');
      return;
    }

    const availableStock = selectedProduct.stock || 0;
    const existingItem = cart.find(i => i.id === selectedProduct.id);
    const currentQty = existingItem ? existingItem.quantity : 0;
    
    if (availableStock > 0 && currentQty + 1 > availableStock) {
      Alert.alert('Stock Limit', `Only ${availableStock} items available`);
      return;
    }
    
    const finalPrice = selectedProduct.discountedPrice || selectedProduct.price;
    const discountPercent = selectedProduct.discountPercent || 0;
    
    if (existingItem) {
      setCart(cart.map(i => i.id === selectedProduct.id ? {
        ...i,
        quantity: i.quantity + 1,
        total: finalPrice * (i.quantity + 1)
      } : i));
    } else {
      setCart([...cart, {
        id: selectedProduct.id,
        name: selectedProduct.name,
        price: finalPrice,
        originalPrice: selectedProduct.price,
        discountPercent: discountPercent,
        quantity: 1,
        total: finalPrice,
        stock: selectedProduct.stock || 0
      }]);
    }
    
    Alert.alert('✅ Added!', `${selectedProduct.name} added to cart`);
    
    // Show AI suggestions after adding to cart
    getAISuggestions(selectedProduct.id);
    
    setSelectedProduct(null);
    setSearchText('');
  };

  const selectProduct = (product) => {
    setSelectedProduct(product);
    setSearchText(product.name);
  };

  const removeFromCart = (itemId) => {
    setCart(cart.filter(i => i.id !== itemId));
  };

  const updateCartQuantity = (itemId, newQuantity) => {
    if (newQuantity < 1) {
      removeFromCart(itemId);
      return;
    }
    const item = cart.find(i => i.id === itemId);
    if (item && (newQuantity <= item.stock || item.stock === 0)) {
      setCart(cart.map(i => i.id === itemId ? { ...i, quantity: newQuantity, total: newQuantity * i.price } : i));
    }
  };

  const placeOrder = async () => {
    if (cart.length === 0) {
      Alert.alert('Error', 'Cart is empty');
      return;
    }
    
    const stockValidation = await validateCartStock(cart);
    if (!stockValidation.valid) {
      Alert.alert('Stock Error', `${stockValidation.product}: Only ${stockValidation.available} available`);
      return;
    }
    
    const subtotal = total;
    const tax = subtotal * 0.05;
    const totalWithTax = subtotal + tax;
    
    Alert.alert(
      'Confirm Order',
      `Items: ${cart.length}\nTotal: ${formatPKR(totalWithTax)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Place Order',
          onPress: async () => {
            const billData = {
              cart: cart.map(item => ({
                id: item.id,
                name: item.name,
                quantity: item.quantity,
                price: item.price,
                total: item.total,
                discount: item.discountPercent
              })),
              subtotal: subtotal,
              tax: tax,
              total: totalWithTax,
              status: 'pending'
            };
            
            const result = await saveBill(billData);
            if (result.success) {
              Alert.alert('✅ Order Placed!', `Order #${result.billNumber}\nTotal: ${formatPKR(totalWithTax)}`);
              setCart([]);
              setShowCartModal(false);
            } else {
              Alert.alert('Error', 'Failed to place order');
            }
          }
        }
      ]
    );
  };

  // ================= RENDER AI SUGGESTIONS MODAL =================
  const renderAISuggestionsModal = () => (
    <Modal visible={showSuggestions} transparent={true} animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.aiSuggestionModal}>
          <View style={styles.aiModalHeader}>
            <View style={styles.aiHeaderLeft}>
              <Ionicons name="bulb-outline" size={24} color="#e67e22" />
              <Text style={styles.aiModalTitle}>🤖 AI Recommendations</Text>
            </View>
            <TouchableOpacity onPress={() => setShowSuggestions(false)}>
              <Ionicons name="close" size={24} color="#999" />
            </TouchableOpacity>
          </View>

          {suggestionLoading ? (
            <View style={styles.aiLoadingContainer}>
              <ActivityIndicator size="large" color="#1a73e8" />
              <Text style={styles.aiLoadingText}>Finding recommendations...</Text>
              <Text style={styles.aiLoadingSub}>AI analyzing purchase patterns...</Text>
            </View>
          ) : aiSuggestions.length === 0 ? (
            <View style={styles.noSuggestionsContainer}>
              <Ionicons name="bulb-outline" size={50} color="#ccc" />
              <Text style={styles.noSuggestionsText}>No suggestions available</Text>
              <Text style={styles.noSuggestionsSub}>Add more items to get AI recommendations</Text>
            </View>
          ) : (
            <>
              <Text style={styles.suggestionDesc}>
                🎯 Customers who bought this also bought:
              </Text>
              <FlatList
                data={aiSuggestions}
                keyExtractor={(item, idx) => idx.toString()}
                renderItem={({ item }) => {
                  const hasDiscount = (item.discountPercent || 0) > 0;
                  const finalPrice = hasDiscount ? item.discountedPrice : item.price;
                  return (
                    <View style={styles.suggestionItem}>
                      <View style={styles.suggestionItemInfo}>
                        <Text style={styles.suggestionItemName}>{item.name}</Text>
                        <View style={styles.suggestionPriceRow}>
                          {hasDiscount ? (
                            <>
                              <Text style={styles.suggestionOldPrice}>{formatPKR(item.price)}</Text>
                              <Text style={styles.suggestionPrice}>{formatPKR(finalPrice)}</Text>
                              <View style={styles.suggestionDiscountBadge}>
                                <Text style={styles.suggestionDiscountText}>-{item.discountPercent}%</Text>
                              </View>
                            </>
                          ) : (
                            <Text style={styles.suggestionPrice}>{formatPKR(finalPrice)}</Text>
                          )}
                        </View>
                        <Text style={styles.suggestionReason}>
                          <Ionicons name="flash" size={10} color="#e67e22" /> {item.reason || 'Popular combination'}
                        </Text>
                      </View>
                      <TouchableOpacity 
                        style={styles.addSuggestionBtn} 
                        onPress={() => addSuggestionToCart(item)}
                      >
                        <Text style={styles.addSuggestionBtnText}>Add</Text>
                      </TouchableOpacity>
                    </View>
                  );
                }}
              />
              <TouchableOpacity 
                style={styles.closeSuggestionsBtn}
                onPress={() => setShowSuggestions(false)}
              >
                <Text style={styles.closeSuggestionsBtnText}>Continue Shopping</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );

  const renderPendingOrder = ({ item }) => (
    <TouchableOpacity style={styles.orderCard} onPress={() => { setSelectedOrder(item); setShowOrderModal(true); }}>
      <View style={styles.orderHeader}>
        <Text style={styles.orderNumber}>{item.billNumber}</Text>
        <View style={styles.pendingBadge}><Text style={styles.pendingText}>Pending</Text></View>
      </View>
      <Text>👤 {item.createdByEmail?.split('@')[0]}</Text>
      <Text style={styles.orderTotal}>{formatPKR(item.total)}</Text>
      <View style={styles.orderActions}>
        <TouchableOpacity style={styles.confirmBtn} onPress={() => confirmOrder(item)}><Text style={styles.confirmBtnText}>✓ Confirm</Text></TouchableOpacity>
        <TouchableOpacity style={styles.rejectBtn} onPress={() => rejectOrder(item)}><Text style={styles.rejectBtnText}>✗ Reject</Text></TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderProductItem = ({ item }) => {
    const hasDiscount = item.discountPercent > 0;
    const finalPrice = hasDiscount ? item.discountedPrice : item.price;
    
    return (
      <TouchableOpacity style={styles.productCard} onPress={() => selectProduct(item)}>
        <View style={styles.productInfo}>
          <Text style={styles.productName}>{item.name}</Text>
          <Text style={styles.productCategory}>{item.category}</Text>
          {hasDiscount ? (
            <View style={styles.productPriceRow}>
              <Text style={styles.oldProductPrice}>{formatPKR(item.price)}</Text>
              <Text style={styles.productPrice}>{formatPKR(finalPrice)}</Text>
              <View style={styles.productDiscountBadge}>
                <Text style={styles.productDiscountText}>-{item.discountPercent}%</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.productPrice}>{formatPKR(finalPrice)}</Text>
          )}
          <Text style={styles.productStock}>📦 Stock: {item.stock || 0}</Text>
        </View>
        <View style={styles.selectIcon}>
          <Ionicons name="chevron-forward" size={20} color="#1a73e8" />
        </View>
      </TouchableOpacity>
    );
  };

  const renderCartItem = ({ item }) => (
    <View style={styles.cartItemRow}>
      <View style={styles.cartItemDetails}>
        <Text style={styles.cartItemName}>{item.name}</Text>
        {item.discountPercent > 0 && <Text style={styles.cartItemDiscount}>-{item.discountPercent}% OFF</Text>}
        <Text style={styles.cartItemPriceText}>{formatPKR(item.price)} each</Text>
      </View>
      <View style={styles.cartItemControls}>
        <TouchableOpacity onPress={() => updateCartQuantity(item.id, item.quantity - 1)} style={styles.qtyButton}>
          <Text style={styles.qtyButtonText}>-</Text>
        </TouchableOpacity>
        <Text style={styles.qtyValue}>{item.quantity}</Text>
        <TouchableOpacity onPress={() => updateCartQuantity(item.id, item.quantity + 1)} style={styles.qtyButton}>
          <Text style={styles.qtyButtonText}>+</Text>
        </TouchableOpacity>
        <Text style={styles.cartItemAmount}>{formatPKR(item.total)}</Text>
        <TouchableOpacity onPress={() => removeFromCart(item.id)}>
          <Ionicons name="trash-outline" size={18} color="#dc3545" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderCartModal = () => (
    <Modal visible={showCartModal} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.cartModalContainer}>
          <View style={styles.cartModalHeader}>
            <Text style={styles.cartModalTitle}>🛒 Cart ({cart.length})</Text>
            <TouchableOpacity onPress={() => setShowCartModal(false)}>
              <Ionicons name="close" size={24} color="#999" />
            </TouchableOpacity>
          </View>
          {cart.length === 0 ? (
            <View style={styles.emptyCartView}>
              <Ionicons name="cart-outline" size={60} color="#ccc" />
              <Text style={styles.emptyCartText}>Cart is empty</Text>
            </View>
          ) : (
            <>
              <FlatList data={cart} keyExtractor={item => item.id} renderItem={renderCartItem} />
              <View style={styles.cartSummary}>
                <Text style={styles.cartSubtotal}>Subtotal: {formatPKR(total)}</Text>
                <Text style={styles.cartTax}>Tax (5%): {formatPKR(total * 0.05)}</Text>
                <Text style={styles.cartGrandTotal}>Total: {formatPKR(total * 1.05)}</Text>
                <TouchableOpacity style={styles.placeOrderButton} onPress={placeOrder}>
                  <Text style={styles.placeOrderButtonText}>📦 Place Order</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#1a73e8" /></View>;
  }

  // SHOPKEEPER VIEW
  if (userRole === 'shopkeeper') {
    return (
      <View style={styles.container}>
        <View style={styles.shopHeader}>
          <Text style={styles.headerTitle}>📋 Orders</Text>
          <View style={styles.pendingCount}>
            <Text style={styles.pendingCountText}>{pendingOrders.length} Pending</Text>
          </View>
        </View>
        {pendingOrders.length === 0 ? (
          <View style={styles.emptyOrders}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>No pending orders</Text>
          </View>
        ) : (
          <FlatList 
            data={pendingOrders} 
            keyExtractor={item => item.id} 
            renderItem={renderPendingOrder} 
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} 
          />
        )}
        <Modal visible={showOrderModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.orderDetailModal}>
              <Text style={styles.modalTitle}>Order Details</Text>
              {selectedOrder && (
                <ScrollView>
                  <Text style={styles.detailText}>Order: {selectedOrder.billNumber}</Text>
                  <Text style={styles.detailText}>Customer: {selectedOrder.createdByEmail}</Text>
                  {(selectedOrder.cart || []).map((item, idx) => (
                    <View key={idx} style={styles.orderItemRow}>
                      <Text>{item.name} x{item.quantity}</Text>
                      <Text>{formatPKR(item.price * item.quantity)}</Text>
                    </View>
                  ))}
                  <Text style={styles.orderTotalText}>Total: {formatPKR(selectedOrder.total)}</Text>
                  <TouchableOpacity style={styles.confirmOrderBtn} onPress={() => confirmOrder(selectedOrder)}>
                    <Text style={styles.confirmOrderBtnText}>Confirm Order</Text>
                  </TouchableOpacity>
                </ScrollView>
              )}
              <TouchableOpacity onPress={() => setShowOrderModal(false)} style={styles.closeModalBtn}>
                <Text style={styles.closeModalBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // CUSTOMER VIEW - WITH AI SUGGESTIONS
  return (
    <View style={styles.container}>
      <View style={styles.customerHeader}>
        <Text style={styles.headerTitle}>🛒 Shop</Text>
        <TouchableOpacity style={styles.headerCartBtn} onPress={() => setShowCartModal(true)}>
          <Ionicons name="cart" size={24} color="#fff" />
          {cart.length > 0 && (
            <View style={styles.headerCartBadge}>
              <Text style={styles.headerCartBadgeText}>{cart.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.searchArea}>
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#999" />
          <TextInput 
            style={styles.searchField} 
            placeholder="🔍 Search product..." 
            placeholderTextColor="#aaa"
            value={searchText} 
            onChangeText={setSearchText} 
          />
        </View>
        {selectedProduct && (
          <View style={styles.selectedProductBox}>
            <Text style={styles.selectedProductText}>✓ Selected: {selectedProduct.name}</Text>
            <TouchableOpacity onPress={() => { setSelectedProduct(null); setSearchText(''); }}>
              <Text style={styles.clearText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
        <TouchableOpacity style={styles.addToCartButton} onPress={addToCart}>
          <Text style={styles.addToCartButtonText}>+ Add to Cart</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={products}
        keyExtractor={item => item.id}
        renderItem={renderProductItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.productsList}
        showsVerticalScrollIndicator={false}
      />

      {renderCartModal()}
      {renderAISuggestionsModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Headers
  shopHeader: { 
    backgroundColor: '#1a73e8', 
    paddingTop: 55, 
    paddingBottom: 20, 
    paddingHorizontal: 20, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  customerHeader: { 
    backgroundColor: '#1a73e8', 
    paddingTop: 55, 
    paddingBottom: 20, 
    paddingHorizontal: 20, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },

  pendingCount: { backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  pendingCountText: { color: '#1a73e8', fontWeight: 'bold' },

  headerCartBtn: { position: 'relative' },
  headerCartBadge: { position: 'absolute', top: -8, right: -8, backgroundColor: '#dc3545', borderRadius: 12, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  headerCartBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

  // Search Area
  searchArea: { backgroundColor: '#fff', padding: 15, margin: 12, borderRadius: 16, elevation: 2 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 12, padding: 12 },
  searchField: { flex: 1, fontSize: 15 },

  selectedProductBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#e8f0fe', padding: 12, borderRadius: 10, marginTop: 10 },
  selectedProductText: { color: '#1a73e8', fontWeight: '500' },
  clearText: { fontSize: 16, color: '#dc3545', padding: 5 },

  addToCartButton: { backgroundColor: '#1a73e8', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  addToCartButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  // Product Card
  productCard: { backgroundColor: '#fff', borderRadius: 12, marginHorizontal: 15, marginBottom: 10, padding: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 2 },
  productInfo: { flex: 1 },
  productName: { fontSize: 16, fontWeight: '600', color: '#333' },
  productCategory: { fontSize: 12, color: '#666', marginTop: 2 },
  productPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  oldProductPrice: { fontSize: 12, textDecorationLine: 'line-through', color: '#999' },
  productPrice: { fontSize: 18, fontWeight: 'bold', color: '#1a73e8', marginTop: 4 },
  productDiscountBadge: { backgroundColor: '#e67e22', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, marginLeft: 8 },
  productDiscountText: { fontSize: 9, color: '#fff', fontWeight: 'bold' },
  productStock: { fontSize: 11, color: '#888', marginTop: 4 },
  selectIcon: { width: 32, height: 32, backgroundColor: '#e8f0fe', borderRadius: 16, alignItems: 'center', justifyContent: 'center' },

  productsList: { paddingVertical: 12, paddingBottom: 30 },

  // Order Card (Shopkeeper)
  orderCard: { backgroundColor: '#fff', borderRadius: 12, margin: 12, padding: 15, elevation: 2 },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  orderNumber: { fontWeight: 'bold', color: '#1a73e8' },
  pendingBadge: { backgroundColor: '#f39c12', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  pendingText: { color: '#fff', fontSize: 10 },
  orderTotal: { fontSize: 18, fontWeight: 'bold', color: '#1a73e8', marginTop: 8 },
  orderActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  confirmBtn: { flex: 1, backgroundColor: '#34a853', padding: 10, borderRadius: 8, alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontWeight: '600' },
  rejectBtn: { flex: 1, backgroundColor: '#dc3545', padding: 10, borderRadius: 8, alignItems: 'center' },
  rejectBtnText: { color: '#fff', fontWeight: '600' },

  // Cart Modal
  cartModalContainer: { backgroundColor: '#fff', borderRadius: 24, padding: 20, width: '90%', maxHeight: '80%' },
  cartModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  cartModalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1a73e8' },
  emptyCartView: { alignItems: 'center', paddingVertical: 50 },
  emptyCartText: { color: '#999', marginTop: 10 },

  cartItemRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  cartItemDetails: { marginBottom: 8 },
  cartItemName: { fontSize: 14, fontWeight: '500', color: '#333' },
  cartItemDiscount: { fontSize: 11, color: '#e67e22', marginTop: 2 },
  cartItemPriceText: { fontSize: 11, color: '#666', marginTop: 2 },
  cartItemControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qtyButton: { width: 28, height: 28, backgroundColor: '#f0f0f0', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  qtyButtonText: { fontSize: 16, fontWeight: 'bold', color: '#666' },
  qtyValue: { minWidth: 30, textAlign: 'center', fontSize: 14 },
  cartItemAmount: { fontWeight: 'bold', color: '#1a73e8', minWidth: 80, textAlign: 'right' },

  cartSummary: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e0e0e0' },
  cartSubtotal: { fontSize: 13, color: '#666', textAlign: 'right' },
  cartTax: { fontSize: 12, color: '#888', textAlign: 'right', marginTop: 4 },
  cartGrandTotal: { fontSize: 18, fontWeight: 'bold', color: '#1a73e8', textAlign: 'right', marginTop: 4 },
  placeOrderButton: { backgroundColor: '#34a853', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  placeOrderButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  // AI Suggestions Modal
  aiSuggestionModal: { backgroundColor: '#fff', borderRadius: 24, padding: 20, width: '90%', maxHeight: '80%' },
  aiModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  aiHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiModalTitle: { fontSize: 18, fontWeight: 'bold', color: '#e67e22' },
  aiLoadingContainer: { alignItems: 'center', paddingVertical: 50 },
  aiLoadingText: { marginTop: 12, color: '#666', fontSize: 16, fontWeight: '500' },
  aiLoadingSub: { marginTop: 4, color: '#999', fontSize: 12 },
  noSuggestionsContainer: { alignItems: 'center', paddingVertical: 50 },
  noSuggestionsText: { fontSize: 16, fontWeight: '500', color: '#999', marginTop: 12 },
  noSuggestionsSub: { fontSize: 12, color: '#bbb', marginTop: 4, textAlign: 'center' },
  suggestionDesc: { fontSize: 13, color: '#666', marginBottom: 16 },
  
  suggestionItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  suggestionItemInfo: { flex: 2 },
  suggestionItemName: { fontSize: 14, fontWeight: '500', color: '#333' },
  suggestionPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  suggestionOldPrice: { fontSize: 11, textDecorationLine: 'line-through', color: '#999' },
  suggestionPrice: { fontSize: 14, fontWeight: 'bold', color: '#1a73e8' },
  suggestionDiscountBadge: { backgroundColor: '#e67e22', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  suggestionDiscountText: { fontSize: 9, color: '#fff', fontWeight: 'bold' },
  suggestionReason: { fontSize: 10, color: '#888', marginTop: 4 },
  addSuggestionBtn: { backgroundColor: '#34a853', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  addSuggestionBtnText: { color: '#fff', fontWeight: '500', fontSize: 12 },
  closeSuggestionsBtn: { backgroundColor: '#1a73e8', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  closeSuggestionsBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  // Order Detail Modal
  orderDetailModal: { backgroundColor: '#fff', borderRadius: 24, padding: 20, width: '90%', maxHeight: '85%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 16, color: '#1a73e8' },
  detailText: { fontSize: 14, marginBottom: 8 },
  orderItemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  orderTotalText: { fontSize: 18, fontWeight: 'bold', color: '#1a73e8', marginTop: 12 },
  confirmOrderBtn: { backgroundColor: '#34a853', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  confirmOrderBtnText: { color: '#fff', fontWeight: 'bold' },
  closeModalBtn: { backgroundColor: '#1a73e8', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  closeModalBtnText: { color: '#fff', fontWeight: 'bold' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },

  emptyOrders: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
  emptyIcon: { fontSize: 64, opacity: 0.5, marginBottom: 16 },
  emptyText: { color: '#999', fontSize: 16 },
});