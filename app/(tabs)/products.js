// app/(tabs)/products.js - SINGLE HEADING

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  Modal,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  Animated,
  Keyboard
} from 'react-native';
import {
  getProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  getUserRole,
  saveBill,
  fetchMarketPrice,
  calculateAIDynamicDiscount,
  updateProductPrice
} from '../../config/firebase';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function Products() {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [stock, setStock] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState('customer');
  const [cart, setCart] = useState([]);
  const [showCartModal, setShowCartModal] = useState(false);
  const [newProductId, setNewProductId] = useState(null);
  
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiData, setAiData] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  useFocusEffect(
    useCallback(() => {
      loadProducts();
      loadUserRole();
    }, [])
  );

  useEffect(() => {
    if (newProductId) {
      const timer = setTimeout(() => {
        setNewProductId(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [newProductId]);

  useEffect(() => {
    if (searchText.trim() === '') {
      setFilteredProducts(products);
    } else {
      const searchLower = searchText.toLowerCase().trim();
      const filtered = products.filter(p => 
        p.name.toLowerCase().includes(searchLower) ||
        (p.category && p.category.toLowerCase().includes(searchLower))
      );
      setFilteredProducts(filtered);
    }
  }, [searchText, products]);

  const loadUserRole = async () => {
    const result = await getUserRole();
    if (result.success) {
      setUserRole(result.role);
    }
  };

  const loadProducts = async () => {
    setLoading(true);
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
    } else {
      Alert.alert('Error', result.error);
    }
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProducts();
    setSearchText('');
    setRefreshing(false);
  };

  const formatPrice = (amount) => {
    return `₨ ${amount?.toLocaleString('en-PK') || 0}`;
  };

  const openAIAnalysis = async (product) => {
    setSelectedProduct(product);
    setAiLoading(true);
    setShowAIModal(true);
    
    try {
      const discountInfo = await calculateAIDynamicDiscount(product);
      const marketData = await fetchMarketPrice(product.name, product.category);
      
      setAiData({
        productName: product.name,
        currentPrice: product.price,
        currentDiscount: product.discountPercent || 0,
        currentDiscountedPrice: product.discountedPrice || product.price,
        marketPrice: marketData.marketPrice,
        marketSource: marketData.source || 'Daraz.pk',
        marketUrl: marketData.url,
        suggestedDiscount: discountInfo.discount,
        suggestedPrice: discountInfo.discountedPrice,
        savings: discountInfo.savings,
        reason: discountInfo.reason,
        productId: product.id,
        darazLink: marketData.url
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch AI analysis');
    } finally {
      setAiLoading(false);
    }
  };

  const applyAIDiscount = async () => {
    if (!aiData || !selectedProduct) return;
    
    const discountPercent = aiData.suggestedDiscount;
    const currentPrice = aiData.currentPrice;
    
    setLoading(true);
    
    try {
      const result = await updateProductPrice(selectedProduct.id, currentPrice, true, discountPercent);
      
      if (result.success) {
        Alert.alert('✅ AI Discount Applied!');
        setShowAIModal(false);
        loadProducts();
      } else {
        Alert.alert('Error', result.error || 'Failed to apply discount');
      }
    } catch (error) {
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const openDarazLink = (url) => {
    if (url) {
      Alert.alert('Daraz Price Check', `Visit Daraz.pk to compare prices:\n${url}`);
    }
  };

  const addToCart = (product) => {
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
          total: finalPrice * qty
        }];
      }
    });

    Alert.alert('✅ Added!', `${product.name} added to cart`);
  };

  const removeFromCart = (itemId) => {
    setCart(cart.filter(i => i.id !== itemId));
  };

  const updateQuantity = (itemId, newQuantity) => {
    if (newQuantity < 1) {
      removeFromCart(itemId);
      return;
    }
    const item = cart.find(i => i.id === itemId);
    if (item) {
      setCart(cart.map(i => i.id === itemId ? { ...i, quantity: newQuantity, total: i.price * newQuantity } : i));
    }
  };

  const getCartTotal = () => {
    return cart.reduce((sum, item) => sum + item.total, 0);
  };

  const placeOrder = async () => {
    if (cart.length === 0) {
      Alert.alert('Error', 'Cart is empty');
      return;
    }

    const subtotal = getCartTotal();
    const tax = subtotal * 0.05;
    const totalWithTax = subtotal + tax;

    Alert.alert(
      'Confirm Order',
      `Items: ${cart.length}\nSubtotal: ${formatPrice(subtotal)}\nTax (5%): ${formatPrice(tax)}\nTotal: ${formatPrice(totalWithTax)}`,
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
              Alert.alert('✅ Order Placed!', `Order #${result.billNumber}\nTotal: ${formatPrice(totalWithTax)}`);
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

  const saveProduct = async () => {
    if (!name || !price) {
      Alert.alert('Error', 'Please enter name and price');
      return;
    }

    const priceValue = parseFloat(price);
    if (isNaN(priceValue) || priceValue <= 0) {
      Alert.alert('Error', 'Please enter a valid price');
      return;
    }

    const productData = {
      name: name.trim(),
      price: priceValue,
      category: category.trim() || 'General',
      stock: parseInt(stock) || 0,
    };

    setLoading(true);

    let result;
    if (editingProduct) {
      result = await updateProduct(editingProduct.id, productData);
      if (result.success) {
        Alert.alert('Success', 'Product updated!');
      }
    } else {
      result = await addProduct(productData);
      if (result.success) {
        setNewProductId(result.id);
        Alert.alert('✅ Success!', 'New product added!');
      }
    }

    if (result.success) {
      setModalVisible(false);
      resetForm();
      await loadProducts();
    } else {
      Alert.alert('Error', result.error || 'Failed to save product');
    }
    setLoading(false);
  };

  const deleteProductItem = async (id) => {
    Alert.alert('Confirm', 'Delete this product?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          const result = await deleteProduct(id);
          if (result.success) {
            await loadProducts();
            Alert.alert('Success', 'Product deleted');
          } else {
            Alert.alert('Error', result.error);
          }
          setLoading(false);
        }
      }
    ]);
  };

  const resetForm = () => {
    setName('');
    setPrice('');
    setCategory('');
    setStock('');
    setEditingProduct(null);
  };

  const editProduct = (product) => {
    setEditingProduct(product);
    setName(product.name);
    setPrice((product.pricePKR || product.price).toString());
    setCategory(product.category || 'General');
    setStock((product.stock || 0).toString());
    setModalVisible(true);
  };

  const renderShopkeeperProduct = ({ item }) => {
    const hasDiscount = (item.discountPercent || 0) > 0;
    const finalPrice = hasDiscount ? item.discountedPrice : item.price;
    const originalPrice = item.price;
    const isNewProduct = newProductId === item.id;
    
    return (
      <Animated.View style={[styles.productCard, isNewProduct && styles.newProductHighlight]}>
        {isNewProduct && (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>✨ NEW</Text>
          </View>
        )}
        <View style={styles.productInfo}>
          <Text style={[styles.productName, isNewProduct && styles.whiteText]}>{item.name}</Text>
          <Text style={[styles.productCategory, isNewProduct && styles.whiteLight]}>{item.category}</Text>
          
          <View style={styles.priceRow}>
            {hasDiscount ? (
              <>
                <Text style={[styles.oldPrice, isNewProduct && styles.whiteLight]}>{formatPrice(originalPrice)}</Text>
                <Text style={[styles.price, isNewProduct && styles.goldPrice]}>{formatPrice(finalPrice)}</Text>
                <View style={styles.discountChip}>
                  <Text style={styles.discountChipText}>-{item.discountPercent}%</Text>
                </View>
              </>
            ) : (
              <Text style={[styles.price, isNewProduct && styles.goldPrice]}>{formatPrice(finalPrice)}</Text>
            )}
          </View>
          
          <Text style={[styles.stockText, isNewProduct && styles.whiteLight]}>📦 Stock: {item.stock || 0}</Text>
          <Text style={[styles.salesText, isNewProduct && styles.whiteLight]}>📊 Sales: {item.salesCount || 0}</Text>
        </View>
        
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.aiButton} onPress={() => openAIAnalysis(item)}>
            <Ionicons name="bulb-outline" size={14} color="#e67e22" />
            <Text style={styles.aiButtonText}>AI</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.editButton} onPress={() => editProduct(item)}>
            <Ionicons name="create-outline" size={14} color="#1a73e8" />
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  const renderCustomerProduct = ({ item }) => {
    const hasDiscount = (item.discountPercent || 0) > 0;
    const finalPrice = hasDiscount ? item.discountedPrice : item.price;
    const originalPrice = item.price;

    return (
      <TouchableOpacity style={styles.customerProductCard} onPress={() => addToCart(item)} activeOpacity={0.7}>
        <View style={styles.customerProductInfo}>
          <Text style={styles.customerProductName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.customerCategory}>{item.category}</Text>
          
          <View style={styles.customerPriceRow}>
            {hasDiscount ? (
              <>
                <Text style={styles.customerOldPrice}>{formatPrice(originalPrice)}</Text>
                <Text style={styles.customerPrice}>{formatPrice(finalPrice)}</Text>
                <View style={styles.customerDiscountChip}>
                  <Text style={styles.customerDiscountText}>-{item.discountPercent}%</Text>
                </View>
              </>
            ) : (
              <Text style={styles.customerPrice}>{formatPrice(finalPrice)}</Text>
            )}
          </View>
          
          <Text style={styles.customerStock}>📦 Stock: {item.stock || 0}</Text>
        </View>
        <View style={styles.addToCartIcon}>
          <Ionicons name="add" size={22} color="#fff" />
        </View>
      </TouchableOpacity>
    );
  };

  const renderCartModal = () => (
    <Modal visible={showCartModal} transparent={true} animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.cartModal}>
          <View style={styles.cartHeader}>
            <Text style={styles.cartTitle}>🛒 Your Cart ({cart.length})</Text>
            <TouchableOpacity onPress={() => setShowCartModal(false)}>
              <Ionicons name="close" size={24} color="#999" />
            </TouchableOpacity>
          </View>

          {cart.length === 0 ? (
            <View style={styles.emptyCart}>
              <Ionicons name="cart-outline" size={60} color="#ccc" />
              <Text style={styles.emptyCartText}>Cart is empty</Text>
            </View>
          ) : (
            <>
              <FlatList
                data={cart}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                  <View style={styles.cartItem}>
                    <View style={styles.cartItemLeft}>
                      <Text style={styles.cartItemName}>{item.name}</Text>
                      {item.discountPercent > 0 && (
                        <Text style={styles.cartItemDiscount}>-{item.discountPercent}% OFF</Text>
                      )}
                      <Text style={styles.cartItemPrice}>{formatPrice(item.price)} each</Text>
                    </View>
                    <View style={styles.cartItemRight}>
                      <TouchableOpacity onPress={() => updateQuantity(item.id, item.quantity - 1)} style={styles.qtyBtn}>
                        <Text style={styles.qtyBtnText}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.qtyText}>{item.quantity}</Text>
                      <TouchableOpacity onPress={() => updateQuantity(item.id, item.quantity + 1)} style={styles.qtyBtn}>
                        <Text style={styles.qtyBtnText}>+</Text>
                      </TouchableOpacity>
                      <Text style={styles.cartItemTotal}>{formatPrice(item.total)}</Text>
                      <TouchableOpacity onPress={() => removeFromCart(item.id)}>
                        <Ionicons name="trash-outline" size={18} color="#dc3545" />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              />
              <View style={styles.cartFooter}>
                <Text style={styles.cartSubtotal}>Subtotal: {formatPrice(getCartTotal())}</Text>
                <Text style={styles.cartTax}>Tax (5%): {formatPrice(getCartTotal() * 0.05)}</Text>
                <Text style={styles.cartTotalAmount}>Total: {formatPrice(getCartTotal() * 1.05)}</Text>
                <TouchableOpacity style={styles.checkoutButton} onPress={placeOrder}>
                  <Text style={styles.checkoutButtonText}>📦 Place Order</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );

  const renderAIModal = () => (
    <Modal visible={showAIModal} transparent={true} animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.aiModal}>
          <View style={styles.aiModalHeader}>
            <Ionicons name="bulb-outline" size={24} color="#e67e22" />
            <Text style={styles.aiModalTitle}>AI Price Analysis</Text>
            <TouchableOpacity onPress={() => setShowAIModal(false)}>
              <Ionicons name="close" size={24} color="#999" />
            </TouchableOpacity>
          </View>

          {aiLoading ? (
            <View style={styles.aiLoading}>
              <ActivityIndicator size="large" color="#1a73e8" />
              <Text style={styles.aiLoadingText}>Analyzing...</Text>
            </View>
          ) : aiData && (
            <ScrollView>
              <Text style={styles.aiProductName}>{aiData.productName}</Text>
              
              <View style={styles.comparisonBox}>
                <Text style={styles.sectionTitle}>💰 Price Comparison</Text>
                <View style={styles.compareRow}>
                  <Text>Your Price:</Text>
                  <Text style={styles.yourPrice}>{formatPrice(aiData.currentPrice)}</Text>
                </View>
                <View style={styles.compareRow}>
                  <Text>Daraz Price:</Text>
                  <Text style={styles.darazPrice}>{aiData.marketPrice ? formatPrice(aiData.marketPrice) : 'N/A'}</Text>
                </View>
              </View>

              <View style={styles.suggestionBox}>
                <Text style={styles.sectionTitle}>🎯 AI Suggestion</Text>
                <Text style={styles.aiReason}>{aiData.reason}</Text>
                <View style={styles.suggestionRow}>
                  <Text>Suggested Discount:</Text>
                  <Text style={styles.suggestedDiscount}>{aiData.suggestedDiscount}% OFF</Text>
                </View>
                <View style={styles.suggestionRow}>
                  <Text>Suggested Price:</Text>
                  <Text style={styles.suggestedPrice}>{formatPrice(aiData.suggestedPrice)}</Text>
                </View>
                
                <TouchableOpacity style={styles.applyButton} onPress={applyAIDiscount} disabled={loading}>
                  <Text style={styles.applyButtonText}>✓ Apply AI Discount</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );

  if (loading && products.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1a73e8" />
      </View>
    );
  }

  // SHOPKEEPER VIEW - Single Heading
  if (userRole === 'shopkeeper') {
    return (
      <View style={styles.container}>
        <View style={styles.shopHeader}>
          <Text style={styles.headerTitle}>📦 Products</Text>
          <TouchableOpacity style={styles.addButtonSmall} onPress={() => { resetForm(); setModalVisible(true); }}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.addButtonSmallText}>Add</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchBox}>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={20} color="#999" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search product..."
              placeholderTextColor="#aaa"
              value={searchText}
              onChangeText={setSearchText}
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => setSearchText('')}>
                <Ionicons name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <FlatList
          data={filteredProducts}
          keyExtractor={item => item.id}
          renderItem={renderShopkeeperProduct}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📦</Text>
              <Text style={styles.emptyText}>No products</Text>
            </View>
          }
        />

        <Modal visible={modalVisible} animationType="slide" transparent={true}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{editingProduct ? 'Edit Product' : 'Add Product'}</Text>
              <TextInput style={styles.modalInput} placeholder="Name" value={name} onChangeText={setName} />
              <TextInput style={styles.modalInput} placeholder="Price" value={price} onChangeText={setPrice} keyboardType="numeric" />
              <TextInput style={styles.modalInput} placeholder="Category" value={category} onChangeText={setCategory} />
              <TextInput style={styles.modalInput} placeholder="Stock" value={stock} onChangeText={setStock} keyboardType="numeric" />
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.saveModalBtn} onPress={saveProduct} disabled={loading}>
                  <Text style={styles.saveModalBtnText}>{loading ? 'Saving...' : 'Save'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelModalBtn} onPress={() => { setModalVisible(false); resetForm(); }}>
                  <Text style={styles.cancelModalBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {renderAIModal()}
      </View>
    );
  }

  // CUSTOMER VIEW - Single Heading with Cart
  return (
    <View style={styles.container}>
      <View style={styles.customerHeader}>
        <Text style={styles.headerTitle}>🛍️ Products</Text>
        <TouchableOpacity style={styles.cartButton} onPress={() => setShowCartModal(true)}>
          <Ionicons name="cart" size={24} color="#fff" />
          {cart.length > 0 && (
            <View style={styles.cartCount}>
              <Text style={styles.cartCountText}>{cart.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        data={products}
        keyExtractor={item => item.id}
        renderItem={renderCustomerProduct}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        numColumns={2}
        columnWrapperStyle={styles.productRow}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyText}>No products</Text>
          </View>
        }
      />

      {renderCartModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f7fa' },

  // Shopkeeper Header
  shopHeader: {
    backgroundColor: '#1a73e8',
    paddingTop: 55,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  customerHeader: {
    backgroundColor: '#1a73e8',
    paddingTop: 55,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },

  addButtonSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 25,
    gap: 6,
  },
  addButtonSmallText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },

  cartButton: { position: 'relative' },
  cartCount: { position: 'absolute', top: -8, right: -8, backgroundColor: '#dc3545', borderRadius: 12, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  cartCountText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

  searchBox: { paddingHorizontal: 15, paddingVertical: 12, backgroundColor: '#fff' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fafafa' },
  searchInput: { flex: 1, fontSize: 15 },

  productCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 15,
    marginBottom: 10,
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  newProductHighlight: { backgroundColor: '#28a745', borderWidth: 2, borderColor: '#1e7e34' },
  newBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: '#ffc107', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  newBadgeText: { color: '#333', fontSize: 10, fontWeight: 'bold' },
  whiteText: { color: '#fff' },
  whiteLight: { color: '#e8f0e8' },
  goldPrice: { color: '#ffd700', fontSize: 20 },

  productInfo: { flex: 1 },
  productName: { fontSize: 16, fontWeight: '600', color: '#333' },
  productCategory: { fontSize: 12, color: '#666', marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  oldPrice: { fontSize: 14, textDecorationLine: 'line-through', color: '#999' },
  price: { fontSize: 18, fontWeight: 'bold', color: '#1a73e8' },
  discountChip: { backgroundColor: '#e67e22', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  discountChipText: { fontSize: 10, color: '#fff', fontWeight: 'bold' },
  stockText: { fontSize: 11, color: '#888', marginTop: 4 },
  salesText: { fontSize: 11, color: '#34a853', marginTop: 2 },

  actionButtons: { flexDirection: 'row', gap: 8 },
  aiButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff3e0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, gap: 4 },
  aiButtonText: { color: '#e67e22', fontSize: 12 },
  editButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e8f0fe', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, gap: 4 },
  editButtonText: { color: '#1a73e8', fontSize: 12 },

  // Customer Product Card
  customerProductCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 6,
    padding: 12,
    width: (width - 48) / 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  customerProductInfo: { flex: 1 },
  customerProductName: { fontSize: 14, fontWeight: '600', color: '#333' },
  customerCategory: { fontSize: 10, color: '#666', marginTop: 2 },
  customerPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  customerOldPrice: { fontSize: 10, textDecorationLine: 'line-through', color: '#999' },
  customerPrice: { fontSize: 16, fontWeight: 'bold', color: '#1a73e8' },
  customerDiscountChip: { backgroundColor: '#e67e22', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 8 },
  customerDiscountText: { fontSize: 8, color: '#fff', fontWeight: 'bold' },
  customerStock: { fontSize: 10, color: '#888', marginTop: 4 },
  addToCartIcon: { width: 32, height: 32, backgroundColor: '#1a73e8', borderRadius: 16, alignItems: 'center', justifyContent: 'center' },

  productRow: { justifyContent: 'space-between', paddingHorizontal: 12 },
  listContent: { paddingVertical: 12, paddingBottom: 30 },

  // Cart Modal
  cartModal: { backgroundColor: '#fff', borderRadius: 24, padding: 20, width: '90%', maxHeight: '80%' },
  cartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  cartTitle: { fontSize: 18, fontWeight: 'bold', color: '#1a73e8' },
  emptyCart: { alignItems: 'center', paddingVertical: 50 },
  emptyCartText: { color: '#999', marginTop: 10 },
  cartItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  cartItemLeft: { marginBottom: 8 },
  cartItemName: { fontSize: 14, fontWeight: '500', color: '#333' },
  cartItemDiscount: { fontSize: 11, color: '#e67e22', marginTop: 2 },
  cartItemPrice: { fontSize: 11, color: '#666', marginTop: 2 },
  cartItemRight: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qtyBtn: { width: 28, height: 28, backgroundColor: '#f0f0f0', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { fontSize: 16, fontWeight: 'bold', color: '#666' },
  qtyText: { minWidth: 30, textAlign: 'center', fontSize: 14 },
  cartItemTotal: { fontSize: 14, fontWeight: 'bold', color: '#1a73e8', minWidth: 80, textAlign: 'right' },
  cartFooter: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e0e0e0' },
  cartSubtotal: { fontSize: 13, color: '#666', textAlign: 'right' },
  cartTax: { fontSize: 12, color: '#888', textAlign: 'right' },
  cartTotalAmount: { fontSize: 18, fontWeight: 'bold', color: '#1a73e8', textAlign: 'right', marginTop: 4 },
  checkoutButton: { backgroundColor: '#34a853', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  checkoutButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  // AI Modal
  aiModal: { backgroundColor: '#fff', borderRadius: 24, padding: 20, width: '90%', maxHeight: '85%' },
  aiModalHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20, justifyContent: 'space-between' },
  aiModalTitle: { fontSize: 18, fontWeight: 'bold', color: '#e67e22', flex: 1 },
  aiLoading: { alignItems: 'center', paddingVertical: 50 },
  aiLoadingText: { marginTop: 12, color: '#666' },
  aiProductName: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  comparisonBox: { backgroundColor: '#f8f9fa', padding: 15, borderRadius: 12, marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 12 },
  compareRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  yourPrice: { fontWeight: 'bold', color: '#dc3545' },
  darazPrice: { fontWeight: 'bold', color: '#34a853' },
  suggestionBox: { backgroundColor: '#e8f0fe', padding: 15, borderRadius: 12 },
  aiReason: { fontSize: 12, marginBottom: 15 },
  suggestionRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  suggestedDiscount: { fontWeight: 'bold', color: '#e67e22' },
  suggestedPrice: { fontWeight: 'bold', color: '#1a73e8' },
  applyButton: { backgroundColor: '#1a73e8', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  applyButtonText: { color: '#fff', fontWeight: 'bold' },

  emptyState: { alignItems: 'center', paddingVertical: 80 },
  emptyIcon: { fontSize: 64, opacity: 0.5 },
  emptyText: { color: '#999', fontSize: 16, marginTop: 16 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 24, padding: 24, width: '85%' },
  modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: '#1a73e8' },
  modalInput: { borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 14, padding: 14, marginBottom: 15, fontSize: 16 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 10 },
  saveModalBtn: { flex: 1, backgroundColor: '#34a853', padding: 14, borderRadius: 12, alignItems: 'center' },
  saveModalBtnText: { color: '#fff', fontWeight: 'bold' },
  cancelModalBtn: { flex: 1, backgroundColor: '#dc3545', padding: 14, borderRadius: 12, alignItems: 'center' },
  cancelModalBtnText: { color: '#fff', fontWeight: 'bold' },
});