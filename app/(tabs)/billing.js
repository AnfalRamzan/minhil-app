import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text, TextInput, TouchableOpacity,
  View
} from 'react-native';
import { addProduct, getAISuggestions, getLowSellingProducts, getProducts } from '../config/firebase';

// ============ DISCOUNT CALCULATION ENGINE ============
// This function would connect to your price comparison API
const getDynamicDiscount = async (productName, currentPrice, category) => {
  // Option 1: Local discount rules based on product analysis
  const localDiscounts = {
    // Electronics
    'laptop': { minDiscount: 5, maxDiscount: 15 },
    'mobile': { minDiscount: 3, maxDiscount: 12 },
    'headphone': { minDiscount: 8, maxDiscount: 20 },
    // Fashion
    'shirt': { minDiscount: 10, maxDiscount: 25 },
    'jeans': { minDiscount: 5, maxDiscount: 15 },
    'shoes': { minDiscount: 8, maxDiscount: 20 },
    // Grocery
    'rice': { minDiscount: 2, maxDiscount: 8 },
    'oil': { minDiscount: 3, maxDiscount: 10 },
    'sugar': { minDiscount: 1, maxDiscount: 5 },
  };

  // Find matching discount rule
  for (const [keyword, discountRange] of Object.entries(localDiscounts)) {
    if (productName.toLowerCase().includes(keyword)) {
      const discount = Math.floor(Math.random() * (discountRange.maxDiscount - discountRange.minDiscount + 1) + discountRange.minDiscount);
      return { discount, reason: `Market competitive pricing (${keyword} category)` };
    }
  }

  // Category-based discounts
  const categoryDiscounts = {
    'Electronics': 8,
    'Fashion': 12,
    'Grocery': 5,
    'General': 3
  };

  const discount = categoryDiscounts[category] || 3;
  return { discount, reason: `${category} category promotion` };
};

// Option 2: Mock API for price comparison (replace with real API)
const fetchCompetitorPrice = async (productName) => {
  // Mock competitor prices - In production, call your backend API
  const mockPrices = {
    'laptop': 45000,
    'mobile': 25000,
    'headphone': 1500,
    'shirt': 800,
    'jeans': 1200,
  };
  
  for (const [keyword, price] of Object.entries(mockPrices)) {
    if (productName.toLowerCase().includes(keyword)) {
      return { success: true, competitorPrice: price, source: 'Daraz.pk' };
    }
  }
  return { success: false, message: 'No competitor data found' };
};

const calculateBestDiscount = async (product) => {
  const productName = product.name;
  const currentPrice = product.pricePKR || product.price;
  const category = product.category || 'General';
  
  // Get dynamic discount based on product analysis
  const dynamicDiscount = await getDynamicDiscount(productName, currentPrice, category);
  
  // Try to get competitor pricing
  const competitorData = await fetchCompetitorPrice(productName);
  
  let finalDiscount = dynamicDiscount.discount;
  let discountReason = dynamicDiscount.reason;
  
  if (competitorData.success && competitorData.competitorPrice < currentPrice) {
    // Calculate discount needed to beat competitor
    const priceDiff = currentPrice - competitorData.competitorPrice;
    const requiredDiscountPercent = (priceDiff / currentPrice) * 100;
    finalDiscount = Math.max(finalDiscount, Math.ceil(requiredDiscountPercent) + 2);
    discountReason = `Price match with ${competitorData.source} (₹${competitorData.competitorPrice})`;
  }
  
  // Cap discount at 30%
  finalDiscount = Math.min(finalDiscount, 30);
  
  return {
    discount: finalDiscount,
    discountedPrice: currentPrice * (1 - finalDiscount / 100),
    originalPrice: currentPrice,
    reason: discountReason
  };
};

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
  const [offerProduct, setOfferProduct] = useState(null);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [quantityFocused, setQuantityFocused] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('');
  const [newProductStock, setNewProductStock] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [applyingDiscount, setApplyingDiscount] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    calculateTotal();
  }, [cart]);

  const calculateTotal = () => {
    const newTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const newOriginalTotal = cart.reduce((sum, item) => sum + ((item.originalPrice || item.price) * item.quantity), 0);
    const newDiscount = newOriginalTotal - newTotal;
    
    setTotal(newTotal);
    setOriginalTotal(newOriginalTotal);
    setTotalDiscount(newDiscount);
  };

  const loadData = async () => {
    setLoading(true);
    await loadProducts();
    await checkSpecialOffers();
    setLoading(false);
  };

  const loadProducts = async () => {
    const result = await getProducts();
    if (result.success) {
      setProducts(result.products);
      setFilteredProducts(result.products);
    } else {
      Alert.alert('Error', result.error);
    }
  };

  const checkSpecialOffers = async () => {
    const result = await getLowSellingProducts();
    if (result.success && result.lowSelling.length > 0) {
      const randomOffer = result.lowSelling[Math.floor(Math.random() * Math.min(3, result.lowSelling.length))];
      if (randomOffer && (randomOffer.salesCount || 0) < 8) {
        setOfferProduct({
          ...randomOffer,
          offerDiscount: 15,
          offerPrice: (randomOffer.pricePKR || randomOffer.price) * 0.85
        });
        setShowOfferModal(true);
      }
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const searchProduct = (text) => {
    setSearchText(text);
    if (text.trim() === '') {
      setFilteredProducts(products);
    } else {
      const filtered = products.filter(p => 
        p.name.toLowerCase().includes(text.toLowerCase())
      );
      setFilteredProducts(filtered);
    }
  };

  const addToCart = async (product, customQuantity = null) => {
    const qty = customQuantity || parseInt(quantity);
    if (isNaN(qty) || qty < 1) {
      Alert.alert('Error', 'Please enter valid quantity');
      return;
    }

    const availableStock = product.stock || 0;
    const existingItem = cart.find(item => item.id === product.id);
    const currentQty = existingItem ? existingItem.quantity : 0;
    
    if (currentQty + qty > availableStock) {
      Alert.alert('Stock Limit', `Only ${availableStock} items available in stock`);
      return;
    }

    setApplyingDiscount(true);
    
    // Calculate dynamic discount for this product
    let discountInfo = { discount: 0, discountedPrice: product.pricePKR || product.price, originalPrice: product.pricePKR || product.price, reason: '' };
    
    try {
      discountInfo = await calculateBestDiscount(product);
    } catch (error) {
      console.log('Discount calculation error:', error);
    }
    
    const finalPrice = discountInfo.discountedPrice;
    const originalPrice = discountInfo.originalPrice;
    const discountPercent = discountInfo.discount;
    const discountReason = discountInfo.reason;
    
    if (existingItem) {
      const newQuantity = existingItem.quantity + qty;
      setCart(cart.map(item => 
        item.id === product.id 
          ? { 
              ...item, 
              quantity: newQuantity, 
              total: finalPrice * newQuantity,
              price: finalPrice,
              originalPrice: originalPrice,
              discount: discountPercent,
              discountReason: discountReason
            }
          : item
      ));
    } else {
      setCart([...cart, {
        id: product.id,
        name: product.name,
        price: finalPrice,
        originalPrice: originalPrice,
        quantity: qty,
        total: finalPrice * qty,
        discount: discountPercent,
        discountReason: discountReason,
        stock: product.stock || 0,
        category: product.category || 'General'
      }]);
    }

    // Show discount alert if applicable
    if (discountPercent > 0) {
      Alert.alert(
        '🎉 Discount Applied!',
        `${discountPercent}% OFF on ${product.name}\nReason: ${discountReason}`,
        [{ text: 'Great!', style: 'default' }]
      );
    }

    setSearchText('');
    setQuantity('1');
    setFilteredProducts(products);
    setSelectedProduct(null);
    setApplyingDiscount(false);
    
    getAISuggestionsForProduct(product);
  };

  const getAISuggestionsForProduct = async (currentProduct) => {
    const result = await getAISuggestions(currentProduct.id, cart);
    if (result.success && result.suggestions.length > 0) {
      setSuggestions(result.suggestions);
      setShowSuggestionModal(true);
    }
  };

  const addSuggestionToCart = (product) => {
    addToCart(product, 1);
    setShowSuggestionModal(false);
  };

  const removeFromCart = (itemId) => {
    setCart(cart.filter(item => item.id !== itemId));
  };

  const updateQuantity = (itemId, newQuantity) => {
    if (newQuantity < 1) {
      removeFromCart(itemId);
      return;
    }
    const item = cart.find(i => i.id === itemId);
    const productStock = item.stock;
    
    if (newQuantity > productStock) {
      Alert.alert('Stock Limit', `Only ${productStock} items available`);
      return;
    }
    
    const newTotal = newQuantity * item.price;
    setCart(cart.map(i => 
      i.id === itemId ? { ...i, quantity: newQuantity, total: newTotal } : i
    ));
  };

  const proceedToBill = () => {
    if (cart.length === 0) {
      Alert.alert('Error', 'Cart is empty');
      return;
    }
    
    // Pass discount info to bill summary
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

  const applyOffer = () => {
    if (offerProduct) {
      addToCart(offerProduct, 1);
      setShowOfferModal(false);
    }
  };

  const addNewProduct = async () => {
    if (!newProductName || !newProductPrice) {
      Alert.alert('Error', 'Please enter product name and price');
      return;
    }

    const result = await addProduct({
      name: newProductName,
      price: parseFloat(newProductPrice),
      category: newProductCategory || 'General',
      stock: parseInt(newProductStock) || 0
    });

    if (result.success) {
      Alert.alert('Success', `${newProductName} added successfully!`);
      setShowAddProductModal(false);
      setNewProductName('');
      setNewProductPrice('');
      setNewProductCategory('');
      setNewProductStock('');
      await loadProducts();
    } else {
      Alert.alert('Error', result.error);
    }
  };

  const selectProduct = (product) => {
    setSelectedProduct(product);
    setSearchText(product.name);
    setFilteredProducts([]);
  };

  const formatPrice = (amount) => {
    return `₨ ${amount?.toLocaleString('en-PK') || 0}`;
  };

  const renderCartItem = ({ item }) => (
    <View style={styles.cartItem}>
      <View style={styles.cartItemInfo}>
        <Text style={styles.cartItemName}>{item.name}</Text>
        {item.discount > 0 ? (
          <View>
            <View style={styles.priceRowSmall}>
              <Text style={styles.oldPrice}>{formatPrice(item.originalPrice)}</Text>
              <View style={styles.discountBadge}>
                <Text style={styles.discountBadgeText}>-{item.discount}% OFF</Text>
              </View>
            </View>
            <Text style={styles.cartItemPrice}>{formatPrice(item.price)} x {item.quantity}</Text>
            <Text style={styles.discountReason}>{item.discountReason}</Text>
          </View>
        ) : (
          <Text style={styles.cartItemPrice}>{formatPrice(item.price)} x {item.quantity}</Text>
        )}
        <Text style={styles.stockIndicator}>📦 Stock: {item.stock}</Text>
      </View>
      <View style={styles.cartItemActions}>
        <Text style={styles.cartItemTotal}>{formatPrice(item.total)}</Text>
        <TouchableOpacity onPress={() => updateQuantity(item.id, item.quantity - 1)} style={styles.actionBtn}>
          <Text style={styles.actionBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.quantityText}>{item.quantity}</Text>
        <TouchableOpacity onPress={() => updateQuantity(item.id, item.quantity + 1)} style={styles.actionBtn}>
          <Text style={styles.actionBtnText}>+</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => removeFromCart(item.id)}>
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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🧾 Smart Billing</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.quickAddBtn} onPress={() => setShowAddProductModal(true)}>
            <Text style={styles.quickAddBtnText}>+</Text>
          </TouchableOpacity>
          <View style={styles.currencyPill}>
            <Text style={styles.currencyPillText}>PKR</Text>
          </View>
        </View>
      </View>

      {/* Input Section */}
      <View style={styles.inputSection}>
        <View style={[styles.searchWrapper, searchFocused && styles.searchFocused]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search product..."
            placeholderTextColor="#aaa"
            value={searchText}
            onChangeText={searchProduct}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
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
                  <View>
                    <Text style={styles.dropdownName}>{product.name}</Text>
                    <Text style={styles.dropdownStock}>📦 Stock: {product.stock || 0}</Text>
                  </View>
                  <View>
                    {product.discount > 0 ? (
                      <View>
                        <Text style={styles.dropdownOldPrice}>{formatPrice(product.pricePKR || product.price)}</Text>
                        <Text style={styles.dropdownPrice}>{formatPrice(product.discountedPrice)}</Text>
                      </View>
                    ) : (
                      <Text style={styles.dropdownPrice}>{formatPrice(product.pricePKR || product.price)}</Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
        
        <View style={styles.quantityRow}>
          <View style={[styles.quantityWrapper, quantityFocused && styles.quantityFocused]}>
            <Text style={styles.quantityLabel}>Qty:</Text>
            <TextInput
              style={styles.quantityInput}
              value={quantity}
              onChangeText={setQuantity}
              onFocus={() => setQuantityFocused(true)}
              onBlur={() => setQuantityFocused(false)}
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
                Alert.alert('Error', 'Please search a product first');
              }
            }}
          >
            <Text style={styles.addButtonText}>
              {applyingDiscount ? 'Checking discounts...' : 'Add to Cart'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Cart Section */}
      <View style={styles.cartSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🛒 Current Bill</Text>
          <Text style={styles.itemCount}>{cart.length} items</Text>
        </View>
        
        {/* Discount Summary Bar */}
        {totalDiscount > 0 && (
          <View style={styles.discountSummaryBar}>
            <Text style={styles.discountSummaryText}>🎉 Total Savings: {formatPrice(totalDiscount)}</Text>
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

      {/* Total Section with Discount Breakdown */}
      <View style={styles.totalSection}>
        {originalTotal > total && (
          <>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Original Amount:</Text>
              <Text style={styles.originalAmount}>{formatPrice(originalTotal)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Discount:</Text>
              <Text style={styles.discountAmount}>-{formatPrice(totalDiscount)}</Text>
            </View>
            <View style={styles.dividerLine} />
          </>
        )}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Final Amount:</Text>
          <Text style={styles.totalAmount}>{formatPrice(total)}</Text>
        </View>
        <TouchableOpacity style={styles.proceedButton} onPress={proceedToBill}>
          <Text style={styles.proceedButtonText}>Proceed to Bill →</Text>
        </TouchableOpacity>
      </View>

      {/* AI Suggestion Modal */}
      <Modal visible={showSuggestionModal} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalIcon}>🧠</Text>
              <Text style={styles.modalTitle}>AI Smart Suggestion</Text>
            </View>
            <Text style={styles.modalSubtitle}>Customers also bought:</Text>
            {suggestions.map(product => (
              <TouchableOpacity 
                key={product.id}
                style={styles.suggestionItem}
                onPress={() => addSuggestionToCart(product)}
              >
                <Text style={styles.suggestionName}>{product.name}</Text>
                <Text style={styles.suggestionPrice}>{formatPrice(product.discountedPrice || product.pricePKR || product.price)}</Text>
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

      {/* Special Offer Modal (Discount Suggestion) */}
      <Modal visible={showOfferModal} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.offerModal]}>
            <Text style={styles.offerEmoji}>🎉</Text>
            <Text style={styles.offerTitle}>Special Offer!</Text>
            <Text style={styles.offerText}>Get {offerProduct?.offerDiscount}% OFF on</Text>
            <Text style={styles.offerProductName}>{offerProduct?.name}</Text>
            <View style={styles.offerPriceRow}>
              <Text style={styles.offerOldPrice}>{formatPrice(offerProduct?.pricePKR || offerProduct?.price)}</Text>
              <Text style={styles.offerNewPrice}>{formatPrice(offerProduct?.offerPrice)}</Text>
            </View>
            <View style={styles.offerButtons}>
              <TouchableOpacity style={styles.offerAddBtn} onPress={applyOffer}>
                <Text style={styles.offerAddBtnText}>Add to Cart</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.offerDismissBtn} onPress={() => setShowOfferModal(false)}>
                <Text style={styles.offerDismissBtnText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Quick Add Product Modal */}
      <Modal visible={showAddProductModal} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Quick Add Product</Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder="Product Name"
              placeholderTextColor="#aaa"
              value={newProductName}
              onChangeText={setNewProductName}
            />
            
            <TextInput
              style={styles.modalInput}
              placeholder="Price (PKR)"
              placeholderTextColor="#aaa"
              value={newProductPrice}
              onChangeText={setNewProductPrice}
              keyboardType="numeric"
            />
            
            <TextInput
              style={styles.modalInput}
              placeholder="Category (optional)"
              placeholderTextColor="#aaa"
              value={newProductCategory}
              onChangeText={setNewProductCategory}
            />
            
            <TextInput
              style={styles.modalInput}
              placeholder="Stock (optional)"
              placeholderTextColor="#aaa"
              value={newProductStock}
              onChangeText={setNewProductStock}
              keyboardType="numeric"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.saveBtn} onPress={addNewProduct}>
                <Text style={styles.saveBtnText}>Add Product</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => {
                setShowAddProductModal(false);
                setNewProductName('');
                setNewProductPrice('');
                setNewProductCategory('');
                setNewProductStock('');
              }}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 12,
    backgroundColor: '#1a73e8',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quickAddBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickAddBtnText: {
    fontSize: 22,
    color: '#fff',
    fontWeight: 'bold',
  },
  currencyPill: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  currencyPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  inputSection: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  searchFocused: {
    borderColor: '#1a73e8',
    backgroundColor: '#fff',
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 10,
    color: '#888',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: '#333',
  },
  dropdown: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 14,
    marginTop: 5,
    marginBottom: 12,
    backgroundColor: '#fff',
    maxHeight: 220,
    elevation: 3,
  },
  dropdownItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
    marginBottom: 3,
  },
  dropdownStock: {
    fontSize: 11,
    color: '#888',
  },
  dropdownOldPrice: {
    fontSize: 12,
    textDecorationLine: 'line-through',
    color: '#999',
    textAlign: 'right',
  },
  dropdownPrice: {
    fontSize: 15,
    color: '#1a73e8',
    fontWeight: 'bold',
  },
  quantityRow: {
    flexDirection: 'row',
    gap: 12,
  },
  quantityWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    paddingHorizontal: 14,
    width: 110,
  },
  quantityFocused: {
    borderColor: '#1a73e8',
    backgroundColor: '#fff',
  },
  quantityLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  quantityInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    textAlign: 'center',
    color: '#333',
  },
  addButton: {
    flex: 1,
    backgroundColor: '#1a73e8',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  cartSection: {
    flex: 1,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  itemCount: {
    fontSize: 13,
    color: '#888',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  discountSummaryBar: {
    backgroundColor: '#e6f4ea',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  discountSummaryText: {
    fontSize: 13,
    color: '#34a853',
    fontWeight: '600',
  },
  cartItem: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cartItemInfo: {
    flex: 1,
  },
  cartItemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  cartItemPrice: {
    color: '#666',
    fontSize: 13,
  },
  stockIndicator: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
  priceRowSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  oldPrice: {
    fontSize: 11,
    textDecorationLine: 'line-through',
    color: '#999',
  },
  discountBadge: {
    backgroundColor: '#e67e22',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  discountBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  discountReason: {
    fontSize: 9,
    color: '#34a853',
    marginTop: 2,
  },
  cartItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cartItemTotal: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1a73e8',
    marginRight: 8,
  },
  actionBtn: {
    width: 32,
    height: 32,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a73e8',
  },
  quantityText: {
    fontSize: 14,
    minWidth: 30,
    textAlign: 'center',
    fontWeight: '500',
    color: '#333',
  },
  deleteBtn: {
    fontSize: 18,
    padding: 6,
  },
  emptyCartContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyCartIcon: {
    fontSize: 60,
    marginBottom: 16,
    opacity: 0.5,
  },
  emptyCart: {
    textAlign: 'center',
    color: '#999',
    fontSize: 16,
    marginBottom: 8,
  },
  emptyCartSub: {
    textAlign: 'center',
    color: '#bbb',
    fontSize: 13,
  },
  emptyCartContent: {
    flex: 1,
    justifyContent: 'center',
  },
  totalSection: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  totalAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a73e8',
  },
  originalAmount: {
    fontSize: 16,
    textDecorationLine: 'line-through',
    color: '#999',
  },
  discountAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#34a853',
  },
  dividerLine: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 10,
  },
  proceedButton: {
    backgroundColor: '#34a853',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  proceedButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    width: '90%',
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  modalIcon: {
    fontSize: 28,
    marginRight: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#333',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  suggestionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  suggestionName: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
    color: '#333',
  },
  suggestionPrice: {
    fontSize: 14,
    color: '#1a73e8',
    fontWeight: 'bold',
    marginHorizontal: 12,
  },
  addSuggestionBtn: {
    backgroundColor: '#e8f0fe',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  addSuggestionBtnText: {
    color: '#1a73e8',
    fontWeight: 'bold',
    fontSize: 12,
  },
  ignoreButton: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    alignItems: 'center',
  },
  ignoreButtonText: {
    color: '#666',
    fontSize: 14,
  },
  offerModal: {
    alignItems: 'center',
  },
  offerEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  offerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e67e22',
    marginBottom: 8,
  },
  offerText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  offerProductName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  offerPriceRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  offerOldPrice: {
    fontSize: 16,
    textDecorationLine: 'line-through',
    color: '#999',
  },
  offerNewPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#e67e22',
  },
  offerButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  offerAddBtn: {
    flex: 1,
    backgroundColor: '#34a853',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  offerAddBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  offerDismissBtn: {
    flex: 1,
    backgroundColor: '#dc3545',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  offerDismissBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    fontSize: 15,
    backgroundColor: '#fafafa',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: '#34a853',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#dc3545',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});