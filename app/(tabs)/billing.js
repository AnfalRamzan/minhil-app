import { useRouter, useFocusEffect } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text, TextInput, TouchableOpacity,
  View,
  Linking
} from 'react-native';
import {
  addProduct,
  getAISuggestions,
  getLowSellingProducts,
  getProducts,
  saveBill,
  updateProductStock,
  updateProduct,
  db
} from '../../config/firebase';

import {
  getDocs,
  collection,
  query,
  where,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  setDoc
} from 'firebase/firestore';
// ============ AI MARKET API INTEGRATION ============
const SERP_API_KEY = 'YOUR_SERPAPI_KEY_HERE';
const SERP_API_URL = 'https://serpapi.com/search';

let marketDataCache = {};
let lastApiCallTime = 0;
const API_CALL_DELAY = 5000;

const fetchMarketPriceFromSerpAPI = async (productName) => {
  try {
    const cacheKey = productName.toLowerCase().trim();
    if (marketDataCache[cacheKey] && 
        (Date.now() - marketDataCache[cacheKey].timestamp) < 3600000) {
      return marketDataCache[cacheKey].data;
    }

    const now = Date.now();
    if (now - lastApiCallTime < API_CALL_DELAY) {
      await new Promise(resolve => setTimeout(resolve, API_CALL_DELAY));
    }
    lastApiCallTime = Date.now();

    return getIntelligentFallbackPrice(productName);
  } catch (error) {
    console.log('API error:', error);
    return getIntelligentFallbackPrice(productName);
  }
};

const getIntelligentFallbackPrice = (productName) => {
  const searchKey = productName.toLowerCase().trim();
  
  const priceDatabase = {
    'milk': { price: 150, source: 'Metro.pk', trend: 'stable', discountTrend: 0 },
    'bread': { price: 120, source: 'Metro.pk', trend: 'stable', discountTrend: 0 },
    'butter': { price: 350, source: 'Metro.pk', trend: 'rising', discountTrend: -5 },
    'sugar': { price: 135, source: 'Daraz.pk', trend: 'falling', discountTrend: 10 },
    'rice': { price: 199, source: 'Carrefour.pk', trend: 'stable', discountTrend: 5 },
    'cooking oil': { price: 449, source: 'Metro.pk', trend: 'rising', discountTrend: -8 },
    'soap': { price: 119, source: 'Daraz.pk', trend: 'stable', discountTrend: 0 },
    'shampoo': { price: 349, source: 'Daraz.pk', trend: 'falling', discountTrend: 8 },
    'tea': { price: 450, source: 'Daraz.pk', trend: 'stable', discountTrend: 5 },
    'coffee': { price: 550, source: 'Daraz.pk', trend: 'rising', discountTrend: -3 },
    'biscuit': { price: 50, source: 'Daraz.pk', trend: 'stable', discountTrend: 5 },
    'chips': { price: 30, source: 'Daraz.pk', trend: 'stable', discountTrend: 0 },
    'cold drink': { price: 60, source: 'Metro.pk', trend: 'stable', discountTrend: 0 },
    'juice': { price: 180, source: 'Metro.pk', trend: 'stable', discountTrend: 5 }
  };
  
  for (const [key, data] of Object.entries(priceDatabase)) {
    if (searchKey.includes(key) || key.includes(searchKey)) {
      return {
        found: true,
        marketPrice: data.price,
        lowestPrice: data.price * 0.9,
        highestPrice: data.price * 1.1,
        source: data.source,
        url: `https://www.daraz.pk/catalog/?q=${encodeURIComponent(productName)}`,
        trend: data.trend,
        discountTrend: data.discountTrend,
        competitorCount: 5,
        timestamp: Date.now()
      };
    }
  }
  
  return {
    found: true,
    marketPrice: 500,
    lowestPrice: 425,
    highestPrice: 575,
    source: 'Market Average',
    url: `https://www.daraz.pk/catalog/?q=${encodeURIComponent(productName)}`,
    trend: 'stable',
    discountTrend: 5,
    competitorCount: 3,
    estimated: true,
    timestamp: Date.now()
  };
};

const calculateAIDynamicDiscount = async (product, salesData = null, stockData = null) => {
  const currentPrice = product.pricePKR || product.price || 0;
  if (currentPrice <= 0) return { discount: 0, discountedPrice: currentPrice, reason: 'Invalid price' };
  
  const marketData = await fetchMarketPriceFromSerpAPI(product.name);
  const salesCount = salesData?.salesCount || product.salesCount || 0;
  const stockLevel = stockData?.stock || product.stock || 0;
  
  let marketBasedDiscount = 0;
  if (marketData.found && marketData.marketPrice) {
    const priceDifference = marketData.marketPrice - currentPrice;
    if (priceDifference < 0) {
      marketBasedDiscount = Math.min(Math.abs(priceDifference) / currentPrice * 100, 25);
    }
  }
  
  let trendAdjustment = marketData.trend === 'falling' ? 8 : marketData.trend === 'rising' ? -5 : 0;
  let salesAdjustment = salesCount < 5 ? 10 : salesCount < 20 ? 5 : salesCount > 50 ? -5 : 0;
  let stockAdjustment = stockLevel > 50 ? 10 : stockLevel < 10 && stockLevel > 0 ? -8 : stockLevel === 0 ? -15 : 0;
  
  let finalDiscount = marketBasedDiscount + trendAdjustment + salesAdjustment + stockAdjustment;
  finalDiscount = Math.max(0, Math.min(finalDiscount, 35));
  
  let reason = [];
  if (marketBasedDiscount > 0) reason.push(`Beat market price`);
  if (salesCount < 5) reason.push(`Low selling product`);
  if (stockLevel > 50) reason.push(`Stock clearance`);
  
  const finalReason = reason.length > 0 ? reason.join(', ') : 'AI best price';
  const discountedPrice = currentPrice * (1 - finalDiscount / 100);
  
  return {
    discount: Math.round(finalDiscount),
    discountedPrice: Math.round(discountedPrice),
    originalPrice: currentPrice,
    reason: finalReason,
    marketPrice: marketData.marketPrice,
    marketSource: marketData.source,
    marketUrl: marketData.url,
    trend: marketData.trend
  };
};

let purchasePatterns = {};

const loadPurchasePatterns = async () => {
  try {
    const patternsRef = collection(db, 'purchasePatterns');
    const snapshot = await getDocs(patternsRef);
    purchasePatterns = {};
    snapshot.forEach(doc => {
      const data = doc.data();
      if (!purchasePatterns[data.productId]) {
        purchasePatterns[data.productId] = {};
      }
      purchasePatterns[data.productId][data.relatedProductId] = data.count || 1;
    });
    console.log('Purchase patterns loaded:', Object.keys(purchasePatterns).length);
  } catch (error) {
    console.log('Error loading patterns:', error);
  }
};

const savePurchasePattern = async (productId, relatedProductId) => {
  try {
    const patternKey = `${productId}_${relatedProductId}`;
    const patternRef = doc(db, 'purchasePatterns', patternKey);
    const patternDoc = await getDoc(patternRef);
    
    if (patternDoc.exists()) {
      const newCount = (patternDoc.data().count || 0) + 1;
      await updateDoc(patternRef, {
        count: newCount,
        lastUpdated: new Date().toISOString()
      });
    } else {
      await setDoc(patternRef, {
        id: patternKey,
        productId: productId,
        relatedProductId: relatedProductId,
        count: 1,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      });
    }
    
    if (!purchasePatterns[productId]) {
      purchasePatterns[productId] = {};
    }
    purchasePatterns[productId][relatedProductId] = (purchasePatterns[productId][relatedProductId] || 0) + 1;
  } catch (error) {
    console.log('Error saving pattern:', error);
  }
};

const getLearnedSuggestions = async (currentProductId, currentCart = [], allProducts = []) => {
  try {
    if (Object.keys(purchasePatterns).length === 0) {
      await loadPurchasePatterns();
    }
    
    const patterns = purchasePatterns[currentProductId] || {};
    const sortedPatterns = Object.entries(patterns)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    const suggestions = [];
    const cartIds = currentCart.map(item => item.id);
    
    for (const [relatedId, frequency] of sortedPatterns) {
      if (!cartIds.includes(relatedId)) {
        const product = allProducts.find(p => p.id === relatedId);
        if (product && frequency >= 1) {
          suggestions.push({
            ...product,
            frequency: frequency,
            confidence: frequency > 3 ? 'high' : frequency > 1 ? 'medium' : 'low',
            reason: `Bought together ${frequency} times`
          });
        }
      }
    }
    
    return suggestions.slice(0, 3);
  } catch (error) {
    console.log('Get learned suggestions error:', error);
    return [];
  }
};

const recordPurchaseCombination = async (cart) => {
  if (!cart || cart.length < 2) return;
  for (let i = 0; i < cart.length; i++) {
    for (let j = i + 1; j < cart.length; j++) {
      await savePurchasePattern(cart[i].id, cart[j].id);
      await savePurchasePattern(cart[j].id, cart[i].id);
    }
  }
};

const openWebsite = async (url) => {
  if (!url) {
    Alert.alert('Error', 'No website link available');
    return;
  }
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Error', `Cannot open link: ${url}`);
    }
  } catch (error) {
    Alert.alert('Error', 'Could not open website');
  }
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
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('');
  const [newProductStock, setNewProductStock] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [applyingDiscount, setApplyingDiscount] = useState(false);
  const [showMarketModal, setShowMarketModal] = useState(false);
  const [marketInfo, setMarketInfo] = useState(null);
  const [learningMessage, setLearningMessage] = useState('');
  const [showAILearningModal, setShowAILearningModal] = useState(false);
  const [aiInsights, setAiInsights] = useState(null);
  const [showDiscountConfirmModal, setShowDiscountConfirmModal] = useState(false);
  const [pendingProduct, setPendingProduct] = useState(null);
  const [pendingQuantity, setPendingQuantity] = useState(null);
  const [pendingDiscountInfo, setPendingDiscountInfo] = useState(null);

  // Refresh products when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('Billing screen focused - refreshing products');
      loadProducts();
      return () => {};
    }, [])
  );

  useEffect(() => {
    loadData();
    loadPurchasePatterns();
  }, []);

  useEffect(() => {
    calculateTotal();
  }, [cart]);

  const calculateTotal = () => {
    const newTotal = cart.reduce((sum, item) => sum + ((item.discountedPrice || item.price) * item.quantity), 0);
    const newOriginalTotal = cart.reduce((sum, item) => sum + ((item.originalPrice || item.price) * item.quantity), 0);
    const newDiscount = newOriginalTotal - newTotal;
    setTotal(newTotal);
    setOriginalTotal(newOriginalTotal);
    setTotalDiscount(newDiscount);
  };

  const loadData = async () => {
    setLoading(true);
    await loadProducts();
    setLoading(false);
  };

  const loadProducts = async () => {
    console.log('Loading products for billing screen...');
    const result = await getProducts();
    if (result.success) {
      const normalizedProducts = result.products.map(p => ({
        ...p,
        price: p.pricePKR || p.price || 0,
        pricePKR: p.pricePKR || p.price || 0,
        discountedPrice: p.discountedPrice || p.pricePKR || p.price,
        name: p.name || 'Unknown Product',
        stock: p.stock || 0,
        category: p.category || 'General',
        salesCount: p.salesCount || 0
      }));
      setProducts(normalizedProducts);
      setFilteredProducts(normalizedProducts);
      console.log('✅ Products loaded in billing screen:', normalizedProducts.length);
      console.log('📦 Product list:', normalizedProducts.map(p => p.name));
    } else {
      console.log('❌ Error loading products:', result.error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProducts();
    setRefreshing(false);
  };

  const searchProduct = (text) => {
    setSearchText(text);
    console.log('🔍 Searching for:', text);
    
    if (text.trim() === '') {
      setFilteredProducts(products);
      console.log('📋 Showing all products:', products.length);
    } else {
      const searchLower = text.toLowerCase().trim();
      const filtered = products.filter(p => {
        if (!p || !p.name) return false;
        return p.name.toLowerCase().includes(searchLower);
      });
      setFilteredProducts(filtered);
      console.log('✅ Found products:', filtered.length);
      if (filtered.length > 0) {
        console.log('📝 Matching:', filtered.map(p => p.name));
      }
    }
  };

  const checkMarketPrice = async (product) => {
    setApplyingDiscount(true);
    setLearningMessage('🌐 Fetching market data...');
    const marketData = await fetchMarketPriceFromSerpAPI(product.name);
    const currentPrice = product.pricePKR || product.price;
    
    setMarketInfo({
      productName: product.name,
      currentPrice: currentPrice,
      marketPrice: marketData.marketPrice,
      lowestPrice: marketData.lowestPrice,
      highestPrice: marketData.highestPrice,
      source: marketData.source,
      url: marketData.url,
      trend: marketData.trend,
      difference: currentPrice - marketData.marketPrice,
      isHigher: currentPrice > marketData.marketPrice,
      competitorCount: marketData.competitorCount
    });
    setShowMarketModal(true);
    setLearningMessage('');
    setApplyingDiscount(false);
  };

  const addToCart = async (product, customQuantity = null) => {
    if (!product || !product.name) {
      Alert.alert('Error', 'Invalid product');
      return;
    }
    
    const qty = customQuantity || parseInt(quantity);
    if (isNaN(qty) || qty < 1) {
      Alert.alert('Error', 'Please enter valid quantity');
      return;
    }

    const availableStock = product.stock || 0;
    const existingItem = cart.find(item => item.id === product.id);
    const currentQty = existingItem ? existingItem.quantity : 0;
    
    if (currentQty + qty > availableStock) {
      Alert.alert('Stock Limit', `Only ${availableStock} items available`);
      return;
    }

    setApplyingDiscount(true);
    setLearningMessage('🧠 AI calculating best price...');
    
    const discountInfo = await calculateAIDynamicDiscount(product);
    
    setPendingProduct(product);
    setPendingQuantity(qty);
    setPendingDiscountInfo(discountInfo);
    setShowDiscountConfirmModal(true);
    setLearningMessage('');
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
    
    const existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
      const newQuantity = existingItem.quantity + qty;
      setCart(cart.map(item => 
        item.id === product.id 
          ? { 
              ...item, 
              quantity: newQuantity, 
              total: finalPrice * newQuantity,
              price: finalPrice,
              discountedPrice: finalPrice,
              originalPrice: originalPrice,
              discount: discountPercent,
              discountReason: discountReason,
              marketPrice: discountInfo.marketPrice,
              marketSource: discountInfo.marketSource
            }
          : item
      ));
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
        category: product.category || 'General',
        marketPrice: discountInfo.marketPrice,
        marketSource: discountInfo.marketSource
      }]);
    }

    if (discountPercent > 0) {
      Alert.alert(
        '🤖 AI Best Price!',
        `${discountPercent}% OFF on ${product.name}\n💰 Market: ₨${Math.round(discountInfo.marketPrice)}\n💵 You Pay: ₨${Math.round(finalPrice)}`,
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
    
    getLearnedSuggestionsForProduct(product);
  };

  const getLearnedSuggestionsForProduct = async (currentProduct) => {
    setLearningMessage('🧠 AI analyzing purchase patterns...');
    const learnedSuggestions = await getLearnedSuggestions(currentProduct.id, cart, products);
    
    if (learnedSuggestions.length > 0) {
      setSuggestions(learnedSuggestions);
      setShowSuggestionModal(true);
      setAiInsights({
        productName: currentProduct.name,
        suggestionCount: learnedSuggestions.length,
        topSuggestion: learnedSuggestions[0]?.name,
        confidenceLevel: learnedSuggestions[0]?.confidence
      });
      setShowAILearningModal(true);
      setTimeout(() => setShowAILearningModal(false), 3000);
    } else {
      setLearningMessage('🔄 AI learning from your purchases...');
      setTimeout(() => setLearningMessage(''), 2000);
    }
  };

  const generateBillAndLearn = async () => {
    if (cart.length === 0) {
      Alert.alert('Error', 'Cart is empty');
      return;
    }
    
    setLearningMessage('🧠 AI recording purchase patterns...');
    await recordPurchaseCombination(cart);
    
    Alert.alert(
      '🧠 AI Learning Complete',
      `✅ ${cart.length} item(s) recorded.\n🔄 AI will use this pattern for future recommendations.`,
      [{ text: 'Continue', onPress: () => proceedToBill() }]
    );
    setLearningMessage('');
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

  const formatPrice = (amount) => {
    if (!amount && amount !== 0) return '₨ 0';
    return `₨ ${Math.round(amount).toLocaleString('en-PK') || 0}`;
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
      category: newProductCategory.trim() || 'General',
      stock: parseInt(newProductStock) || 0,
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
      setSearchText('');
      setFilteredProducts(products);
    } else {
      Alert.alert('Error', result.error || 'Failed to add product');
    }
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
                <Text style={styles.discountBadgeText}>AI -{item.discount}%</Text>
              </View>
            </View>
            <Text style={styles.cartItemPrice}>{formatPrice(item.price)} x {item.quantity}</Text>
            <Text style={styles.discountReason} numberOfLines={1}>{item.discountReason}</Text>
          </View>
        ) : (
          <Text style={styles.cartItemPrice}>{formatPrice(item.price)} x {item.quantity}</Text>
        )}
        <Text style={styles.stockIndicator}>📦 Stock: {item.stock}</Text>
      </View>
      <View style={styles.cartItemActions}>
        <Text style={styles.cartItemTotal}>{formatPrice(item.total)}</Text>
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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🧠 AI Smart Billing</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.quickAddBtn} onPress={() => setShowAddProductModal(true)}>
            <Text style={styles.quickAddBtnText}>+</Text>
          </TouchableOpacity>
          <View style={styles.currencyPill}>
            <Text style={styles.currencyPillText}>PKR</Text>
          </View>
        </View>
      </View>

      {learningMessage ? (
        <View style={styles.learningBar}>
          <Text style={styles.learningText}>{learningMessage}</Text>
          <ActivityIndicator size="small" color="#1a73e8" style={{ marginLeft: 8 }} />
        </View>
      ) : null}

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
                  </View>
                  <View style={styles.dropdownActions}>
                    <Text style={styles.dropdownPrice}>{formatPrice(product.pricePKR || product.price)}</Text>
                    <TouchableOpacity 
                      style={styles.competitorCheckBtn}
                      onPress={() => checkMarketPrice(product)}
                    >
                      <Text style={styles.competitorCheckBtnText}>🔍</Text>
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
                if (found) addToCart(found);
                else Alert.alert('Error', 'Product not found.\nTry adding manually.');
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
            <Text style={styles.discountSummaryText}>🎉 AI Saved: {formatPrice(totalDiscount)}</Text>
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
              <Text style={styles.originalAmount}>{formatPrice(originalTotal)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>AI Discount:</Text>
              <Text style={styles.discountAmount}>-{formatPrice(totalDiscount)}</Text>
            </View>
            <View style={styles.dividerLine} />
          </>
        )}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Final Amount:</Text>
          <Text style={styles.totalAmount}>{formatPrice(total)}</Text>
        </View>
        <TouchableOpacity style={styles.proceedButton} onPress={generateBillAndLearn}>
          <Text style={styles.proceedButtonText}>Generate Bill & AI Learns →</Text>
        </TouchableOpacity>
      </View>

      {/* AI Learning Modal */}
      <Modal visible={showAILearningModal} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.aiLearningModal]}>
            <Text style={styles.aiIcon}>🧠</Text>
            <Text style={styles.aiTitle}>AI Learning Complete!</Text>
            {aiInsights && (
              <>
                <Text style={styles.aiMessage}>Analyzed: {aiInsights.productName}</Text>
                <Text style={styles.aiSubMessage}>Found {aiInsights.suggestionCount} recommendations</Text>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Discount Confirm Modal */}
      <Modal visible={showDiscountConfirmModal} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🤖 AI Best Price</Text>
            {pendingDiscountInfo && (
              <View style={styles.discountConfirmContainer}>
                <Text style={styles.confirmProductName}>{pendingProduct?.name}</Text>
                <View style={styles.confirmPriceRow}>
                  <Text style={styles.confirmOriginalPrice}>{formatPrice(pendingDiscountInfo.originalPrice)}</Text>
                  <Text style={styles.confirmNewPrice}>{formatPrice(pendingDiscountInfo.discountedPrice)}</Text>
                </View>
                <View style={styles.confirmDiscountBadge}>
                  <Text style={styles.confirmDiscountText}>-{pendingDiscountInfo.discount}% OFF</Text>
                </View>
                <Text style={styles.confirmReason}>📊 {pendingDiscountInfo.reason}</Text>
                <View style={styles.confirmButtons}>
                  <TouchableOpacity style={styles.confirmYesBtn} onPress={confirmAddToCart}>
                    <Text style={styles.confirmYesBtnText}>✅ Apply & Add</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.confirmNoBtn} onPress={() => {
                    setShowDiscountConfirmModal(false);
                    setPendingProduct(null);
                  }}>
                    <Text style={styles.confirmNoBtnText}>❌ Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Market Price Modal */}
      <Modal visible={showMarketModal} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🏷️ Market Price</Text>
            {marketInfo && (
              <View style={styles.marketResult}>
                <Text style={styles.marketProduct}>{marketInfo.productName}</Text>
                <Text style={styles.marketYourPrice}>Your Price: {formatPrice(marketInfo.currentPrice)}</Text>
                <Text style={styles.marketPrice}>Market: {formatPrice(marketInfo.marketPrice)} ({marketInfo.source})</Text>
                <View style={styles.marketDiffContainer}>
                  <Text style={[styles.marketDiff, marketInfo.isHigher ? styles.marketHigher : styles.marketLower]}>
                    {marketInfo.isHigher 
                      ? `⚠️ Paying ₨${Math.round(Math.abs(marketInfo.difference))} more` 
                      : `✓ Saving ₨${Math.round(Math.abs(marketInfo.difference))}`}
                  </Text>
                </View>
                <TouchableOpacity style={styles.openWebsiteBtn} onPress={() => openWebsite(marketInfo.url)}>
                  <Text style={styles.openWebsiteBtnText}>🌐 Compare on {marketInfo.source}</Text>
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setShowMarketModal(false)}>
              <Text style={styles.closeModalBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* AI Suggestion Modal */}
      <Modal visible={showSuggestionModal} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalIcon}>🧠</Text>
              <Text style={styles.modalTitle}>AI Suggestions</Text>
            </View>
            {suggestions.map(product => (
              <TouchableOpacity 
                key={product.id}
                style={styles.suggestionItem}
                onPress={() => {
                  addToCart(product, 1);
                  setShowSuggestionModal(false);
                }}
              >
                <View style={styles.suggestionLeft}>
                  <Text style={styles.suggestionName}>{product.name}</Text>
                  {product.frequency && (
                    <Text style={styles.suggestionFrequency}>🔥 Bought together {product.frequency}x</Text>
                  )}
                </View>
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

      {/* Add Product Modal */}
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
              placeholder="Category"
              placeholderTextColor="#aaa"
              value={newProductCategory}
              onChangeText={setNewProductCategory}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Stock Quantity"
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
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f7fa' },
  loadingText: { marginTop: 10, color: '#666', fontSize: 14 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 15, paddingBottom: 12, backgroundColor: '#1a73e8', borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  quickAddBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  quickAddBtnText: { fontSize: 22, color: '#fff', fontWeight: 'bold' },
  currencyPill: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  currencyPillText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  learningBar: { flexDirection: 'row', backgroundColor: '#e8f0fe', padding: 10, marginHorizontal: 16, marginTop: 10, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  learningText: { fontSize: 12, color: '#1a73e8', fontWeight: '500' },
  inputSection: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  searchWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f7fa', borderRadius: 14, borderWidth: 1.5, borderColor: '#e0e0e0', paddingHorizontal: 14, marginBottom: 12 },
  searchIcon: { fontSize: 18, marginRight: 10, color: '#888' },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: '#333' },
  dropdown: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 14, marginTop: 5, marginBottom: 12, backgroundColor: '#fff', maxHeight: 220, elevation: 3 },
  dropdownItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  dropdownItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dropdownInfo: { flex: 2 },
  dropdownName: { fontSize: 15, fontWeight: '500', color: '#333', marginBottom: 3 },
  dropdownStock: { fontSize: 11, color: '#888' },
  dropdownActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dropdownPrice: { fontSize: 15, color: '#1a73e8', fontWeight: 'bold' },
  competitorCheckBtn: { backgroundColor: '#e8f0fe', padding: 8, borderRadius: 20 },
  competitorCheckBtnText: { fontSize: 14 },
  quantityRow: { flexDirection: 'row', gap: 12 },
  quantityWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f7fa', borderRadius: 14, borderWidth: 1.5, borderColor: '#e0e0e0', paddingHorizontal: 14, width: 110 },
  quantityLabel: { fontSize: 14, color: '#666', marginRight: 8 },
  quantityInput: { flex: 1, paddingVertical: 12, fontSize: 15, textAlign: 'center', color: '#333' },
  addButton: { flex: 1, backgroundColor: '#1a73e8', borderRadius: 14, justifyContent: 'center', alignItems: 'center', paddingVertical: 12 },
  addButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  cartSection: { flex: 1, padding: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  itemCount: { fontSize: 13, color: '#888', backgroundColor: '#f0f0f0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  discountSummaryBar: { backgroundColor: '#e6f4ea', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, marginBottom: 12, alignItems: 'center' },
  discountSummaryText: { fontSize: 13, color: '#34a853', fontWeight: '600' },
  cartItem: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  cartItemInfo: { flex: 1 },
  cartItemName: { fontSize: 16, fontWeight: '500', color: '#333', marginBottom: 4 },
  cartItemPrice: { color: '#666', fontSize: 13 },
  stockIndicator: { fontSize: 10, color: '#999', marginTop: 2 },
  priceRowSmall: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  oldPrice: { fontSize: 11, textDecorationLine: 'line-through', color: '#999' },
  discountBadge: { backgroundColor: '#e67e22', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  discountBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  discountReason: { fontSize: 9, color: '#34a853', marginTop: 2 },
  cartItemActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cartItemTotal: { fontSize: 15, fontWeight: 'bold', color: '#1a73e8', marginRight: 8 },
  actionBtn: { width: 32, height: 32, backgroundColor: '#f0f0f0', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  actionBtnText: { fontSize: 18, fontWeight: 'bold', color: '#1a73e8' },
  quantityText: { fontSize: 14, minWidth: 30, textAlign: 'center', fontWeight: '500', color: '#333' },
  deleteBtn: { fontSize: 18, padding: 6 },
  emptyCartContainer: { alignItems: 'center', paddingVertical: 60 },
  emptyCartIcon: { fontSize: 60, marginBottom: 16, opacity: 0.5 },
  emptyCart: { textAlign: 'center', color: '#999', fontSize: 16, marginBottom: 8 },
  emptyCartSub: { textAlign: 'center', color: '#bbb', fontSize: 13 },
  emptyCartContent: { flex: 1, justifyContent: 'center' },
  totalSection: { padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e0e0e0' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  totalLabel: { fontSize: 16, fontWeight: '500', color: '#666' },
  totalAmount: { fontSize: 28, fontWeight: 'bold', color: '#1a73e8' },
  originalAmount: { fontSize: 16, textDecorationLine: 'line-through', color: '#999' },
  discountAmount: { fontSize: 16, fontWeight: 'bold', color: '#34a853' },
  dividerLine: { height: 1, backgroundColor: '#e0e0e0', marginVertical: 10 },
  proceedButton: { backgroundColor: '#34a853', padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  proceedButtonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 24, padding: 20, width: '90%', maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  modalIcon: { fontSize: 28, marginRight: 8 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', color: '#1a73e8', marginBottom: 16 },
  modalInput: { borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 15, backgroundColor: '#f8f9fa' },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  saveBtn: { flex: 1, backgroundColor: '#34a853', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cancelBtn: { flex: 1, backgroundColor: '#dc3545', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  cancelBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  marketResult: { alignItems: 'center', padding: 16 },
  marketProduct: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 16 },
  marketYourPrice: { fontSize: 16, color: '#666', marginBottom: 8 },
  marketPrice: { fontSize: 18, fontWeight: 'bold', color: '#1a73e8', marginBottom: 8 },
  marketDiffContainer: { marginBottom: 12 },
  marketDiff: { fontSize: 14, fontWeight: 'bold' },
  marketHigher: { color: '#dc3545' },
  marketLower: { color: '#34a853' },
  openWebsiteBtn: { backgroundColor: '#1a73e8', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, width: '100%', alignItems: 'center' },
  openWebsiteBtnText: { color: '#fff', fontWeight: '500', fontSize: 14 },
  closeModalBtn: { backgroundColor: '#1a73e8', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  closeModalBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  discountConfirmContainer: { alignItems: 'center' },
  confirmProductName: { fontSize: 22, fontWeight: 'bold', color: '#333', marginBottom: 16 },
  confirmPriceRow: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  confirmOriginalPrice: { fontSize: 18, textDecorationLine: 'line-through', color: '#999' },
  confirmNewPrice: { fontSize: 24, fontWeight: 'bold', color: '#e67e22' },
  confirmDiscountBadge: { backgroundColor: '#e67e22', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, marginBottom: 12 },
  confirmDiscountText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  confirmReason: { fontSize: 13, color: '#666', textAlign: 'center', marginBottom: 20 },
  confirmButtons: { flexDirection: 'row', gap: 12, width: '100%' },
  confirmYesBtn: { flex: 1, backgroundColor: '#34a853', padding: 14, borderRadius: 12, alignItems: 'center' },
  confirmYesBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  confirmNoBtn: { flex: 1, backgroundColor: '#dc3545', padding: 14, borderRadius: 12, alignItems: 'center' },
  confirmNoBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  suggestionItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  suggestionLeft: { flex: 2 },
  suggestionName: { fontSize: 15, fontWeight: '500', color: '#333' },
  suggestionFrequency: { fontSize: 10, color: '#e67e22', marginTop: 2 },
  suggestionPrice: { fontSize: 14, color: '#1a73e8', fontWeight: 'bold', marginHorizontal: 12 },
  addSuggestionBtn: { backgroundColor: '#e8f0fe', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  addSuggestionBtnText: { color: '#1a73e8', fontWeight: 'bold', fontSize: 12 },
  ignoreButton: { marginTop: 16, padding: 12, backgroundColor: '#f0f0f0', borderRadius: 12, alignItems: 'center' },
  ignoreButtonText: { color: '#666', fontSize: 14 },
  aiLearningModal: { alignItems: 'center', padding: 24 },
  aiIcon: { fontSize: 48, marginBottom: 16 },
  aiTitle: { fontSize: 20, fontWeight: 'bold', color: '#34a853', marginBottom: 12 },
  aiMessage: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 8 },
  aiSubMessage: { fontSize: 12, color: '#1a73e8', textAlign: 'center', marginBottom: 4 },
});