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
  writeBatch,
  Timestamp
} from 'firebase/firestore';
import { 
  initializeAuth, 
  getReactNativePersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
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

// Currency formatter for Pakistani Rupees
export const formatPKR = (amount) => {
  return `₨ ${amount?.toLocaleString('en-PK') || 0}`;
};

// ============ PRODUCT FUNCTIONS ============

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
    const querySnapshot = await getDocs(collection(db, 'products'));
    const products = [];
    querySnapshot.forEach((doc) => {
      products.push({ id: doc.id, ...doc.data() });
    });
    return { success: true, products };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getProductById = async (productId) => {
  try {
    const docRef = doc(db, 'products', productId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { success: true, product: { id: docSnap.id, ...docSnap.data() } };
    }
    return { success: false, error: 'Product not found' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const updateProduct = async (productId, productData) => {
  try {
    const productRef = doc(db, 'products', productId);
    await updateDoc(productRef, {
      ...productData,
      pricePKR: productData.price,
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
      await updateDoc(productRef, {
        stock: Math.max(0, currentStock - quantity),
        updatedAt: new Date().toISOString()
      });
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const applyDiscountToProduct = async (productId, discountPercentage) => {
  try {
    const productRef = doc(db, 'products', productId);
    const productDoc = await getDoc(productRef);
    if (productDoc.exists()) {
      const originalPrice = productDoc.data().pricePKR;
      const discountedPrice = originalPrice * (1 - discountPercentage / 100);
      await updateDoc(productRef, {
        discount: discountPercentage,
        discountedPrice: discountedPrice,
        updatedAt: new Date().toISOString()
      });
      return { success: true };
    }
    return { success: false, error: 'Product not found' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ============ BILL FUNCTIONS ============

export const saveBill = async (billData) => {
  try {
    const billNumber = `INV-${Date.now()}`;
    
    // Save bill to Firestore
    const docRef = await addDoc(collection(db, 'bills'), {
      ...billData,
      billNumber: billNumber,
      createdAt: new Date().toISOString(),
      currency: 'PKR',
      status: 'completed'
    });
    
    // Update stock and sales for each item
    const batch = writeBatch(db);
    
    for (const item of billData.cart) {
      // Add to sales collection
      const salesRef = doc(collection(db, 'sales'));
      batch.set(salesRef, {
        productId: item.id,
        productName: item.name,
        quantity: item.quantity,
        price: item.price,
        total: item.total,
        billId: docRef.id,
        billNumber: billNumber,
        date: new Date().toISOString(),
        createdAt: new Date().toISOString()
      });
      
      // Update product stock and sales count
      const productRef = doc(db, 'products', item.id);
      const productDoc = await getDoc(productRef);
      
      if (productDoc.exists()) {
        const currentSales = productDoc.data().salesCount || 0;
        const currentStock = productDoc.data().stock || 0;
        
        batch.update(productRef, {
          salesCount: currentSales + item.quantity,
          stock: Math.max(0, currentStock - item.quantity),
          updatedAt: new Date().toISOString()
        });
      }
    }
    
    // Commit all updates
    await batch.commit();
    
    return { 
      success: true, 
      billId: docRef.id, 
      billNumber: billNumber,
      billData: {
        ...billData,
        billNumber: billNumber,
        id: docRef.id
      }
    };
  } catch (error) {
    console.error('Save bill error:', error);
    return { success: false, error: error.message };
  }
};

export const getBills = async () => {
  try {
    const q = query(collection(db, 'bills'), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    const bills = [];
    querySnapshot.forEach((doc) => {
      bills.push({ id: doc.id, ...doc.data() });
    });
    return { success: true, bills };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getBillById = async (billId) => {
  try {
    const docRef = doc(db, 'bills', billId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { success: true, bill: { id: docSnap.id, ...docSnap.data() } };
    }
    return { success: false, error: 'Bill not found' };
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
    const querySnapshot = await getDocs(q);
    let total = 0;
    let count = 0;
    querySnapshot.forEach((doc) => {
      total += doc.data().total || 0;
      count++;
    });
    return { success: true, total, count };
  } catch (error) {
    return { success: false, error: error.message, total: 0, count: 0 };
  }
};

export const getSalesByDateRange = async (startDate, endDate) => {
  try {
    const q = query(
      collection(db, 'bills'),
      where('createdAt', '>=', startDate.toISOString()),
      where('createdAt', '<=', endDate.toISOString())
    );
    const querySnapshot = await getDocs(q);
    let total = 0;
    const bills = [];
    querySnapshot.forEach((doc) => {
      const bill = { id: doc.id, ...doc.data() };
      total += bill.total || 0;
      bills.push(bill);
    });
    return { success: true, total, bills };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ============ AI FUNCTIONS ============

export const getAISuggestions = async (currentProductId, currentCart = []) => {
  try {
    // Get all sales data
    const querySnapshot = await getDocs(collection(db, 'sales'));
    const combinations = {};
    const billsMap = {};
    
    // Group sales by bill
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (!billsMap[data.billId]) {
        billsMap[data.billId] = [];
      }
      billsMap[data.billId].push(data.productId);
    });
    
    // Find frequently bought together combinations
    for (const billId in billsMap) {
      const products = billsMap[billId];
      for (let i = 0; i < products.length; i++) {
        for (let j = i + 1; j < products.length; j++) {
          const key = `${products[i]}_${products[j]}`;
          combinations[key] = (combinations[key] || 0) + 1;
        }
      }
    }
    
    // Get suggestions based on current product
    const suggestions = [];
    const cartIds = currentCart.map(item => item.id);
    
    for (const combo in combinations) {
      const [prod1, prod2] = combo.split('_');
      if (prod1 === currentProductId && !cartIds.includes(prod2)) {
        suggestions.push({ productId: prod2, score: combinations[combo] });
      } else if (prod2 === currentProductId && !cartIds.includes(prod1)) {
        suggestions.push({ productId: prod1, score: combinations[combo] });
      }
    }
    
    // Sort by score and get top 3
    suggestions.sort((a, b) => b.score - a.score);
    
    // Get product details for suggestions
    const suggestionProducts = [];
    for (let i = 0; i < Math.min(3, suggestions.length); i++) {
      const result = await getProductById(suggestions[i].productId);
      if (result.success && result.product) {
        suggestionProducts.push(result.product);
      }
    }
    
    return { success: true, suggestions: suggestionProducts };
  } catch (error) {
    console.error('AI Suggestions error:', error);
    return { success: false, suggestions: [], error: error.message };
  }
};

export const getLowSellingProducts = async () => {
  try {
    const result = await getProducts();
    if (!result.success) return { success: false, lowSelling: [] };
    
    const lowSelling = (result.products || [])
      .filter(p => (p.salesCount || 0) < 10 && (p.stock || 0) > 0)
      .sort((a, b) => (a.salesCount || 0) - (b.salesCount || 0))
      .slice(0, 5);
    return { success: true, lowSelling };
  } catch (error) {
    return { success: false, lowSelling: [] };
  }
};

export const getTopSellingProducts = async (limit = 5) => {
  try {
    const result = await getProducts();
    if (!result.success) return { success: false, topProducts: [] };
    
    const topProducts = (result.products || [])
      .sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0))
      .slice(0, limit);
    return { success: true, topProducts };
  } catch (error) {
    return { success: false, topProducts: [] };
  }
};

// ============ AUTH FUNCTIONS ============

export const registerUser = async (email, password, userData = {}) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    // Update profile with display name
    if (userData.name) {
      await updateProfile(userCredential.user, {
        displayName: userData.name
      });
    }
    
    // Save user data to Firestore
    await setDoc(doc(db, 'users', userCredential.user.uid), {
      email: email,
      name: userData.name || email.split('@')[0],
      ...userData,
      role: 'shopkeeper',
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    });
    
    return { success: true, user: userCredential.user };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    
    // Update last login time
    const userRef = doc(db, 'users', userCredential.user.uid);
    await updateDoc(userRef, {
      lastLogin: new Date().toISOString()
    });
    
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

export const getCurrentUser = () => {
  return auth.currentUser;
};

export const getUserData = async (userId) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
      return { success: true, userData: userDoc.data() };
    }
    return { success: false, error: 'User not found' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const updateUserProfile = async (userId, profileData) => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      ...profileData,
      updatedAt: new Date().toISOString()
    });
    
    // Also update auth profile if name is being updated
    if (profileData.name && auth.currentUser) {
      await updateProfile(auth.currentUser, {
        displayName: profileData.name
      });
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ============ DASHBOARD STATS ============

export const getDashboardStats = async () => {
  try {
    const [salesResult, billsResult, productsResult, topProductsResult] = await Promise.all([
      getTodaySales(),
      getBills(),
      getProducts(),
      getTopSellingProducts(5)
    ]);
    
    // Calculate total revenue
    let totalRevenue = 0;
    if (billsResult.success) {
      totalRevenue = billsResult.bills.reduce((sum, bill) => sum + (bill.total || 0), 0);
    }
    
    // Calculate average bill value
    const averageBillValue = billsResult.success && billsResult.bills.length > 0 
      ? totalRevenue / billsResult.bills.length 
      : 0;
    
    // Calculate monthly sales
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthlySales = billsResult.success ? billsResult.bills.filter(bill => {
      const billDate = new Date(bill.createdAt);
      return billDate.getMonth() === currentMonth && billDate.getFullYear() === currentYear;
    }).reduce((sum, bill) => sum + (bill.total || 0), 0) : 0;
    
    return { 
      success: true, 
      stats: {
        todaySales: salesResult.success ? salesResult.total : 0,
        todayBillsCount: salesResult.success ? salesResult.count : 0,
        totalBills: billsResult.success ? billsResult.bills.length : 0,
        totalProducts: productsResult.success ? productsResult.products.length : 0,
        totalRevenue: totalRevenue,
        averageBillValue: averageBillValue,
        monthlySales: monthlySales,
        topProducts: topProductsResult.success ? topProductsResult.topProducts : []
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ============ INVENTORY FUNCTIONS ============

export const getLowStockProducts = async (threshold = 5) => {
  try {
    const result = await getProducts();
    if (!result.success) return { success: false, lowStockProducts: [] };
    
    const lowStockProducts = (result.products || [])
      .filter(p => (p.stock || 0) <= threshold && (p.stock || 0) > 0)
      .sort((a, b) => (a.stock || 0) - (b.stock || 0));
    
    return { success: true, lowStockProducts };
  } catch (error) {
    return { success: false, lowStockProducts: [] };
  }
};

export const getOutOfStockProducts = async () => {
  try {
    const result = await getProducts();
    if (!result.success) return { success: false, outOfStockProducts: [] };
    
    const outOfStockProducts = (result.products || [])
      .filter(p => (p.stock || 0) === 0);
    
    return { success: true, outOfStockProducts };
  } catch (error) {
    return { success: false, outOfStockProducts: [] };
  }
};

export const bulkUpdateStock = async (updates) => {
  try {
    const batch = writeBatch(db);
    
    for (const update of updates) {
      const productRef = doc(db, 'products', update.productId);
      batch.update(productRef, {
        stock: update.newStock,
        updatedAt: new Date().toISOString()
      });
    }
    
    await batch.commit();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ============ EXPORTS ============

export { auth, db, onAuthStateChanged };

// DEFAULT EXPORT
export default {
  auth,
  db,
  onAuthStateChanged,
  formatPKR,
  addProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  updateProductStock,
  applyDiscountToProduct,
  saveBill,
  getBills,
  getBillById,
  getTodaySales,
  getSalesByDateRange,
  getAISuggestions,
  getLowSellingProducts,
  getTopSellingProducts,
  registerUser,
  loginUser,
  logoutUser,
  getCurrentUser,
  getUserData,
  updateUserProfile,
  getDashboardStats,
  getLowStockProducts,
  getOutOfStockProducts,
  bulkUpdateStock
};