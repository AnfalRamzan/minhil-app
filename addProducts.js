const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyAb7Fsyr-DLWIA3jSYYplWSOoeDzYVflK8",
  authDomain: "smart-billing-system-dfa51.firebaseapp.com",
  projectId: "smart-billing-system-dfa51",
  storageBucket: "smart-billing-system-dfa51.firebasestorage.app",
  messagingSenderId: "779647911861",
  appId: "1:779647911861:web:586e1f97394b35bc683bfc"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const products = [
  {
    name: "Milk",
    pricePKR: 220,
    category: "Dairy",
    stock: 50,
    salesCount: 0,
    discount: 0,
    discountedPrice: 220,
    originalPrice: 220,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: "Bread",
    pricePKR: 150,
    category: "Bakery",
    stock: 40,
    salesCount: 0,
    discount: 0,
    discountedPrice: 150,
    originalPrice: 150,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: "Butter",
    pricePKR: 350,
    category: "Dairy",
    stock: 30,
    salesCount: 0,
    discount: 0,
    discountedPrice: 350,
    originalPrice: 350,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: "Eggs (12 pcs)",
    pricePKR: 280,
    category: "Dairy",
    stock: 60,
    salesCount: 0,
    discount: 0,
    discountedPrice: 280,
    originalPrice: 280,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: "Coca Cola (1.5L)",
    pricePKR: 150,
    category: "Beverages",
    stock: 100,
    salesCount: 0,
    discount: 0,
    discountedPrice: 150,
    originalPrice: 150,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: "Lays Chips",
    pricePKR: 80,
    category: "Snacks",
    stock: 80,
    salesCount: 0,
    discount: 0,
    discountedPrice: 80,
    originalPrice: 80,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: "Sugar (1kg)",
    pricePKR: 130,
    category: "Groceries",
    stock: 55,
    salesCount: 0,
    discount: 0,
    discountedPrice: 130,
    originalPrice: 130,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: "Cooking Oil (1L)",
    pricePKR: 520,
    category: "Groceries",
    stock: 35,
    salesCount: 0,
    discount: 0,
    discountedPrice: 520,
    originalPrice: 520,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: "Rice Basmati (1kg)",
    pricePKR: 450,
    category: "Groceries",
    stock: 45,
    salesCount: 0,
    discount: 0,
    discountedPrice: 450,
    originalPrice: 450,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: "Chicken (1kg)",
    pricePKR: 550,
    category: "Meat",
    stock: 25,
    salesCount: 0,
    discount: 0,
    discountedPrice: 550,
    originalPrice: 550,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: "Tea (250g)",
    pricePKR: 380,
    category: "Beverages",
    stock: 40,
    salesCount: 0,
    discount: 0,
    discountedPrice: 380,
    originalPrice: 380,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: "Flour (2kg)",
    pricePKR: 180,
    category: "Groceries",
    stock: 50,
    salesCount: 0,
    discount: 0,
    discountedPrice: 180,
    originalPrice: 180,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: "Salt (1kg)",
    pricePKR: 60,
    category: "Groceries",
    stock: 70,
    salesCount: 0,
    discount: 0,
    discountedPrice: 60,
    originalPrice: 60,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: "Yogurt (500g)",
    pricePKR: 120,
    category: "Dairy",
    stock: 45,
    salesCount: 0,
    discount: 0,
    discountedPrice: 120,
    originalPrice: 120,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: "Ketchup (500ml)",
    pricePKR: 250,
    category: "Condiments",
    stock: 30,
    salesCount: 0,
    discount: 0,
    discountedPrice: 250,
    originalPrice: 250,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

async function addProducts() {
  console.log("🔄 Adding 15 products to Firebase...");
  console.log("=====================================");
  
  let successCount = 0;
  let failCount = 0;
  
  for (const product of products) {
    try {
      const docRef = await addDoc(collection(db, 'products'), product);
      console.log(`✅ Added: ${product.name.padEnd(20)} | ₨ ${product.pricePKR} | ${product.category}`);
      successCount++;
    } catch (error) {
      console.error(`❌ Error adding ${product.name}:`, error.message);
      failCount++;
    }
  }
  
  console.log("=====================================");
  console.log(`\n🎉 Products added successfully!`);
  console.log(`✅ Success: ${successCount} products`);
  console.log(`❌ Failed: ${failCount} products`);
  console.log(`📦 Total products in database: ${products.length}`);
  process.exit();
}

addProducts();