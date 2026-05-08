import { db } from '../config/firebase';
import { collection, doc, setDoc, addDoc, Timestamp } from 'firebase/firestore';

// ============ YE FUNCTION EK BAAR RUN KARO ============
const setupCompetitorCollection = async () => {
  try {
    console.log('🚀 Setting up competitor_prices collection...');
    
    // Option 1: Direct document add karo (Collection auto-create ho jayegi)
    const testDocRef = await addDoc(collection(db, 'competitor_prices'), {
      productId: "test_123",
      productName: "Test Product",
      ourPrice: 1000,
      recommendedDiscount: 5,
      recommendedPrice: 950,
      lowestCompetitorPrice: 980,
      lowestCompetitorSource: "Daraz.pk",
      discountReason: "Price match with Daraz",
      competitorPrices: [
        { source: "Daraz.pk", price: 980, updatedAt: new Date().toISOString() },
        { source: "PriceOye.pk", price: 990, updatedAt: new Date().toISOString() },
        { source: "Shophive.pk", price: 1000, updatedAt: new Date().toISOString() }
      ],
      lastUpdated: Timestamp.now(),
      cachedUntil: new Date(Date.now() + 3600000).toISOString()
    });
    
    console.log('✅ Test document added with ID:', testDocRef.id);
    console.log('✅ competitor_prices collection created successfully!');
    
    return true;
  } catch (error) {
    console.error('❌ Error setting up collection:', error);
    return false;
  }
};

// ============ ACTUAL PRODUCTS KE LIYE COMPETITOR DATA ADD KARO ============
const addCompetitorDataForAllProducts = async () => {
  try {
    // Pehle saare products fetch karo
    const { getProducts } = await import('../config/firebase');
    const result = await getProducts();
    
    if (!result.success || result.products.length === 0) {
      console.log('No products found in database');
      return;
    }
    
    console.log(`📦 Found ${result.products.length} products`);
    
    // Har product ke liye competitor data add karo
    for (const product of result.products) {
      const ourPrice = product.pricePKR || product.price;
      
      // Mock competitor data (baad mein real scraping se replace hoga)
      const competitorData = {
        productId: product.id,
        productName: product.name,
        ourPrice: ourPrice,
        competitorPrices: [
          { source: "Daraz.pk", price: ourPrice * 0.95, updatedAt: new Date().toISOString() },
          { source: "PriceOye.pk", price: ourPrice * 0.93, updatedAt: new Date().toISOString() },
          { source: "Shophive.pk", price: ourPrice * 0.97, updatedAt: new Date().toISOString() }
        ],
        lowestCompetitorPrice: ourPrice * 0.93,
        lowestCompetitorSource: "PriceOye.pk",
        recommendedDiscount: Math.min(Math.ceil(7), 30),
        recommendedPrice: ourPrice * 0.93,
        discountReason: `Price matched with PriceOye.pk (PKR ${(ourPrice * 0.93).toLocaleString()})`,
        lastUpdated: Timestamp.now(),
        cachedUntil: new Date(Date.now() + 3600000).toISOString()
      };
      
      // Check if already exists
      const { getDoc, doc } = await import('firebase/firestore');
      const competitorRef = doc(db, 'competitor_prices', product.id);
      const existingDoc = await getDoc(competitorRef);
      
      if (!existingDoc.exists()) {
        await setDoc(competitorRef, competitorData);
        console.log(`✅ Added competitor data for: ${product.name}`);
      } else {
        console.log(`⏭️ Already exists for: ${product.name}`);
      }
    }
    
    console.log('🎉 All competitor data added successfully!');
  } catch (error) {
    console.error('Error adding competitor data:', error);
  }
};

// ============ COLLECTION CHECK KARNE KA FUNCTION ============
const checkCompetitorCollection = async () => {
  try {
    const { getDocs, query, collection, limit } = await import('firebase/firestore');
    const q = query(collection(db, 'competitor_prices'), limit(1));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      console.log('✅ competitor_prices collection exists!');
      console.log('📄 Sample document:', snapshot.docs[0].data());
    } else {
      console.log('❌ competitor_prices collection is empty');
    }
  } catch (error) {
    console.error('Error checking collection:', error);
  }
};