// app/(tabs)/history.js - COMPLETE WITH STOCK UPDATE ON BILL GENERATION

import React, { useState, useCallback } from 'react';
import { 
  View, Text, FlatList, StyleSheet, TouchableOpacity, 
  Alert, RefreshControl, Modal, ScrollView, ActivityIndicator 
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { 
  getBills, getMyOrders, getUserRole, formatPKR, 
  updateBillStatus, recordPurchaseCombination, getCurrentUser,
  completeBillAndUpdateStock, getCustomerStats
} from '../../config/firebase';
import { Ionicons } from '@expo/vector-icons';

export default function History() {
  const router = useRouter();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [totalSales, setTotalSales] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [userRole, setUserRole] = useState('customer');
  const [generatingBill, setGeneratingBill] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState('');
  const [customerStats, setCustomerStats] = useState({ totalOrders: 0, totalSpent: 0, totalItems: 0 });

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    setLoading(true);
    const currentUser = getCurrentUser();
    if (currentUser) {
      setCurrentUserEmail(currentUser.email);
    }
    const role = await loadUserRole();
    await loadBills(role);
    
    if (role === 'customer') {
      const stats = await getCustomerStats();
      if (stats.success) {
        setCustomerStats(stats.stats);
      }
    }
    
    setLoading(false);
  };

  const loadUserRole = async () => {
    const result = await getUserRole();
    if (result.success) {
      setUserRole(result.role);
      return result.role;
    }
    return 'customer';
  };

  const loadBills = async (currentRole = null) => {
    try {
      let role = currentRole;
      if (!role) {
        const roleResult = await getUserRole();
        role = roleResult.success ? roleResult.role : 'customer';
      }
      
      const currentUser = getCurrentUser();
      console.log(`🔍 Loading bills for: ${currentUser?.email} (Role: ${role})`);
      
      let result;
      if (role === 'shopkeeper') {
        // ✅ Shopkeeper sees ALL orders from ALL customers
        result = await getBills();
        console.log(`🏪 Shopkeeper view: Found ${result.bills?.length} total orders`);
      } else {
        // ✅ Customer sees ONLY their own orders (all statuses)
        result = await getMyOrders(true);
        console.log(`🛒 Customer view: Found ${result.bills?.length} of my orders`);
      }
      
      if (result.success && result.bills) {
        // Log each bill's creator for debugging
        result.bills.forEach(bill => {
          console.log(`  Bill ${bill.billNumber}: Created by ${bill.createdByEmail} (${bill.createdById}) Status: ${bill.status}`);
        });
        
        const sortedBills = result.bills.sort((a, b) => 
          new Date(b.createdAt) - new Date(a.createdAt)
        );
        setBills(sortedBills);
        
        // Only count completed for sales total
        const completedBills = sortedBills.filter(b => b.status === 'completed');
        let sales = 0;
        let items = 0;
        completedBills.forEach(bill => {
          sales += bill.total || 0;
          items += bill.cart?.length || 0;
        });
        setTotalSales(sales);
        setTotalItems(items);
      } else {
        setBills([]);
        setTotalSales(0);
        setTotalItems(0);
      }
    } catch (error) {
      console.error('Error loading bills:', error);
      setBills([]);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    const role = await loadUserRole();
    await loadBills(role);
    setRefreshing(false);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString(),
      full: date.toLocaleString()
    };
  };

  const getOrderStatus = (bill) => {
    if (bill.status === 'completed') {
      return { text: 'Completed', color: '#34a853', icon: 'checkmark-circle' };
    }
    return { text: 'Pending', color: '#f39c12', icon: 'time' };
  };

  const generateBillFromHistory = async (bill) => {
    Alert.alert(
      'Generate Bill',
      `Generate bill for Order #${bill.billNumber}?\n\nThis will:\n✅ Update product stock\n✅ Update sales count\n✅ Mark order as completed\n\nTotal: ${formatPKR(bill.total)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate',
          onPress: async () => {
            setGeneratingBill(true);
            try {
              // First update stock and then bill status
              const result = await completeBillAndUpdateStock(bill.id, bill.cart || []);
              
              if (result.success) {
                // Record purchase patterns for AI learning
                if (bill.cart && bill.cart.length > 1) {
                  await recordPurchaseCombination(bill.cart);
                }
                
                Alert.alert('✅ Success', 'Bill generated successfully!\n\nStock updated and order completed.');
                setModalVisible(false);
                const role = await loadUserRole();
                await loadBills(role);
              } else {
                Alert.alert('Error', result.error || 'Failed to generate bill');
              }
            } catch (error) {
              console.error('Generate bill error:', error);
              Alert.alert('Error', 'Something went wrong');
            } finally {
              setGeneratingBill(false);
            }
          }
        }
      ]
    );
  };

  const viewBillDetails = (bill) => {
    setSelectedBill(bill);
    setModalVisible(true);
  };

  const renderBillItem = ({ item }) => {
    const dateInfo = formatDate(item.createdAt);
    const status = getOrderStatus(item);
    const isPending = item.status === 'pending';
    const isCustomerOrder = userRole === 'customer';
    const isShopkeeperView = userRole === 'shopkeeper';
    
    return (
      <TouchableOpacity style={styles.billCard} onPress={() => viewBillDetails(item)} activeOpacity={0.7}>
        <View style={styles.billHeader}>
          <View style={styles.billNumberContainer}>
            <Ionicons name="receipt-outline" size={22} color="#1a73e8" />
            <View>
              <Text style={styles.billNumber}>{item.billNumber}</Text>
              <Text style={styles.billTime}>{dateInfo.time}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.color + '20' }]}>
            <Ionicons name={status.icon} size={12} color={status.color} />
            <Text style={[styles.statusText, { color: status.color }]}>{status.text}</Text>
          </View>
        </View>

        <View style={styles.billBody}>
          <View style={styles.itemsInfo}>
            <Text style={styles.itemsLabel}>Items</Text>
            <Text style={styles.itemsCount}>{item.cart?.length || 0} products</Text>
            {/* ✅ Show customer email ONLY for shopkeeper */}
            {isShopkeeperView && item.createdByEmail && (
              <Text style={styles.customerEmail}>👤 Customer: {item.createdByEmail}</Text>
            )}
            {/* ✅ Show "You" for customer's own orders */}
            {isCustomerOrder && (
              <Text style={styles.customerEmail}>👤 You</Text>
            )}
          </View>
          <View style={styles.totalInfo}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.billTotal}>{formatPKR(item.total)}</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.productsScroll}>
          {(item.cart || []).slice(0, 3).map((product, idx) => (
            <View key={idx} style={styles.productChip}>
              <Text style={styles.productChipText}>{product.name} x{product.quantity}</Text>
            </View>
          ))}
          {(item.cart?.length || 0) > 3 && (
            <View style={styles.moreChip}>
              <Text style={styles.moreChipText}>+{item.cart.length - 3} more</Text>
            </View>
          )}
        </ScrollView>
        
        {/* ✅ Show pending notice for customers */}
        {isCustomerOrder && isPending && (
          <View style={styles.pendingNotice}>
            <Ionicons name="time" size={12} color="#f39c12" />
            <Text style={styles.pendingNoticeText}>Waiting for shopkeeper to process</Text>
          </View>
        )}
        
        {/* ✅ Show generate bill button for shopkeeper on pending orders */}
        {isShopkeeperView && isPending && (
          <TouchableOpacity 
            style={styles.generateBillChip} 
            onPress={() => generateBillFromHistory(item)}
            disabled={generatingBill}
          >
            <Text style={styles.generateBillChipText}>✓ Generate Bill & Update Stock</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1a73e8" />
        <Text style={styles.loadingText}>Loading orders...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Order History</Text>
        <View style={styles.roleBadge}>
          <Ionicons name={userRole === 'shopkeeper' ? 'storefront' : 'person'} size={14} color="#fff" />
          <Text style={styles.roleBadgeText}>
            {userRole === 'shopkeeper' ? ' All Orders' : ' My Orders'}
          </Text>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{bills.length}</Text>
            <Text style={styles.statLabel}>
              {userRole === 'shopkeeper' ? 'Orders' : 'My Orders'}
            </Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{totalItems}</Text>
            <Text style={styles.statLabel}>Items</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{formatPKR(totalSales)}</Text>
            <Text style={styles.statLabel}>Spent</Text>
          </View>
        </View>
        {userRole === 'customer' && (
          <View style={styles.customerInfoNote}>
            <Text style={styles.customerInfoNoteText}>
              💰 Showing your completed orders only
            </Text>
          </View>
        )}
      </View>

      {bills.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>No Orders Found</Text>
          <Text style={styles.emptySubText}>
            {userRole === 'shopkeeper' 
              ? 'No orders from customers yet' 
              : 'Place your first order to see it here'}
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

      {/* Order Details Modal */}
      <Modal visible={modalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="receipt" size={24} color="#1a73e8" />
              <Text style={styles.modalTitle}>Order Details</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#999" />
              </TouchableOpacity>
            </View>

            {selectedBill && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.detailSection}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Order #:</Text>
                    <Text style={styles.detailValue}>{selectedBill.billNumber}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Date:</Text>
                    <Text style={styles.detailValue}>{new Date(selectedBill.createdAt).toLocaleString()}</Text>
                  </View>
                  {/* ✅ Show customer info ONLY for shopkeeper */}
                  {userRole === 'shopkeeper' && selectedBill.createdByEmail && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Customer:</Text>
                      <Text style={styles.detailValue}>{selectedBill.createdByEmail}</Text>
                    </View>
                  )}
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Status:</Text>
                    <Text style={[styles.detailValue, { color: selectedBill.status === 'completed' ? '#34a853' : '#f39c12' }]}>
                      {selectedBill.status === 'completed' ? 'Completed ✓' : 'Pending ⏳'}
                    </Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <Text style={styles.sectionTitle}>Items</Text>
                {(selectedBill.cart || []).map((item, idx) => (
                  <View key={idx} style={styles.itemRow}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemQty}>x{item.quantity}</Text>
                    <Text style={styles.itemPrice}>{formatPKR(item.price)}</Text>
                    <Text style={styles.itemTotal}>{formatPKR(item.price * item.quantity)}</Text>
                  </View>
                ))}

                <View style={styles.divider} />

                <View style={styles.summarySection}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Subtotal:</Text>
                    <Text style={styles.summaryValue}>{formatPKR(selectedBill.subtotal || 0)}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Tax (5%):</Text>
                    <Text style={styles.summaryValue}>{formatPKR(selectedBill.tax || 0)}</Text>
                  </View>
                  <View style={styles.totalRowModal}>
                    <Text style={styles.totalLabelModal}>Total:</Text>
                    <Text style={styles.totalValueModal}>{formatPKR(selectedBill.total)}</Text>
                  </View>
                </View>

                {/* ✅ Generate Bill Button - Only for Shopkeeper with Pending Order */}
                {userRole === 'shopkeeper' && selectedBill.status === 'pending' && (
                  <TouchableOpacity 
                    style={styles.generateBtn} 
                    onPress={() => generateBillFromHistory(selectedBill)} 
                    disabled={generatingBill}
                  >
                    {generatingBill ? <ActivityIndicator color="#fff" /> : <Text style={styles.generateBtnText}>✓ Generate Bill & Update Stock</Text>}
                  </TouchableOpacity>
                )}

                {/* ✅ Pending Message for Customer */}
                {userRole === 'customer' && selectedBill.status === 'pending' && (
                  <View style={styles.pendingMsg}>
                    <Ionicons name="time-outline" size={20} color="#f39c12" />
                    <Text style={styles.pendingMsgText}>Order pending. Shopkeeper will process soon.</Text>
                  </View>
                )}

                {/* ✅ Completed Message */}
                {selectedBill.status === 'completed' && (
                  <View style={styles.completedMsg}>
                    <Ionicons name="checkmark-circle" size={20} color="#34a853" />
                    <Text style={styles.completedMsgText}>Order completed! Thank you for shopping.</Text>
                  </View>
                )}
              </ScrollView>
            )}

            <TouchableOpacity style={styles.closeBtn} onPress={() => setModalVisible(false)}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f7fa', gap: 12 },
  loadingText: { fontSize: 14, color: '#666', marginTop: 8 },
  header: { backgroundColor: '#1a73e8', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 10 },
  roleBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 15, marginBottom: 12 },
  roleBadgeText: { color: '#fff', fontSize: 12, fontWeight: '500', marginLeft: 4 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  statBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: 12, alignItems: 'center' },
  statNumber: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  statLabel: { fontSize: 10, color: '#e8f0fe', marginTop: 4 },
  customerInfoNote: { marginTop: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: 6, alignItems: 'center' },
  customerInfoNoteText: { fontSize: 10, color: '#e8f0fe' },
  listContent: { padding: 15 },
  billCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
  billHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  billNumberContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  billNumber: { fontSize: 14, fontWeight: 'bold', color: '#1a73e8' },
  billTime: { fontSize: 10, color: '#999', marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4 },
  statusText: { fontSize: 10, fontWeight: '500' },
  billBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', marginBottom: 10 },
  itemsInfo: { flex: 1 },
  itemsLabel: { fontSize: 11, color: '#999' },
  itemsCount: { fontSize: 14, fontWeight: '500', color: '#333' },
  customerEmail: { fontSize: 10, color: '#1a73e8', marginTop: 2 },
  totalInfo: { alignItems: 'flex-end' },
  totalLabel: { fontSize: 11, color: '#999' },
  billTotal: { fontSize: 18, fontWeight: 'bold', color: '#1a73e8' },
  productsScroll: { flexDirection: 'row', marginBottom: 8 },
  productChip: { backgroundColor: '#f5f7fa', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15, marginRight: 8 },
  productChipText: { fontSize: 11, color: '#666' },
  moreChip: { backgroundColor: '#e8f0fe', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15 },
  moreChipText: { fontSize: 11, color: '#1a73e8' },
  pendingNotice: { flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f0f0f0', gap: 6 },
  pendingNoticeText: { fontSize: 10, color: '#f39c12' },
  generateBillChip: { backgroundColor: '#34a853', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, alignSelf: 'flex-start', marginTop: 8 },
  generateBillChipText: { color: '#fff', fontSize: 11, fontWeight: '500' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 18, fontWeight: '500', color: '#999', marginBottom: 8, marginTop: 16 },
  emptySubText: { fontSize: 13, color: '#bbb', textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 24, padding: 20, width: '90%', maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1a73e8', flex: 1, textAlign: 'center' },
  detailSection: { marginBottom: 15, gap: 8 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between' },
  detailLabel: { fontSize: 13, color: '#666' },
  detailValue: { fontSize: 13, fontWeight: '500', color: '#333' },
  divider: { height: 1, backgroundColor: '#e0e0e0', marginVertical: 12 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  itemRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', alignItems: 'center' },
  itemName: { flex: 2, fontSize: 13, color: '#333' },
  itemQty: { flex: 1, fontSize: 13, color: '#666', textAlign: 'center' },
  itemPrice: { flex: 1, fontSize: 13, color: '#666', textAlign: 'right' },
  itemTotal: { flex: 1, fontSize: 13, fontWeight: '500', color: '#1a73e8', textAlign: 'right' },
  summarySection: { marginTop: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  summaryLabel: { fontSize: 13, color: '#666' },
  summaryValue: { fontSize: 13, color: '#333' },
  totalRowModal: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, marginTop: 8, borderTopWidth: 1, borderTopColor: '#e0e0e0' },
  totalLabelModal: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  totalValueModal: { fontSize: 18, fontWeight: 'bold', color: '#1a73e8' },
  generateBtn: { backgroundColor: '#34a853', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  generateBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  pendingMsg: { backgroundColor: '#fff3e0', padding: 12, borderRadius: 12, marginTop: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  pendingMsgText: { color: '#f39c12', fontSize: 13 },
  completedMsg: { backgroundColor: '#e8f5e9', padding: 12, borderRadius: 12, marginTop: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  completedMsgText: { color: '#34a853', fontSize: 13 },
  closeBtn: { backgroundColor: '#1a73e8', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  closeBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});