// config/firebase.js - COMPLETE WITH WORKING DARAZ LINKS

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

// ================= COMPLETE MARKET DATABASE WITH DARAZ LINKS =================
const marketDatabase = {
  'sugar': { 
    price: 135, source: 'Daraz.pk', 
    url: 'https://www.daraz.pk/catalog/?q=sugar&spm=a2a0e.tm80335411.search.1',
    category: 'grocery', trend: 'falling' 
  },
  'milk': { 
    price: 150, source: 'Daraz.pk', 
    url: 'https://www.daraz.pk/catalog/?q=milk&spm=a2a0e.tm80335411.search.1',
    category: 'dairy', trend: 'stable' 
  },
  'bread': { 
    price: 120, source: 'Daraz.pk', 
    url: 'https://www.daraz.pk/catalog/?q=bread&spm=a2a0e.tm80335411.search.1',
    category: 'bakery', trend: 'stable' 
  },
  'butter': { 
    price: 350, source: 'Daraz.pk', 
    url: 'https://www.daraz.pk/catalog/?q=butter&spm=a2a0e.tm80335411.search.1',
    category: 'dairy', trend: 'rising' 
  },
  'rice': { 
    price: 199, source: 'Daraz.pk', 
    url: 'https://www.daraz.pk/catalog/?q=rice&spm=a2a0e.tm80335411.search.1',
    category: 'grocery', trend: 'stable' 
  },
  'tea': { 
    price: 450, source: 'Daraz.pk', 
    url: 'https://www.daraz.pk/catalog/?q=tea&spm=a2a0e.tm80335411.search.1',
    category: 'beverage', trend: 'stable' 
  },
  'coffee': { 
    price: 550, source: 'Daraz.pk', 
    url: 'https://www.daraz.pk/catalog/?q=coffee&spm=a2a0e.tm80335411.search.1',
    category: 'beverage', trend: 'rising' 
  },
  'cooking oil': { 
    price: 449, source: 'Daraz.pk', 
    url: 'https://www.daraz.pk/catalog/?q=cooking+oil&spm=a2a0e.tm80335411.search.1',
    category: 'grocery', trend: 'rising' 
  },
  'eggs': { 
    price: 15, source: 'Daraz.pk', 
    url: 'https://www.daraz.pk/catalog/?q=eggs&spm=a2a0e.tm80335411.search.1',
    category: 'dairy', trend: 'rising' 
  },
  'biscuit': { 
    price: 50, source: 'Daraz.pk', 
    url: 'https://www.daraz.pk/catalog/?q=biscuit&spm=a2a0e.tm80335411.search.1',
    category: 'snacks', trend: 'stable' 
  },
  'chips': { 
    price: 30, source: 'Daraz.pk', 
    url: 'https://www.daraz.pk/catalog/?q=chips&spm=a2a0e.tm80335411.search.1',
    category: 'snacks', trend: 'stable' 
  },
  'soap': { 
    price: 119, source: 'Daraz.pk', 
    url: 'https://www.daraz.pk/catalog/?q=soap&spm=a2a0e.tm80335411.search.1',
    category: 'personal', trend: 'stable' 
  },
  'shampoo': { 
    price: 349, source: 'Daraz.pk', 
    url: 'https://www.daraz.pk/catalog/?q=shampoo&spm=a2a0e.tm80335411.search.1',
    category: 'personal', trend: 'falling' 
  },
  'juice': { 
    price: 180, source: 'Daraz.pk', 
    url: 'https://www.daraz.pk/catalog/?q=juice&spm=a2a0e.tm80335411.search.1',
    category: 'beverage', trend: 'stable' 
  },
  'salt': { 
    price: 20, source: 'Daraz.pk', 
    url: 'https://www.daraz.pk/catalog/?q=salt&spm=a2a0e.tm80335411.search.1',
    category: 'grocery', trend: 'stable' 
  },
  'flour': { 
    price: 120, source: 'Daraz.pk', 
    url: 'https://www.daraz.pk/catalog/?q=flour&spm=a2a0e.tm80335411.search.1',
    category: 'grocery', trend: 'falling' 
  }
};

// ================= SMART MARKET FETCH =================
let marketCache = {};

export const fetchMarketPrice = async (productName) => {
  const searchKey = (productName || "").toLowerCase().trim();
  
  // Check cache
  if (marketCache[searchKey] && (Date.now() - marketCache[searchKey].timestamp) < 3600000) {
    return marketCache[searchKey].data;
  }
  
  // Step 1: Exact match in database
  let foundData = null;
  for (const [key, data] of Object.entries(marketDatabase)) {
    if (searchKey === key || searchKey.includes(key) || key.includes(searchKey)) {
      foundData = data;
      break;
    }
  }
  
  let result;
  
  if (foundData) {
    // Product found - use exact market data
    result = {
      found: true,
      exactMatch: true,
      marketPrice: foundData.price,
      lowestPrice: foundData.price * 0.9,
      highestPrice: foundData.price * 1.15,
      source: foundData.source,
      url: foundData.url,  // ✅ DARAZ LINK
      trend: foundData.trend,
      category: foundData.category,
      competitorCount: 5
    };
  } else {
    // Product NOT found - generate Daraz search link
    const darazSearchUrl = `https://www.daraz.pk/catalog/?q=${encodeURIComponent(productName)}&spm=a2a0e.tm80335411.search.1`;
    
    result = {
      found: false,
      exactMatch: false,
      marketPrice: null,
      lowestPrice: null,
      highestPrice: null,
      source: "Daraz Search",
      url: darazSearchUrl,  // ✅ DARAZ SEARCH LINK (har product ke liye)
      trend: "unknown",
      category: "default",
      competitorCount: 3,
      estimated: true
    };
  }
  
  marketCache[searchKey] = { data: result, timestamp: Date.now() };
  return result;
};

// ================= AI DISCOUNT CALCULATION =================
export const calculateAIDynamicDiscount = async (product, salesData = null, stockData = null) => {
  const currentPrice = product.pricePKR || product.price || 0;
  const category = product.category || 'default';
  
  if (currentPrice <= 0) {
    return { 
      discount: 0, 
      discountedPrice: currentPrice, 
      originalPrice: currentPrice,
      reason: 'Invalid price', 
      savings: 0,
      marketPrice: null,
      marketUrl: `https://www.daraz.pk/catalog/?q=${encodeURIComponent(product?.name || '')}`,
      marketSource: null,
      exactMatch: false
    };
  }
  
  const marketData = await fetchMarketPrice(product.name);
  const salesCount = salesData?.salesCount || product.salesCount || 0;
  const stockLevel = stockData?.stock || product.stock || 0;
  const isNewProduct = salesCount < 3;
  
  let totalDiscount = 0;
  let reasons = [];
  
  // FACTOR 1: Market Competition
  if (marketData.found && marketData.marketPrice && marketData.marketPrice > 0) {
    if (currentPrice > marketData.marketPrice) {
      const diffPercent = ((currentPrice - marketData.marketPrice) / currentPrice) * 100;
      const marketDiscount = Math.min(diffPercent + 5, 35);
      totalDiscount += marketDiscount;
      reasons.push(`💰 Market ${formatPKR(marketData.marketPrice)}`);
    } else if (currentPrice < marketData.marketPrice * 0.85) {
      totalDiscount -= 8;
      reasons.push(`✅ Already below market`);
    }
  }
  
  // FACTOR 2: New Product
  if (isNewProduct) {
    totalDiscount += 12;
    reasons.push(`🎉 New product launch`);
  }
  
  // FACTOR 3: Sales Performance
  if (salesCount < 3 && !isNewProduct) {
    totalDiscount += 10;
    reasons.push(`📉 Low sales`);
  } else if (salesCount < 10) {
    totalDiscount += 5;
    reasons.push(`📊 Improving sales`);
  } else if (salesCount > 50) {
    totalDiscount -= 5;
    reasons.push(`🔥 Best seller`);
  }
  
  // FACTOR 4: Stock Clearance
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
  
  // Ensure discount between 0 and 45%
  totalDiscount = Math.max(0, Math.min(totalDiscount, 45));
  
  const discountedPrice = currentPrice * (1 - totalDiscount / 100);
  const reasonText = reasons.length > 0 ? reasons.slice(0, 2).join(', ') : '🤖 AI Best Price';
  
  return {
    discount: Math.round(totalDiscount),
    discountedPrice: Math.round(discountedPrice),
    originalPrice: currentPrice,
    reason: reasonText,
    marketPrice: marketData.marketPrice,
    marketSource: marketData.source,
    marketUrl: marketData.url,  // ✅ YAHAN PE DARAZ LINK AAYEGA
    trend: marketData.trend,
    savings: Math.round(currentPrice - discountedPrice),
    isNewProduct: isNewProduct,
    exactMatch: marketData.exactMatch || false
  };
};

// ================= AI PURCHASE PATTERNS =================
let purchasePatterns = {};

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
    return { success: true };
  } catch (error) {
    return { success: false };
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
          await updateDoc(patternRef, { count: (patternDoc.data().count || 0) + 1, lastUpdated: new Date().toISOString() });
        } else {
          await setDoc(patternRef, { 
            id: patternKey, 
            productId: cart[i].id, 
            relatedProductId: cart[j].id, 
            count: 1, 
            createdAt: new Date().toISOString() 
          });
        }
        recorded += 2;
      } catch(e) {}
    }
  }
  return { success: true, recorded };
};

export const getLearnedSuggestions = async (currentProductId, currentCart = [], allProducts = []) => {
  try {
    if (Object.keys(purchasePatterns).length === 0) await loadPurchasePatterns();
    const patterns = purchasePatterns[currentProductId] || {};
    const sorted = Object.entries(patterns).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const suggestions = [];
    const cartIds = currentCart.map(i => i.id);
    for (const [relatedId, freq] of sorted) {
      if (!cartIds.includes(relatedId)) {
        const product = allProducts.find(p => p.id === relatedId);
        if (product) suggestions.push({ ...product, frequency: freq, reason: `Bought ${freq} times` });
      }
    }
    return suggestions;
  } catch (error) {
    return [];
  }
};

// ================= SHOPKEEPER NOTIFICATIONS =================
export const subscribeToNewOrders = (callback) => {
  try {
    const q = query(collection(db, 'bills'), orderBy('createdAt', 'desc'), limit(10));
    return onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          callback({ id: change.doc.id, ...change.doc.data() });
        }
      });
    });
  } catch (error) {
    return null;
  }
};

// ================= PRODUCT FUNCTIONS =================
export const addProduct = async (productData) => {
  try {
    const docRef = await addDoc(collection(db, 'products'), {
      ...productData,
      pricePKR: productData.price,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      salesCount: 0,
      discount: 0,
      discountedPrice: productData.price,
      originalPrice: productData.price
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
    snapshot.forEach(doc => products.push({ id: doc.id, ...doc.data() }));
    return { success: true, products };
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

export const saveBill = async (billData) => {
  try {
    const billNumber = `INV-${Date.now()}`;
    const docRef = await addDoc(collection(db, 'bills'), {
      ...billData,
      billNumber: billNumber,
      createdAt: new Date().toISOString(),
      status: 'completed'
    });
    
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
    const q = query(collection(db, 'bills'), where('createdAt', '>=', today.toISOString()), where('createdAt', '<', tomorrow.toISOString()));
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
        totalProducts: products.success ? products.products.length : 0
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ================= AUTH FUNCTIONS =================
export const registerUser = async (email, password, userData = {}) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, 'users', userCredential.user.uid), { 
      email, ...userData, role: 'shopkeeper', createdAt: new Date().toISOString() 
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

// ================= COMPATIBILITY =================
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

export { auth, db, onAuthStateChanged };

export default {
  auth, db, onAuthStateChanged, formatPKR,
  fetchMarketPrice, calculateAIDynamicDiscount,
  loadPurchasePatterns, recordPurchaseCombination, getLearnedSuggestions,
  subscribeToNewOrders,
  addProduct, getProducts, updateProductStock,
  saveBill, getBills, getTodaySales, getDashboardStats,
  getAISuggestions, getLowSellingProducts,
  registerUser, loginUser, logoutUser, getCurrentUser
};