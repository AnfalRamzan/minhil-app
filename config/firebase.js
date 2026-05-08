// config/firebase.js - COMPLETE FIXED VERSION (No Hardcoding)

import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy,
  getDoc,
  where,
  setDoc,
  onSnapshot,
  limit,
  writeBatch
} from 'firebase/firestore';
import { 
  initializeAuth, 
  getReactNativePersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyAb7Fsyr-DLWIA3jSYYplWSOoeDzYVflK8",
  authDomain: "smart-billing-system-dfa51.firebaseapp.com",
  projectId: "smart-billing-system-dfa51",
  storageBucket: "smart-billing-system-dfa51.firebasestorage.app",
  messagingSenderId: "779647911861",
  appId: "1:779647911861:web:586e1f97394b35bc683bfc",
  measurementId: "G-GRVVRBC3NT"
};

const app = initializeApp(firebaseConfig);

const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

const db = getFirestore(app);

export const formatPKR = (amount) => {
  if (!amount && amount !== 0) return '₨ 0';
  return `₨ ${Math.round(amount).toLocaleString('en-PK') || 0}`;
};

// ================= DARAZ LINK GENERATOR (UNIFIED) =================
export const generateDarazLink = (productName) => {
  if (!productName || productName === 'Unknown') return 'https://www.daraz.pk/';
  const searchQuery = encodeURIComponent(productName.trim().toLowerCase());
  return `https://www.daraz.pk/catalog/?q=${searchQuery}&spm=a2a0e.tm80335411.search.1`;
};

// ================= REAL API INTEGRATION (NO HARDCODING) =================
// IMPORTANT: Get free API key from https://serper.dev/
// Store it in environment variable or AsyncStorage
let SERPER_API_KEY = null;

export const setSerperApiKey = (apiKey) => {
  SERPER_API_KEY = apiKey;
  return { success: true };
};

export const getSerperApiKey = async () => {
  if (SERPER_API_KEY) return SERPER_API_KEY;
  try {
    const savedKey = await AsyncStorage.getItem('serper_api_key');
    if (savedKey) SERPER_API_KEY = savedKey;
    return SERPER_API_KEY;
  } catch {
    return null;
  }
};

export const fetchRealMarketPriceFromAPI = async (productName) => {
  try {
    const apiKey = await getSerperApiKey();
    
    // If no API key, return null (will use database-only mode)
    if (!apiKey) {
      return { success: false, error: 'No API key', useDatabaseOnly: true };
    }

    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        q: `${productName} price in Pakistan PKR`,
        num: 5
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    
    let extractedPrice = null;
    
    if (data.organic && data.organic.length > 0) {
      for (const result of data.organic) {
        const text = (result.title + ' ' + (result.snippet || '')).toLowerCase();
        const priceMatch = text.match(/(?:₨|rs|pkr|rupees?)\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i);
        if (priceMatch) {
          extractedPrice = parseFloat(priceMatch[1].replace(/,/g, ''));
          break;
        }
      }
    }
    
    return {
      success: true,
      marketPrice: extractedPrice,
      source: 'Serper.dev (Google Search)',
      trend: 'stable',
      url: generateDarazLink(productName),
      exactMatch: extractedPrice !== null
    };
  } catch (error) {
    return { success: false, error: error.message, useDatabaseOnly: true };
  }
};

// ================= MARKET PRICE FROM FIREBASE DATABASE ONLY =================
export const fetchMarketPriceFromDB = async (productName, category = 'default') => {
  try {
    // First, try to get exact product match from products collection
    const productsRef = collection(db, 'products');
    const q = query(productsRef, where('name', '>=', productName), where('name', '<=', productName + '\uf8ff'), limit(1));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      const product = snapshot.docs[0].data();
      if (product.marketPrice) {
        return {
          success: true,
          marketPrice: product.marketPrice,
          source: 'Database (Exact Match)',
          trend: product.marketTrend || 'stable',
          url: generateDarazLink(productName),
          exactMatch: true
        };
      }
    }
    
    // If no exact match, get category average price
    const categoryQuery = query(productsRef, where('category', '==', category), limit(10));
    const categorySnapshot = await getDocs(categoryQuery);
    
    if (!categorySnapshot.empty) {
      let totalPrice = 0;
      let count = 0;
      categorySnapshot.forEach(doc => {
        const data = doc.data();
        const price = data.pricePKR || data.price || 0;
        if (price > 0) {
          totalPrice += price;
          count++;
        }
      });
      
      if (count > 0) {
        const avgPrice = totalPrice / count;
        return {
          success: true,
          marketPrice: Math.round(avgPrice),
          source: `Database (${category} Category Average)`,
          trend: 'stable',
          url: generateDarazLink(productName),
          exactMatch: false
        };
      }
    }
    
    // Return null if no data found
    return { success: false, marketPrice: null, error: 'No market data available' };
  } catch (error) {
    return { success: false, marketPrice: null, error: error.message };
  }
};

// ================= MAIN MARKET PRICE FETCH =================
let marketCache = {};

export const fetchMarketPrice = async (productName, category = 'default') => {
  const searchKey = (productName || "").toLowerCase().trim();
  
  // Check cache (5 minutes)
  if (marketCache[searchKey] && (Date.now() - marketCache[searchKey].timestamp) < 300000) {
    return marketCache[searchKey].data;
  }
  
  // Try real API first if key exists
  const apiKey = await getSerperApiKey();
  let result = null;
  
  if (apiKey) {
    result = await fetchRealMarketPriceFromAPI(productName);
  }
  
  // If API didn't return a price, try database
  if (!result || !result.marketPrice) {
    result = await fetchMarketPriceFromDB(productName, category);
  }
  
  // If still no price, return null (no hardcoded fallback)
  const finalResult = {
    found: result?.marketPrice !== null,
    exactMatch: result?.exactMatch || false,
    marketPrice: result?.marketPrice || null,
    source: result?.source || 'No data available',
    url: generateDarazLink(productName),
    trend: result?.trend || 'unknown',
    competitorCount: null,
    lastUpdated: new Date().toISOString()
  };
  
  marketCache[searchKey] = { data: finalResult, timestamp: Date.now() };
  return finalResult;
};

// ================= AI DISCOUNT CALCULATION (NO HARDCODING) =================
export const calculateAIDynamicDiscount = async (product, salesData = null, stockData = null) => {
  if (!product) {
    return { 
      discount: 0, 
      discountedPrice: 0, 
      originalPrice: 0, 
      reason: 'Invalid product', 
      savings: 0,
      marketUrl: generateDarazLink(''),
      marketPrice: null,
      useDynamicPricing: true
    };
  }
  
  const currentPrice = product.pricePKR || product.price || 0;
  const category = product.category || 'default';
  const productName = product.name || 'Unknown';
  
  if (currentPrice <= 0) {
    return { 
      discount: 0, 
      discountedPrice: currentPrice, 
      originalPrice: currentPrice,
      reason: 'Standard pricing', 
      savings: 0,
      marketPrice: null,
      marketUrl: generateDarazLink(productName),
      useDynamicPricing: true
    };
  }
  
  let totalDiscount = 0;
  let reasons = [];
  
  // Get sales and stock from product or parameters
  const salesCount = salesData?.salesCount || product.salesCount || 0;
  const stockLevel = stockData?.stock || product.stock || 0;
  
  // 1. Sales-based discount (from actual data)
  if (salesCount === 0) {
    totalDiscount += 10;
    reasons.push(`🆕 New product (no sales yet)`);
  } else if (salesCount < 5) {
    totalDiscount += 7;
    reasons.push(`📉 Low sales (${salesCount} units)`);
  } else if (salesCount < 15) {
    totalDiscount += 3;
    reasons.push(`📊 Building momentum (${salesCount} units)`);
  }
  
  // 2. Stock-based discount (from actual data)
  if (stockLevel > 100) {
    totalDiscount += 15;
    reasons.push(`🏪 High stock clearance (${stockLevel} units)`);
  } else if (stockLevel > 50) {
    totalDiscount += 8;
    reasons.push(`📦 Good stock available (${stockLevel} units)`);
  } else if (stockLevel < 3 && stockLevel > 0) {
    totalDiscount -= 5;
    reasons.push(`⚡ Limited stock remaining (${stockLevel} units)`);
  }
  
  // 3. Get market price from API/DB (no hardcoding)
  const marketData = await fetchMarketPrice(productName, category);
  
  if (marketData.marketPrice && marketData.marketPrice > 0) {
    if (currentPrice > marketData.marketPrice) {
      const diffPercent = ((currentPrice - marketData.marketPrice) / currentPrice) * 100;
      const marketDiscount = Math.min(Math.round(diffPercent + 3), 30);
      totalDiscount += marketDiscount;
      reasons.push(`💰 Matched to market (${formatPKR(marketData.marketPrice)})`);
    }
  }
  
  // Ensure discount is within reasonable bounds (0-50%)
  totalDiscount = Math.max(0, Math.min(Math.round(totalDiscount), 50));
  const discountedPrice = Math.round(currentPrice * (1 - totalDiscount / 100));
  const savings = Math.round(currentPrice - discountedPrice);
  const reasonText = reasons.length > 0 ? reasons.slice(0, 2).join(', ') : '🤖 AI optimized price';
  
  return {
    discount: totalDiscount,
    discountedPrice: discountedPrice,
    originalPrice: currentPrice,
    reason: reasonText,
    marketPrice: marketData.marketPrice,
    marketSource: marketData.source,
    marketUrl: marketData.url,
    trend: marketData.trend,
    savings: savings,
    useDynamicPricing: true
  };
};

// ================= AI PURCHASE PATTERNS (FROM DATABASE ONLY) =================
let purchasePatterns = {};
let patternsLoaded = false;

export const loadPurchasePatterns = async () => {
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
    patternsLoaded = true;
    return { success: true, patternCount: snapshot.size };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const recordPurchaseCombination = async (cart) => {
  if (!cart || cart.length < 2) return { success: true, recorded: 0 };
  let recorded = 0;
  
  for (let i = 0; i < cart.length; i++) {
    for (let j = i + 1; j < cart.length; j++) {
      try {
        const patternKey = `${cart[i].id}_${cart[j].id}`;
        const patternRef = doc(db, 'purchasePatterns', patternKey);
        const patternDoc = await getDoc(patternRef);
        
        if (patternDoc.exists()) {
          await updateDoc(patternRef, { 
            count: (patternDoc.data().count || 0) + 1, 
            lastUpdated: new Date().toISOString() 
          });
        } else {
          await setDoc(patternRef, { 
            id: patternKey, 
            productId: cart[i].id, 
            productName: cart[i].name,
            relatedProductId: cart[j].id,
            relatedProductName: cart[j].name,
            count: 1, 
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
          });
        }
        recorded++;
        
        // Also record reverse relationship
        const reverseKey = `${cart[j].id}_${cart[i].id}`;
        const reverseRef = doc(db, 'purchasePatterns', reverseKey);
        const reverseDoc = await getDoc(reverseRef);
        
        if (reverseDoc.exists()) {
          await updateDoc(reverseRef, { count: (reverseDoc.data().count || 0) + 1, lastUpdated: new Date().toISOString() });
        } else {
          await setDoc(reverseRef, { 
            id: reverseKey, 
            productId: cart[j].id,
            productName: cart[j].name,
            relatedProductId: cart[i].id,
            relatedProductName: cart[i].name,
            count: 1, 
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
          });
        }
        recorded++;
      } catch(e) {
        console.log('Pattern record error:', e);
      }
    }
  }
  
  await loadPurchasePatterns();
  return { success: true, recorded };
};

// Get suggestions with ranking from ACTUAL purchase data only
export const getLearnedSuggestions = async (currentProductId, currentCart = [], allProducts = []) => {
  try {
    if (!patternsLoaded) await loadPurchasePatterns();
    
    const patterns = purchasePatterns[currentProductId] || {};
    
    // Sort by frequency (highest first)
    const sorted = Object.entries(patterns).sort((a, b) => b[1] - a[1]).slice(0, 5);
    
    const suggestions = [];
    const cartIds = currentCart.map(i => i.id);
    
    for (const [relatedId, freq] of sorted) {
      if (!cartIds.includes(relatedId)) {
        const product = allProducts.find(p => p.id === relatedId);
        if (product) {
          suggestions.push({ 
            ...product, 
            frequency: freq,
            reason: `🎯 Bought together ${freq} time${freq > 1 ? 's' : ''}`
          });
        }
      }
    }
    
    // Return suggestions (empty array if none - NO HARDCODED FALLBACK)
    return suggestions;
  } catch (error) {
    return [];
  }
};

// ================= SHOPKEEPER NOTIFICATIONS =================
let lastOrderId = null;
let currentUserId = null;

export const setCurrentUserForNotifications = (userId) => {
  currentUserId = userId;
};

export const subscribeToNewOrders = (callback) => {
  try {
    const q = query(collection(db, 'bills'), orderBy('createdAt', 'desc'), limit(10));
    
    return onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const orderData = { id: change.doc.id, ...change.doc.data() };
          // Don't notify for orders created by current user (shopkeeper)
          if (lastOrderId !== orderData.id && (!currentUserId || orderData.createdBy !== currentUserId)) {
            lastOrderId = orderData.id;
            callback(orderData);
          }
        }
      });
    });
  } catch (error) {
    console.log('Subscribe error:', error);
    return null;
  }
};

// ================= PRODUCT FUNCTIONS =================
export const addProduct = async (productData) => {
  try {
    const price = parseFloat(productData.price) || 0;
    const docRef = await addDoc(collection(db, 'products'), {
      name: productData.name?.trim() || 'Unknown',
      pricePKR: price,
      price: price,
      category: productData.category?.trim() || 'General',
      stock: parseInt(productData.stock) || 0,
      salesCount: 0,
      discount: 0,
      discountedPrice: price,
      originalPrice: price,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getProducts = async () => {
  try {
    const snapshot = await getDocs(collection(db, 'products'));
    const products = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      products.push({ 
        id: doc.id, 
        ...data,
        price: data.pricePKR || data.price || 0,
        pricePKR: data.pricePKR || data.price || 0
      });
    });
    return { success: true, products };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const updateProduct = async (productId, productData) => {
  try {
    const productRef = doc(db, 'products', productId);
    const price = parseFloat(productData.price) || 0;
    await updateDoc(productRef, {
      name: productData.name?.trim(),
      pricePKR: price,
      price: price,
      category: productData.category?.trim(),
      stock: parseInt(productData.stock) || 0,
      updatedAt: new Date().toISOString()
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const deleteProduct = async (productId) => {
  try {
    await deleteDoc(doc(db, 'products', productId));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const updateProductStock = async (productId, quantity) => {
  try {
    const productRef = doc(db, 'products', productId);
    const productDoc = await getDoc(productRef);
    if (productDoc.exists()) {
      const currentStock = productDoc.data().stock || 0;
      await updateDoc(productRef, { stock: Math.max(0, currentStock - quantity) });
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ================= BILL FUNCTIONS =================
export const saveBill = async (billData) => {
  try {
    // Generate bill number from Firestore
    const counterRef = doc(db, 'counters', 'billCounter');
    let billNumber;
    
    try {
      const counterDoc = await getDoc(counterRef);
      if (counterDoc.exists()) {
        const currentCount = counterDoc.data().count || 0;
        const newCount = currentCount + 1;
        await updateDoc(counterRef, { count: newCount });
        billNumber = `INV-${new Date().getFullYear()}${(new Date().getMonth()+1).toString().padStart(2,'0')}-${newCount.toString().padStart(5, '0')}`;
      } else {
        await setDoc(counterRef, { count: 1 });
        billNumber = `INV-${new Date().getFullYear()}${(new Date().getMonth()+1).toString().padStart(2,'0')}-00001`;
      }
    } catch (error) {
      // Fallback to timestamp if counter fails
      billNumber = `INV-${Date.now()}`;
    }
    
    // Update product sales and stock
    for (const item of billData.cart) {
      const productRef = doc(db, 'products', item.id);
      const productDoc = await getDoc(productRef);
      if (productDoc.exists()) {
        const currentSales = productDoc.data().salesCount || 0;
        const currentStock = productDoc.data().stock || 0;
        await updateDoc(productRef, {
          salesCount: currentSales + item.quantity,
          stock: Math.max(0, currentStock - item.quantity)
        });
      }
    }
    
    const docRef = await addDoc(collection(db, 'bills'), {
      ...billData,
      billNumber: billNumber,
      createdAt: new Date().toISOString(),
      createdBy: getCurrentUser()?.uid || 'unknown',
      status: 'completed'
    });
    
    return { success: true, billId: docRef.id, billNumber: billNumber };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getBills = async () => {
  try {
    const q = query(collection(db, 'bills'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    const bills = [];
    snapshot.forEach(doc => bills.push({ id: doc.id, ...doc.data() }));
    return { success: true, bills };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getTodaySales = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const q = query(
      collection(db, 'bills'), 
      where('createdAt', '>=', today.toISOString()), 
      where('createdAt', '<', tomorrow.toISOString())
    );
    const snapshot = await getDocs(q);
    let total = 0;
    snapshot.forEach(doc => total += doc.data().total || 0);
    return { success: true, total };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getDashboardStats = async () => {
  try {
    const today = await getTodaySales();
    const bills = await getBills();
    const products = await getProducts();
    return {
      success: true,
      stats: {
        todaySales: today.success ? today.total : 0,
        totalBills: bills.success ? bills.bills.length : 0,
        totalProducts: products.success ? products.products.length : 0,
        totalRevenue: bills.success ? bills.bills.reduce((sum, b) => sum + (b.total || 0), 0) : 0
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ================= USER FUNCTIONS =================
export const registerUser = async (email, password, userData = {}) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, 'users', userCredential.user.uid), { 
      email, 
      ...userData, 
      role: 'shopkeeper', 
      createdAt: new Date().toISOString(),
      shopName: userData.shopName || 'My Store'
    });
    setCurrentUserForNotifications(userCredential.user.uid);
    return { success: true, user: userCredential.user };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    setCurrentUserForNotifications(userCredential.user.uid);
    return { success: true, user: userCredential.user };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const logoutUser = async () => {
  try {
    setCurrentUserForNotifications(null);
    await signOut(auth);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getCurrentUser = () => auth.currentUser;

export const getUserData = async (userId) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      return { success: true, userData: userDoc.data() };
    }
    return { success: true, userData: null };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const updateUserProfile = async (userId, profileData) => {
  try {
    await updateDoc(doc(db, 'users', userId), profileData);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ================= CLEAR DATABASE FUNCTION (FOR TESTING) =================
export const clearAllDatabaseData = async () => {
  try {
    const collections = ['products', 'bills', 'purchasePatterns', 'users'];
    const batch = writeBatch(db);
    
    for (const collectionName of collections) {
      const snapshot = await getDocs(collection(db, collectionName));
      snapshot.forEach(doc => {
        batch.delete(doc.ref);
      });
    }
    
    await batch.commit();
    
    // Reset patterns cache
    purchasePatterns = {};
    patternsLoaded = false;
    marketCache = {};
    lastOrderId = null;
    
    return { success: true, message: 'All database data cleared successfully' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ================= EXPORTS =================
export { auth, db, onAuthStateChanged };

export default {
  auth, 
  db, 
  onAuthStateChanged, 
  formatPKR,
  generateDarazLink,
  fetchMarketPrice,
  fetchRealMarketPriceFromAPI,
  fetchMarketPriceFromDB,
  setSerperApiKey,
  getSerperApiKey,
  calculateAIDynamicDiscount,
  loadPurchasePatterns,
  recordPurchaseCombination,
  getLearnedSuggestions,
  subscribeToNewOrders,
  setCurrentUserForNotifications,
  addProduct,
  getProducts,
  updateProduct,
  deleteProduct,
  updateProductStock,
  saveBill,
  getBills,
  getTodaySales,
  getDashboardStats,
  registerUser,
  loginUser,
  logoutUser,
  getCurrentUser,
  getUserData,
  updateUserProfile,
  clearAllDatabaseData
};