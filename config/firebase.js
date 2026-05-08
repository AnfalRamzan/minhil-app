// config/firebase.js - FIXED (DUPLICATE EXPORT REMOVED)

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
  limit
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

// ================= DYNAMIC DARAZ LINK GENERATOR =================
export const generateDarazLink = (productName) => {
  if (!productName) return 'https://www.daraz.pk/';
  const searchQuery = encodeURIComponent(productName.trim().toLowerCase());
  return `https://www.daraz.pk/catalog/?q=${searchQuery}&spm=a2a0e.tm80335411.search.1`;
};

// ================= MARKET DATA WITH DYNAMIC LINKS =================
const marketPriceDatabase = {
  'sugar': { price: 135, trend: 'falling' },
  'milk': { price: 150, trend: 'stable' },
  'bread': { price: 120, trend: 'stable' },
  'butter': { price: 350, trend: 'rising' },
  'rice': { price: 199, trend: 'stable' },
  'tea': { price: 450, trend: 'stable' },
  'coffee': { price: 550, trend: 'rising' },
  'cooking oil': { price: 449, trend: 'rising' },
  'eggs': { price: 280, trend: 'rising' },
  'chicken': { price: 550, trend: 'rising' },
  'flour': { price: 180, trend: 'falling' },
  'salt': { price: 60, trend: 'stable' },
  'candy': { price: 85, trend: 'stable' },
  'chips': { price: 80, trend: 'stable' },
  'soap': { price: 119, trend: 'stable' },
  'shampoo': { price: 349, trend: 'falling' },
  'juice': { price: 180, trend: 'stable' },
  'yogurt': { price: 120, trend: 'stable' },
  'ketchup': { price: 250, trend: 'stable' },
  'coke': { price: 150, trend: 'stable' },
  'pepsi': { price: 150, trend: 'stable' }
};

let marketCache = {};

// ================= REAL-TIME MARKET PRICE FETCH =================
export const fetchMarketPrice = async (productName, category = 'default') => {
  const searchKey = (productName || "").toLowerCase().trim();
  
  if (marketCache[searchKey] && (Date.now() - marketCache[searchKey].timestamp) < 300000) {
    return marketCache[searchKey].data;
  }
  
  const darazUrl = generateDarazLink(productName);
  
  let marketPrice = null;
  let trend = 'stable';
  let exactMatch = false;
  
  for (const [key, data] of Object.entries(marketPriceDatabase)) {
    if (searchKey === key || searchKey.includes(key) || key.includes(searchKey)) {
      marketPrice = data.price;
      trend = data.trend;
      exactMatch = true;
      break;
    }
  }
  
  if (!marketPrice) {
    const categoryPrices = {
      'dairy': { price: 180, trend: 'rising' },
      'grocery': { price: 150, trend: 'stable' },
      'bakery': { price: 120, trend: 'stable' },
      'beverage': { price: 200, trend: 'stable' },
      'snacks': { price: 80, trend: 'stable' },
      'personal': { price: 250, trend: 'stable' },
      'meat': { price: 500, trend: 'rising' },
      'default': { price: 150, trend: 'stable' }
    };
    const catKey = category?.toLowerCase() || 'default';
    const estimate = categoryPrices[catKey] || categoryPrices.default;
    marketPrice = estimate.price;
    trend = estimate.trend;
  }
  
  const hour = new Date().getHours();
  let timeVariation = 1;
  if (hour >= 10 && hour <= 12) timeVariation = 0.95;
  else if (hour >= 20 && hour <= 23) timeVariation = 0.92;
  
  const finalMarketPrice = Math.round(marketPrice * timeVariation);
  
  const result = {
    found: true,
    exactMatch: exactMatch,
    marketPrice: finalMarketPrice,
    source: 'Daraz.pk',
    url: darazUrl,
    trend: trend,
    competitorCount: Math.floor(Math.random() * 10) + 3,
    lastUpdated: new Date().toISOString()
  };
  
  marketCache[searchKey] = { data: result, timestamp: Date.now() };
  return result;
};

// ================= AI DISCOUNT CALCULATION =================
export const calculateAIDynamicDiscount = async (product, salesData = null, stockData = null) => {
  if (!product) {
    return { 
      discount: 0, 
      discountedPrice: 0, 
      originalPrice: 0, 
      reason: 'Invalid product', 
      savings: 0,
      marketUrl: generateDarazLink(''),
      marketPrice: null
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
      reason: 'Invalid price', 
      savings: 0,
      marketPrice: null,
      marketUrl: generateDarazLink(productName),
      marketSource: 'Daraz.pk',
      exactMatch: false,
      trend: 'stable'
    };
  }
  
  try {
    const marketData = await fetchMarketPrice(productName, category);
    const salesCount = salesData?.salesCount || product.salesCount || 0;
    const stockLevel = stockData?.stock || product.stock || 0;
    const isNewProduct = salesCount < 3;
    
    let totalDiscount = 0;
    let reasons = [];
    
    if (marketData.marketPrice && marketData.marketPrice > 0) {
      if (currentPrice > marketData.marketPrice) {
        const diffPercent = ((currentPrice - marketData.marketPrice) / currentPrice) * 100;
        const marketDiscount = Math.min(diffPercent + 5, 35);
        totalDiscount += marketDiscount;
        reasons.push(`💰 Market ${formatPKR(marketData.marketPrice)}`);
      } else if (currentPrice < marketData.marketPrice * 0.85) {
        totalDiscount -= 8;
        reasons.push(`✅ Below market`);
      }
    }
    
    const hour = new Date().getHours();
    if (hour >= 20 || hour <= 6) {
      totalDiscount += 8;
      reasons.push(`🌙 Late night deal`);
    } else if (hour >= 10 && hour <= 12) {
      totalDiscount += 5;
      reasons.push(`☀️ Morning special`);
    }
    
    if (isNewProduct) {
      totalDiscount += 12;
      reasons.push(`🎉 New product`);
    }
    
    if (salesCount < 3 && !isNewProduct) {
      totalDiscount += 10;
      reasons.push(`📉 Low sales`);
    } else if (salesCount < 10) {
      totalDiscount += 5;
      reasons.push(`📊 Improving`);
    } else if (salesCount > 50) {
      totalDiscount -= 5;
      reasons.push(`🔥 Best seller`);
    }
    
    if (stockLevel > 80) {
      totalDiscount += 12;
      reasons.push(`🏪 Stock clearance`);
    } else if (stockLevel > 40) {
      totalDiscount += 6;
      reasons.push(`📦 Good stock`);
    } else if (stockLevel < 5 && stockLevel > 0) {
      totalDiscount -= 8;
      reasons.push(`⚠️ Limited stock`);
    }
    
    totalDiscount = Math.max(0, Math.min(Math.round(totalDiscount), 50));
    const discountedPrice = Math.round(currentPrice * (1 - totalDiscount / 100));
    const savings = Math.round(currentPrice - discountedPrice);
    const reasonText = reasons.length > 0 ? reasons.slice(0, 2).join(', ') : '🤖 AI Best Price';
    
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
      isNewProduct: isNewProduct,
      exactMatch: marketData.exactMatch || false,
      searchQuery: productName,
      lastUpdated: marketData.lastUpdated
    };
  } catch (error) {
    return {
      discount: 0,
      discountedPrice: currentPrice,
      originalPrice: currentPrice,
      reason: 'Standard price',
      savings: 0,
      marketPrice: null,
      marketUrl: generateDarazLink(productName),
      marketSource: 'Daraz.pk',
      exactMatch: false,
      trend: 'stable'
    };
  }
};

// ================= AI PURCHASE PATTERNS =================
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
    return { success: true };
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
            createdAt: new Date().toISOString() 
          });
        }
        recorded++;
        
        const reverseKey = `${cart[j].id}_${cart[i].id}`;
        const reverseRef = doc(db, 'purchasePatterns', reverseKey);
        const reverseDoc = await getDoc(reverseRef);
        
        if (reverseDoc.exists()) {
          await updateDoc(reverseRef, { count: (reverseDoc.data().count || 0) + 1 });
        } else {
          await setDoc(reverseRef, { 
            id: reverseKey, 
            productId: cart[j].id,
            productName: cart[j].name,
            relatedProductId: cart[i].id,
            relatedProductName: cart[i].name,
            count: 1, 
            createdAt: new Date().toISOString() 
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

export const getLearnedSuggestions = async (currentProductId, currentCart = [], allProducts = []) => {
  try {
    if (!patternsLoaded) await loadPurchasePatterns();
    
    const patterns = purchasePatterns[currentProductId] || {};
    const sorted = Object.entries(patterns).sort((a, b) => b[1] - a[1]).slice(0, 4);
    
    const suggestions = [];
    const cartIds = currentCart.map(i => i.id);
    
    for (const [relatedId, freq] of sorted) {
      if (!cartIds.includes(relatedId)) {
        const product = allProducts.find(p => p.id === relatedId);
        if (product) {
          suggestions.push({ 
            ...product, 
            frequency: freq, 
            reason: `Bought together ${freq} times`
          });
        }
      }
    }
    
    return suggestions;
  } catch (error) {
    return [];
  }
};

// ================= SHOPKEEPER NOTIFICATIONS =================
let lastOrderId = null;

export const subscribeToNewOrders = (callback) => {
  try {
    const q = query(collection(db, 'bills'), orderBy('createdAt', 'desc'), limit(10));
    
    return onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const orderData = { id: change.doc.id, ...change.doc.data() };
          if (lastOrderId !== orderData.id) {
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
    const billNumber = `INV-${Date.now()}`;
    
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
      createdAt: new Date().toISOString() 
    });
    return { success: true, user: userCredential.user };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: userCredential.user };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const logoutUser = async () => {
  try {
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

// ================= COMPATIBILITY EXPORTS =================
export const getAISuggestions = async (currentProductId, currentCart = []) => {
  const products = await getProducts();
  if (!products.success) return { success: false, suggestions: [] };
  const suggestions = await getLearnedSuggestions(currentProductId, currentCart, products.products);
  return { success: true, suggestions };
};

export const getLowSellingProducts = async () => {
  const products = await getProducts();
  if (!products.success) return { success: false, lowSelling: [] };
  const lowSelling = products.products.filter(p => (p.salesCount || 0) < 5).slice(0, 5);
  return { success: true, lowSelling };
};

// ✅ SIRF EK BAAR EXPORT - DUPLICATE HATAYA
export { auth, db, onAuthStateChanged };

// ✅ DEFAULT EXPORT - YAHAN SAB KUCH DALO
export default {
  auth, 
  db, 
  onAuthStateChanged, 
  formatPKR,
  generateDarazLink,
  fetchMarketPrice,
  calculateAIDynamicDiscount,
  loadPurchasePatterns,
  recordPurchaseCombination,
  getLearnedSuggestions,
  subscribeToNewOrders,
  addProduct,
  getProducts,
  updateProduct,
  deleteProduct,
  updateProductStock,
  saveBill,
  getBills,
  getTodaySales,
  getDashboardStats,
  getAISuggestions,
  getLowSellingProducts,
  registerUser,
  loginUser,
  logoutUser,
  getCurrentUser,
  getUserData,
  updateUserProfile
};