import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert, Modal, RefreshControl } from 'react-native';
import { getProducts, addProduct, updateProduct, deleteProduct } from '../config/firebase';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [stock, setStock] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    const result = await getProducts();
    if (result.success) {
      setProducts(result.products);
    } else {
      Alert.alert('Error', result.error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProducts();
    setRefreshing(false);
  };

  const formatPrice = (amount) => {
    return `₨ ${amount?.toLocaleString('en-PK') || 0}`;
  };

  const saveProduct = async () => {
    if (!name || !price) {
      Alert.alert('Error', 'Please enter name and price');
      return;
    }

    const productData = {
      name,
      price: parseFloat(price),
      category: category || 'General',
      stock: parseInt(stock) || 0,
    };

    let result;
    if (editingProduct) {
      result = await updateProduct(editingProduct.id, productData);
    } else {
      result = await addProduct(productData);
    }

    if (result.success) {
      Alert.alert('Success', editingProduct ? 'Product updated' : 'Product added');
      setModalVisible(false);
      resetForm();
      loadProducts();
    } else {
      Alert.alert('Error', result.error);
    }
  };

  const deleteProductItem = async (id) => {
    Alert.alert('Confirm', 'Delete this product?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const result = await deleteProduct(id);
          if (result.success) {
            loadProducts();
            Alert.alert('Success', 'Product deleted');
          } else {
            Alert.alert('Error', result.error);
          }
        }
      }
    ]);
  };

  const resetForm = () => {
    setName('');
    setPrice('');
    setCategory('');
    setStock('');
    setEditingProduct(null);
  };

  const renderProduct = ({ item }) => (
    <View style={styles.productCard}>
      <View style={styles.productInfo}>
        <View style={styles.productHeader}>
          <Text style={styles.productName}>{item.name}</Text>
          {item.discount > 0 && (
            <View style={styles.discountPill}>
              <Text style={styles.discountPillText}>{item.discount}% OFF</Text>
            </View>
          )}
        </View>
        <Text style={styles.productCategory}>📁 {item.category}</Text>
        <View style={styles.priceRow}>
          {item.discount > 0 ? (
            <>
              <Text style={styles.productOldPrice}>{formatPrice(item.pricePKR || item.price)}</Text>
              <Text style={styles.productPrice}>{formatPrice(item.discountedPrice)}</Text>
            </>
          ) : (
            <Text style={styles.productPrice}>{formatPrice(item.pricePKR || item.price)}</Text>
          )}
        </View>
        <View style={styles.stockRow}>
          <Text style={styles.productStock}>📦 Stock: {item.stock || 0}</Text>
          <Text style={styles.productSales}>📊 Sales: {item.salesCount || 0}</Text>
        </View>
      </View>
      <View style={styles.productActions}>
        <TouchableOpacity 
          style={styles.editBtn}
          onPress={() => {
            setEditingProduct(item);
            setName(item.name);
            setPrice((item.pricePKR || item.price).toString());
            setCategory(item.category || 'General');
            setStock((item.stock || 0).toString());
            setModalVisible(true);
          }}
        >
          <Text style={styles.editBtnText}>✏️ Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.deleteBtn}
          onPress={() => deleteProductItem(item.id)}
        >
          <Text style={styles.deleteBtnText}>🗑️ Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📦 Products</Text>
        <Text style={styles.productCount}>{products.length} products</Text>
      </View>
      <TouchableOpacity style={styles.addButton} onPress={() => {
        resetForm();
        setModalVisible(true);
      }}>
        <Text style={styles.addButtonText}>➕ Add New Product</Text>
      </TouchableOpacity>

      <FlatList
        data={products}
        keyExtractor={item => item.id}
        renderItem={renderProduct}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyText}>No products found</Text>
            <Text style={styles.emptySubText}>Tap + Add New Product to get started</Text>
          </View>
        }
        contentContainerStyle={products.length === 0 && styles.emptyContent}
        showsVerticalScrollIndicator={false}
      />

      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingProduct ? '✏️ Edit Product' : '➕ Add New Product'}</Text>
            
            <TextInput 
              style={styles.modalInput} 
              placeholder="Product Name" 
              placeholderTextColor="#aaa"
              value={name} 
              onChangeText={setName} 
            />
            <TextInput 
              style={styles.modalInput} 
              placeholder="Price (PKR)" 
              placeholderTextColor="#aaa"
              value={price} 
              onChangeText={setPrice} 
              keyboardType="numeric" 
            />
            <TextInput 
              style={styles.modalInput} 
              placeholder="Category" 
              placeholderTextColor="#aaa"
              value={category} 
              onChangeText={setCategory} 
            />
            <TextInput 
              style={styles.modalInput} 
              placeholder="Stock Quantity" 
              placeholderTextColor="#aaa"
              value={stock} 
              onChangeText={setStock} 
              keyboardType="numeric" 
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.saveBtn} onPress={saveProduct}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => {
                setModalVisible(false);
                resetForm();
              }}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f5f7fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a73e8',
  },
  productCount: {
    fontSize: 14,
    color: '#666',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  addButton: { 
    backgroundColor: '#1a73e8', 
    padding: 16, 
    margin: 15,
    borderRadius: 14, 
    alignItems: 'center',
    shadowColor: '#1a73e8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  addButtonText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: 'bold',
  },
  productCard: { 
    backgroundColor: '#fff', 
    borderRadius: 16, 
    padding: 16, 
    marginHorizontal: 15,
    marginBottom: 12,
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  productInfo: { 
    flex: 1,
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  productName: { 
    fontSize: 16, 
    fontWeight: 'bold',
    color: '#333',
  },
  discountPill: {
    backgroundColor: '#e67e22',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  discountPillText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  productCategory: { 
    fontSize: 12, 
    color: '#666', 
    marginBottom: 6,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  productOldPrice: {
    fontSize: 12,
    textDecorationLine: 'line-through',
    color: '#999',
  },
  productPrice: { 
    fontSize: 18, 
    color: '#1a73e8', 
    fontWeight: 'bold',
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  productStock: { 
    fontSize: 12, 
    color: '#666',
  },
  productSales: {
    fontSize: 12,
    color: '#34a853',
  },
  productActions: { 
    flexDirection: 'column', 
    gap: 8,
  },
  editBtn: { 
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#e8f0fe', 
    borderRadius: 10, 
    alignItems: 'center',
  },
  editBtnText: { 
    color: '#1a73e8',
    fontSize: 13,
    fontWeight: '500',
  },
  deleteBtn: { 
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#fee8e8', 
    borderRadius: 10, 
    alignItems: 'center',
  },
  deleteBtnText: { 
    color: '#dc3545',
    fontSize: 13,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
    opacity: 0.5,
  },
  emptyText: { 
    textAlign: 'center', 
    color: '#999', 
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 8,
  },
  emptySubText: {
    textAlign: 'center',
    color: '#bbb',
    fontSize: 13,
  },
  emptyContent: {
    flex: 1,
  },
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  modalContent: { 
    backgroundColor: '#fff', 
    borderRadius: 24, 
    padding: 24, 
    width: '85%' 
  },
  modalTitle: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    marginBottom: 20, 
    textAlign: 'center',
    color: '#1a73e8',
  },
  modalInput: { 
    borderWidth: 1.5, 
    borderColor: '#e0e0e0', 
    borderRadius: 14, 
    padding: 14, 
    marginBottom: 15, 
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  modalButtons: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    gap: 12,
    marginTop: 10,
  },
  saveBtn: { 
    flex: 1, 
    backgroundColor: '#34a853', 
    padding: 14, 
    borderRadius: 12, 
    alignItems: 'center' 
  },
  saveBtnText: { 
    color: '#fff', 
    fontWeight: 'bold',
    fontSize: 16,
  },
  cancelBtn: { 
    flex: 1, 
    backgroundColor: '#dc3545', 
    padding: 14, 
    borderRadius: 12, 
    alignItems: 'center' 
  },
  cancelBtnText: { 
    color: '#fff', 
    fontWeight: 'bold',
    fontSize: 16,
  },
});