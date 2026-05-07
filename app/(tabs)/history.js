import React, { useState, useEffect } from 'react';
import { 
  View, Text, FlatList, StyleSheet, TouchableOpacity, 
  Alert, RefreshControl, Modal, ScrollView 
} from 'react-native';
import { getBills } from '../config/firebase';

export default function History() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [totalSales, setTotalSales] = useState(0);
  const [totalItems, setTotalItems] = useState(0);

  useEffect(() => {
    loadBills();
  }, []);

  const loadBills = async () => {
    const result = await getBills();
    if (result.success) {
      // Sort by date (newest first)
      const sortedBills = result.bills.sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
      );
      setBills(sortedBills);
      
      // Calculate total sales and items
      let sales = 0;
      let items = 0;
      sortedBills.forEach(bill => {
        sales += bill.total || 0;
        items += bill.cart?.length || 0;
      });
      setTotalSales(sales);
      setTotalItems(items);
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

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString(),
      full: date.toLocaleString()
    };
  };

  const viewBillDetails = (bill) => {
    setSelectedBill(bill);
    setModalVisible(true);
  };

  const renderBillItem = ({ item, index }) => {
    const dateInfo = formatDate(item.createdAt);
    
    return (
      <TouchableOpacity 
        style={styles.billCard} 
        onPress={() => viewBillDetails(item)}
        activeOpacity={0.7}
      >
        {/* Bill Header */}
        <View style={styles.billHeader}>
          <View style={styles.billNumberContainer}>
            <Text style={styles.billIcon}>🧾</Text>
            <View>
              <Text style={styles.billNumber}>{item.billNumber}</Text>
              <Text style={styles.billTime}>{dateInfo.time}</Text>
            </View>
          </View>
          <Text style={styles.billDate}>{dateInfo.date}</Text>
        </View>

        {/* Bill Body */}
        <View style={styles.billBody}>
          <View style={styles.itemsInfo}>
            <Text style={styles.itemsLabel}>📦 Items</Text>
            <Text style={styles.itemsCount}>{item.cart?.length || 0} products</Text>
          </View>
          <View style={styles.totalInfo}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.billTotal}>{formatPrice(item.total)}</Text>
          </View>
        </View>

        {/* Bill Footer - Product Preview */}
        <View style={styles.billFooter}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {(item.cart || []).slice(0, 3).map((product, idx) => (
              <View key={idx} style={styles.productChip}>
                <Text style={styles.productChipText}>
                  {product.name} x{product.quantity}
                </Text>
              </View>
            ))}
            {(item.cart?.length || 0) > 3 && (
              <View style={styles.moreChip}>
                <Text style={styles.moreChipText}>+{item.cart.length - 3} more</Text>
              </View>
            )}
          </ScrollView>
        </View>

        {/* Status Badge */}
        <View style={styles.statusContainer}>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>✅ Completed</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Loading history...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with Stats */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📜 Bill History</Text>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{bills.length}</Text>
            <Text style={styles.statLabel}>Total Bills</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{totalItems}</Text>
            <Text style={styles.statLabel}>Items Sold</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{formatPrice(totalSales)}</Text>
            <Text style={styles.statLabel}>Total Sales</Text>
          </View>
        </View>
      </View>

      {/* Bills List */}
      {bills.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyText}>No Bills Found</Text>
          <Text style={styles.emptySubText}>
            Generate your first bill from billing screen
          </Text>
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

      {/* Bill Details Modal */}
      <Modal visible={modalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalIcon}>🧾</Text>
              <Text style={styles.modalTitle}>Bill Details</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedBill && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Bill Info */}
                <View style={styles.detailSection}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Bill Number:</Text>
                    <Text style={styles.detailValue}>{selectedBill.billNumber}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Date & Time:</Text>
                    <Text style={styles.detailValue}>
                      {new Date(selectedBill.createdAt).toLocaleString()}
                    </Text>
                  </View>
                </View>

                <View style={styles.divider} />

                {/* Items List */}
                <Text style={styles.sectionTitle}>🛒 Items Purchased</Text>
                <View style={styles.itemsHeader}>
                  <Text style={styles.headerItem}>Product</Text>
                  <Text style={styles.headerQty}>Qty</Text>
                  <Text style={styles.headerPrice}>Price</Text>
                  <Text style={styles.headerTotal}>Total</Text>
                </View>

                {(selectedBill.cart || []).map((item, idx) => (
                  <View key={idx} style={styles.itemRow}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemQty}>x{item.quantity}</Text>
                    <Text style={styles.itemPrice}>{formatPrice(item.price)}</Text>
                    <Text style={styles.itemTotal}>{formatPrice(item.total)}</Text>
                  </View>
                ))}

                <View style={styles.divider} />

                {/* Amount Summary */}
                <View style={styles.summarySection}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Subtotal:</Text>
                    <Text style={styles.summaryValue}>
                      {formatPrice(selectedBill.subtotal || selectedBill.total - (selectedBill.total * 0.05))}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Tax (5% GST):</Text>
                    <Text style={styles.summaryValue}>
                      {formatPrice(selectedBill.tax || (selectedBill.total * 0.05))}
                    </Text>
                  </View>
                  <View style={styles.totalRowModal}>
                    <Text style={styles.totalLabelModal}>Grand Total:</Text>
                    <Text style={styles.totalValueModal}>
                      {formatPrice(selectedBill.total)}
                    </Text>
                  </View>
                </View>

                <View style={styles.footerMessage}>
                  <Text style={styles.thanksMessage}>✓ Thank you for shopping!</Text>
                </View>
              </ScrollView>
            )}

            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
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
    backgroundColor: '#1a73e8',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 10,
    color: '#e8f0fe',
    marginTop: 4,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
  },
  listContent: {
    padding: 15,
  },
  billCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  billHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  billNumberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  billIcon: {
    fontSize: 20,
  },
  billNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a73e8',
    fontFamily: 'monospace',
  },
  billTime: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
  billDate: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  billBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    marginBottom: 10,
  },
  itemsInfo: {
    flex: 1,
  },
  itemsLabel: {
    fontSize: 11,
    color: '#999',
  },
  itemsCount: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  totalInfo: {
    alignItems: 'flex-end',
  },
  totalLabel: {
    fontSize: 11,
    color: '#999',
  },
  billTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a73e8',
  },
  billFooter: {
    marginBottom: 10,
  },
  productChip: {
    backgroundColor: '#f5f7fa',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    marginRight: 8,
  },
  productChipText: {
    fontSize: 11,
    color: '#666',
  },
  moreChip: {
    backgroundColor: '#e8f0fe',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  moreChipText: {
    fontSize: 11,
    color: '#1a73e8',
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    backgroundColor: '#e6f4ea',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    color: '#34a853',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
    opacity: 0.5,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#999',
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 13,
    color: '#bbb',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    width: '90%',
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalIcon: {
    fontSize: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a73e8',
  },
  closeIcon: {
    fontSize: 20,
    color: '#999',
    padding: 5,
  },
  detailSection: {
    marginBottom: 15,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 13,
    color: '#666',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#333',
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  itemsHeader: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    marginBottom: 8,
  },
  headerItem: {
    flex: 2,
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
  },
  headerQty: {
    flex: 1,
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    textAlign: 'center',
  },
  headerPrice: {
    flex: 1,
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    textAlign: 'right',
  },
  headerTotal: {
    flex: 1,
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    textAlign: 'right',
  },
  itemRow: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  itemName: {
    flex: 2,
    fontSize: 13,
    color: '#333',
  },
  itemQty: {
    flex: 1,
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
  },
  itemPrice: {
    flex: 1,
    fontSize: 13,
    color: '#666',
    textAlign: 'right',
  },
  itemTotal: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: '#1a73e8',
    textAlign: 'right',
  },
  summarySection: {
    marginTop: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#666',
  },
  summaryValue: {
    fontSize: 13,
    color: '#333',
  },
  totalRowModal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  totalLabelModal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValueModal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a73e8',
  },
  footerMessage: {
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  thanksMessage: {
    fontSize: 14,
    fontWeight: '500',
    color: '#34a853',
  },
  closeButton: {
    backgroundColor: '#1a73e8',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});