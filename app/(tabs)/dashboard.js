// app/(tabs)/dashboard.js - WITH "CONFIRMED" STATUS

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  TextInput,
  Modal,
  Alert
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  getDashboardStats,
  formatPKR,
  getUserRole,
  getCurrentUser,
  getBills,
  getProducts,
  getCustomerStats,
  submitReview,
  updateReview,
  deleteReview,
  getReviews,
  getUserReview,
  getUserDisplayName
} from '../../config/firebase';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function Dashboard() {
  const router = useRouter();
  const [stats, setStats] = useState({
    todaySales: 0,
    totalRevenue: 0,
    totalOrders: 0,
    pendingOrders: 0,
    confirmedOrders: 0,
    totalProducts: 0
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userRole, setUserRole] = useState('customer');
  const [userName, setUserName] = useState('');
  const [recentOrders, setRecentOrders] = useState([]);
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [recentReviews, setRecentReviews] = useState([]);
  const [userReview, setUserReview] = useState(null);
  const [hasReview, setHasReview] = useState(false);
  
  // Review Modal
  const [reviewModal, setReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Customer specific
  const [customerStats, setCustomerStats] = useState({
    myOrders: 0,
    myTotalSpent: 0
  });

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
      loadAllReviews();
      loadUserOwnReview();
    }, [])
  );

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      const roleResult = await getUserRole();
      const role = roleResult.success ? roleResult.role : 'customer';
      setUserRole(role);
      
      const displayName = getUserDisplayName();
      setUserName(displayName);
      
      if (role === 'shopkeeper') {
        await loadShopkeeperData();
      } else {
        await loadCustomerData();
      }
    } catch (error) {
      console.log('Dashboard error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadShopkeeperData = async () => {
    const dashboardStats = await getDashboardStats();
    if (dashboardStats.success) {
      setStats({
        todaySales: dashboardStats.stats.todaySales || 0,
        totalRevenue: dashboardStats.stats.totalRevenue || 0,
        totalOrders: dashboardStats.stats.totalBills || 0,
        pendingOrders: dashboardStats.stats.pendingBills || 0,
        confirmedOrders: dashboardStats.stats.confirmedBills || 0,
        totalProducts: dashboardStats.stats.totalProducts || 0
      });
    }
    
    const billsResult = await getBills();
    if (billsResult.success) {
      const recent = billsResult.bills.slice(0, 5);
      setRecentOrders(recent);
    }
  };

  const loadCustomerData = async () => {
    const customerStatsResult = await getCustomerStats();
    if (customerStatsResult.success) {
      setCustomerStats({
        myOrders: customerStatsResult.stats.totalOrders || 0,
        myTotalSpent: customerStatsResult.stats.totalSpent || 0
      });
    }
    
    const billsResult = await getBills();
    if (billsResult.success && billsResult.bills) {
      const recent = billsResult.bills.slice(0, 3);
      setRecentOrders(recent);
    }
  };

  const loadAllReviews = async () => {
    try {
      const result = await getReviews(10);
      if (result.success) {
        setRecentReviews(result.reviews);
        setAverageRating(result.averageRating);
        setTotalReviews(result.totalReviews);
      }
    } catch (error) {
      console.log('Load reviews error:', error);
    }
  };

  const loadUserOwnReview = async () => {
    try {
      const result = await getUserReview();
      if (result.success) {
        setHasReview(result.hasReview);
        setUserReview(result.review);
      }
    } catch (error) {
      console.log('Load user review error:', error);
    }
  };

  const openReviewModal = () => {
    if (userReview) {
      setIsEditing(true);
      setReviewRating(userReview.rating);
      setReviewComment(userReview.comment);
    } else {
      setIsEditing(false);
      setReviewRating(0);
      setReviewComment('');
    }
    setReviewModal(true);
  };

  const handleSubmitReview = async () => {
    if (reviewRating < 1 || reviewRating > 5) {
      Alert.alert('Error', 'Please select rating between 1-5 stars');
      return;
    }
    
    setSubmitting(true);
    try {
      let result;
      if (isEditing && userReview) {
        result = await updateReview(userReview.id, reviewRating, reviewComment);
        if (result.success) {
          Alert.alert('✅ Success', 'Your review has been updated!');
        }
      } else {
        result = await submitReview(reviewRating, reviewComment);
        if (result.success) {
          Alert.alert('✅ Thank You!', 'Your review has been submitted!');
        }
      }
      
      if (result.success) {
        setReviewModal(false);
        setReviewRating(0);
        setReviewComment('');
        setIsEditing(false);
        await loadAllReviews();
        await loadUserOwnReview();
      } else {
        Alert.alert('Error', result.error || 'Failed to submit review');
      }
    } catch (error) {
      console.error('Submit error:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReview = async () => {
    Alert.alert(
      'Delete Review',
      'Are you sure you want to delete your review? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            setSubmitting(true);
            try {
              const result = await deleteReview(userReview.id);
              if (result.success) {
                Alert.alert('✅ Deleted', 'Your review has been deleted.');
                setReviewModal(false);
                setUserReview(null);
                setHasReview(false);
                await loadAllReviews();
              } else {
                Alert.alert('Error', result.error);
              }
            } catch (error) {
              Alert.alert('Error', 'Something went wrong');
            } finally {
              setSubmitting(false);
            }
          }
        }
      ]
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    await loadAllReviews();
    await loadUserOwnReview();
    setRefreshing(false);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const renderStars = (rating, size = 14, interactive = false, onStarPress = null) => {
    let stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <TouchableOpacity 
          key={i} 
          onPress={interactive ? () => onStarPress(i) : null}
          activeOpacity={interactive ? 0.7 : 1}
          disabled={!interactive}
        >
          <Ionicons 
            name={i <= rating ? "star" : "star-outline"} 
            size={size} 
            color={i <= rating ? "#f39c12" : "#ddd"} 
          />
        </TouchableOpacity>
      );
    }
    return <View style={{ flexDirection: 'row', gap: 4 }}>{stars}</View>;
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1a73e8" />
        <Text style={styles.loadingText}>Loading Dashboard...</Text>
      </View>
    );
  }

  // ================= SHOPKEEPER DASHBOARD =================
  if (userRole === 'shopkeeper') {
    return (
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.shopHeader}>
          <View>
            <Text style={styles.welcomeText}>Hello,</Text>
            <Text style={styles.shopNameText}>{userName} 🏪</Text>
          </View>
          <View style={styles.dateBadge}>
            <Ionicons name="calendar-outline" size={14} color="#fff" />
            <Text style={styles.dateText}>{new Date().toLocaleDateString()}</Text>
          </View>
        </View>

        <View style={styles.welcomeBox}>
          <Text style={styles.welcomeMessage}>Welcome to BillingEase!</Text>
          <Text style={styles.welcomeSubText}>AI Powered Smart Billing System</Text>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <View style={[styles.statIconBg, { backgroundColor: '#e8f0fe' }]}>
              <Ionicons name="trending-up" size={22} color="#1a73e8" />
            </View>
            <Text style={styles.statValue}>{formatPKR(stats.todaySales)}</Text>
            <Text style={styles.statLabel}>Today's Sales</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconBg, { backgroundColor: '#dcfce7' }]}>
              <Ionicons name="wallet" size={22} color="#34a853" />
            </View>
            <Text style={styles.statValue}>{formatPKR(stats.totalRevenue)}</Text>
            <Text style={styles.statLabel}>Total Revenue</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconBg, { backgroundColor: '#fef3c7' }]}>
              <Ionicons name="receipt" size={22} color="#f39c12" />
            </View>
            <Text style={styles.statValue}>{stats.totalOrders}</Text>
            <Text style={styles.statLabel}>Total Orders</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconBg, { backgroundColor: '#dcfce7' }]}>
              <Ionicons name="checkmark-circle" size={22} color="#34a853" />
            </View>
            <Text style={styles.statValue}>{stats.confirmedOrders}</Text>
            <Text style={styles.statLabel}>Confirmed</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionGrid}>
            <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/billing')}>
              <Ionicons name="cart" size={24} color="#1a73e8" />
              <Text style={styles.actionLabel}>New Order</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/products')}>
              <Ionicons name="cube" size={24} color="#34a853" />
              <Text style={styles.actionLabel}>Products</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/history')}>
              <Ionicons name="time" size={24} color="#f39c12" />
              <Text style={styles.actionLabel}>History</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/profile')}>
              <Ionicons name="person" size={24} color="#9333ea" />
              <Text style={styles.actionLabel}>Profile</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Orders</Text>
          {recentOrders.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={40} color="#ccc" />
              <Text style={styles.emptyText}>No orders yet</Text>
            </View>
          ) : (
            recentOrders.map((order, idx) => (
              <View key={idx} style={styles.orderRow}>
                <View style={styles.orderLeft}>
                  <Text style={styles.orderNumber} numberOfLines={1}>{order.billNumber}</Text>
                  <Text style={styles.orderDate}>{formatDate(order.createdAt)}</Text>
                </View>
                <Text style={styles.orderAmount}>{formatPKR(order.total)}</Text>
                <View style={[styles.orderStatus, 
                  order.status === 'confirmed' ? styles.statusConfirmed : styles.statusPending]}>
                  <Text style={styles.orderStatusText}>
                    {order.status === 'confirmed' ? '✓' : '⏳'}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={[styles.section, styles.lastSection]}>
          <View style={styles.reviewHeader}>
            <Text style={styles.sectionTitle}>⭐ Customer Reviews</Text>
            <View style={styles.ratingSummary}>
              <Text style={styles.averageRating}>{averageRating.toFixed(1)}</Text>
              {renderStars(Math.round(averageRating), 14)}
              <Text style={styles.reviewCount}>({totalReviews})</Text>
            </View>
          </View>
          
          {recentReviews.length === 0 ? (
            <View style={styles.emptyReviews}>
              <Ionicons name="star-outline" size={40} color="#ccc" />
              <Text style={styles.emptyText}>No reviews yet</Text>
              <Text style={styles.emptySubText}>Be the first to write a review!</Text>
            </View>
          ) : (
            recentReviews.slice(0, 3).map((review, idx) => (
              <View key={idx} style={styles.reviewItem}>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewerName}>{review.userName}</Text>
                  {renderStars(review.rating, 12)}
                </View>
                <Text style={styles.reviewComment}>{review.comment}</Text>
                <Text style={styles.reviewDate}>{formatDate(review.createdAt)}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    );
  }

  // ================= CUSTOMER DASHBOARD =================
  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.customerHeader}>
        <View>
          <Text style={styles.welcomeText}>Hello,</Text>
          <Text style={styles.userNameText}>{userName} 👋</Text>
        </View>
        <TouchableOpacity style={styles.reviewBtn} onPress={openReviewModal}>
          <Ionicons name="star" size={16} color="#fff" />
          <Text style={styles.reviewBtnText}>
            {hasReview ? 'Edit Review' : 'Write Review'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.welcomeBox}>
        <Text style={styles.welcomeMessage}>Welcome to BillingEase!</Text>
        <Text style={styles.welcomeSubText}>Your smart billing assistant</Text>
      </View>

      <View style={styles.ordersBox}>
        <View style={styles.ordersBoxIcon}>
          <Ionicons name="bag-handle" size={32} color="#1a73e8" />
        </View>
        <Text style={styles.ordersBoxValue}>{customerStats.myOrders}</Text>
        <Text style={styles.ordersBoxLabel}>My Orders</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionGrid}>
          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/billing')}>
            <Ionicons name="cart" size={24} color="#1a73e8" />
            <Text style={styles.actionLabel}>Shop</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/history')}>
            <Ionicons name="time" size={24} color="#f39c12" />
            <Text style={styles.actionLabel}>History</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/products')}>
            <Ionicons name="cube" size={24} color="#34a853" />
            <Text style={styles.actionLabel}>Products</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/profile')}>
            <Ionicons name="person" size={24} color="#9333ea" />
            <Text style={styles.actionLabel}>Profile</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Orders</Text>
        {recentOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={40} color="#ccc" />
            <Text style={styles.emptyText}>No orders yet</Text>
            <TouchableOpacity 
              style={styles.shopNowBtn}
              onPress={() => router.push('/(tabs)/billing')}
            >
              <Text style={styles.shopNowBtnText}>Start Shopping →</Text>
            </TouchableOpacity>
          </View>
        ) : (
          recentOrders.map((order, idx) => (
            <View key={idx} style={styles.orderRow}>
              <View style={styles.orderLeft}>
                <Text style={styles.orderNumber} numberOfLines={1}>{order.billNumber}</Text>
                <Text style={styles.orderDate}>{formatDate(order.createdAt)}</Text>
              </View>
              <Text style={styles.orderAmount}>{formatPKR(order.total)}</Text>
              <View style={[styles.orderStatus, 
                order.status === 'confirmed' ? styles.statusConfirmed : styles.statusPending]}>
                <Text style={styles.orderStatusText}>
                  {order.status === 'confirmed' ? '✓' : '⏳'}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={[styles.section, styles.lastSection]}>
        <View style={styles.reviewHeader}>
          <Text style={styles.sectionTitle}>⭐ Customer Reviews</Text>
          <View style={styles.ratingSummary}>
            <Text style={styles.averageRating}>{averageRating.toFixed(1)}</Text>
            {renderStars(Math.round(averageRating), 14)}
            <Text style={styles.reviewCount}>({totalReviews})</Text>
          </View>
        </View>
        
        {recentReviews.length === 0 ? (
          <View style={styles.emptyReviews}>
            <Ionicons name="star-outline" size={40} color="#ccc" />
            <Text style={styles.emptyText}>No reviews yet</Text>
            <Text style={styles.emptySubText}>Be the first to share your experience!</Text>
          </View>
        ) : (
          recentReviews.slice(0, 2).map((review, idx) => (
            <View key={idx} style={styles.reviewItem}>
              <View style={styles.reviewRow}>
                <Text style={styles.reviewerName}>{review.userName}</Text>
                {renderStars(review.rating, 12)}
              </View>
              <Text style={styles.reviewComment} numberOfLines={2}>{review.comment}</Text>
            </View>
          ))
        )}
        
        <TouchableOpacity style={styles.writeReviewBtn} onPress={openReviewModal}>
          <Text style={styles.writeReviewBtnText}>
            {hasReview ? '✏️ Edit My Review' : '📝 Write a Review'}
          </Text>
        </TouchableOpacity>
      </View>

      <Modal visible={reviewModal} transparent={true} animationType="slide" onRequestClose={() => setReviewModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {isEditing ? '✏️ Edit Your Review' : '⭐ Write a Review'}
            </Text>
            
            <Text style={styles.modalLabel}>Your Rating</Text>
            <View style={styles.ratingSelector}>
              {renderStars(reviewRating, 40, true, (rating) => setReviewRating(rating))}
            </View>
            
            <Text style={styles.modalLabel}>Your Review (Optional)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Tell us about your experience..."
              placeholderTextColor="#aaa"
              value={reviewComment}
              onChangeText={setReviewComment}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitReview} disabled={submitting}>
                <Text style={styles.submitBtnText}>
                  {submitting ? 'Saving...' : (isEditing ? 'Update Review' : 'Submit Review')}
                </Text>
              </TouchableOpacity>
              {isEditing && (
                <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteReview} disabled={submitting}>
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.cancelModalBtn} onPress={() => setReviewModal(false)}>
                <Text style={styles.cancelModalBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  scrollContent: { paddingBottom: 30 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f7fa' },
  loadingText: { marginTop: 10, fontSize: 14, color: '#666' },

  shopHeader: {
    backgroundColor: '#1a73e8',
    paddingTop: 55,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  customerHeader: {
    backgroundColor: '#1a73e8',
    paddingTop: 55,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  welcomeText: { color: '#e8f0fe', fontSize: 14 },
  shopNameText: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginTop: 2 },
  userNameText: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginTop: 2 },
  dateBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, gap: 5 },
  dateText: { color: '#fff', fontSize: 11 },
  reviewBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 5 },
  reviewBtnText: { color: '#fff', fontSize: 12, fontWeight: '500' },

  welcomeBox: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginTop: 15,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  welcomeMessage: { fontSize: 16, fontWeight: 'bold', color: '#1a73e8' },
  welcomeSubText: { fontSize: 12, color: '#666', marginTop: 4 },

  ordersBox: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginTop: 15,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  ordersBoxIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#e8f0fe', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  ordersBoxValue: { fontSize: 36, fontWeight: 'bold', color: '#1a73e8' },
  ordersBoxLabel: { fontSize: 14, color: '#666', marginTop: 4 },

  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginTop: 15,
  },
  statCard: {
    width: (width - 40) / 2,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  statIconBg: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statValue: { fontSize: 18, fontWeight: 'bold', color: '#1a73e8' },
  statLabel: { fontSize: 11, color: '#666', marginTop: 3, textAlign: 'center' },

  section: { 
    backgroundColor: '#fff', 
    marginHorizontal: 12, 
    marginTop: 14, 
    borderRadius: 18, 
    padding: 14, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 6, 
    elevation: 2 
  },
  lastSection: { marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#333', marginBottom: 12 },

  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  actionCard: { 
    width: (width - 60) / 4, 
    backgroundColor: '#f8f9fa', 
    borderRadius: 14, 
    paddingVertical: 12,
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: '#f0f0f0' 
  },
  actionLabel: { fontSize: 11, color: '#555', marginTop: 6, fontWeight: '500' },

  orderRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingVertical: 10, 
    borderBottomWidth: 1, 
    borderBottomColor: '#f0f0f0' 
  },
  orderLeft: { flex: 2 },
  orderNumber: { fontSize: 12, fontWeight: '500', color: '#333' },
  orderDate: { fontSize: 9, color: '#999', marginTop: 2 },
  orderAmount: { fontSize: 13, fontWeight: 'bold', color: '#1a73e8', flex: 1, textAlign: 'right' },
  orderStatus: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  statusConfirmed: { backgroundColor: '#dcfce7' },
  statusPending: { backgroundColor: '#fff3e0' },
  orderStatusText: { fontSize: 12, fontWeight: 'bold' },

  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' },
  ratingSummary: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  averageRating: { fontSize: 18, fontWeight: 'bold', color: '#f39c12' },
  reviewCount: { fontSize: 11, color: '#999' },
  reviewItem: { backgroundColor: '#f8f9fa', borderRadius: 12, padding: 12, marginBottom: 10 },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  reviewerName: { fontSize: 13, fontWeight: '500', color: '#333' },
  reviewComment: { fontSize: 12, color: '#666', marginBottom: 4 },
  reviewDate: { fontSize: 9, color: '#999' },
  writeReviewBtn: { backgroundColor: '#1a73e8', paddingVertical: 10, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  writeReviewBtnText: { color: '#fff', fontSize: 13, fontWeight: '500' },
  emptyReviews: { alignItems: 'center', paddingVertical: 20 },
  emptySubText: { fontSize: 11, color: '#bbb', marginTop: 4, textAlign: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 24, padding: 24, width: '85%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', color: '#1a73e8', marginBottom: 20 },
  modalLabel: { fontSize: 14, fontWeight: '500', color: '#333', marginBottom: 8, marginTop: 12 },
  ratingSelector: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 10 },
  modalInput: { borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 14, padding: 14, fontSize: 14, backgroundColor: '#f8f9fa', minHeight: 100 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 20, flexWrap: 'wrap' },
  submitBtn: { flex: 1, backgroundColor: '#34a853', paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  deleteBtn: { backgroundColor: '#dc3545', paddingVertical: 14, borderRadius: 14, alignItems: 'center', paddingHorizontal: 20 },
  deleteBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cancelModalBtn: { flex: 1, backgroundColor: '#6c757d', paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  cancelModalBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  emptyState: { alignItems: 'center', paddingVertical: 25 },
  emptyText: { textAlign: 'center', color: '#999', fontSize: 13, marginTop: 8 },
  shopNowBtn: { backgroundColor: '#1a73e8', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 22, marginTop: 12 },
  shopNowBtnText: { color: '#fff', fontWeight: '500', fontSize: 12 },
});