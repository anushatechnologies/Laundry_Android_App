import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import { api } from '@/lib/api';
import { payRazorpayCustom } from '@/lib/payments';
import type { WalletData, WalletTransaction } from '@/types/domain';

interface WalletScreenProps {
  onBack?: () => void;
  onNavigateReferral?: () => void;
  onSignIn?: () => void;
}

const QUICK_AMOUNTS = [100, 200, 500, 1000];

export function WalletScreen({ onBack, onNavigateReferral, onSignIn }: WalletScreenProps) {
  const { session } = useApp();
  const customerId = session?.user.id;

  const [data, setData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [amountInput, setAmountInput] = useState('200');
  const [processingTopup, setProcessingTopup] = useState(false);
  const [filterType, setFilterType] = useState<'ALL' | 'CREDIT' | 'DEBIT'>('ALL');

  const fetchWallet = useCallback(async (isRefresh = false) => {
    if (!customerId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await api.getWallet();
      setData(res);
    } catch (err: any) {
      console.warn('[WalletScreen] Failed to load wallet:', err?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [customerId]);

  useEffect(() => {
    void fetchWallet();
  }, [fetchWallet]);

  const handleTopup = async () => {
    const numAmount = parseInt(amountInput.trim(), 10);
    if (isNaN(numAmount) || numAmount < 10) {
      Alert.alert('Invalid Amount', 'Please enter a top-up amount of at least ₹10.');
      return;
    }
    if (numAmount > 50000) {
      Alert.alert('Amount Exceeded', 'Maximum wallet top-up per transaction is ₹50,000.');
      return;
    }

    setProcessingTopup(true);
    try {
      // 1. Create Razorpay order on backend
      const orderData = await api.createWalletTopupOrder(numAmount);

      // 2. Open Razorpay Checkout
      const paymentResult = await payRazorpayCustom({
        key: orderData.key,
        orderId: orderData.orderId,
        amount: orderData.amount, // in paise
        currency: orderData.currency,
        description: `Wallet Top-up: ₹${numAmount}`,
        prefill: {
          name: session?.user.name,
          contact: session?.user.phone,
          email: session?.user.email,
        },
      });

      // 3. Verify Razorpay signature and credit wallet
      const verification = await api.verifyWalletTopup({
        razorpayOrderId: paymentResult.razorpay_order_id,
        razorpayPaymentId: paymentResult.razorpay_payment_id,
        razorpaySignature: paymentResult.razorpay_signature,
      });

      if (verification.data) {
        setData(verification.data);
      } else {
        await fetchWallet(true);
      }

      Alert.alert(
        'Top-up Successful! 🎉',
        `₹${numAmount} has been credited to your LaundryFresh Wallet. You can use it anytime during checkout.`,
      );
      setAmountInput('200');
    } catch (err: any) {
      const msg = err && typeof err === 'object' && 'description' in err
        ? (err as any).description
        : err instanceof Error
          ? err.message
          : 'Payment was cancelled or failed.';
      if (msg !== 'Payment cancelled') {
        Alert.alert('Top-up Incomplete', msg);
      }
    } finally {
      setProcessingTopup(false);
    }
  };

  if (!customerId) {
    return (
      <View style={styles.root}>
        {onBack && (
          <View style={styles.navBar}>
            <Pressable onPress={onBack} hitSlop={12} style={styles.backBtn}>
              <MaterialCommunityIcons name="arrow-left" size={24} color="#1C0B18" />
            </Pressable>
            <Text style={styles.navTitle}>LaundryFresh Wallet</Text>
            <View style={{ width: 24 }} />
          </View>
        )}
        <View style={styles.guestContainer}>
          <MaterialCommunityIcons name="wallet-outline" size={72} color="#F97316" />
          <Text style={styles.guestTitle}>Sign in to Access Your Wallet</Text>
          <Text style={styles.guestSubtitle}>
            Enjoy instant ₹100 referral bonuses, seamless 1-tap checkout, and lightning-fast refunds.
          </Text>
          {onSignIn && (
            <Pressable onPress={onSignIn} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Sign In / Register</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  const balance = data?.wallet?.balance ?? 0;
  const transactions = (data?.transactions ?? []).filter((tx) => {
    if (filterType === 'CREDIT') return tx.type === 'CREDIT';
    if (filterType === 'DEBIT') return tx.type === 'DEBIT';
    return true;
  });

  return (
    <View style={styles.root}>
      {/* Navigation Header */}
      <View style={styles.navBar}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={12} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#1C0B18" />
          </Pressable>
        ) : (
          <View style={{ width: 24 }} />
        )}
        <Text style={styles.navTitle}>LaundryFresh Wallet</Text>
        <Pressable onPress={() => void fetchWallet(true)} hitSlop={12} style={styles.backBtn}>
          <MaterialCommunityIcons name="refresh" size={22} color="#F97316" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void fetchWallet(true)}
            colors={['#F97316']}
          />
        }
      >
        {/* Balance Card with Gradient */}
        <LinearGradient
          colors={['#2A103C', '#160824', '#0D0417']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.balanceCard}
        >
          <View style={styles.balanceTopRow}>
            <View style={styles.walletBadge}>
              <MaterialCommunityIcons name="wallet" size={16} color="#F97316" />
              <Text style={styles.walletBadgeText}>WALLET BALANCE</Text>
            </View>
            <View style={styles.securityBadge}>
              <MaterialCommunityIcons name="shield-check" size={14} color="#10B981" />
              <Text style={styles.securityBadgeText}>100% SECURE</Text>
            </View>
          </View>

          <View style={styles.balanceMainRow}>
            <Text style={styles.currencySymbol}>₹</Text>
            <Text style={styles.balanceAmount}>
              {loading && !data ? '...' : balance.toFixed(2)}
            </Text>
          </View>

          <Text style={styles.balanceHint}>
            Usable across all services. Automatically deducted at checkout.
          </Text>

          <View style={styles.balanceFeaturesRow}>
            <View style={styles.balanceFeatureItem}>
              <MaterialCommunityIcons name="lightning-bolt" size={14} color="#F59E0B" />
              <Text style={styles.balanceFeatureText}>Instant Checkout</Text>
            </View>
            <View style={styles.balanceFeatureItem}>
              <MaterialCommunityIcons name="gift" size={14} color="#EC4899" />
              <Text style={styles.balanceFeatureText}>₹100 Referrals</Text>
            </View>
            <View style={styles.balanceFeatureItem}>
              <MaterialCommunityIcons name="cash-refund" size={14} color="#10B981" />
              <Text style={styles.balanceFeatureText}>Zero Delay</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Top-up Form */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="plus-circle-outline" size={20} color="#F97316" />
            <Text style={styles.sectionTitle}>Add Money via Razorpay</Text>
          </View>

          {/* Quick Amount Chips */}
          <View style={styles.chipsRow}>
            {QUICK_AMOUNTS.map((amt) => {
              const isSelected = amountInput === String(amt);
              return (
                <Pressable
                  key={amt}
                  style={[styles.chip, isSelected && styles.chipActive]}
                  onPress={() => setAmountInput(String(amt))}
                >
                  <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                    +₹{amt}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Input & Topup Button */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputPrefix}>₹</Text>
            <TextInput
              style={styles.amountInput}
              keyboardType="number-pad"
              maxLength={6}
              value={amountInput}
              onChangeText={(t) => setAmountInput(t.replace(/[^0-9]/g, ''))}
              placeholder="Enter amount"
              placeholderTextColor="#A3A3A3"
            />
          </View>

          <Pressable
            style={[styles.topupBtn, processingTopup && styles.btnDisabled]}
            disabled={processingTopup}
            onPress={handleTopup}
          >
            {processingTopup ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <MaterialCommunityIcons name="credit-card-outline" size={20} color="#FFFFFF" />
                <Text style={styles.topupBtnText}>
                  Top Up ₹{amountInput || '0'} Now
                </Text>
              </>
            )}
          </Pressable>

          <View style={styles.paymentMethodsRow}>
            <MaterialCommunityIcons name="shield-check-outline" size={14} color="#737373" />
            <Text style={styles.paymentMethodsText}>
              Powered by Razorpay • UPI, GPay, PhonePe, Cards, NetBanking
            </Text>
          </View>
        </View>

        {/* Referral Teaser Banner */}
        {onNavigateReferral && (
          <Pressable style={styles.referralBanner} onPress={onNavigateReferral}>
            <LinearGradient
              colors={['#1F2937', '#111827']}
              style={styles.referralBannerGrad}
            >
              <View style={styles.referralBannerLeft}>
                <View style={styles.giftIconWrap}>
                  <MaterialCommunityIcons name="gift-outline" size={24} color="#F97316" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.referralBannerTitle}>Invite Friends, Get ₹100</Text>
                  <Text style={styles.referralBannerSubtitle}>
                    Earn ₹100 directly in this wallet for every friend who signs up!
                  </Text>
                </View>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color="#9CA3AF" />
            </LinearGradient>
          </Pressable>
        )}

        {/* Transaction History Section */}
        <View style={styles.historySection}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>Transaction History</Text>
            {/* Filter Chips */}
            <View style={styles.filterRow}>
              {(['ALL', 'CREDIT', 'DEBIT'] as const).map((ft) => (
                <Pressable
                  key={ft}
                  style={[styles.filterChip, filterType === ft && styles.filterChipActive]}
                  onPress={() => setFilterType(ft)}
                >
                  <Text style={[styles.filterChipText, filterType === ft && styles.filterChipTextActive]}>
                    {ft === 'ALL' ? 'All' : ft === 'CREDIT' ? 'Added' : 'Spent'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {loading && !data ? (
            <ActivityIndicator color="#F97316" style={{ marginVertical: 24 }} />
          ) : transactions.length === 0 ? (
            <View style={styles.emptyTransactions}>
              <MaterialCommunityIcons name="receipt" size={48} color="#D1D5DB" />
              <Text style={styles.emptyTransactionsTitle}>No transactions found</Text>
              <Text style={styles.emptyTransactionsDesc}>
                {filterType === 'ALL'
                  ? 'Add money or invite friends to see transactions here.'
                  : `No ${filterType.toLowerCase()} transactions recorded.`}
              </Text>
            </View>
          ) : (
            transactions.map((tx) => {
              const isCredit = tx.type === 'CREDIT';
              const formattedDate = new Date(tx.createdAt).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <View key={tx.id} style={styles.txRow}>
                  <View
                    style={[
                      styles.txIconWrap,
                      isCredit ? styles.txIconWrapCredit : styles.txIconWrapDebit,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={
                        isCredit
                          ? tx.source === 'REFERRAL_BONUS'
                            ? 'gift'
                            : 'arrow-bottom-left'
                          : 'arrow-top-right'
                      }
                      size={20}
                      color={isCredit ? '#10B981' : '#EF4444'}
                    />
                  </View>

                  <View style={styles.txDetails}>
                    <Text style={styles.txTitle}>
                      {tx.source === 'REFERRAL_BONUS'
                        ? 'Referral Reward'
                        : tx.source === 'TOPUP'
                          ? 'Wallet Top-up'
                          : tx.source === 'ORDER_PAYMENT'
                            ? 'Order Payment'
                            : tx.source === 'REFUND'
                              ? 'Order Refund'
                              : tx.source}
                    </Text>
                    <Text style={styles.txDescription} numberOfLines={1}>
                      {tx.description || formattedDate}
                    </Text>
                    <Text style={styles.txDate}>{formattedDate}</Text>
                  </View>

                  <View style={styles.txAmountWrap}>
                    <Text
                      style={[
                        styles.txAmount,
                        isCredit ? styles.txAmountCredit : styles.txAmountDebit,
                      ]}
                    >
                      {isCredit ? '+' : '-'}₹{tx.amount.toFixed(2)}
                    </Text>
                    <View
                      style={[
                        styles.txStatusTag,
                        tx.status === 'COMPLETED'
                          ? styles.txStatusSuccess
                          : styles.txStatusPending,
                      ]}
                    >
                      <Text style={styles.txStatusText}>{tx.status}</Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 48 : 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: {
    padding: 6,
    borderRadius: 8,
  },
  navTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,  // Small top spacing for visual breathing room
    paddingBottom: 48,
    gap: 16,
  },
  balanceCard: {
    borderRadius: 22,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  balanceTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  walletBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 6,
  },
  walletBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F97316',
    letterSpacing: 0.8,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 4,
  },
  securityBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10B981',
    letterSpacing: 0.5,
  },
  balanceMainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 18,
    marginBottom: 6,
  },
  currencySymbol: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F97316',
    marginTop: 6,
    marginRight: 4,
  },
  balanceAmount: {
    fontSize: 48,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  balanceHint: {
    fontSize: 12,
    color: '#9CA3AF',
    lineHeight: 18,
    marginBottom: 16,
  },
  balanceFeaturesRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 14,
    justifyContent: 'space-between',
  },
  balanceFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  balanceFeatureText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D1D5DB',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    borderColor: '#F97316',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },
  chipTextActive: {
    color: '#EA580C',
    fontWeight: '800',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  inputPrefix: {
    fontSize: 20,
    fontWeight: '800',
    color: '#6B7280',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    height: 48,
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  topupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F97316',
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  topupBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  paymentMethodsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  paymentMethodsText: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  referralBanner: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  referralBannerGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
  },
  referralBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  giftIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  referralBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F97316',
    marginBottom: 2,
  },
  referralBannerSubtitle: {
    fontSize: 11,
    color: '#9CA3AF',
    lineHeight: 16,
  },
  historySection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 8,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  filterChipActive: {
    backgroundColor: '#111827',
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  txIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txIconWrapCredit: {
    backgroundColor: '#ECFDF5',
  },
  txIconWrapDebit: {
    backgroundColor: '#FEF2F2',
  },
  txDetails: {
    flex: 1,
  },
  txTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  txDescription: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 2,
  },
  txDate: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  txAmountWrap: {
    alignItems: 'flex-end',
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  txAmountCredit: {
    color: '#10B981',
  },
  txAmountDebit: {
    color: '#EF4444',
  },
  txStatusTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  txStatusSuccess: {
    backgroundColor: '#ECFDF5',
  },
  txStatusPending: {
    backgroundColor: '#FFFBEB',
  },
  txStatusText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#059669',
  },
  emptyTransactions: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 6,
  },
  emptyTransactionsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4B5563',
  },
  emptyTransactionsDesc: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    maxWidth: 240,
  },
  guestContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  guestTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },
  guestSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
  },
  primaryBtn: {
    backgroundColor: '#F97316',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
