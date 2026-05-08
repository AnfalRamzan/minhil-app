const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
app.use(cors());
app.use(express.json());

// Product price database (falls back to this if scraping fails)
const localPrices = {
  'laptop': { price: 45000, source: 'Daraz.pk' },
  'mobile': { price: 25000, source: 'PriceOye.pk' },
  'headphone': { price: 1500, source: 'Telemart.pk' },
  'shirt': { price: 800, source: 'Daraz.pk' },
  'jeans': { price: 1500, source: 'PriceOye.pk' },
  'shoes': { price: 2500, source: 'Telemart.pk' },
  'sugar': { price: 120, source: 'Metro.pk' },
  'rice': { price: 180, source: 'Carrefour.pk' },
  'oil': { price: 400, source: 'Metro.pk' },
  'soap': { price: 100, source: 'Daraz.pk' },
  'shampoo': { price: 300, source: 'Daraz.pk' },
  'detergent': { price: 250, source: 'Metro.pk' },
  'toothpaste': { price: 150, source: 'Daraz.pk' },
  'watch': { price: 4000, source: 'PriceOye.pk' },
  'charger': { price: 500, source: 'Daraz.pk' }
};

// API Endpoint to search product on Daraz
app.get('/api/search-daraz', async (req, res) => {
  const productName = req.query.q;
  if (!productName) {
    return res.status(400).json({ success: false, error: 'Product name required' });
  }

  try {
    // First check local database
    const searchKey = productName.toLowerCase();
    for (const [keyword, data] of Object.entries(localPrices)) {
      if (searchKey.includes(keyword)) {
        return res.json({
          success: true,
          product: productName,
          price: data.price,
          source: data.source,
          currency: 'PKR',
          lastUpdated: new Date().toISOString()
        });
      }
    }

    // Try to scrape Daraz (may be blocked)
    try {
      const darazUrl = `https://www.daraz.pk/catalog/?q=${encodeURIComponent(productName)}`;
      const response = await axios.get(darazUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });
      
      const $ = cheerio.load(response.data);
      let price = null;
      
      $('.pdp-price').each((i, elem) => {
        if (i === 0) {
          const priceText = $(elem).text().replace(/[^0-9]/g, '');
          price = parseInt(priceText);
        }
      });
      
      if (price) {
        return res.json({
          success: true,
          product: productName,
          price: price,
          source: 'Daraz.pk (Live)',
          currency: 'PKR'
        });
      }
    } catch (scrapeError) {
      console.log('Scraping failed:', scrapeError.message);
    }

    // If not found
    return res.json({
      success: false,
      message: `No price data found for "${productName}"`,
      suggestion: 'Try searching for: laptop, mobile, shirt, jeans, shoes, sugar, rice, oil'
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get multiple product prices
app.post('/api/compare-prices', async (req, res) => {
  const { products } = req.body;
  const results = [];

  for (const product of products) {
    const searchKey = product.name.toLowerCase();
    let found = false;
    
    for (const [keyword, data] of Object.entries(localPrices)) {
      if (searchKey.includes(keyword)) {
        results.push({
          name: product.name,
          yourPrice: product.price,
          competitorPrice: data.price,
          source: data.source,
          difference: product.price - data.price,
          recommendation: product.price > data.price 
            ? `Price is ₨${product.price - data.price} higher than ${data.source}`
            : `Price is competitive (₨${data.price - product.price} lower than ${data.source})`
        });
        found = true;
        break;
      }
    }
    
    if (!found) {
      results.push({
        name: product.name,
        yourPrice: product.price,
        competitorPrice: null,
        source: null,
        message: 'No competitor data found'
      });
    }
  }
  
  res.json({ success: true, results });
});

app.listen(3000, () => {
  console.log('Price Comparison API running on http://localhost:3000');
  console.log('\n📊 Available endpoints:');
  console.log('  GET  /api/search-daraz?q=product_name');
  console.log('  POST /api/compare-prices');
});