// app/(tabs)/billing.js - COMPLETE FIXED VERSION

import { useRouter, useFocusEffect } from 'expo-router';
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Linking,
  Animated,
  ScrollView,
  Dimensions,
  SafeAreaView
} from 'react-native';
import {
  addProduct,
  getProducts,
  calculateAIDynamicDiscount,
  recordPurchaseCombination,
  getLearnedSuggestions,
  loadPurchasePatterns,
  subscribeToNewOrders,
  formatPKR,
  generateDarazLink,  // Import from firebase.js
  getCurrentUser
} from '../../config/firebase';

const { height } = Dimensions.get('window');

export default function Billing() {
  const router = useRouter();
  const [products, setProducts] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [cart, setCart] = useState([]);
  const [total, setTotal] = useState(0);
  const [originalTotal, setOriginalTotal] = useState(0);
  const [totalDiscount, setTotalDiscount] = useState(0);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('');
  const [newProductStock, setNewProductStock] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [applyingDiscount, setApplyingDiscount] = useState(false);
  const [showMarketModal, setShowMarketModal] = useState(false);
  const [marketInfo, setMarketInfo] = useState(null);
  const [showDiscountConfirmModal, setShowDiscountConfirmModal] = useState(false);
  const [pendingProduct, setPendingProduct] = useState(null);
  const [pendingQuantity, setPendingQuantity] = useState(null);
  const [pendingDiscountInfo, setPendingDiscountInfo] = useState(null);
  const [showOrderToast, setShowOrderToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showCustomerAlert, setShowCustomerAlert] = useState(false);
  const [customerAlertMessage, setCustomerAlertMessage] = useState('');
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const customerAlertAnim = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    loadPurchasePatterns();
  }, []);

  useFocusEffect(useCallback(() => { loadProducts(); }, []));

  useEffect(() => {
    calculateTotal();
  }, [cart]);

  const calculateTotal = () => {
    const newTotal = cart.reduce((sum, item) => sum + ((item.discountedPrice || item.price) * item.quantity), 0);
    const newOriginalTotal = cart.reduce((sum, item) => sum + ((item.originalPrice || item.price) * item.quantity), 0);
    setTotal(newTotal);
    setOriginalTotal(newOriginalTotal);
    setTotalDiscount(newOriginalTotal - newTotal);
  };

  useEffect(() => {
    const currentUser = getCurrentUser();
    const unsubscribe = subscribeToNewOrders((newOrder) => {
      // Only show notification if order is not from current user
      if (newOrder.createdBy !== currentUser?.uid) {
        setToastMessage(`📦 New order #${newOrder.billNumber} received!`);
        setShowOrderToast(true);
        Animated.sequence([
          Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay(3000),
          Animated.timing(slideAnim, { toValue: -100, duration: 300, useNativeDriver: true })
        ]).start(() => setShowOrderToast(false));
      }
    });
    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    const result = await getProducts();
    if (result.success) {
      const normalized = result.products.map(p => ({
        ...p,
        price: p.pricePKR || p.price || 0,
        pricePKR: p.pricePKR || p.price || 0,
        discountedPrice: p.discountedPrice || p.pricePKR || p.price,
        name: p.name || 'Unknown',
        stock: p.stock || 0,
        salesCount: p.salesCount || 0,
        category: p.category || 'default'
      }));
      setProducts(normalized);
      setFilteredProducts(normalized);
    }
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProducts();
    setRefreshing(false);
  };

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

  const checkMarketPrice = async (product) => {
    setApplyingDiscount(true);
    const discountInfo = await calculateAIDynamicDiscount(product);
    setMarketInfo({
      productName: product.name,
      currentPrice: product.pricePKR || product.price,
      marketPrice: discountInfo.marketPrice,
      marketSource: discountInfo.marketSource || 'Market Data',
      marketUrl: generateDarazLink(product.name),
      trend: discountInfo.trend || 'stable',
      suggestedDiscount: discountInfo.discount,
      suggestedPrice: discountInfo.discountedPrice,
      savings: discountInfo.savings,
      reason: discountInfo.reason,
    });
    setShowMarketModal(true);
    setApplyingDiscount(false);
  };

  const showCustomerOrderAlert = (productName, quantity) => {
    setCustomerAlertMessage(`✅ Order placed! ${quantity} × ${productName} added to cart`);
    setShowCustomerAlert(true);
    Animated.sequence([
      Animated.timing(customerAlertAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.delay(2500),
      Animated.timing(customerAlertAnim, { toValue: -100, duration: 300, useNativeDriver: true })
    ]).start(() => setShowCustomerAlert(false));
  };

  const addToCart = async (product, customQuantity = null) => {
    if (!product?.name) {
      Alert.alert('Error', 'Invalid product');
      return;
    }
    
    const qty = customQuantity || parseInt(quantity);
    if (isNaN(qty) || qty < 1) {
      Alert.alert('Error', 'Please enter valid quantity');
      return;
    }
    
    const availableStock = product.stock || 0;
    const existingItem = cart.find(i => i.id === product.id);
    const currentQty = existingItem ? existingItem.quantity : 0;
    
    if (currentQty + qty > availableStock && availableStock > 0) {
      Alert.alert('Stock Limit', `Only ${availableStock} items available`);
      return;
    }
    
    setApplyingDiscount(true);
    const discountInfo = await calculateAIDynamicDiscount(product);
    setPendingProduct(product);
    setPendingQuantity(qty);
    setPendingDiscountInfo(discountInfo);
    setShowDiscountConfirmModal(true);
    setApplyingDiscount(false);
  };

  const confirmAddToCart = () => {
    const product = pendingProduct;
    const qty = pendingQuantity;
    const discountInfo = pendingDiscountInfo;
    
    const finalPrice = discountInfo.discountedPrice;
    const originalPrice = discountInfo.originalPrice;
    const discountPercent = discountInfo.discount;
    const discountReason = discountInfo.reason;
    
    const existingItem = cart.find(i => i.id === product.id);
    
    if (existingItem) {
      const newQuantity = existingItem.quantity + qty;
      setCart(cart.map(i => i.id === product.id ? {
        ...i,
        quantity: newQuantity,
        total: finalPrice * newQuantity,
        price: finalPrice,
        discountedPrice: finalPrice,
        originalPrice: originalPrice,
        discount: discountPercent,
        discountReason: discountReason
      } : i));
    } else {
      setCart([...cart, {
        id: product.id,
        name: product.name,
        price: finalPrice,
        discountedPrice: finalPrice,
        originalPrice: originalPrice,
        quantity: qty,
        total: finalPrice * qty,
        discount: discountPercent,
        discountReason: discountReason,
        stock: product.stock || 0,
        category: product.category || 'default'
      }]);
    }
    
    showCustomerOrderAlert(product.name, qty);
    
    setSearchText('');
    setQuantity('1');
    setFilteredProducts(products);
    setSelectedProduct(null);
    setShowDiscountConfirmModal(false);
    setPendingProduct(null);
    setPendingQuantity(null);
    setPendingDiscountInfo(null);
    getSuggestionsForProduct(product);
  };

  const getSuggestionsForProduct = async (product) => {
    const suggestionsList = await getLearnedSuggestions(product.id, cart, products);
    if (suggestionsList.length > 0) {
      setSuggestions(suggestionsList);
      setShowSuggestionModal(true);
    }
  };

  const addSuggestionToCart = (product) => {
    addToCart(product, 1);
    setShowSuggestionModal(false);
  };

  const generateBillAndLearn = async () => {
    if (cart.length === 0) {
      Alert.alert('Error', 'Cart is empty');
      return;
    }
    
    Alert.alert(
      '📋 Confirm Order',
      `Your order has ${cart.length} item(s) totaling ${formatPKR(total)}.\n\nDo you want to proceed?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Proceed', 
          onPress: async () => {
            Alert.alert('✅ Order Placed Successfully!', 
              `Your order has been placed successfully!\n\nOrder Total: ${formatPKR(total)}\n\nThank you for shopping with us!`,
              [{ text: 'OK', onPress: () => proceedToLearning() }]
            );
          }
        }
      ]
    );
  };

  const proceedToLearning = async () => {
    const result = await recordPurchaseCombination(cart);
    Alert.alert(
      '🧠 AI Learning Complete',
      `✅ ${cart.length} item(s) recorded.\n📊 ${result.recorded} purchase patterns saved.`,
      [{ text: 'Continue', onPress: () => proceedToBill() }]
    );
  };

  const proceedToBill = () => {
    router.push({
      pathname: '/billsummary',
      params: { 
        cart: JSON.stringify(cart),
        total: total.toString(),
        originalTotal: originalTotal.toString(),
        totalDiscount: totalDiscount.toString()
      }
    });
  };

  const selectProduct = (product) => {
    if (product && product.name) {
      setSelectedProduct(product);
      setSearchText(product.name);
      setFilteredProducts([]);
    }
  };

  const addNewProduct = async () => {
    if (!newProductName || !newProductPrice) {
      Alert.alert('Error', 'Please enter product name and price');
      return;
    }
    const priceVal = parseFloat(newProductPrice);
    if (isNaN(priceVal) || priceVal <= 0) {
      Alert.alert('Error', 'Please enter a valid price');
      return;
    }
    const productData = {
      name: newProductName.trim(),
      price: priceVal,
      pricePKR: priceVal,
      category: newProductCategory.trim() || 'General',
      stock: parseInt(newProductStock) || 0,
      salesCount: 0,
      createdAt: new Date().toISOString()
    };
    const result = await addProduct(productData);
    if (result.success) {
      Alert.alert('Success', `${newProductName} added successfully!`);
      setShowAddProductModal(false);
      setNewProductName('');
      setNewProductPrice('');
      setNewProductCategory('');
      setNewProductStock('');
      await loadProducts();
    } else {
      Alert.alert('Error', result.error || 'Failed to add product');
    }
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
    } else if (item) {
      Alert.alert('Stock Limit', `Only ${item.stock} items available`);
    }
  };

  const renderCartItem = ({ item }) => {
    const itemTotal = item.price * item.quantity;
    const itemOriginalTotal = (item.originalPrice || item.price) * item.quantity;
    const hasDiscount = item.discount > 0;
    
    return (
      <View style={styles.cartItem}>
        <View style={styles.cartItemLeft}>
          <Text style={styles.cartItemName}>{item.name}</Text>
          <Text style={styles.cartItemPrice}>
            {formatPKR(item.price)} × {item.quantity}
          </Text>
          {hasDiscount && (
            <View style={styles.discountChip}>
              <Text style={styles.discountChipText}>🎯 {item.discount}% OFF</Text>
            </View>
          )}
        </View>
        <View style={styles.cartItemRight}>
          {hasDiscount && (
            <Text style={styles.cartItemOldPrice}>{formatPKR(itemOriginalTotal)}</Text>
          )}
          <Text style={styles.cartItemTotal}>{formatPKR(itemTotal)}</Text>
          <View style={styles.cartItemControls}>
            <TouchableOpacity onPress={() => updateCartQuantity(item.id, item.quantity - 1)} style={styles.qtyBtn}>
              <Text style={styles.qtyBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.qtyText}>{item.quantity}</Text>
            <TouchableOpacity onPress={() => updateCartQuantity(item.id, item.quantity + 1)} style={styles.qtyBtn}>
              <Text style={styles.qtyBtnText}>+</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => removeFromCart(item.id)} style={styles.deleteBtn}>
              <Text style={styles.deleteBtnText}>🗑️</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1a73e8" />
        <Text style={styles.loadingText}>Loading products...</Text>
      </View>
    );
  }

  return (
    <View style={styles.safeArea}>
      <View style={styles.container}>
        {showCustomerAlert && (
          <Animated.View style={[styles.customerAlertContainer, { transform: [{ translateY: customerAlertAnim }] }]}>
            <Text style={styles.customerAlertText}>{customerAlertMessage}</Text>
          </Animated.View>
        )}

        {showOrderToast && (
          <Animated.View style={[styles.toastContainer, { transform: [{ translateY: slideAnim }] }]}>
            <Text style={styles.toastText}>{toastMessage}</Text>
          </Animated.View>
        )}

        <View style={styles.header}>
          <Text style={styles.headerTitle}>🧠 AI Smart Billing</Text>
          <TouchableOpacity style={styles.addProductBtn} onPress={() => setShowAddProductModal(true)}>
            <Text style={styles.addProductBtnText}>+ Add Product</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.inputSection}>
          <View style={styles.searchWrapper}>
            <Text style={styles.searchIcon}>🔍</Text>
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
                    <View>
                      <Text style={styles.dropdownName}>{product.name}</Text>
                      <Text style={styles.dropdownStock}>📦 Stock: {product.stock || 0}</Text>
                    </View>
                    <View style={styles.dropdownActions}>
                      <Text style={styles.dropdownPrice}>{formatPKR(product.price)}</Text>
                      <TouchableOpacity style={styles.compareBtn} onPress={() => checkMarketPrice(product)}>
                        <Text style={styles.compareBtnText}>🔍</Text>
                      </TouchableOpacity>
                    </View>
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
              style={styles.addButton}
              disabled={applyingDiscount}
              onPress={() => {
                if (selectedProduct) {
                  addToCart(selectedProduct);
                } else if (searchText.length > 0) {
                  const found = products.find(p => p.name.toLowerCase() === searchText.toLowerCase());
                  if (found) addToCart(found);
                  else Alert.alert('Error', 'Product not found');
                } else {
                  Alert.alert('Error', 'Search a product first');
                }
              }}
            >
              <Text style={styles.addButtonText}>
                {applyingDiscount ? '🤖 Calculating...' : 'Add to Cart'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.cartHeader}>
          <Text style={styles.cartTitle}>🛒 Current Bill</Text>
          <View style={styles.cartBadge}>
            <Text style={styles.cartBadgeText}>{cart.length} items</Text>
          </View>
        </View>

        {totalDiscount > 0 && (
          <View style={styles.savingsBar}>
            <Text style={styles.savingsText}>🎉 AI Saved: {formatPKR(totalDiscount)}</Text>
          </View>
        )}

        <FlatList
          data={cart}
          keyExtractor={item => item.id}
          renderItem={renderCartItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={cart.length === 0 ? styles.emptyCart : styles.cartList}
          ListEmptyComponent={
            <View style={styles.emptyCartContainer}>
              <Text style={styles.emptyCartIcon}>🛒</Text>
              <Text style={styles.emptyCartText}>Cart is empty</Text>
              <Text style={styles.emptyCartSub}>Search & add products above</Text>
            </View>
          }
        />

        <View style={styles.totalSection}>
          {originalTotal > total ? (
            <>
              <View style={styles.compactRow}>
                <Text style={styles.compactLabel}>Original:</Text>
                <Text style={styles.compactOriginal}>{formatPKR(originalTotal)}</Text>
              </View>
              <View style={styles.compactRow}>
                <Text style={styles.compactLabel}>Discount:</Text>
                <Text style={styles.compactDiscount}>-{formatPKR(totalDiscount)}</Text>
              </View>
              <View style={styles.totalDivider} />
            </>
          ) : null}
          
          <View style={styles.compactRow}>
            <Text style={styles.compactFinalLabel}>Total:</Text>
            <Text style={styles.compactFinalAmount}>{formatPKR(total)}</Text>
          </View>
          
          <TouchableOpacity style={styles.proceedBtn} onPress={generateBillAndLearn}>
            <Text style={styles.proceedBtnText}>Place Order & AI Learns →</Text>
          </TouchableOpacity>
        </View>

        {/* Modals remain same as your original code */}
        <Modal visible={showMarketModal} transparent={true} animationType="slide">
          <View style={styles.modalOverlay}>
            <ScrollView style={styles.modalContent}>
              <Text style={styles.modalTitle}>🏷️ Market Price</Text>
              {marketInfo && (
                <View>
                  <Text style={styles.modalProduct}>{marketInfo.productName}</Text>
                  <View style={styles.modalRow}><Text>Your Price:</Text><Text style={styles.modalYourPrice}>{formatPKR(marketInfo.currentPrice)}</Text></View>
                  <View style={styles.modalRow}><Text>Market Price:</Text><Text style={styles.modalMarketPrice}>{marketInfo.marketPrice ? formatPKR(marketInfo.marketPrice) : 'Not available'}</Text></View>
                  <TouchableOpacity style={styles.darazBtn} onPress={() => Linking.openURL(marketInfo.marketUrl)}>
                    <Text style={styles.darazBtnText}>🌐 Compare on Daraz</Text>
                  </TouchableOpacity>
                  <View style={styles.aiSuggestionBox}>
                    <Text style={styles.aiSuggestionTitle}>🤖 AI Suggestion</Text>
                    <Text style={styles.aiDiscountText}>{marketInfo.suggestedDiscount}% OFF</Text>
                    <Text style={styles.aiPriceText}>{formatPKR(marketInfo.suggestedPrice)}</Text>
                    <Text style={styles.aiSaveText}>Save {formatPKR(marketInfo.savings)}</Text>
                    <Text style={styles.aiReasonText}>{marketInfo.reason}</Text>
                  </View>
                  <TouchableOpacity style={styles.closeModalBtn} onPress={() => setShowMarketModal(false)}>
                    <Text style={styles.closeModalBtnText}>Close</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </Modal>

        <Modal visible={showDiscountConfirmModal} transparent={true} animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>🤖 AI Best Price!</Text>
              {pendingDiscountInfo && pendingProduct && (
                <View style={styles.confirmContainer}>
                  <Text style={styles.confirmProduct}>{pendingProduct.name}</Text>
                  <View style={styles.confirmPriceRow}>
                    <Text style={styles.confirmOldPrice}>{formatPKR(pendingDiscountInfo.originalPrice)}</Text>
                    <Text style={styles.confirmNewPrice}>{formatPKR(pendingDiscountInfo.discountedPrice)}</Text>
                  </View>
                  <View style={styles.confirmDiscountBadge}>
                    <Text style={styles.confirmDiscountText}>-{pendingDiscountInfo.discount}% OFF</Text>
                  </View>
                  <Text style={styles.confirmSave}>Save {formatPKR(pendingDiscountInfo.savings)}</Text>
                  <Text style={styles.confirmReason}>{pendingDiscountInfo.reason}</Text>
                  <View style={styles.confirmButtons}>
                    <TouchableOpacity style={styles.confirmApplyBtn} onPress={confirmAddToCart}>
                      <Text style={styles.confirmApplyText}>Apply Discount</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.confirmOriginalBtn} onPress={() => setShowDiscountConfirmModal(false)}>
                      <Text style={styles.confirmOriginalText}>Use Original Price</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </View>
        </Modal>

        <Modal visible={showSuggestionModal} transparent={true} animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>🧠 AI Smart Suggestions</Text>
              <Text style={styles.suggestionSubtitle}>Based on purchase history (Ranked by frequency)</Text>
              {suggestions.map((item, idx) => (
                <TouchableOpacity key={idx} style={styles.suggestionItem} onPress={() => addSuggestionToCart(item)}>
                  <View style={styles.suggestionRank}>
                    <Text style={styles.suggestionRankText}>#{idx + 1}</Text>
                  </View>
                  <View style={styles.suggestionInfo}>
                    <Text style={styles.suggestionName}>{item.name}</Text>
                    <Text style={styles.suggestionReason}>{item.reason}</Text>
                  </View>
                  <Text style={styles.suggestionPrice}>{formatPKR(item.price)}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.closeSuggestBtn} onPress={() => setShowSuggestionModal(false)}>
                <Text style={styles.closeSuggestBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal visible={showAddProductModal} transparent={true} animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Add New Product</Text>
              <TextInput style={styles.modalInput} placeholder="Product Name" value={newProductName} onChangeText={setNewProductName} />
              <TextInput style={styles.modalInput} placeholder="Price (PKR)" value={newProductPrice} onChangeText={setNewProductPrice} keyboardType="numeric" />
              <TextInput style={styles.modalInput} placeholder="Category" value={newProductCategory} onChangeText={setNewProductCategory} />
              <TextInput style={styles.modalInput} placeholder="Initial Stock" value={newProductStock} onChangeText={setNewProductStock} keyboardType="numeric" />
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.saveModalBtn} onPress={addNewProduct}><Text style={styles.saveModalBtnText}>Add Product</Text></TouchableOpacity>
                <TouchableOpacity style={styles.cancelModalBtn} onPress={() => setShowAddProductModal(false)}><Text style={styles.cancelModalBtnText}>Cancel</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </View>
  );
}

// Styles remain same as your original billing.js styles
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f2f4f8' },
  container: { flex: 1, backgroundColor: '#f2f4f8' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f2f4f8' },
  loadingText: { marginTop: 10, color: '#666' },
  customerAlertContainer: { position: 'absolute', top: 10, left: 15, right: 15, backgroundColor: '#34a853', padding: 12, borderRadius: 12, zIndex: 1001, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 5 },
  customerAlertText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  toastContainer: { position: 'absolute', top: 10, left: 15, right: 15, backgroundColor: '#f39c12', padding: 10, borderRadius: 10, zIndex: 1000, alignItems: 'center' },
  toastText: { color: '#fff', fontSize: 13, fontWeight: '500' },
  header: { backgroundColor: '#1a73e8', padding: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  addProductBtn: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  addProductBtnText: { color: '#fff', fontSize: 11 },
  inputSection: { backgroundColor: '#fff', padding: 15, margin: 12, borderRadius: 16, elevation: 2 },
  searchWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 12, padding: 10, backgroundColor: '#fafafa' },
  searchIcon: { marginRight: 10, fontSize: 14 },
  searchInput: { flex: 1, fontSize: 15 },
  dropdown: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 12, marginTop: 10, maxHeight: 200, backgroundColor: '#fff' },
  dropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  dropdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dropdownName: { fontSize: 14, fontWeight: '500', color: '#333' },
  dropdownStock: { fontSize: 10, color: '#888', marginTop: 2 },
  dropdownPrice: { fontSize: 14, color: '#1a73e8', fontWeight: 'bold' },
  dropdownActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  compareBtn: { backgroundColor: '#e8f0fe', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15 },
  compareBtnText: { fontSize: 12, color: '#1a73e8', fontWeight: '500' },
  selectedCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#e8f0fe', padding: 10, borderRadius: 10, marginTop: 10 },
  selectedText: { fontSize: 13, color: '#1a73e8', fontWeight: '500' },
  clearText: { fontSize: 16, color: '#dc3545', padding: 5 },
  quantityRow: { flexDirection: 'row', gap: 12, marginTop: 15 },
  quantityWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 12, paddingHorizontal: 12, backgroundColor: '#fafafa' },
  quantityLabel: { fontSize: 14, color: '#666', marginRight: 8 },
  quantityInput: { width: 45, textAlign: 'center', fontSize: 16, paddingVertical: 10 },
  addButton: { flex: 1, backgroundColor: '#1a73e8', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  addButtonText: { color: '#fff', fontWeight: '600', padding: 12, fontSize: 14 },
  cartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingTop: 10, paddingBottom: 8 },
  cartTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  cartBadge: { backgroundColor: '#f0f0f0', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 15 },
  cartBadgeText: { fontSize: 11, color: '#666', fontWeight: '500' },
  savingsBar: { backgroundColor: '#e8f5e9', marginHorizontal: 12, marginBottom: 8, padding: 10, borderRadius: 12, alignItems: 'center' },
  savingsText: { fontSize: 12, color: '#34a853', fontWeight: '600' },
  cartList: { paddingHorizontal: 12, paddingBottom: 10 },
  emptyCart: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 50 },
  emptyCartContainer: { alignItems: 'center', padding: 40 },
  emptyCartIcon: { fontSize: 50, opacity: 0.4, marginBottom: 12 },
  emptyCartText: { fontSize: 15, color: '#999' },
  emptyCartSub: { fontSize: 12, color: '#bbb', marginTop: 5 },
  cartItem: { backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  cartItemLeft: { flex: 2 },
  cartItemName: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 4 },
  cartItemPrice: { fontSize: 12, color: '#666', marginBottom: 4 },
  discountChip: { backgroundColor: '#e67e22', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, alignSelf: 'flex-start' },
  discountChipText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  cartItemRight: { alignItems: 'flex-end', gap: 4 },
  cartItemOldPrice: { fontSize: 11, textDecorationLine: 'line-through', color: '#999' },
  cartItemTotal: { fontSize: 15, fontWeight: 'bold', color: '#1a73e8' },
  cartItemControls: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  qtyBtn: { width: 26, height: 26, backgroundColor: '#f0f0f0', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  qtyBtnText: { fontSize: 14, fontWeight: 'bold', color: '#666' },
  qtyText: { minWidth: 24, textAlign: 'center', fontSize: 13, fontWeight: '500' },
  deleteBtn: { padding: 4 },
  deleteBtnText: { fontSize: 16, color: '#dc3545' },
  totalSection: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#e8e8e8', paddingBottom: 20 },
  compactRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  compactLabel: { fontSize: 12, color: '#888' },
  compactOriginal: { fontSize: 12, textDecorationLine: 'line-through', color: '#999' },
  compactDiscount: { fontSize: 12, color: '#34a853', fontWeight: '500' },
  compactFinalLabel: { fontSize: 14, fontWeight: 'bold', color: '#333' },
  compactFinalAmount: { fontSize: 20, fontWeight: 'bold', color: '#1a73e8' },
  totalDivider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 8 },
  proceedBtn: { backgroundColor: '#34a853', padding: 12, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  proceedBtnText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 20, width: '90%', maxHeight: '80%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 15, color: '#1a73e8' },
  modalProduct: { fontSize: 16, fontWeight: 'bold', textAlign: 'center', marginBottom: 15 },
  modalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalYourPrice: { fontSize: 14, fontWeight: 'bold', color: '#dc3545' },
  modalMarketPrice: { fontSize: 14, fontWeight: 'bold', color: '#34a853' },
  darazBtn: { backgroundColor: '#f0ad4e', padding: 12, borderRadius: 12, marginTop: 15, alignItems: 'center' },
  darazBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  aiSuggestionBox: { backgroundColor: '#e8f0fe', padding: 15, borderRadius: 12, marginTop: 15, alignItems: 'center' },
  aiSuggestionTitle: { fontSize: 13, fontWeight: 'bold', color: '#1a73e8' },
  aiDiscountText: { fontSize: 24, fontWeight: 'bold', color: '#e67e22', marginVertical: 5 },
  aiPriceText: { fontSize: 18, fontWeight: 'bold', color: '#1a73e8' },
  aiSaveText: { fontSize: 12, color: '#34a853', marginTop: 5 },
  aiReasonText: { fontSize: 11, color: '#666', marginTop: 5, textAlign: 'center' },
  closeModalBtn: { backgroundColor: '#1a73e8', padding: 12, borderRadius: 12, alignItems: 'center', marginTop: 15 },
  closeModalBtnText: { color: '#fff', fontWeight: '600' },
  confirmContainer: { alignItems: 'center' },
  confirmProduct: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  confirmPriceRow: { flexDirection: 'row', gap: 15, marginBottom: 10 },
  confirmOldPrice: { fontSize: 14, textDecorationLine: 'line-through', color: '#999' },
  confirmNewPrice: { fontSize: 20, fontWeight: 'bold', color: '#e67e22' },
  confirmDiscountBadge: { backgroundColor: '#e67e22', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginBottom: 10 },
  confirmDiscountText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  confirmSave: { fontSize: 13, color: '#34a853', fontWeight: 'bold', marginBottom: 8 },
  confirmReason: { fontSize: 11, color: '#666', textAlign: 'center', marginBottom: 20 },
  confirmButtons: { flexDirection: 'row', gap: 10, width: '100%' },
  confirmApplyBtn: { flex: 1, backgroundColor: '#34a853', padding: 12, borderRadius: 10, alignItems: 'center' },
  confirmApplyText: { color: '#fff', fontWeight: 'bold' },
  confirmOriginalBtn: { flex: 1, backgroundColor: '#dc3545', padding: 12, borderRadius: 10, alignItems: 'center' },
  confirmOriginalText: { color: '#fff', fontWeight: 'bold' },
  suggestionSubtitle: { fontSize: 12, color: '#666', textAlign: 'center', marginBottom: 15 },
  suggestionItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee', gap: 12 },
  suggestionRank: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#e8f0fe', alignItems: 'center', justifyContent: 'center' },
  suggestionRankText: { fontSize: 12, fontWeight: 'bold', color: '#1a73e8' },
  suggestionInfo: { flex: 1 },
  suggestionName: { fontSize: 14, fontWeight: '500', color: '#333' },
  suggestionReason: { fontSize: 10, color: '#888', marginTop: 2 },
  suggestionPrice: { fontSize: 14, fontWeight: 'bold', color: '#1a73e8' },
  closeSuggestBtn: { backgroundColor: '#1a73e8', padding: 12, borderRadius: 12, alignItems: 'center', marginTop: 15 },
  closeSuggestBtnText: { color: '#fff', fontWeight: '600' },
  modalInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 12, marginBottom: 12, fontSize: 14 },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 10 },
  saveModalBtn: { flex: 1, backgroundColor: '#34a853', padding: 12, borderRadius: 10, alignItems: 'center' },
  saveModalBtnText: { color: '#fff', fontWeight: 'bold' },
  cancelModalBtn: { flex: 1, backgroundColor: '#dc3545', padding: 12, borderRadius: 10, alignItems: 'center' },
  cancelModalBtnText: { color: '#fff', fontWeight: 'bold' },
});