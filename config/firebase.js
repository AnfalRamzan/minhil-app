// config/firebase.js - COMPLETE WORKING VERSION WITH ROLE-BASED DATA & STOCK MANAGEMENT

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
  writeBatch,
  increment
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

// ================= DARAZ LINK GENERATOR =================
export const generateDarazLink = (productName) => {
  if (!productName || productName === 'Unknown') return 'https://www.daraz.pk/';
  const searchQuery = encodeURIComponent(productName.trim().toLowerCase());
  return `https://www.daraz.pk/catalog/?q=${searchQuery}&spm=a2a0e.tm80335411.search.1`;
};

// ================= USER ROLE MANAGEMENT =================
let currentUserIdForNotifications = null;

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

// ================= STOCK MANAGEMENT =================
export const updateProductStock = async (productId, quantitySold) => {
  try {
    const productRef = doc(db, 'products', productId);
    const productDoc = await getDoc(productRef);
    
    if (productDoc.exists()) {
      const currentStock = productDoc.data().stock || 0;
      const newStock = Math.max(0, currentStock - quantitySold);
      const currentSalesCount = productDoc.data().salesCount || 0;
      
      await updateDoc(productRef, {
        stock: newStock,
        salesCount: currentSalesCount + quantitySold,
        lastUpdated: new Date().toISOString()
      });
      
      return { success: true, newStock };
    }
    return { success: false, error: 'Product not found' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

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
    return { success: false, error: error.message };
  }
};

// ================= MARKET PRICE FROM DATABASE =================
export const fetchMarketPriceFromDB = async (productName, category = 'default') => {
  try {
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
    
    return { success: false, marketPrice: null };
  } catch (error) {
    return { success: false, marketPrice: null };
  }
};

// ================= MAIN MARKET PRICE FETCH =================
let marketCache = {};
let marketCacheTimer = null;

// Clear cache every 5 minutes
const setupCacheCleanup = () => {
  if (marketCacheTimer) clearInterval(marketCacheTimer);
  marketCacheTimer = setInterval(() => {
    const now = Date.now();
    for (const key in marketCache) {
      if (marketCache[key] && (now - marketCache[key].timestamp) > 300000) {
        delete marketCache[key];
      }
    }
  }, 300000);
};
setupCacheCleanup();

export const fetchMarketPrice = async (productName, category = 'default') => {
  const searchKey = (productName || "").toLowerCase().trim();
  
  if (marketCache[searchKey] && (Date.now() - marketCache[searchKey].timestamp) < 300000) {
    return marketCache[searchKey].data;
  }
  
  const result = await fetchMarketPriceFromDB(productName, category);
  
  const finalResult = {
    found: result?.marketPrice !== null,
    exactMatch: result?.exactMatch || false,
    marketPrice: result?.marketPrice || null,
    source: result?.source || 'No data available',
    url: generateDarazLink(productName),
    trend: result?.trend || 'unknown'
  };
  
  marketCache[searchKey] = { data: finalResult, timestamp: Date.now() };
  return finalResult;
};

// ================= AI DISCOUNT CALCULATION =================
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
  } else if (salesCount < 15) {
    totalDiscount += 3;
    reasons.push('Building momentum');
  } else if (salesCount > 50) {
    totalDiscount = Math.max(0, totalDiscount - 5);
    reasons.push('Best seller');
  }
  
  if (stockLevel > 100) {
    totalDiscount += 15;
    reasons.push(`High stock (${stockLevel} units)`);
  } else if (stockLevel > 50) {
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

// ================= AI PURCHASE PATTERNS (DYNAMIC LEARNING) =================
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
            reason: getSuggestionReason(suggestion.frequency)
          });
        }
      }
    }
    
    return suggestions;
  } catch (error) {
    return [];
  }
};

const getSuggestionReason = (frequency) => {
  if (frequency >= 20) return '🔥 Frequently bought together';
  if (frequency >= 10) return '👍 Popular combination';
  if (frequency >= 5) return '📈 Often purchased together';
  return '🆕 Customers also buy';
};

// ================= SHOPKEEPER NOTIFICATIONS =================
let lastOrderId = null;

export const setCurrentUserForNotifications = (userId) => {
  currentUserIdForNotifications = userId;
};

export const subscribeToNewOrders = (callback) => {
  try {
    const q = query(collection(db, 'bills'), orderBy('createdAt', 'desc'), limit(10));
    return onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const orderData = { id: change.doc.id, ...change.doc.data() };
          if (lastOrderId !== orderData.id && orderData.createdById !== currentUserIdForNotifications) {
            lastOrderId = orderData.id;
            callback(orderData);
          }
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
    const price = parseFloat(productData.price) || 0;
    const docRef = await addDoc(collection(db, 'products'), {
      name: productData.name?.trim() || 'Unknown',
      pricePKR: price,
      price: price,
      category: productData.category?.trim() || 'General',
      stock: parseInt(productData.stock) || 0,
      salesCount: 0,
      createdAt: new Date().toISOString()
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
      products.push({ id: doc.id, ...data, price: data.pricePKR || data.price || 0 });
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

export const deleteProduct = async (productId) => {
  try {
    await deleteDoc(doc(db, 'products', productId));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ================= BILL FUNCTIONS (UPDATED WITH ROLE-BASED DATA) =================
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
    
    // IMPORTANT: status determines if it's a customer order or shopkeeper bill
    const status = billData.status || 'pending';
    
    // Calculate tax correctly
    const subtotal = billData.subtotal || billData.total || 0;
    const taxRate = 0.05;
    const tax = subtotal * taxRate;
    const totalWithTax = subtotal + tax;
    
    const docRef = await addDoc(collection(db, 'bills'), {
      ...billData,
      billNumber: billNumber,
      createdAt: new Date().toISOString(),
      createdById: userId,
      createdByEmail: userEmail,
      status: status,
      subtotal: subtotal,
      tax: tax,
      total: totalWithTax
    });
    
    return { success: true, billId: docRef.id, billNumber: billNumber };
  } catch (error) {
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
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Complete bill generation with stock update
export const completeBillAndUpdateStock = async (billId, cartItems) => {
  try {
    // Update stock for all products
    const stockResult = await updateBulkProductStock(cartItems);
    if (!stockResult.success) {
      return { success: false, error: stockResult.error };
    }
    
    // Update bill status
    const statusResult = await updateBillStatus(billId, 'completed');
    if (!statusResult.success) {
      return { success: false, error: statusResult.error };
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ✅ UPDATED: getBills - Shopkeeper sees ALL bills
export const getBills = async () => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) return { success: true, bills: [] };
    
    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
    const userRole = userDoc.exists() ? userDoc.data().role : 'customer';
    
    let bills = [];
    
    if (userRole === 'shopkeeper') {
      // ✅ Shopkeeper: Get ALL bills from ALL customers
      const snapshot = await getDocs(collection(db, 'bills'));
      snapshot.forEach(doc => {
        bills.push({ id: doc.id, ...doc.data() });
      });
      console.log(`🏪 Shopkeeper ${currentUser.email}: Loading ${bills.length} total bills`);
    } else {
      // ✅ Customer: Get ONLY their own bills
      const q = query(collection(db, 'bills'), where('createdById', '==', currentUser.uid));
      const snapshot = await getDocs(q);
      snapshot.forEach(doc => {
        bills.push({ id: doc.id, ...doc.data() });
      });
      console.log(`🛒 Customer ${currentUser.email}: Loading ${bills.length} of their bills`);
    }
    
    // Sort by date (newest first)
    bills.sort((a, b) => {
      const dateA = new Date(a.createdAt);
      const dateB = new Date(b.createdAt);
      return dateB - dateA;
    });
    
    return { success: true, bills };
  } catch (error) {
    console.error('Error in getBills:', error);
    return { success: false, bills: [], error: error.message };
  }
};

// ✅ UPDATED: getMyOrders - For Customer to see ONLY their orders (completed only for spending)
export const getMyOrders = async (includePending = true) => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) return { success: true, bills: [] };
    
    // ✅ Customer: Get bills created by this user
    const q = query(collection(db, 'bills'), where('createdById', '==', currentUser.uid));
    const snapshot = await getDocs(q);
    const bills = [];
    snapshot.forEach(doc => {
      const bill = { id: doc.id, ...doc.data() };
      // Filter by status if needed
      if (!includePending && bill.status === 'pending') {
        return;
      }
      bills.push(bill);
    });
    
    bills.sort((a, b) => {
      const dateA = new Date(a.createdAt);
      const dateB = new Date(b.createdAt);
      return dateB - dateA;
    });
    
    console.log(`🛒 ${currentUser.email}: Found ${bills.length} orders`);
    return { success: true, bills };
  } catch (error) {
    console.error('Error in getMyOrders:', error);
    return { success: true, bills: [] };
  }
};

// Get customer stats (only completed orders for spending)
export const getCustomerStats = async () => {
  try {
    const result = await getMyOrders(false); // Only completed orders
    let totalSpent = 0;
    let totalItems = 0;
    
    if (result.success && result.bills.length > 0) {
      totalSpent = result.bills.reduce((sum, bill) => sum + (bill.total || 0), 0);
      totalItems = result.bills.reduce((sum, bill) => sum + (bill.cart?.length || 0), 0);
    }
    
    return {
      success: true,
      stats: {
        totalOrders: result.bills.length,
        totalSpent: totalSpent,
        totalItems: totalItems,
        pendingOrders: 0 // Count pending separately if needed
      }
    };
  } catch (error) {
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
      if (createdAt >= today && createdAt < tomorrow && bill.status === 'completed') {
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
    
    // Only count completed bills for revenue
    const completedBills = bills.success ? bills.bills.filter(b => b.status === 'completed') : [];
    const totalRevenue = completedBills.reduce((sum, b) => sum + (b.total || 0), 0);
    
    return {
      success: true,
      stats: {
        todaySales: today.success ? today.total : 0,
        totalBills: bills.success ? bills.bills.length : 0,
        totalProducts: products.success ? products.products.length : 0,
        totalRevenue: totalRevenue,
        completedBills: completedBills.length,
        pendingBills: bills.success ? bills.bills.filter(b => b.status === 'pending').length : 0
      }
    };
  } catch (error) {
    return { success: false, stats: {} };
  }
};

// ================= USER FUNCTIONS =================
export const registerUser = async (email, password, role = 'customer', userData = {}) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, 'users', userCredential.user.uid), { 
      email, 
      ...userData, 
      role: role,
      shopName: userData.shopName || (role === 'shopkeeper' ? 'My Store' : ''),
      createdAt: new Date().toISOString()
    });
    setCurrentUserForNotifications(userCredential.user.uid);
    return { success: true, user: userCredential.user, role: role };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    setCurrentUserForNotifications(userCredential.user.uid);
    const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
    const role = userDoc.exists() ? (userDoc.data().role || 'customer') : 'customer';
    return { success: true, user: userCredential.user, role: role };
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

// ================= CLEAR DATABASE FUNCTION (Shopkeeper only) =================
export const clearAllDatabaseData = async () => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) return { success: false, error: 'Not logged in' };
    
    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
    const userRole = userDoc.exists() ? userDoc.data().role : 'customer';
    
    if (userRole !== 'shopkeeper') {
      return { success: false, error: 'Only shopkeeper can clear data' };
    }
    
    // Clear products
    const productsSnapshot = await getDocs(collection(db, 'products'));
    const batch = writeBatch(db);
    productsSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    // Clear bills
    const billsSnapshot = await getDocs(collection(db, 'bills'));
    billsSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    // Clear purchase patterns
    const patternsSnapshot = await getDocs(collection(db, 'purchasePatterns'));
    patternsSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    
    // Reset counter
    const counterRef = doc(db, 'counters', 'billCounter');
    await setDoc(counterRef, { count: 0 });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ================= EXPORTS =================
export { auth, db, onAuthStateChanged };

export default {
  auth, db, onAuthStateChanged, formatPKR, generateDarazLink,
  fetchMarketPrice, calculateAIDynamicDiscount, loadPurchasePatterns,
  recordPurchaseCombination, getLearnedSuggestions, subscribeToNewOrders,
  setCurrentUserForNotifications, addProduct, getProducts, updateProduct,
  deleteProduct, saveBill, getBills, getTodaySales, getDashboardStats,
  registerUser, loginUser, logoutUser, getCurrentUser, getUserData,
  updateUserProfile, getUserRole, getMyOrders, updateBillStatus,
  clearAllDatabaseData, updateProductStock, updateBulkProductStock,
  completeBillAndUpdateStock, getCustomerStats
};