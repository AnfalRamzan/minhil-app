// app/(tabs)/products.js - COMPLETE WITH AI SUGGESTIONS

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
  ScrollView
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
  const [flatListKey, setFlatListKey] = useState('customer');
  
  // AI Compare Modal
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

  const loadUserRole = async () => {
    const result = await getUserRole();
    if (result.success) {
      const role = result.role;
      setUserRole(role);
      setFlatListKey(role === 'shopkeeper' ? 'shopkeeper' : 'customer');
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
    } else {
      Alert.alert('Error', result.error);
    }
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProducts();
    setRefreshing(false);
  };

  const formatPrice = (amount) => {
    return `₨ ${amount?.toLocaleString('en-PK') || 0}`;
  };

  // ================= AI SUGGESTIONS & COMPARE =================
  const openAIAnalysis = async (product) => {
    setSelectedProduct(product);
    setAiLoading(true);
    setShowAIModal(true);
    
    try {
      // Get AI discount suggestion
      const discountInfo = await calculateAIDynamicDiscount(product);
      // Get market price
      const marketData = await fetchMarketPrice(product.name, product.category);
      
      setAiData({
        productName: product.name,
        currentPrice: product.price,
        currentDiscount: product.discountPercent || 0,
        currentDiscountedPrice: product.discountedPrice || product.price,
        marketPrice: marketData.marketPrice,
        marketSource: marketData.source || 'Market Data',
        marketUrl: marketData.url,
        suggestedDiscount: discountInfo.discount,
        suggestedPrice: discountInfo.discountedPrice,
        savings: discountInfo.savings,
        reason: discountInfo.reason,
        productId: product.id
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
    const result = await updateProductPrice(selectedProduct.id, currentPrice, true, discountPercent);
    
    if (result.success) {
      Alert.alert(
        '✅ AI Discount Applied!',
        `Product: ${selectedProduct.name}\n\n` +
        `Original Price: ${formatPrice(currentPrice)}\n` +
        `Discount: ${discountPercent}% OFF\n` +
        `New Price: ${formatPrice(aiData.suggestedPrice)}\n` +
        `You Save: ${formatPrice(aiData.savings)}`,
        [{ text: 'OK', onPress: () => {
          setShowAIModal(false);
          loadProducts();
        }}]
      );
    } else {
      Alert.alert('Error', result.error || 'Failed to apply discount');
    }
    setLoading(false);
  };

  // ================= ADD TO CART =================
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

    Alert.alert('✅ Added to Cart!', `${product.name} added to your cart`);
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
    } else {
      result = await addProduct(productData);
    }

    if (result.success) {
      Alert.alert('Success', editingProduct ? 'Product updated!' : 'Product added!');
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

  // ================= SHOPKEEPER PRODUCT CARD =================
  const renderShopkeeperProduct = ({ item }) => {
    const hasDiscount = (item.discountPercent || 0) > 0;
    const finalPrice = hasDiscount ? item.discountedPrice : item.price;
    const originalPrice = item.price;
    
    return (
      <View style={styles.shopkeeperProductCard}>
        <View style={styles.productInfo}>
          <Text style={styles.productName}>{item.name}</Text>
          <Text style={styles.productCategory}>📁 {item.category}</Text>
          
          <View style={styles.priceContainer}>
            {hasDiscount ? (
              <>
                <Text style={styles.originalPrice}>{formatPrice(originalPrice)}</Text>
                <Text style={styles.discountedPrice}>{formatPrice(finalPrice)}</Text>
                <View style={styles.discountBadge}>
                  <Text style={styles.discountBadgeText}>-{item.discountPercent}%</Text>
                </View>
              </>
            ) : (
              <Text style={styles.normalPrice}>{formatPrice(finalPrice)}</Text>
            )}
          </View>
          
          <Text style={styles.productStock}>📦 Stock: {item.stock || 0}</Text>
          <Text style={styles.productSales}>📊 Sales: {item.salesCount || 0}</Text>
        </View>
        
        <View style={styles.shopkeeperActions}>
          <TouchableOpacity style={styles.aiBtn} onPress={() => openAIAnalysis(item)}>
            <Ionicons name="bulb-outline" size={16} color="#e67e22" />
            <Text style={styles.aiBtnText}>AI Suggest</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.editBtn} onPress={() => editProduct(item)}>
            <Ionicons name="create-outline" size={16} color="#1a73e8" />
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ================= CUSTOMER PRODUCT CARD =================
  const renderCustomerProduct = ({ item }) => {
    const hasDiscount = (item.discountPercent || 0) > 0;
    const finalPrice = hasDiscount ? item.discountedPrice : item.price;
    const originalPrice = item.price;

    return (
      <TouchableOpacity
        style={styles.customerProductCard}
        onPress={() => addToCart(item)}
        activeOpacity={0.7}
      >
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
          
          <View style={styles.priceContainer}>
            {hasDiscount ? (
              <>
                <Text style={styles.customerOriginalPrice}>{formatPrice(originalPrice)}</Text>
                <Text style={styles.customerDiscountedPrice}>{formatPrice(finalPrice)}</Text>
                <View style={styles.customerDiscountBadge}>
                  <Text style={styles.customerDiscountBadgeText}>-{item.discountPercent}%</Text>
                </View>
              </>
            ) : (
              <Text style={styles.customerNormalPrice}>{formatPrice(finalPrice)}</Text>
            )}
          </View>
          
          <Text style={styles.productStock}>📦 Stock: {item.stock || 0}</Text>
        </View>
        <View style={styles.addIcon}>
          <Ionicons name="add" size={24} color="#fff" />
        </View>
      </TouchableOpacity>
    );
  };

  // ================= CART MODAL =================
  const renderCartModal = () => (
    <Modal visible={showCartModal} transparent={true} animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.cartModalContent}>
          <View style={styles.cartModalHeader}>
            <Text style={styles.cartModalTitle}>🛒 Your Cart ({cart.length})</Text>
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
                    <View style={styles.cartItemInfo}>
                      <Text style={styles.cartItemName}>{item.name}</Text>
                      {item.discountPercent > 0 && (
                        <Text style={styles.cartItemDiscount}>-{item.discountPercent}% OFF</Text>
                      )}
                      <Text style={styles.cartItemPrice}>{formatPrice(item.price)} each</Text>
                    </View>
                    <View style={styles.cartItemControls}>
                      <TouchableOpacity onPress={() => updateQuantity(item.id, item.quantity - 1)} style={styles.cartQtyBtn}>
                        <Text style={styles.cartQtyBtnText}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.cartQtyText}>{item.quantity}</Text>
                      <TouchableOpacity onPress={() => updateQuantity(item.id, item.quantity + 1)} style={styles.cartQtyBtn}>
                        <Text style={styles.cartQtyBtnText}>+</Text>
                      </TouchableOpacity>
                      <Text style={styles.cartItemTotal}>{formatPrice(item.total)}</Text>
                      <TouchableOpacity onPress={() => removeFromCart(item.id)}>
                        <Ionicons name="trash-outline" size={20} color="#dc3545" />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              />
              <View style={styles.cartFooter}>
                <Text style={styles.cartSubtotal}>Subtotal: {formatPrice(getCartTotal())}</Text>
                <Text style={styles.cartTax}>Tax (5%): {formatPrice(getCartTotal() * 0.05)}</Text>
                <Text style={styles.cartTotal}>Total: {formatPrice(getCartTotal() * 1.05)}</Text>
                <TouchableOpacity style={styles.checkoutBtn} onPress={placeOrder}>
                  <Text style={styles.checkoutBtnText}>📦 Place Order</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );

  // ================= AI SUGGESTIONS MODAL =================
  const renderAIModal = () => (
    <Modal visible={showAIModal} transparent={true} animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.aiModalContent}>
          <View style={styles.aiModalHeader}>
            <Text style={styles.aiModalTitle}>🤖 AI Price Analysis</Text>
            <TouchableOpacity onPress={() => setShowAIModal(false)}>
              <Ionicons name="close" size={24} color="#999" />
            </TouchableOpacity>
          </View>

          {aiLoading ? (
            <View style={styles.aiLoadingContainer}>
              <ActivityIndicator size="large" color="#1a73e8" />
              <Text style={styles.aiLoadingText}>Analyzing market data...</Text>
            </View>
          ) : aiData && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.aiProductName}>{aiData.productName}</Text>
              
              <View style={styles.priceComparisonCard}>
                <Text style={styles.sectionSubtitle}>💰 Price Comparison</Text>
                <View style={styles.comparisonRow}>
                  <Text style={styles.comparisonLabel}>Your Price:</Text>
                  <Text style={styles.comparisonValue}>{formatPrice(aiData.currentPrice)}</Text>
                </View>
                {aiData.currentDiscount > 0 && (
                  <View style={styles.comparisonRow}>
                    <Text style={styles.comparisonLabel}>Current Discount:</Text>
                    <Text style={styles.comparisonDiscount}>{aiData.currentDiscount}% OFF</Text>
                  </View>
                )}
                <View style={styles.comparisonRow}>
                  <Text style={styles.comparisonLabel}>Market Average:</Text>
                  <Text style={styles.comparisonMarketPrice}>
                    {aiData.marketPrice ? formatPrice(aiData.marketPrice) : 'Not available'}
                  </Text>
                </View>
              </View>

              <View style={styles.aiSuggestionCard}>
                <Text style={styles.sectionSubtitle}>🎯 AI Suggestion</Text>
                <Text style={styles.aiReason}>{aiData.reason}</Text>
                <View style={styles.suggestionRow}>
                  <Text style={styles.suggestionLabel}>Suggested Discount:</Text>
                  <Text style={styles.suggestionDiscount}>{aiData.suggestedDiscount}% OFF</Text>
                </View>
                <View style={styles.suggestionRow}>
                  <Text style={styles.suggestionLabel}>Suggested Price:</Text>
                  <Text style={styles.suggestionPrice}>{formatPrice(aiData.suggestedPrice)}</Text>
                </View>
                <View style={styles.suggestionRow}>
                  <Text style={styles.suggestionLabel}>You Save:</Text>
                  <Text style={styles.suggestionSave}>{formatPrice(aiData.savings)}</Text>
                </View>
                
                <TouchableOpacity style={styles.applyAiBtn} onPress={applyAIDiscount} disabled={loading}>
                  <Text style={styles.applyAiBtnText}>
                    {loading ? 'Applying...' : '✓ Apply AI Discount'}
                  </Text>
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
        <Text style={styles.loadingText}>Loading products...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📦 Products</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>
            {userRole === 'shopkeeper' ? '🏪 Manage Products' : '🛒 Tap to Add'}
          </Text>
        </View>
        <Text style={styles.productCount}>{products.length} products</Text>
      </View>

      {/* Cart Icon for Customer */}
      {userRole === 'customer' && (
        <TouchableOpacity style={styles.cartIcon} onPress={() => setShowCartModal(true)}>
          <Ionicons name="cart" size={24} color="#1a73e8" />
          {cart.length > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cart.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      {/* Add New Product button - ONLY for SHOPKEEPER */}
      {userRole === 'shopkeeper' && (
        <TouchableOpacity style={styles.addButton} onPress={() => {
          resetForm();
          setModalVisible(true);
        }}>
          <Text style={styles.addButtonText}>➕ Add New Product</Text>
        </TouchableOpacity>
      )}

      {/* Products List */}
      <FlatList
        key={flatListKey}
        data={products}
        keyExtractor={item => item.id}
        renderItem={userRole === 'shopkeeper' ? renderShopkeeperProduct : renderCustomerProduct}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        numColumns={userRole === 'shopkeeper' ? 1 : 2}
        columnWrapperStyle={userRole === 'customer' && styles.productRow}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyText}>No products found</Text>
            {userRole === 'shopkeeper' && (
              <Text style={styles.emptySubText}>Tap "Add New Product" to get started</Text>
            )}
          </View>
        }
      />

      {/* Cart Modal for Customer */}
      {renderCartModal()}
      
      {/* AI Suggestions Modal for Shopkeeper */}
      {renderAIModal()}

      {/* Add/Edit Product Modal - ONLY for SHOPKEEPER */}
      {userRole === 'shopkeeper' && (
        <Modal visible={modalVisible} animationType="slide" transparent={true}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {editingProduct ? '✏️ Edit Product' : '➕ Add New Product'}
              </Text>

              <TextInput
                style={styles.modalInput}
                placeholder="Product Name"
                placeholderTextColor="#aaa"
                value={name}
                onChangeText={setName}
              />

              <TextInput
                style={styles.modalInput}
                placeholder="Price (PKR)"
                placeholderTextColor="#aaa"
                value={price}
                onChangeText={setPrice}
                keyboardType="numeric"
              />

              <TextInput
                style={styles.modalInput}
                placeholder="Category"
                placeholderTextColor="#aaa"
                value={category}
                onChangeText={setCategory}
              />

              <TextInput
                style={styles.modalInput}
                placeholder="Stock Quantity"
                placeholderTextColor="#aaa"
                value={stock}
                onChangeText={setStock}
                keyboardType="numeric"
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.saveBtn} onPress={saveProduct} disabled={loading}>
                  <Text style={styles.saveBtnText}>
                    {loading ? 'Saving...' : (editingProduct ? 'Update' : 'Save')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => {
                  setModalVisible(false);
                  resetForm();
                }}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f7fa' },
  loadingText: { marginTop: 10, color: '#666' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0'
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1a73e8' },
  roleBadge: { backgroundColor: '#e8f0fe', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 15 },
  roleBadgeText: { fontSize: 10, color: '#1a73e8', fontWeight: '500' },
  productCount: { fontSize: 14, color: '#666', backgroundColor: '#f0f0f0', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },

  // Cart Icon
  cartIcon: { position: 'absolute', top: 70, right: 20, zIndex: 10, backgroundColor: '#fff', width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  cartBadge: { position: 'absolute', top: -5, right: -5, backgroundColor: '#dc3545', borderRadius: 12, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  cartBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

  addButton: { backgroundColor: '#1a73e8', padding: 16, margin: 15, borderRadius: 14, alignItems: 'center' },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  // Shopkeeper Product Card
  shopkeeperProductCard: {
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
  productInfo: { flex: 1 },
  productName: { fontSize: 16, fontWeight: '600', color: '#333' },
  productCategory: { fontSize: 12, color: '#666', marginTop: 2 },
  priceContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  originalPrice: { fontSize: 14, textDecorationLine: 'line-through', color: '#999' },
  discountedPrice: { fontSize: 18, fontWeight: 'bold', color: '#1a73e8' },
  normalPrice: { fontSize: 18, fontWeight: 'bold', color: '#1a73e8' },
  discountBadge: { backgroundColor: '#e67e22', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  discountBadgeText: { fontSize: 10, color: '#fff', fontWeight: 'bold' },
  productStock: { fontSize: 11, color: '#888', marginTop: 4 },
  productSales: { fontSize: 11, color: '#34a853', marginTop: 2 },
  
  shopkeeperActions: { flexDirection: 'row', gap: 8 },
  aiBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff3e0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, gap: 4 },
  aiBtnText: { color: '#e67e22', fontSize: 12 },
  editBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e8f0fe', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, gap: 4 },
  editBtnText: { color: '#1a73e8', fontSize: 12 },

  // Customer Product Card
  customerProductCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 6,
    padding: 12,
    width: (width - 48) / 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  productRow: { justifyContent: 'space-between', paddingHorizontal: 12 },
  listContent: { paddingVertical: 12, paddingBottom: 30 },
  addIcon: { width: 32, height: 32, backgroundColor: '#1a73e8', borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  
  customerOriginalPrice: { fontSize: 11, textDecorationLine: 'line-through', color: '#999' },
  customerDiscountedPrice: { fontSize: 16, fontWeight: 'bold', color: '#1a73e8' },
  customerNormalPrice: { fontSize: 16, fontWeight: 'bold', color: '#1a73e8' },
  customerDiscountBadge: { backgroundColor: '#e67e22', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 8, alignSelf: 'flex-start', marginTop: 2 },
  customerDiscountBadgeText: { fontSize: 8, color: '#fff', fontWeight: 'bold' },

  // Cart Modal
  cartModalContent: { backgroundColor: '#fff', borderRadius: 24, padding: 20, width: '90%', maxHeight: '80%' },
  cartModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  cartModalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1a73e8' },
  emptyCart: { alignItems: 'center', paddingVertical: 50 },
  emptyCartText: { color: '#999', marginTop: 10 },
  cartItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  cartItemInfo: { marginBottom: 8 },
  cartItemName: { fontSize: 14, fontWeight: '500', color: '#333' },
  cartItemDiscount: { fontSize: 11, color: '#e67e22', marginTop: 2 },
  cartItemPrice: { fontSize: 11, color: '#666', marginTop: 2 },
  cartItemControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cartQtyBtn: { width: 28, height: 28, backgroundColor: '#f0f0f0', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  cartQtyBtnText: { fontSize: 16, fontWeight: 'bold', color: '#666' },
  cartQtyText: { minWidth: 30, textAlign: 'center', fontSize: 14 },
  cartItemTotal: { fontSize: 14, fontWeight: 'bold', color: '#1a73e8', minWidth: 80, textAlign: 'right' },
  cartFooter: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e0e0e0' },
  cartSubtotal: { fontSize: 13, color: '#666', textAlign: 'right' },
  cartTax: { fontSize: 12, color: '#888', textAlign: 'right' },
  cartTotal: { fontSize: 18, fontWeight: 'bold', color: '#1a73e8', textAlign: 'right', marginTop: 4 },
  checkoutBtn: { backgroundColor: '#34a853', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  checkoutBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  // AI Modal
  aiModalContent: { backgroundColor: '#fff', borderRadius: 24, padding: 20, width: '90%', maxHeight: '85%' },
  aiModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  aiModalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1a73e8' },
  aiLoadingContainer: { alignItems: 'center', paddingVertical: 50 },
  aiLoadingText: { marginTop: 12, color: '#666' },
  aiProductName: { fontSize: 18, fontWeight: 'bold', color: '#333', textAlign: 'center', marginBottom: 20 },
  
  priceComparisonCard: { backgroundColor: '#f8f9fa', padding: 15, borderRadius: 12, marginBottom: 16 },
  sectionSubtitle: { fontSize: 14, fontWeight: 'bold', color: '#666', marginBottom: 12 },
  comparisonRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
  comparisonLabel: { fontSize: 13, color: '#666' },
  comparisonValue: { fontSize: 14, fontWeight: 'bold', color: '#dc3545' },
  comparisonDiscount: { fontSize: 14, fontWeight: 'bold', color: '#e67e22' },
  comparisonMarketPrice: { fontSize: 14, fontWeight: 'bold', color: '#34a853' },
  
  aiSuggestionCard: { backgroundColor: '#e8f0fe', padding: 15, borderRadius: 12, marginBottom: 16 },
  aiReason: { fontSize: 12, color: '#555', marginBottom: 15, lineHeight: 18 },
  suggestionRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#d0e0f0' },
  suggestionLabel: { fontSize: 13, color: '#555' },
  suggestionDiscount: { fontSize: 14, fontWeight: 'bold', color: '#e67e22' },
  suggestionPrice: { fontSize: 14, fontWeight: 'bold', color: '#1a73e8' },
  suggestionSave: { fontSize: 14, fontWeight: 'bold', color: '#34a853' },
  
  applyAiBtn: { backgroundColor: '#1a73e8', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  applyAiBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  // Empty State
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 80 },
  emptyIcon: { fontSize: 64, marginBottom: 16, opacity: 0.5 },
  emptyText: { textAlign: 'center', color: '#999', fontSize: 18, fontWeight: '500', marginBottom: 8 },
  emptySubText: { textAlign: 'center', color: '#bbb', fontSize: 13 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 24, padding: 24, width: '85%' },
  modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: '#1a73e8' },
  modalInput: { borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 14, padding: 14, marginBottom: 15, fontSize: 16, backgroundColor: '#fafafa' },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 10 },
  saveBtn: { flex: 1, backgroundColor: '#34a853', padding: 14, borderRadius: 12, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  cancelBtn: { flex: 1, backgroundColor: '#dc3545', padding: 14, borderRadius: 12, alignItems: 'center' },
  cancelBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});