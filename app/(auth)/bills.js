import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, RefreshControl, Modal } from 'react-native';
import { getBills } from '../../config/firebase';

export default function Bills() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    loadBills();
  }, []);

  const loadBills = async () => {
    const result = await getBills();
    if (result.success) {
      setBills(result.bills);
    } else {
      Alert.alert('Error', result.error);
    }
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBills();
    setRefreshing(false);
  };

  const formatPrice = (amount) => {
    return `₨ ${amount?.toLocaleString('en-PK') || 0}`;
  };

  const viewBillDetails = (bill) => {
    setSelectedBill(bill);
    setModalVisible(true);
  };

  const calculateSubtotal = (cart) => {
    return cart?.reduce((sum, item) => sum + (item.price * item.quantity), 0) || 0;
  };

  const calculateTax = (subtotal) => {
    return subtotal * 0.05;
  };

  const renderBillItem = ({ item }) => (
    <TouchableOpacity style={styles.billCard} onPress={() => viewBillDetails(item)} activeOpacity={0.7}>
      <View style={styles.billHeader}>
        <View>
          <Text style={styles.billNumber}>{item.billNumber}</Text>
          <Text style={styles.billTime}>{new Date(item.createdAt).toLocaleString()}</Text>
        </View>
        <Text style={styles.billTotal}>{formatPrice(item.total)}</Text>
      </View>
      <View style={styles.billFooter}>
        <Text style={styles.billItems}>{item.cart?.length || 0} items</Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>✅ Paid</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Loading bills...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📄 My Bills</Text>
        <Text style={styles.headerCount}>{bills.length} bills</Text>
      </View>

      {bills.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyText}>No bills found</Text>
          <Text style={styles.emptySubText}>Generate your first bill from billing screen</Text>
        </View>
      ) : (
        <FlatList
          data={bills}
          keyExtractor={item => item.id}
          renderItem={renderBillItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal visible={modalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🧾 Bill Details</Text>
            {selectedBill && (
              <>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Bill Number:</Text>
                  <Text style={styles.detailValue}>{selectedBill.billNumber}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Date:</Text>
                  <Text style={styles.detailValue}>{new Date(selectedBill.createdAt).toLocaleString()}</Text>
                </View>
                <View style={styles.divider} />
                <Text style={styles.itemsTitle}>Items:</Text>
                {selectedBill.cart?.map((item, idx) => (
                  <View key={idx} style={styles.itemRow}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemQty}>x{item.quantity}</Text>
                    <Text style={styles.itemPrice}>{formatPrice(item.price)}</Text>
                  </View>
                ))}
                <View style={styles.divider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Subtotal:</Text>
                  <Text style={styles.summaryValue}>{formatPrice(calculateSubtotal(selectedBill.cart))}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Tax (5% GST):</Text>
                  <Text style={styles.summaryValue}>{formatPrice(calculateTax(calculateSubtotal(selectedBill.cart)))}</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total:</Text>
                  <Text style={styles.totalValue}>{formatPrice(selectedBill.total)}</Text>
                </View>
              </>
            )}
            <TouchableOpacity style={styles.closeButton} onPress={() => setModalVisible(false)}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
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
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1a73e8' },
  headerCount: { fontSize: 14, color: '#666', backgroundColor: '#f0f0f0', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f7fa' },
  loadingText: { fontSize: 14, color: '#666' },
  listContent: { padding: 15 },
  billCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
  billHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  billNumber: { fontSize: 16, fontWeight: 'bold', color: '#1a73e8', fontFamily: 'monospace' },
  billTime: { fontSize: 11, color: '#999', marginTop: 2 },
  billTotal: { fontSize: 20, fontWeight: 'bold', color: '#1a73e8' },
  billFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  billItems: { fontSize: 13, color: '#666' },
  statusBadge: { backgroundColor: '#e6f4ea', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 11, color: '#34a853', fontWeight: '500' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 64, marginBottom: 16, opacity: 0.5 },
  emptyText: { fontSize: 18, fontWeight: '500', color: '#999', marginBottom: 8 },
  emptySubText: { fontSize: 13, color: '#bbb', textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 24, padding: 20, width: '90%', maxHeight: '80%' },
  modalTitle: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 16, color: '#1a73e8' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  detailLabel: { fontSize: 14, color: '#666' },
  detailValue: { fontSize: 14, fontWeight: '500', color: '#333' },
  divider: { height: 1, backgroundColor: '#e0e0e0', marginVertical: 12 },
  itemsTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  itemName: { fontSize: 14, color: '#333', flex: 2 },
  itemQty: { fontSize: 14, color: '#666', width: 50, textAlign: 'center' },
  itemPrice: { fontSize: 14, fontWeight: '500', color: '#1a73e8', width: 70, textAlign: 'right' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  summaryLabel: { fontSize: 14, color: '#666' },
  summaryValue: { fontSize: 14, color: '#333' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12, marginTop: 8, borderTopWidth: 1, borderTopColor: '#e0e0e0' },
  totalLabel: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  totalValue: { fontSize: 20, fontWeight: 'bold', color: '#1a73e8' },
  closeButton: { backgroundColor: '#1a73e8', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  closeButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});