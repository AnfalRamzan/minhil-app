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
  setDoc
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
        stock: Math.max(0, currentStock - quantity)
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
    const docRef = await addDoc(collection(db, 'bills'), {
      ...billData,
      billNumber: billNumber,
      createdAt: new Date().toISOString(),
      currency: 'PKR'
    });
    
    for (const item of billData.cart) {
      await addDoc(collection(db, 'sales'), {
        productId: item.id,
        productName: item.name,
        quantity: item.quantity,
        price: item.price,
        total: item.total,
        billId: docRef.id,
        billNumber: billNumber,
        date: new Date().toISOString()
      });
      
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
    querySnapshot.forEach((doc) => {
      total += doc.data().total || 0;
    });
    return { success: true, total };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ============ AI FUNCTIONS ============

export const getAISuggestions = async (currentProductId, currentCart = []) => {
  try {
    const querySnapshot = await getDocs(collection(db, 'sales'));
    const combinations = {};
    const billsMap = {};
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (!billsMap[data.billId]) {
        billsMap[data.billId] = [];
      }
      billsMap[data.billId].push(data.productId);
    });
    
    for (const billId in billsMap) {
      const products = billsMap[billId];
      for (let i = 0; i < products.length; i++) {
        for (let j = i + 1; j < products.length; j++) {
          const key = `${products[i]}_${products[j]}`;
          combinations[key] = (combinations[key] || 0) + 1;
        }
      }
    }
    
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
    
    suggestions.sort((a, b) => b.score - a.score);
    
    const suggestionProducts = [];
    for (let i = 0; i < Math.min(3, suggestions.length); i++) {
      const result = await getProductById(suggestions[i].productId);
      if (result.success) {
        suggestionProducts.push(result.product);
      }
    }
    
    return { success: true, suggestions: suggestionProducts };
  } catch (error) {
    return { success: false, suggestions: [] };
  }
};

export const getLowSellingProducts = async () => {
  try {
    const result = await getProducts();
    if (!result.success) return { success: false, lowSelling: [] };
    
    const lowSelling = (result.products || [])
      .filter(p => (p.salesCount || 0) < 10)
      .sort((a, b) => (a.salesCount || 0) - (b.salesCount || 0))
      .slice(0, 5);
    return { success: true, lowSelling };
  } catch (error) {
    return { success: false, lowSelling: [] };
  }
};

// ============ AUTH FUNCTIONS ============

export const registerUser = async (email, password, userData = {}) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, 'users', userCredential.user.uid), {
      email: email,
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

export const getCurrentUser = () => {
  return auth.currentUser;
};

export { auth, db, onAuthStateChanged };

// ✅ ADD DEFAULT EXPORT AT THE END
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
  getTodaySales,
  getAISuggestions,
  getLowSellingProducts,
  registerUser,
  loginUser,
  logoutUser,
  getCurrentUser
};