// app/(tabs)/billing.js - COMPLETE WITH "CONFIRMED" STATUS

import { useRouter, useFocusEffect } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
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
  ScrollView,
  TextInput,
  Dimensions
} from 'react-native';
import {
  getProducts,
  recordPurchaseCombination,
  formatPKR,
  getCurrentUser,
  getUserRole,
  saveBill,
  getBills,
  confirmBillAndUpdateStock,
  updateBillStatus,
  getLearnedSuggestions,
  loadPurchasePatterns,
  validateCartStock
} from '../../config/firebase';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function Billing() {
  const router = useRouter();
  const [products, setProducts] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [cart, setCart] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userRole, setUserRole] = useState('customer');
  const [pendingOrders, setPendingOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [generatingBill, setGeneratingBill] = useState(false);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  
  // AI Suggestions
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionLoading, setSuggestionLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadInitialData();
    }, [])
  );

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const roleResult = await getUserRole();
      const role = roleResult.success ? roleResult.role : 'customer';
      setUserRole(role);
      
      await loadPurchasePatterns();
      
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
      setFilteredProducts(normalized);
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

  const getSuggestions = async (productId) => {
    if (!productId) return;
    
    setSuggestionLoading(true);
    try {
      const suggestions = await getLearnedSuggestions(productId, cart, products);
      setAiSuggestions(suggestions);
      setShowSuggestions(true);
    } catch (error) {
      console.log('Suggestion error:', error);
    } finally {
      setSuggestionLoading(false);
    }
  };

  const addSuggestionToCart = (product) => {
    const qty = 1;
    const finalPrice = product.discountedPrice || product.price;
    const discountPercent = product.discountPercent || 0;
    
    setCart(prevCart => {
      const existingItem = prevCart.find(i => i.id === product.id);
      if (existingItem) {
        return prevCart.map(i => i.id === product.id ? {
          ...i,
          quantity: i.quantity + qty,
          total: finalPrice * (i.quantity + qty)
        } : i);
      } else {
        return [...prevCart, {
          id: product.id,
          name: product.name,
          price: finalPrice,
          originalPrice: product.price,
          discountPercent: discountPercent,
          quantity: qty,
          total: finalPrice * qty,
          stock: product.stock || 0
        }];
      }
    });
    
    Alert.alert('✅ Added!', `${product.name} added to cart`);
    setShowSuggestions(false);
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

  const calculateTotal = () => {
    const newTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    setTotal(newTotal);
  };

  useEffect(() => {
    calculateTotal();
  }, [cart]);

  // ================= SHOPKEEPER FUNCTIONS =================
  const confirmOrder = async (order) => {
    Alert.alert(
      '✅ Confirm Order',
      `Order #${order.billNumber}\nCustomer: ${order.createdByEmail}\nTotal: ${formatPKR(order.total)}\n\nGenerate invoice and update stock?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Order',
          onPress: async () => {
            setGeneratingBill(true);
            try {
              const result = await confirmBillAndUpdateStock(order.id, order.cart || []);
              if (result.success) {
                await recordPurchaseCombination(order.cart || []);
                Alert.alert('✅ Order Confirmed!', `Order #${order.billNumber} confirmed.\nStock updated.`);
                await loadPendingOrders();
                setShowOrderModal(false);
              } else {
                Alert.alert('Error', result.error || 'Failed to confirm order');
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
      '❌ Reject Order',
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
                Alert.alert('❌ Order Rejected', `Order #${order.billNumber} has been rejected.`);
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

  const viewOrderDetails = (order) => {
    setSelectedOrder(order);
    setShowOrderModal(true);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // ================= CUSTOMER FUNCTIONS =================
  const searchProduct = (text) => {
    setSearchText(text);
    if (!text.trim()) {
      setFilteredProducts(products);
    } else {
      const searchLower = text.toLowerCase().trim();
      const filtered = products.filter(p => 
        p.name && p.name.toLowerCase().includes(searchLower)
      );
      setFilteredProducts(filtered);
    }
  };

  const selectProduct = (product) => {
    setSelectedProduct(product);
    setSearchText(product.name);
    setFilteredProducts([]);
  };

  const addToCart = (product) => {
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 1) {
      Alert.alert('Error', 'Please enter valid quantity');
      return;
    }
    
    const availableStock = product.stock || 0;
    const existingItem = cart.find(i => i.id === product.id);
    const currentQty = existingItem ? existingItem.quantity : 0;
    
    if (availableStock > 0 && currentQty + qty > availableStock) {
      Alert.alert('Stock Limit', `Only ${availableStock} items available`);
      return;
    }
    
    const finalPrice = product.discountedPrice || product.price;
    const discountPercent = product.discountPercent || 0;
    
    if (existingItem) {
      setCart(cart.map(i => i.id === product.id ? {
        ...i,
        quantity: i.quantity + qty,
        total: finalPrice * (i.quantity + qty)
      } : i));
    } else {
      setCart([...cart, {
        id: product.id,
        name: product.name,
        price: finalPrice,
        originalPrice: product.price,
        discountPercent: discountPercent,
        quantity: qty,
        total: finalPrice * qty,
        stock: product.stock || 0
      }]);
    }
    
    Alert.alert('✅ Added!', `${product.name} added to cart`);
    setSearchText('');
    setQuantity('1');
    setSelectedProduct(null);
    getSuggestions(product.id);
  };

  const placeOrder = async () => {
    if (cart.length === 0) {
      Alert.alert('Error', 'Cart is empty');
      return;
    }
    
    const stockValidation = await validateCartStock(cart);
    if (!stockValidation.valid) {
      Alert.alert('Stock Error', 
        `${stockValidation.product}: Only ${stockValidation.available} available, you requested ${stockValidation.requested}`);
      return;
    }
    
    const subtotal = total;
    const tax = subtotal * 0.05;
    const totalWithTax = subtotal + tax;
    
    Alert.alert(
      'Confirm Order',
      `Items: ${cart.length}\nSubtotal: ${formatPKR(subtotal)}\nTax (5%): ${formatPKR(tax)}\nTotal: ${formatPKR(totalWithTax)}`,
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
              Alert.alert('✅ Order Placed!', `Order #${result.billNumber}\nTotal: ${formatPKR(totalWithTax)}\n\nWaiting for shopkeeper confirmation.`);
              setCart([]);
            } else {
              Alert.alert('Error', 'Failed to place order');
            }
          }
        }
      ]
    );
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

  const renderPendingOrder = ({ item }) => {
    return (
      <TouchableOpacity style={styles.orderCard} onPress={() => viewOrderDetails(item)} activeOpacity={0.8}>
        <View style={styles.orderHeader}>
          <View style={styles.orderNumberContainer}>
            <Ionicons name="receipt-outline" size={20} color="#1a73e8" />
            <Text style={styles.orderNumber}>{item.billNumber}</Text>
          </View>
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingBadgeText}>Pending</Text>
          </View>
        </View>
        
        <Text style={styles.orderCustomer}>👤 {item.createdByEmail?.split('@')[0] || 'Customer'}</Text>
        <Text style={styles.orderItems}>📦 {item.cart?.length || 0} items</Text>
        <Text style={styles.orderTotal}>💰 {formatPKR(item.total)}</Text>
        <Text style={styles.orderDate}>📅 {formatDate(item.createdAt)}</Text>
        
        <View style={styles.orderActions}>
          <TouchableOpacity style={styles.confirmBtn} onPress={() => confirmOrder(item)} disabled={generatingBill}>
            <Ionicons name="checkmark-circle" size={18} color="#fff" />
            <Text style={styles.confirmBtnText}>Confirm Order</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.rejectBtn} onPress={() => rejectOrder(item)} disabled={generatingBill}>
            <Ionicons name="close-circle" size={18} color="#fff" />
            <Text style={styles.rejectBtnText}>Reject</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderCustomerProduct = ({ item }) => {
    const hasDiscount = (item.discountPercent || 0) > 0;
    const finalPrice = hasDiscount ? item.discountedPrice : item.price;
    
    return (
      <TouchableOpacity style={styles.productCard} onPress={() => addToCart(item)} activeOpacity={0.8}>
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.productCategory}>📁 {item.category}</Text>
          {hasDiscount ? (
            <View>
              <Text style={styles.oldPrice}>{formatPKR(item.price)}</Text>
              <Text style={styles.price}>{formatPKR(finalPrice)}</Text>
              <View style={styles.discountBadge}>
                <Text style={styles.discountBadgeText}>-{item.discountPercent}%</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.price}>{formatPKR(finalPrice)}</Text>
          )}
          <Text style={styles.stock}>📦 Stock: {item.stock || 0}</Text>
        </View>
        <View style={styles.addIcon}>
          <Ionicons name="add" size={24} color="#fff" />
        </View>
      </TouchableOpacity>
    );
  };

  const renderCartItem = ({ item }) => (
    <View style={styles.cartItem}>
      <View style={styles.cartItemInfo}>
        <Text style={styles.cartItemName}>{item.name}</Text>
        {item.discountPercent > 0 && (
          <Text style={styles.cartItemDiscount}>-{item.discountPercent}% OFF</Text>
        )}
        <Text style={styles.cartItemPrice}>{formatPKR(item.price)} × {item.quantity}</Text>
      </View>
      <View style={styles.cartItemControls}>
        <TouchableOpacity onPress={() => updateCartQuantity(item.id, item.quantity - 1)} style={styles.qtyBtn}>
          <Text style={styles.qtyBtnText}>-</Text>
        </TouchableOpacity>
        <Text style={styles.qtyText}>{item.quantity}</Text>
        <TouchableOpacity onPress={() => updateCartQuantity(item.id, item.quantity + 1)} style={styles.qtyBtn}>
          <Text style={styles.qtyBtnText}>+</Text>
        </TouchableOpacity>
        <Text style={styles.cartItemTotal}>{formatPKR(item.total)}</Text>
        <TouchableOpacity onPress={() => removeFromCart(item.id)}>
          <Ionicons name="trash-outline" size={18} color="#dc3545" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderAISuggestions = () => (
    <Modal visible={showSuggestions} transparent={true} animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.suggestionModalContent}>
          <View style={styles.suggestionModalHeader}>
            <Text style={styles.suggestionModalTitle}>🤖 AI Recommendations</Text>
            <TouchableOpacity onPress={() => setShowSuggestions(false)}>
              <Ionicons name="close" size={24} color="#999" />
            </TouchableOpacity>
          </View>

          {suggestionLoading ? (
            <View style={styles.suggestionLoading}>
              <ActivityIndicator size="large" color="#1a73e8" />
              <Text style={styles.suggestionLoadingText}>Finding recommendations...</Text>
            </View>
          ) : aiSuggestions.length === 0 ? (
            <View style={styles.noSuggestions}>
              <Ionicons name="bulb-outline" size={50} color="#ccc" />
              <Text style={styles.noSuggestionsText}>No suggestions available</Text>
              <Text style={styles.noSuggestionsSub}>Add more items to get AI recommendations</Text>
            </View>
          ) : (
            <>
              <Text style={styles.suggestionDesc}>
                Customers who bought "{selectedProduct?.name}" also bought:
              </Text>
              <FlatList
                data={aiSuggestions}
                keyExtractor={(item, idx) => idx.toString()}
                renderItem={({ item }) => (
                  <View style={styles.suggestionItem}>
                    <View style={styles.suggestionItemInfo}>
                      <Text style={styles.suggestionItemName}>{item.name}</Text>
                      <View style={styles.suggestionPriceRow}>
                        {item.discountPercent > 0 ? (
                          <>
                            <Text style={styles.suggestionOldPrice}>{formatPKR(item.price)}</Text>
                            <Text style={styles.suggestionPrice}>{formatPKR(item.discountedPrice)}</Text>
                            <Text style={styles.suggestionDiscount}>-{item.discountPercent}%</Text>
                          </>
                        ) : (
                          <Text style={styles.suggestionPrice}>{formatPKR(item.price)}</Text>
                        )}
                      </View>
                      <Text style={styles.suggestionReason}>{item.reason || 'Popular combination'}</Text>
                    </View>
                    <View style={styles.suggestionActions}>
                      <TouchableOpacity 
                        style={styles.addSuggestionBtn} 
                        onPress={() => addSuggestionToCart(item)}
                      >
                        <Text style={styles.addSuggestionBtnText}>Add</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
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

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1a73e8" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // SHOPKEEPER VIEW
  if (userRole === 'shopkeeper') {
    return (
      <View style={styles.container}>
        <View style={styles.shopkeeperHeader}>
          <Text style={styles.headerTitle}>📋 Pending Orders</Text>
          <View style={styles.orderCountBadge}>
            <Text style={styles.orderCountText}>{pendingOrders.length} Pending</Text>
          </View>
        </View>

        {pendingOrders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={80} color="#ccc" />
            <Text style={styles.emptyTitle}>No Pending Orders</Text>
            <Text style={styles.emptySubText}>Orders from customers will appear here</Text>
          </View>
        ) : (
          <FlatList
            data={pendingOrders}
            keyExtractor={item => item.id}
            renderItem={renderPendingOrder}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            contentContainerStyle={styles.ordersList}
            showsVerticalScrollIndicator={false}
          />
        )}

        <Modal visible={showOrderModal} transparent={true} animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Order Details</Text>
                <TouchableOpacity onPress={() => setShowOrderModal(false)}>
                  <Ionicons name="close" size={24} color="#999" />
                </TouchableOpacity>
              </View>

              {selectedOrder && (
                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={styles.orderInfoBox}>
                    <Text style={styles.orderInfoLabel}>Order #: {selectedOrder.billNumber}</Text>
                    <Text style={styles.orderInfoLabel}>Customer: {selectedOrder.createdByEmail}</Text>
                    <Text style={styles.orderInfoLabel}>Date: {formatDate(selectedOrder.createdAt)}</Text>
                  </View>

                  <Text style={styles.sectionTitle}>📦 Items</Text>
                  {(selectedOrder.cart || []).map((item, idx) => (
                    <View key={idx} style={styles.itemRow}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemQty}>x{item.quantity}</Text>
                      <Text style={styles.itemPrice}>{formatPKR(item.price)}</Text>
                      <Text style={styles.itemTotal}>{formatPKR(item.price * item.quantity)}</Text>
                    </View>
                  ))}

                  <View style={styles.totalBox}>
                    <Text style={styles.totalLabel}>Subtotal: {formatPKR(selectedOrder.subtotal || 0)}</Text>
                    <Text style={styles.taxLabel}>Tax (5%): {formatPKR(selectedOrder.tax || 0)}</Text>
                    <Text style={styles.grandTotal}>Total: {formatPKR(selectedOrder.total || 0)}</Text>
                  </View>

                  <View style={styles.modalActions}>
                    <TouchableOpacity 
                      style={styles.modalConfirmBtn} 
                      onPress={() => confirmOrder(selectedOrder)} 
                      disabled={generatingBill}
                    >
                      {generatingBill ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalConfirmBtnText}>✓ Confirm Order</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.modalRejectBtn} 
                      onPress={() => rejectOrder(selectedOrder)} 
                      disabled={generatingBill}
                    >
                      <Text style={styles.modalRejectBtnText}>✗ Reject</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              )}

              <TouchableOpacity style={styles.closeBtn} onPress={() => setShowOrderModal(false)}>
                <Text style={styles.closeBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // CUSTOMER VIEW
  return (
    <View style={styles.container}>
      <View style={styles.customerHeader}>
        <Text style={styles.headerTitle}>🛒 Shop Products</Text>
        <TouchableOpacity style={styles.cartIconBtn} onPress={() => {}}>
          <Ionicons name="cart" size={24} color="#fff" />
          {cart.length > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cart.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.searchSection}>
        <View style={styles.searchWrapper}>
          <Ionicons name="search-outline" size={20} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search product..."
            placeholderTextColor="#aaa"
            value={searchText}
            onChangeText={searchProduct}
          />
        </View>
        
        {searchText.length > 0 && filteredProducts.length > 0 && (
          <View style={styles.dropdown}>
            {filteredProducts.slice(0, 5).map(product => (
              <TouchableOpacity key={product.id} style={styles.dropdownItem} onPress={() => selectProduct(product)}>
                <View style={styles.dropdownRow}>
                  <Text style={styles.dropdownName}>{product.name}</Text>
                  <Text style={styles.dropdownPrice}>{formatPKR(product.discountedPrice || product.price)}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
        
        {selectedProduct && (
          <View style={styles.selectedCard}>
            <Text style={styles.selectedText}>✓ {selectedProduct.name}</Text>
            <TouchableOpacity onPress={() => setSelectedProduct(null)}>
              <Text style={styles.clearText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
        
        <View style={styles.quantityRow}>
          <View style={styles.quantityWrapper}>
            <Text style={styles.quantityLabel}>Qty:</Text>
            <TextInput
              style={styles.quantityInput}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="numeric"
            />
          </View>
          <TouchableOpacity 
            style={styles.addToCartBtn}
            onPress={() => {
              if (selectedProduct) {
                addToCart(selectedProduct);
              } else if (searchText.length > 0) {
                const found = products.find(p => p.name.toLowerCase() === searchText.toLowerCase());
                if (found) {
                  setSelectedProduct(found);
                  addToCart(found);
                }
                else Alert.alert('Error', 'Product not found');
              } else {
                Alert.alert('Error', 'Search a product first');
              }
            }}
          >
            <Text style={styles.addToCartBtnText}>Add to Cart</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={products}
        keyExtractor={item => item.id}
        renderItem={renderCustomerProduct}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        numColumns={2}
        columnWrapperStyle={styles.productRow}
        contentContainerStyle={styles.productsList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyText}>No products available</Text>
          </View>
        }
      />

      {cart.length > 0 && (
        <View style={styles.cartSection}>
          <Text style={styles.cartTitle}>🛒 Cart ({cart.length})</Text>
          <FlatList
            data={cart}
            keyExtractor={item => item.id}
            renderItem={renderCartItem}
            scrollEnabled={false}
          />
          <View style={styles.cartFooter}>
            <Text style={styles.cartSubtotal}>Subtotal: {formatPKR(total)}</Text>
            <Text style={styles.cartTax}>Tax (5%): {formatPKR(total * 0.05)}</Text>
            <Text style={styles.cartTotal}>Total: {formatPKR(total * 1.05)}</Text>
            <TouchableOpacity style={styles.placeOrderBtn} onPress={placeOrder}>
              <Text style={styles.placeOrderBtnText}>📦 Place Order</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {renderAISuggestions()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f7fa' },
  loadingText: { marginTop: 10, color: '#666' },

  shopkeeperHeader: {
    backgroundColor: '#1a73e8',
    paddingTop: 55,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  customerHeader: {
    backgroundColor: '#1a73e8',
    paddingTop: 55,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  orderCountBadge: { backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  orderCountText: { color: '#1a73e8', fontWeight: 'bold', fontSize: 14 },
  cartIconBtn: { position: 'relative' },
  cartBadge: { position: 'absolute', top: -8, right: -8, backgroundColor: '#dc3545', borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  cartBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 15,
    marginBottom: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#f39c12',
  },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  orderNumberContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  orderNumber: { fontSize: 14, fontWeight: 'bold', color: '#1a73e8' },
  pendingBadge: { backgroundColor: '#f39c12', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  pendingBadgeText: { color: '#fff', fontSize: 10, fontWeight: '500' },
  orderCustomer: { fontSize: 13, color: '#555', marginBottom: 4 },
  orderItems: { fontSize: 12, color: '#666', marginBottom: 4 },
  orderTotal: { fontSize: 16, fontWeight: 'bold', color: '#1a73e8', marginBottom: 4 },
  orderDate: { fontSize: 10, color: '#999', marginBottom: 12 },
  orderActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  confirmBtn: { flex: 1, backgroundColor: '#34a853', paddingVertical: 10, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  confirmBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  rejectBtn: { flex: 1, backgroundColor: '#dc3545', paddingVertical: 10, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  rejectBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  ordersList: { paddingVertical: 12, paddingBottom: 20 },

  searchSection: { backgroundColor: '#fff', padding: 15, margin: 12, borderRadius: 16, elevation: 2 },
  searchWrapper: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 12, padding: 10, backgroundColor: '#fafafa' },
  searchInput: { flex: 1, fontSize: 15 },
  dropdown: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 12, marginTop: 10, maxHeight: 200, backgroundColor: '#fff' },
  dropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  dropdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dropdownName: { fontSize: 14, fontWeight: '500', color: '#333' },
  dropdownPrice: { fontSize: 13, color: '#1a73e8', fontWeight: '500' },
  selectedCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#e8f0fe', padding: 10, borderRadius: 10, marginTop: 10 },
  selectedText: { fontSize: 13, color: '#1a73e8', fontWeight: '500' },
  clearText: { fontSize: 16, color: '#dc3545', padding: 5 },
  quantityRow: { flexDirection: 'row', gap: 12, marginTop: 15 },
  quantityWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 12, paddingHorizontal: 12, backgroundColor: '#fafafa' },
  quantityLabel: { fontSize: 14, color: '#666', marginRight: 8 },
  quantityInput: { width: 45, textAlign: 'center', fontSize: 16, paddingVertical: 10 },
  addToCartBtn: { flex: 1, backgroundColor: '#1a73e8', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  addToCartBtnText: { color: '#fff', fontWeight: '600', padding: 12, fontSize: 14 },

  productRow: { justifyContent: 'space-between', paddingHorizontal: 12 },
  productsList: { paddingVertical: 12, paddingBottom: 220 },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    margin: 6,
    width: (width - 48) / 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  productInfo: { flex: 1 },
  productName: { fontSize: 14, fontWeight: '600', color: '#333' },
  productCategory: { fontSize: 11, color: '#666', marginTop: 2 },
  oldPrice: { fontSize: 11, textDecorationLine: 'line-through', color: '#999' },
  price: { fontSize: 16, fontWeight: 'bold', color: '#1a73e8', marginTop: 4 },
  stock: { fontSize: 10, color: '#888', marginTop: 4 },
  discountBadge: { position: 'absolute', top: -8, right: 0, backgroundColor: '#e67e22', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  discountBadgeText: { fontSize: 9, color: '#fff', fontWeight: 'bold' },
  addIcon: { width: 32, height: 32, backgroundColor: '#1a73e8', borderRadius: 16, alignItems: 'center', justifyContent: 'center' },

  cartSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
    maxHeight: '45%',
  },
  cartTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 10 },
  cartItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  cartItemInfo: { flex: 2 },
  cartItemName: { fontSize: 13, fontWeight: '500', color: '#333' },
  cartItemDiscount: { fontSize: 10, color: '#e67e22', marginTop: 2 },
  cartItemPrice: { fontSize: 11, color: '#666', marginTop: 2 },
  cartItemControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: { width: 24, height: 24, backgroundColor: '#f0f0f0', borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { fontSize: 14, fontWeight: 'bold', color: '#666' },
  qtyText: { minWidth: 20, textAlign: 'center', fontSize: 12 },
  cartItemTotal: { fontSize: 13, fontWeight: 'bold', color: '#1a73e8', minWidth: 70, textAlign: 'right' },
  cartFooter: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e0e0e0' },
  cartSubtotal: { fontSize: 13, color: '#666', textAlign: 'right' },
  cartTax: { fontSize: 12, color: '#888', textAlign: 'right' },
  cartTotal: { fontSize: 18, fontWeight: 'bold', color: '#1a73e8', textAlign: 'right', marginTop: 4 },
  placeOrderBtn: { backgroundColor: '#34a853', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  placeOrderBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  suggestionModalContent: { backgroundColor: '#fff', borderRadius: 24, padding: 20, width: '90%', maxHeight: '80%' },
  suggestionModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  suggestionModalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1a73e8' },
  suggestionDesc: { fontSize: 13, color: '#666', marginBottom: 16 },
  suggestionLoading: { alignItems: 'center', paddingVertical: 50 },
  suggestionLoadingText: { marginTop: 12, color: '#666' },
  noSuggestions: { alignItems: 'center', paddingVertical: 50 },
  noSuggestionsText: { fontSize: 16, fontWeight: '500', color: '#999', marginTop: 12 },
  noSuggestionsSub: { fontSize: 12, color: '#bbb', marginTop: 4, textAlign: 'center' },
  
  suggestionItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  suggestionItemInfo: { flex: 2 },
  suggestionItemName: { fontSize: 14, fontWeight: '500', color: '#333' },
  suggestionPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  suggestionOldPrice: { fontSize: 11, textDecorationLine: 'line-through', color: '#999' },
  suggestionPrice: { fontSize: 13, fontWeight: 'bold', color: '#1a73e8' },
  suggestionDiscount: { fontSize: 10, color: '#e67e22', fontWeight: 'bold' },
  suggestionReason: { fontSize: 10, color: '#888', marginTop: 2 },
  suggestionActions: { flexDirection: 'row', gap: 8 },
  addSuggestionBtn: { backgroundColor: '#34a853', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  addSuggestionBtnText: { color: '#fff', fontWeight: '500', fontSize: 12 },
  closeSuggestionsBtn: { backgroundColor: '#1a73e8', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  closeSuggestionsBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 24, padding: 20, width: '90%', maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1a73e8', flex: 1, textAlign: 'center' },
  orderInfoBox: { backgroundColor: '#f8f9fa', padding: 12, borderRadius: 12, marginBottom: 15 },
  orderInfoLabel: { fontSize: 12, color: '#666', marginBottom: 4 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  itemRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', alignItems: 'center' },
  itemName: { flex: 2, fontSize: 13, color: '#333' },
  itemQty: { flex: 1, fontSize: 13, color: '#666', textAlign: 'center' },
  itemPrice: { flex: 1, fontSize: 13, color: '#666', textAlign: 'right' },
  itemTotal: { flex: 1, fontSize: 13, fontWeight: '500', color: '#1a73e8', textAlign: 'right' },
  totalBox: { marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#e0e0e0', alignItems: 'flex-end' },
  totalLabel: { fontSize: 14, color: '#666' },
  taxLabel: { fontSize: 14, color: '#666', marginTop: 4 },
  grandTotal: { fontSize: 18, fontWeight: 'bold', color: '#1a73e8', marginTop: 8 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalConfirmBtn: { flex: 1, backgroundColor: '#34a853', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  modalConfirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  modalRejectBtn: { flex: 1, backgroundColor: '#dc3545', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  modalRejectBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  closeBtn: { backgroundColor: '#1a73e8', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  closeBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 64, opacity: 0.5, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#999', marginTop: 16 },
  emptyText: { fontSize: 18, fontWeight: '500', color: '#999', textAlign: 'center' },
  emptySubText: { fontSize: 13, color: '#bbb', textAlign: 'center', marginTop: 8 },
});