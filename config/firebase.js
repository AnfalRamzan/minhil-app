// config/firebase.js - COMPLETE FIXED VERSION WITH "CONFIRMED" STATUS

import { initializeApp, getApps, getApp } from 'firebase/app';
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

// Initialize Firebase
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

// Initialize Auth
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage)
  });
} catch (error) {
  const { getAuth } = require('firebase/auth');
  auth = getAuth(app);
}

const db = getFirestore(app);

// Utility Functions
export const formatPKR = (amount) => {
  if (!amount && amount !== 0) return '₨ 0';
  return `₨ ${Math.round(amount).toLocaleString('en-PK')}`;
};

export const generateDarazLink = (productName) => {
  if (!productName || productName === 'Unknown') return 'https://www.daraz.pk/';
  const searchQuery = encodeURIComponent(productName.trim().toLowerCase());
  return `https://www.daraz.pk/catalog/?q=${searchQuery}`;
};

// ================= NOTIFICATION SYSTEM =================
let currentUserIdForNotifications = null;
let lastProcessedOrderIds = new Set();
let notificationUnsubscribe = null;

export const setCurrentUserForNotifications = (userId) => {
  console.log(`🔔 Setting current user for notifications: ${userId}`);
  currentUserIdForNotifications = userId;
  lastProcessedOrderIds.clear();
};

export const subscribeToNewOrders = (callback) => {
  if (notificationUnsubscribe) {
    console.log('🧹 Cleaning up existing notification subscription');
    notificationUnsubscribe();
    notificationUnsubscribe = null;
  }
  
  if (!currentUserIdForNotifications) {
    console.log('⚠️ No current user set for notifications - notifications disabled');
    return () => {};
  }
  
  console.log(`🔔 Setting up real-time notifications for user: ${currentUserIdForNotifications}`);
  
  try {
    const q = query(
      collection(db, 'bills'), 
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    
    let isInitialLoad = true;
    
    notificationUnsubscribe = onSnapshot(q, (snapshot) => {
      console.log(`📡 Firestore snapshot: ${snapshot.docChanges().length} changes`);
      
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const orderData = { id: change.doc.id, ...change.doc.data() };
          
          if (isInitialLoad) {
            console.log(`  ⏭️ Skipping (initial load)`);
            return;
          }
          
          if (orderData.createdById === currentUserIdForNotifications) {
            console.log(`  ⏭️ Skipping (self order)`);
            return;
          }
          
          if (lastProcessedOrderIds.has(orderData.id)) {
            console.log(`  ⏭️ Skipping (already processed)`);
            return;
          }
          
          console.log(`🔔🔔🔔 NEW ORDER #${orderData.billNumber} 🔔🔔🔔`);
          lastProcessedOrderIds.add(orderData.id);
          callback(orderData);
          
          if (lastProcessedOrderIds.size > 100) {
            const iterator = lastProcessedOrderIds.values();
            for (let i = 0; i < 50; i++) {
              lastProcessedOrderIds.delete(iterator.next().value);
            }
          }
        }
      });
      
      isInitialLoad = false;
    }, (error) => {
      console.error('❌ Firestore snapshot error:', error);
    });
    
    console.log('✅ Notification subscription created successfully');
    
    return () => {
      console.log('🧹 Cleaning up notification subscription');
      if (notificationUnsubscribe) {
        notificationUnsubscribe();
        notificationUnsubscribe = null;
      }
    };
  } catch (error) {
    console.error('❌ Failed to create notification subscription:', error);
    return null;
  }
};

// ================= PROFILE IMAGE FUNCTIONS =================
export const updateProfileImage = async (userId, imageUri) => {
  try {
    await updateDoc(doc(db, 'users', userId), {
      profileImage: imageUri,
      updatedAt: new Date().toISOString()
    });
    return { success: true };
  } catch (error) {
    console.error('Update profile image error:', error);
    return { success: false, error: error.message };
  }
};

export const getProfileImage = async (userId) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists() && userDoc.data().profileImage) {
      return { success: true, imageUri: userDoc.data().profileImage };
    }
    return { success: true, imageUri: null };
  } catch (error) {
    console.error('Get profile image error:', error);
    return { success: false, imageUri: null };
  }
};

// ================= STOCK MANAGEMENT =================
export const updateBulkProductStock = async (cartItems) => {
  try {
    const batch = writeBatch(db);
    
    for (const item of cartItems) {
      const productRef = doc(db, 'products', item.id);
      const productDoc = await getDoc(productRef);
      
      if (productDoc.exists()) {
        const currentStock = productDoc.data().stock || 0;
        const currentSalesCount = productDoc.data().salesCount || 0;
        
        batch.update(productRef, {
          stock: Math.max(0, currentStock - item.quantity),
          salesCount: currentSalesCount + item.quantity,
          lastUpdated: new Date().toISOString()
        });
      }
    }
    
    await batch.commit();
    return { success: true };
  } catch (error) {
    console.error('Stock update error:', error);
    return { success: false, error: error.message };
  }
};

export const validateCartStock = async (cart) => {
  try {
    for (const item of cart) {
      const productRef = doc(db, 'products', item.id);
      const productDoc = await getDoc(productRef);
      if (productDoc.exists()) {
        const currentStock = productDoc.data().stock || 0;
        if (item.quantity > currentStock) {
          return { 
            valid: false, 
            product: item.name,
            available: currentStock,
            requested: item.quantity
          };
        }
      }
    }
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message };
  }
};

// ================= MARKET PRICE =================
export const fetchMarketPrice = async (productName, category = 'default') => {
  try {
    const productsRef = collection(db, 'products');
    const q = query(productsRef, where('category', '==', category), limit(10));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      let totalPrice = 0;
      let count = 0;
      snapshot.forEach(doc => {
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
          found: true,
          marketPrice: Math.round(avgPrice),
          source: `Database (${category} Category Average)`,
          url: generateDarazLink(productName),
          trend: 'stable'
        };
      }
    }
    
    return { found: false, marketPrice: null, source: 'No data available', url: generateDarazLink(productName), trend: 'unknown' };
  } catch (error) {
    return { found: false, marketPrice: null, source: 'Error fetching data', url: generateDarazLink(productName), trend: 'unknown' };
  }
};

// ================= AI DISCOUNT =================
export const calculateAIDynamicDiscount = async (product) => {
  if (!product) {
    return { discount: 0, discountedPrice: 0, originalPrice: 0, reason: 'Invalid product', savings: 0 };
  }
  
  const currentPrice = product.pricePKR || product.price || 0;
  const category = product.category || 'default';
  
  if (currentPrice <= 0) {
    return { discount: 0, discountedPrice: currentPrice, originalPrice: currentPrice, reason: 'Standard pricing', savings: 0 };
  }
  
  let totalDiscount = 0;
  let reasons = [];
  
  const salesCount = product.salesCount || 0;
  const stockLevel = product.stock || 0;
  
  if (salesCount === 0) {
    totalDiscount += 10;
    reasons.push('New product');
  } else if (salesCount < 5) {
    totalDiscount += 7;
    reasons.push(`Low sales (${salesCount} units)`);
  } else if (salesCount > 50) {
    totalDiscount = Math.max(0, totalDiscount - 5);
    reasons.push('Best seller');
  }
  
  if (stockLevel > 50) {
    totalDiscount += 8;
    reasons.push('Good stock available');
  } else if (stockLevel < 5 && stockLevel > 0) {
    totalDiscount = Math.max(0, totalDiscount - 5);
    reasons.push('Limited stock');
  }
  
  const marketData = await fetchMarketPrice(product.name, category);
  
  if (marketData.marketPrice && marketData.marketPrice > 0) {
    if (currentPrice > marketData.marketPrice) {
      const diffPercent = ((currentPrice - marketData.marketPrice) / currentPrice) * 100;
      const marketDiscount = Math.min(Math.round(diffPercent + 3), 30);
      totalDiscount += marketDiscount;
      reasons.push(`Market price ${formatPKR(marketData.marketPrice)}`);
    }
  }
  
  totalDiscount = Math.max(0, Math.min(Math.round(totalDiscount), 50));
  const discountedPrice = Math.round(currentPrice * (1 - totalDiscount / 100));
  const savings = Math.round(currentPrice - discountedPrice);
  const reasonText = reasons.length > 0 ? reasons.slice(0, 2).join(', ') : 'AI optimized price';
  
  return {
    discount: totalDiscount,
    discountedPrice: discountedPrice,
    originalPrice: currentPrice,
    reason: reasonText,
    marketPrice: marketData.marketPrice,
    savings: savings
  };
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
      purchasePatterns[data.productId][data.relatedProductId] = {
        count: data.count || 1,
        productName: data.relatedProductName,
        lastUpdated: data.lastUpdated || new Date().toISOString()
      };
    });
    patternsLoaded = true;
    return { success: true };
  } catch (error) {
    console.error('Load purchase patterns error:', error);
    return { success: false };
  }
};

export const recordPurchaseCombination = async (cart) => {
  if (!cart || cart.length < 2) return { success: true, recorded: 0 };
  let recorded = 0;
  
  for (let i = 0; i < cart.length; i++) {
    for (let j = i + 1; j < cart.length; j++) {
      try {
        const product1 = cart[i];
        const product2 = cart[j];
        
        await recordPairPattern(product1, product2);
        await recordPairPattern(product2, product1);
        recorded += 2;
      } catch(e) {
        console.error('Error recording pattern:', e);
      }
    }
  }
  
  await loadPurchasePatterns();
  return { success: true, recorded };
};

const recordPairPattern = async (product, relatedProduct) => {
  const patternKey = `${product.id}_${relatedProduct.id}`;
  const patternRef = doc(db, 'purchasePatterns', patternKey);
  const patternDoc = await getDoc(patternRef);
  
  if (patternDoc.exists()) {
    const currentCount = patternDoc.data().count || 0;
    await updateDoc(patternRef, { 
      count: currentCount + 1,
      lastUpdated: new Date().toISOString()
    });
  } else {
    await setDoc(patternRef, { 
      id: patternKey,
      productId: product.id, 
      productName: product.name,
      relatedProductId: relatedProduct.id,
      relatedProductName: relatedProduct.name,
      count: 1,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    });
  }
};

export const getLearnedSuggestions = async (currentProductId, currentCart = [], allProducts = []) => {
  try {
    if (!patternsLoaded) {
      await loadPurchasePatterns();
    }
    
    const patterns = purchasePatterns[currentProductId] || {};
    
    const sortedSuggestions = Object.entries(patterns)
      .map(([productId, data]) => ({
        productId: productId,
        productName: data.productName,
        frequency: data.count,
        lastUpdated: data.lastUpdated
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 6);
    
    const suggestions = [];
    const cartIds = currentCart.map(item => item.id);
    
    for (const suggestion of sortedSuggestions) {
      if (!cartIds.includes(suggestion.productId)) {
        const product = allProducts.find(p => p.id === suggestion.productId);
        if (product) {
          suggestions.push({
            ...product,
            frequency: suggestion.frequency,
            rank: suggestions.length + 1,
            reason: getSuggestionReason(suggestion.frequency, suggestions.length + 1)
          });
        }
      }
    }
    
    return suggestions;
  } catch (error) {
    console.error('Get learned suggestions error:', error);
    return [];
  }
};

const getSuggestionReason = (frequency, rank) => {
  if (rank === 1) return '🔥 Most frequently bought together';
  if (rank === 2) return '👍 Very popular combination';
  if (frequency >= 20) return '🌟 Frequently bought together';
  if (frequency >= 10) return '📈 Popular combination';
  return '💡 Customers also buy';
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
      createdAt: new Date().toISOString(),
      discountApplied: false,
      discountPercent: 0
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
        discountedPrice: data.discountedPrice || data.pricePKR || data.price
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
      stock: parseInt(productData.stock) || 0
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const updateProductPrice = async (productId, newPrice, applyDiscount, discountPercent) => {
  try {
    const productRef = doc(db, 'products', productId);
    const productDoc = await getDoc(productRef);
    
    if (productDoc.exists()) {
      const originalPrice = productDoc.data().pricePKR || productDoc.data().price;
      
      await updateDoc(productRef, {
        pricePKR: newPrice,
        price: newPrice,
        discountedPrice: applyDiscount ? newPrice : null,
        discountApplied: applyDiscount,
        discountPercent: applyDiscount ? discountPercent : 0,
        originalPrice: applyDiscount ? originalPrice : null,
        lastPriceUpdate: new Date().toISOString()
      });
      
      return { success: true };
    }
    return { success: false, error: 'Product not found' };
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

// ================= BILL FUNCTIONS =================
export const saveBill = async (billData) => {
  try {
    const counterRef = doc(db, 'counters', 'billCounter');
    let billNumber;
    
    try {
      const counterDoc = await getDoc(counterRef);
      if (counterDoc.exists()) {
        const newCount = (counterDoc.data().count || 0) + 1;
        await updateDoc(counterRef, { count: newCount });
        billNumber = `INV-${new Date().getFullYear()}${(new Date().getMonth()+1).toString().padStart(2,'0')}-${newCount.toString().padStart(5, '0')}`;
      } else {
        await setDoc(counterRef, { count: 1 });
        billNumber = `INV-${new Date().getFullYear()}${(new Date().getMonth()+1).toString().padStart(2,'0')}-00001`;
      }
    } catch (error) {
      billNumber = `INV-${Date.now()}`;
    }
    
    const currentUser = getCurrentUser();
    const userId = currentUser?.uid || 'unknown';
    const userEmail = currentUser?.email || 'unknown';
    
    const status = billData.status || 'pending';
    const subtotal = billData.subtotal || 0;
    const tax = billData.tax || (subtotal * 0.05);
    const total = billData.total || (subtotal + tax);
    
    const docRef = await addDoc(collection(db, 'bills'), {
      ...billData,
      billNumber: billNumber,
      createdAt: new Date().toISOString(),
      createdById: userId,
      createdByEmail: userEmail,
      status: status,
      subtotal: subtotal,
      tax: tax,
      total: total
    });
    
    console.log(`✅ Bill saved: ${billNumber} by ${userEmail} (${userId}) - Status: ${status}`);
    
    return { success: true, billId: docRef.id, billNumber: billNumber };
  } catch (error) {
    console.error('Save bill error:', error);
    return { success: false, error: error.message };
  }
};

export const updateBillStatus = async (billId, status) => {
  try {
    const billRef = doc(db, 'bills', billId);
    await updateDoc(billRef, { 
      status: status,
      updatedAt: new Date().toISOString()
    });
    console.log(`✅ Bill status updated: ${billId} -> ${status}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const confirmBillAndUpdateStock = async (billId, cartItems) => {
  try {
    const stockResult = await updateBulkProductStock(cartItems);
    if (!stockResult.success) {
      return { success: false, error: stockResult.error };
    }
    
    const statusResult = await updateBillStatus(billId, 'confirmed');
    if (!statusResult.success) {
      return { success: false, error: statusResult.error };
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getBills = async () => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) return { success: true, bills: [] };
    
    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
    const userRole = userDoc.exists() ? userDoc.data().role : 'customer';
    
    let bills = [];
    
    if (userRole === 'shopkeeper') {
      const snapshot = await getDocs(collection(db, 'bills'));
      snapshot.forEach(doc => {
        bills.push({ id: doc.id, ...doc.data() });
      });
    } else {
      const q = query(collection(db, 'bills'), where('createdById', '==', currentUser.uid));
      const snapshot = await getDocs(q);
      snapshot.forEach(doc => {
        bills.push({ id: doc.id, ...doc.data() });
      });
    }
    
    bills.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    return { success: true, bills };
  } catch (error) {
    return { success: false, bills: [], error: error.message };
  }
};

export const getMyOrders = async (includePending = true) => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) return { success: true, bills: [] };
    
    const q = query(collection(db, 'bills'), where('createdById', '==', currentUser.uid));
    const snapshot = await getDocs(q);
    const bills = [];
    snapshot.forEach(doc => {
      const bill = { id: doc.id, ...doc.data() };
      if (!includePending && bill.status === 'pending') {
        return;
      }
      bills.push(bill);
    });
    
    bills.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    return { success: true, bills };
  } catch (error) {
    console.error('Get my orders error:', error);
    return { success: true, bills: [] };
  }
};

export const getCustomerStats = async () => {
  try {
    const result = await getMyOrders(false);
    let totalSpent = 0;
    let totalItems = 0;
    
    if (result.success && result.bills.length > 0) {
      totalSpent = result.bills.reduce((sum, bill) => sum + (bill.total || 0), 0);
      totalItems = result.bills.reduce((sum, bill) => {
        const billItems = bill.cart?.reduce((itemSum, item) => itemSum + (item.quantity || 1), 0) || 0;
        return sum + billItems;
      }, 0);
    }
    
    const pendingResult = await getMyOrders(true);
    const pendingOrders = pendingResult.success ? pendingResult.bills.filter(b => b.status === 'pending').length : 0;
    
    return {
      success: true,
      stats: {
        totalOrders: result.bills.length,
        totalSpent: totalSpent,
        totalItems: totalItems,
        pendingOrders: pendingOrders
      }
    };
  } catch (error) {
    console.error('Customer stats error:', error);
    return { success: false, stats: {} };
  }
};

export const getTodaySales = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const snapshot = await getDocs(collection(db, 'bills'));
    let total = 0;
    snapshot.forEach(doc => {
      const bill = doc.data();
      const createdAt = new Date(bill.createdAt);
      if (createdAt >= today && createdAt < tomorrow && bill.status === 'confirmed') {
        total += bill.total || 0;
      }
    });
    return { success: true, total };
  } catch (error) {
    return { success: false, total: 0 };
  }
};

export const getDashboardStats = async () => {
  try {
    const today = await getTodaySales();
    const bills = await getBills();
    const products = await getProducts();
    
    const confirmedBills = bills.success ? bills.bills.filter(b => b.status === 'confirmed') : [];
    const totalRevenue = confirmedBills.reduce((sum, b) => sum + (b.total || 0), 0);
    const pendingBills = bills.success ? bills.bills.filter(b => b.status === 'pending').length : 0;
    
    return {
      success: true,
      stats: {
        todaySales: today.success ? today.total : 0,
        totalBills: bills.success ? bills.bills.length : 0,
        totalProducts: products.success ? products.products.length : 0,
        totalRevenue: totalRevenue,
        confirmedBills: confirmedBills.length,
        pendingBills: pendingBills
      }
    };
  } catch (error) {
    return { success: false, stats: {} };
  }
};

// ================= USER FUNCTIONS =================
export const getUserRole = async () => {
  try {
    const user = getCurrentUser();
    if (!user) return { success: false, role: null };
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists()) {
      return { success: true, role: userDoc.data().role || 'customer' };
    }
    return { success: false, role: 'customer' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const registerUser = async (email, password, role = 'customer', userData = {}) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, 'users', userCredential.user.uid), { 
      email, 
      ...userData, 
      role: role,
      shopName: userData.shopName || (role === 'shopkeeper' ? 'My Store' : 'My Account'),
      createdAt: new Date().toISOString()
    });
    return { success: true, user: userCredential.user, role: role };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
    const role = userDoc.exists() ? (userDoc.data().role || 'customer') : 'customer';
    return { success: true, user: userCredential.user, role: role };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const logoutUser = async () => {
  try {
    if (notificationUnsubscribe) {
      notificationUnsubscribe();
      notificationUnsubscribe = null;
    }
    setCurrentUserForNotifications(null);
    await signOut(auth);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getCurrentUser = () => {
  try {
    return auth.currentUser;
  } catch (error) {
    return null;
  }
};

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

export const clearAllDatabaseData = async () => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) return { success: false, error: 'Not logged in' };
    
    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
    const userRole = userDoc.exists() ? userDoc.data().role : 'customer';
    
    if (userRole !== 'shopkeeper') {
      return { success: false, error: 'Only shopkeeper can clear data' };
    }
    
    const productsSnapshot = await getDocs(collection(db, 'products'));
    const batch = writeBatch(db);
    productsSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    const billsSnapshot = await getDocs(collection(db, 'bills'));
    billsSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    const patternsSnapshot = await getDocs(collection(db, 'purchasePatterns'));
    patternsSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    
    const counterRef = doc(db, 'counters', 'billCounter');
    await setDoc(counterRef, { count: 1 });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ================= REVIEWS SYSTEM =================
export const submitReview = async (rating, comment) => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      return { success: false, error: 'Please login to submit review' };
    }
    
    const reviewData = {
      userId: currentUser.uid,
      userName: currentUser.email?.split('@')[0] || 'User',
      userEmail: currentUser.email,
      rating: parseInt(rating),
      comment: comment?.trim() || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active'
    };
    
    const docRef = await addDoc(collection(db, 'reviews'), reviewData);
    console.log('✅ Review submitted:', docRef.id);
    
    return { success: true, reviewId: docRef.id };
  } catch (error) {
    console.error('Submit review error:', error);
    return { success: false, error: error.message };
  }
};

export const updateReview = async (reviewId, rating, comment) => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      return { success: false, error: 'Please login to update review' };
    }
    
    const reviewRef = doc(db, 'reviews', reviewId);
    const reviewDoc = await getDoc(reviewRef);
    
    if (!reviewDoc.exists()) {
      return { success: false, error: 'Review not found' };
    }
    
    if (reviewDoc.data().userId !== currentUser.uid) {
      return { success: false, error: 'You can only update your own review' };
    }
    
    await updateDoc(reviewRef, {
      rating: parseInt(rating),
      comment: comment?.trim() || '',
      updatedAt: new Date().toISOString()
    });
    
    console.log('✅ Review updated:', reviewId);
    return { success: true };
  } catch (error) {
    console.error('Update review error:', error);
    return { success: false, error: error.message };
  }
};

export const deleteReview = async (reviewId) => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      return { success: false, error: 'Please login' };
    }
    
    const reviewRef = doc(db, 'reviews', reviewId);
    const reviewDoc = await getDoc(reviewRef);
    
    if (!reviewDoc.exists()) {
      return { success: false, error: 'Review not found' };
    }
    
    if (reviewDoc.data().userId !== currentUser.uid) {
      return { success: false, error: 'You can only delete your own review' };
    }
    
    await deleteDoc(reviewRef);
    console.log('✅ Review deleted:', reviewId);
    return { success: true };
  } catch (error) {
    console.error('Delete review error:', error);
    return { success: false, error: error.message };
  }
};

export const getUserReview = async () => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      return { success: false, review: null };
    }
    
    const q = query(collection(db, 'reviews'), where('userId', '==', currentUser.uid), limit(1));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return { success: true, review: null, hasReview: false };
    }
    
    let review = null;
    snapshot.forEach(doc => {
      review = { id: doc.id, ...doc.data() };
    });
    
    return { success: true, review: review, hasReview: true };
  } catch (error) {
    console.error('Get user review error:', error);
    return { success: false, review: null, hasReview: false };
  }
};

export const getReviews = async (limitCount = 10) => {
  try {
    const reviewsRef = collection(db, 'reviews');
    const q = query(reviewsRef, orderBy('createdAt', 'desc'), limit(limitCount));
    const snapshot = await getDocs(q);
    
    const reviews = [];
    let totalRating = 0;
    
    snapshot.forEach(doc => {
      const review = { id: doc.id, ...doc.data() };
      reviews.push(review);
      totalRating += review.rating || 0;
    });
    
    const averageRating = reviews.length > 0 ? totalRating / reviews.length : 0;
    
    return { 
      success: true, 
      reviews: reviews,
      averageRating: averageRating,
      totalReviews: reviews.length
    };
  } catch (error) {
    console.error('Get reviews error:', error);
    return { success: false, reviews: [], averageRating: 0, totalReviews: 0 };
  }
};

export const hasUserReviewed = async () => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) return { success: false, hasReviewed: false };
    
    const q = query(collection(db, 'reviews'), where('userId', '==', currentUser.uid));
    const snapshot = await getDocs(q);
    
    return { success: true, hasReviewed: !snapshot.empty };
  } catch (error) {
    return { success: false, hasReviewed: false };
  }
};

export const getUserDisplayName = () => {
  const currentUser = getCurrentUser();
  if (!currentUser) return 'Guest';
  
  let name = currentUser.email?.split('@')[0] || 'User';
  name = name.charAt(0).toUpperCase() + name.slice(1);
  return name;
};

export { auth, db, onAuthStateChanged };