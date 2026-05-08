// app/(tabs)/billing.js - CORRECTED VERSION

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
  Animated
} from 'react-native';
import {
  addProduct,
  getProducts,
  calculateAIDynamicDiscount,
  recordPurchaseCombination,
  getLearnedSuggestions,
  loadPurchasePatterns,
  subscribeToNewOrders,
  formatPKR
} from '../../config/firebase';

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
  const slideAnim = useRef(new Animated.Value(-100)).current;

  // Silent notification for new orders (No popup alert)
  useEffect(() => {
    const unsubscribe = subscribeToNewOrders((newOrder) => {
      console.log('📦 New order received:', newOrder.billNumber);
      setToastMessage(`📦 New order #${newOrder.billNumber} received!`);
      setShowOrderToast(true);
      Animated.sequence([
        Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.delay(3000),
        Animated.timing(slideAnim, { toValue: -100, duration: 300, useNativeDriver: true })
      ]).start(() => setShowOrderToast(false));
    });
    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

  useEffect(() => {
    loadPurchasePatterns();
  }, []);

  useFocusEffect(useCallback(() => { loadProducts(); }, []));

  useEffect(() => { calculateTotal(); }, [cart]);

  const calculateTotal = () => {
    const newTotal = cart.reduce((sum, item) => sum + ((item.discountedPrice || item.price) * item.quantity), 0);
    const newOriginalTotal = cart.reduce((sum, item) => sum + ((item.originalPrice || item.price) * item.quantity), 0);
    setTotal(newTotal);
    setOriginalTotal(newOriginalTotal);
    setTotalDiscount(newOriginalTotal - newTotal);
  };

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
    const info = await calculateAIDynamicDiscount(product);
    setMarketInfo({
      productName: product.name,
      currentPrice: product.pricePKR || product.price,
      marketPrice: info.marketPrice,
      marketSource: info.marketSource,
      marketUrl: info.marketUrl,
      trend: info.trend,
      suggestedDiscount: info.discount,
      suggestedPrice: info.discountedPrice,
      savings: info.savings,
      reason: info.reason,
      exactMatch: info.exactMatch,
      category: info.category
    });
    setShowMarketModal(true);
    setApplyingDiscount(false);
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
    
    if (currentQty + qty > availableStock) {
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
    
    if (discountPercent > 0) {
      Alert.alert(
        '🤖 AI Best Price!',
        `${discountPercent}% OFF on ${product.name}\n💰 You save: ${formatPKR(discountInfo.savings)}\n📊 ${discountReason}`,
        [{ text: 'Great!', style: 'default' }]
      );
    }
    
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
    
    const result = await recordPurchaseCombination(cart);
    Alert.alert(
      '🧠 AI Learning Complete',
      `✅ ${cart.length} item(s) recorded.\n📊 ${result.recorded} purchase patterns saved.\n🔄 AI will use this for future recommendations.`,
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

    const productData = {
      name: newProductName.trim(),
      price: parseFloat(newProductPrice),
      pricePKR: parseFloat(newProductPrice),
      category: newProductCategory.trim() || 'default',
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

  const renderCartItem = ({ item }) => (
    <View style={styles.cartItem}>
      <View style={styles.cartItemInfo}>
        <Text style={styles.cartItemName}>{item.name}</Text>
        {item.discount > 0 ? (
          <>
            <View style={styles.priceRowSmall}>
              <Text style={styles.oldPrice}>{formatPKR(item.originalPrice)}</Text>
              <View style={styles.discountBadge}>
                <Text style={styles.discountBadgeText}>AI -{item.discount}%</Text>
              </View>
            </View>
            <Text style={styles.cartItemPrice}>{formatPKR(item.price)} x {item.quantity}</Text>
            <Text style={styles.discountReason} numberOfLines={1}>{item.discountReason}</Text>
          </>
        ) : (
          <Text style={styles.cartItemPrice}>{formatPKR(item.price)} x {item.quantity}</Text>
        )}
        <Text style={styles.stockIndicator}>📦 Stock: {item.stock}</Text>
      </View>
      <View style={styles.cartItemActions}>
        <Text style={styles.cartItemTotal}>{formatPKR(item.total)}</Text>
        <TouchableOpacity onPress={() => {
          const newQty = item.quantity - 1;
          if (newQty < 1) {
            setCart(cart.filter(i => i.id !== item.id));
          } else {
            setCart(cart.map(i => i.id === item.id ? { ...i, quantity: newQty, total: newQty * i.price } : i));
          }
        }} style={styles.actionBtn}>
          <Text style={styles.actionBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.quantityText}>{item.quantity}</Text>
        <TouchableOpacity onPress={() => {
          const newQty = item.quantity + 1;
          if (newQty <= item.stock) {
            setCart(cart.map(i => i.id === item.id ? { ...i, quantity: newQty, total: newQty * i.price } : i));
          } else {
            Alert.alert('Stock Limit', `Only ${item.stock} items available`);
          }
        }} style={styles.actionBtn}>
          <Text style={styles.actionBtnText}>+</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setCart(cart.filter(i => i.id !== item.id))}>
          <Text style={styles.deleteBtn}>🗑️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1a73e8" />
        <Text style={styles.loadingText}>Loading products...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Order Toast Notification */}
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
              <TouchableOpacity 
                key={product.id} 
                style={styles.dropdownItem}
                onPress={() => selectProduct(product)}
              >
                <View style={styles.dropdownItemRow}>
                  <View style={styles.dropdownInfo}>
                    <Text style={styles.dropdownName}>{product.name}</Text>
                    <Text style={styles.dropdownStock}>📦 Stock: {product.stock || 0}</Text>
                    <Text style={styles.dropdownCategory}>📁 {product.category || 'General'}</Text>
                  </View>
                  <View style={styles.dropdownActions}>
                    <Text style={styles.dropdownPrice}>{formatPKR(product.pricePKR || product.price)}</Text>
                    <TouchableOpacity 
                      style={styles.competitorCheckBtn}
                      onPress={() => checkMarketPrice(product)}
                    >
                      <Text style={styles.competitorCheckBtnText}>🔍 Compare</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
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
                const found = products.find(p => p.name && p.name.toLowerCase() === searchText.toLowerCase());
                if (found) {
                  addToCart(found);
                } else {
                  Alert.alert('Error', 'Product not found. Add it manually.');
                }
              } else {
                Alert.alert('Error', 'Please search a product first');
              }
            }}
          >
            <Text style={styles.addButtonText}>
              {applyingDiscount ? 'AI Calculating...' : 'Add to Cart'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.cartSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🛒 Current Bill</Text>
          <Text style={styles.itemCount}>{cart.length} items</Text>
        </View>
        
        {totalDiscount > 0 && (
          <View style={styles.discountSummaryBar}>
            <Text style={styles.discountSummaryText}>🎉 AI Saved: {formatPKR(totalDiscount)}</Text>
          </View>
        )}
        
        <FlatList
          data={cart}
          keyExtractor={item => item.id}
          renderItem={renderCartItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyCartContainer}>
              <Text style={styles.emptyCartIcon}>🛒</Text>
              <Text style={styles.emptyCart}>No items added yet</Text>
              <Text style={styles.emptyCartSub}>Search and add products above</Text>
            </View>
          }
          contentContainerStyle={cart.length === 0 && styles.emptyCartContent}
        />
      </View>

      <View style={styles.totalSection}>
        {originalTotal > total && (
          <>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Original Amount:</Text>
              <Text style={styles.originalAmount}>{formatPKR(originalTotal)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>AI Discount:</Text>
              <Text style={styles.discountAmount}>-{formatPKR(totalDiscount)}</Text>
            </View>
            <View style={styles.dividerLine} />
          </>
        )}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Final Amount:</Text>
          <Text style={styles.totalAmount}>{formatPKR(total)}</Text>
        </View>
        <TouchableOpacity style={styles.proceedButton} onPress={generateBillAndLearn}>
          <Text style={styles.proceedButtonText}>Generate Bill & AI Learns →</Text>
        </TouchableOpacity>
      </View>

      {/* Market Price Modal */}
      <Modal visible={showMarketModal} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🏷️ Market Price Analysis</Text>
            {marketInfo && (
              <View>
                <Text style={styles.modalProductName}>{marketInfo.productName}</Text>
                
                <View style={styles.priceRowModal}>
                  <Text style={styles.priceLabelModal}>Your Price:</Text>
                  <Text style={styles.yourPriceModal}>{formatPKR(marketInfo.currentPrice)}</Text>
                </View>
                
                <View style={styles.priceRowModal}>
                  <Text style={styles.priceLabelModal}>Market Price:</Text>
                  <Text style={styles.marketPriceModal}>
                    {marketInfo.marketPrice ? formatPKR(marketInfo.marketPrice) : 'Not available'}
                  </Text>
                  <Text style={styles.marketSourceModal}>({marketInfo.marketSource})</Text>
                </View>
                
                {marketInfo.marketUrl && (
                  <TouchableOpacity 
                    style={styles.websiteBtn}
                    onPress={() => {
                      Linking.openURL(marketInfo.marketUrl).catch(() => {
                        Alert.alert('Error', 'Cannot open website');
                      });
                    }}
                  >
                    <Text style={styles.websiteBtnText}>
                      🌐 View on {marketInfo.marketSource || 'Daraz'}
                    </Text>
                  </TouchableOpacity>
                )}
                
                <View style={styles.aiBox}>
                  <Text style={styles.aiBoxTitle}>🤖 AI Suggestion</Text>
                  <Text style={styles.aiDiscount}>{marketInfo.suggestedDiscount}% OFF</Text>
                  <Text style={styles.aiPrice}>{formatPKR(marketInfo.suggestedPrice)}</Text>
                  <Text style={styles.aiSavings}>Save {formatPKR(marketInfo.savings)}</Text>
                  <Text style={styles.aiReason}>{marketInfo.reason}</Text>
                </View>
                
                <TouchableOpacity style={styles.closeBtn} onPress={() => setShowMarketModal(false)}>
                  <Text style={styles.closeBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* AI Suggestion Modal */}
      <Modal visible={showSuggestionModal} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🧠 AI Recommendations</Text>
            <Text style={styles.suggestionSubtitle}>Frequently bought together:</Text>
            {suggestions.map(product => (
              <TouchableOpacity 
                key={product.id}
                style={styles.suggestionItem}
                onPress={() => addSuggestionToCart(product)}
              >
                <View style={styles.suggestionLeft}>
                  <Text style={styles.suggestionName}>{product.name}</Text>
                  <Text style={styles.suggestionFrequency}>🔥 Bought {product.frequency} times</Text>
                </View>
                <Text style={styles.suggestionPrice}>{formatPKR(product.price)}</Text>
                <View style={styles.addSuggestionBtn}>
                  <Text style={styles.addSuggestionBtnText}>+ Add</Text>
                </View>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.ignoreButton} onPress={() => setShowSuggestionModal(false)}>
              <Text style={styles.ignoreButtonText}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Discount Confirm Modal */}
      <Modal visible={showDiscountConfirmModal} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🤖 AI Best Price!</Text>
            {pendingDiscountInfo && (
              <View style={styles.discountConfirmContainer}>
                <Text style={styles.confirmProductName}>{pendingProduct?.name}</Text>
                <View style={styles.confirmPriceRow}>
                  <Text style={styles.confirmOriginalPrice}>{formatPKR(pendingDiscountInfo.originalPrice)}</Text>
                  <Text style={styles.confirmNewPrice}>{formatPKR(pendingDiscountInfo.discountedPrice)}</Text>
                </View>
                <View style={styles.confirmDiscountBadge}>
                  <Text style={styles.confirmDiscountText}>-{pendingDiscountInfo.discount}% OFF</Text>
                </View>
                <Text style={styles.confirmSavings}>Save {formatPKR(pendingDiscountInfo.savings)}</Text>
                <Text style={styles.confirmReason}>{pendingDiscountInfo.reason}</Text>
                <View style={styles.confirmButtons}>
                  <TouchableOpacity style={styles.confirmYesBtn} onPress={confirmAddToCart}>
                    <Text style={styles.confirmYesBtnText}>Apply Discount</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.confirmNoBtn} onPress={() => setShowDiscountConfirmModal(false)}>
                    <Text style={styles.confirmNoBtnText}>Use Original</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Add Product Modal */}
      <Modal visible={showAddProductModal} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Product</Text>
            <TextInput style={styles.modalInput} placeholder="Product Name" value={newProductName} onChangeText={setNewProductName} />
            <TextInput style={styles.modalInput} placeholder="Price (PKR)" value={newProductPrice} onChangeText={setNewProductPrice} keyboardType="numeric" />
            <TextInput style={styles.modalInput} placeholder="Category" value={newProductCategory} onChangeText={setNewProductCategory} />
            <TextInput style={styles.modalInput} placeholder="Stock" value={newProductStock} onChangeText={setNewProductStock} keyboardType="numeric" />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.saveBtn} onPress={addNewProduct}><Text style={styles.saveBtnText}>Add Product</Text></TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddProductModal(false)}><Text style={styles.cancelBtnText}>Cancel</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#666' },
  toastContainer: { position: 'absolute', top: 10, left: 20, right: 20, backgroundColor: '#34a853', padding: 12, borderRadius: 10, zIndex: 1000, alignItems: 'center' },
  toastText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  header: { backgroundColor: '#1a73e8', padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  addProductBtn: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  addProductBtnText: { color: '#fff', fontSize: 12 },
  inputSection: { backgroundColor: '#fff', padding: 15, margin: 10, borderRadius: 15 },
  searchWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 10 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1 },
  dropdown: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, marginTop: 10, maxHeight: 200 },
  dropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  dropdownItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dropdownName: { fontSize: 16, fontWeight: '500' },
  dropdownStock: { fontSize: 12, color: '#666' },
  dropdownCategory: { fontSize: 10, color: '#1a73e8' },
  dropdownPrice: { fontSize: 16, color: '#1a73e8', fontWeight: 'bold' },
  dropdownActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  competitorCheckBtn: { backgroundColor: '#e8f0fe', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15 },
  competitorCheckBtnText: { fontSize: 12, color: '#1a73e8' },
  quantityRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  quantityWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 10, width: 100, justifyContent: 'space-between' },
  quantityInput: { width: 50, textAlign: 'center' },
  addButton: { flex: 1, backgroundColor: '#1a73e8', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  addButtonText: { color: '#fff', fontWeight: 'bold', padding: 12 },
  cartSection: { flex: 1, padding: 10 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold' },
  itemCount: { fontSize: 12, color: '#666' },
  discountSummaryBar: { backgroundColor: '#e6f4ea', padding: 8, borderRadius: 10, marginBottom: 10, alignItems: 'center' },
  discountSummaryText: { fontSize: 12, color: '#34a853', fontWeight: '600' },
  cartItem: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between' },
  cartItemInfo: { flex: 1 },
  cartItemName: { fontSize: 16, fontWeight: '500' },
  priceRowSmall: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  oldPrice: { fontSize: 12, textDecorationLine: 'line-through', color: '#999' },
  discountBadge: { backgroundColor: '#e67e22', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  discountBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  cartItemPrice: { fontSize: 12, color: '#666' },
  discountReason: { fontSize: 10, color: '#34a853' },
  stockIndicator: { fontSize: 10, color: '#999', marginTop: 2 },
  cartItemActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cartItemTotal: { fontSize: 14, fontWeight: 'bold', color: '#1a73e8' },
  actionBtn: { width: 28, height: 28, backgroundColor: '#f0f0f0', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  actionBtnText: { fontSize: 16, fontWeight: 'bold' },
  quantityText: { minWidth: 25, textAlign: 'center' },
  deleteBtn: { fontSize: 16, padding: 4 },
  emptyCartContainer: { alignItems: 'center', padding: 40 },
  emptyCartIcon: { fontSize: 50, marginBottom: 10 },
  emptyCart: { color: '#999' },
  emptyCartSub: { fontSize: 12, color: '#999', marginTop: 5 },
  totalSection: { backgroundColor: '#fff', padding: 20, borderTopWidth: 1, borderTopColor: '#ddd' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  totalLabel: { fontSize: 14, color: '#666' },
  totalAmount: { fontSize: 24, fontWeight: 'bold', color: '#1a73e8', textAlign: 'right', marginTop: 10 },
  originalAmount: { fontSize: 14, textDecorationLine: 'line-through', color: '#999' },
  discountAmount: { fontSize: 14, color: '#34a853', fontWeight: 'bold' },
  dividerLine: { height: 1, backgroundColor: '#ddd', marginVertical: 10 },
  proceedButton: { backgroundColor: '#34a853', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  proceedButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 20, width: '90%', maxHeight: '80%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 15, color: '#1a73e8' },
  modalProductName: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 15 },
  priceRowModal: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
  priceLabelModal: { fontSize: 14, color: '#666' },
  yourPriceModal: { fontSize: 16, fontWeight: 'bold', color: '#dc3545' },
  marketPriceModal: { fontSize: 16, fontWeight: 'bold', color: '#34a853' },
  marketSourceModal: { fontSize: 11, color: '#999' },
  websiteBtn: { backgroundColor: '#1a73e8', padding: 12, borderRadius: 10, marginTop: 15, alignItems: 'center' },
  websiteBtnText: { color: '#fff', fontWeight: '600' },
  aiBox: { backgroundColor: '#e8f0fe', padding: 15, borderRadius: 12, marginTop: 15, alignItems: 'center' },
  aiBoxTitle: { fontSize: 14, fontWeight: 'bold', color: '#1a73e8' },
  aiDiscount: { fontSize: 28, fontWeight: 'bold', color: '#e67e22', marginVertical: 5 },
  aiPrice: { fontSize: 20, fontWeight: 'bold', color: '#1a73e8' },
  aiSavings: { fontSize: 12, color: '#34a853', marginTop: 5 },
  aiReason: { fontSize: 11, color: '#666', marginTop: 8, textAlign: 'center' },
  closeBtn: { backgroundColor: '#1a73e8', padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 15 },
  closeBtnText: { color: '#fff', fontWeight: '600' },
  suggestionSubtitle: { fontSize: 12, color: '#666', marginBottom: 10, textAlign: 'center' },
  suggestionItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  suggestionLeft: { flex: 1 },
  suggestionName: { fontSize: 14, fontWeight: '500' },
  suggestionFrequency: { fontSize: 10, color: '#e67e22' },
  suggestionPrice: { fontSize: 14, fontWeight: 'bold', color: '#1a73e8' },
  addSuggestionBtn: { backgroundColor: '#e8f0fe', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15 },
  addSuggestionBtnText: { fontSize: 12, color: '#1a73e8', fontWeight: '500' },
  ignoreButton: { marginTop: 15, padding: 12, alignItems: 'center', backgroundColor: '#f0f0f0', borderRadius: 10 },
  ignoreButtonText: { color: '#666' },
  discountConfirmContainer: { alignItems: 'center' },
  confirmProductName: { fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
  confirmPriceRow: { flexDirection: 'row', gap: 15, marginBottom: 10 },
  confirmOriginalPrice: { fontSize: 16, textDecorationLine: 'line-through', color: '#999' },
  confirmNewPrice: { fontSize: 22, fontWeight: 'bold', color: '#e67e22' },
  confirmDiscountBadge: { backgroundColor: '#e67e22', paddingHorizontal: 15, paddingVertical: 5, borderRadius: 20, marginBottom: 10 },
  confirmDiscountText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  confirmSavings: { fontSize: 14, color: '#34a853', fontWeight: 'bold', marginBottom: 8 },
  confirmReason: { fontSize: 12, color: '#666', textAlign: 'center', marginBottom: 20 },
  confirmButtons: { flexDirection: 'row', gap: 10, width: '100%' },
  confirmYesBtn: { flex: 1, backgroundColor: '#34a853', padding: 12, borderRadius: 10, alignItems: 'center' },
  confirmYesBtnText: { color: '#fff', fontWeight: 'bold' },
  confirmNoBtn: { flex: 1, backgroundColor: '#dc3545', padding: 12, borderRadius: 10, alignItems: 'center' },
  confirmNoBtnText: { color: '#fff', fontWeight: 'bold' },
  modalInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, marginBottom: 10 },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 10 },
  saveBtn: { flex: 1, backgroundColor: '#34a853', padding: 12, borderRadius: 10, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: 'bold' },
  cancelBtn: { flex: 1, backgroundColor: '#dc3545', padding: 12, borderRadius: 10, alignItems: 'center' },
  cancelBtnText: { color: '#fff', fontWeight: 'bold' },
});