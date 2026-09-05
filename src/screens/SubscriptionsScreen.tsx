import React, { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import { api } from '@/lib/api';
import { payWithRazorpay } from '@/lib/payments';
import type { SubscriptionPlan } from '@/types/domain';

interface SubscriptionsScreenProps {
  onBook: () => void;
  onSignIn?: () => void;
}

const FALLBACK_PLANS: SubscriptionPlan[] = [
  {
    id: 'sub-plan-family',
    name: 'Family Deluxe Care Pass',
    slug: 'family-deluxe',
    durationMonths: 1,
    price: 1699,
    originalPrice: 2499,
    validityDays: 30,
    includedKg: 30,
    freePickupDelivery: true,
    priorityService: true,
    maxFamilyMembers: 4,
    popular: true,
    isActive: true,
    features: [
      '30 KG Wash & Fold or Steam Press',
      '4 Scheduled Doorstep Pickups & Deliveries',
      'Priority 24-Hour Express Return',
      'Free Herbal Fabric Softener & Sanitization',
      'Rollover Support for unused days',
    ],
  },
  {
    id: 'sub-plan-unlimited-press',
    name: 'Executive Steam Press Pass',
    slug: 'executive-press',
    durationMonths: 1,
    price: 999,
    originalPrice: 1499,
    validityDays: 30,
    includedKg: 15,
    freePickupDelivery: true,
    priorityService: true,
    maxFamilyMembers: 2,
    popular: false,
    isActive: true,
    features: [
      'Up to 60 Formal Shirts, Trousers & Sarees',
      '8 Free Doorstep Pickups per month',
      'Industrial High-Pressure Steam Press',
      'Delivered on Eco-Friendly Wire Hangers',
      'Same-Day Emergency 12H Slot Available',
    ],
  },
  {
    id: 'sub-plan-weekly',
    name: 'Weekly Essentials Pass',
    slug: 'weekly-essentials',
    durationMonths: 1,
    price: 899,
    originalPrice: 1199,
    validityDays: 30,
    includedKg: 15,
    freePickupDelivery: true,
    priorityService: false,
    maxFamilyMembers: 2,
    popular: false,
    isActive: true,
    features: [
      '15 KG Mixed Clothes Wash & Fold',
      '4 Scheduled Weekly Doorstep Pickups',
      '100% Ozone Anti-Bacterial Sterilization',
      'Neat Compact Shelf-Ready Packaging',
      'Zero Delivery & Zero Platform Fees',
    ],
  },
  {
    id: 'sub-plan-student',
    name: 'Student & Bachelor Saver',
    slug: 'student-saver',
    durationMonths: 1,
    price: 599,
    originalPrice: 799,
    validityDays: 30,
    includedKg: 10,
    freePickupDelivery: true,
    priorityService: false,
    maxFamilyMembers: 1,
    popular: false,
    isActive: true,
    features: [
      '10 KG Everyday Wear Wash & Fold',
      '2 Monthly Doorstep Pickups',
      'Gentle Detergents Safe for Colors',
      'Student ID Discount Eligible',
      'Instant In-App Scheduling',
    ],
  },
];

export function SubscriptionsScreen({ onBook, onSignIn }: SubscriptionsScreenProps) {
  const insets = useSafeAreaInsets();
  const { session } = useApp();
  const [purchasing, setPurchasing] = useState(false);
  const [memberships, setMemberships] = useState<any[]>([]);
  const [membershipError, setMembershipError] = useState('');
  const [plans, setPlans] = useState<SubscriptionPlan[]>(FALLBACK_PLANS);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('sub-plan-family');

  useEffect(() => {
    let mounted = true;
    api.getSubscriptionPlans()
      .then((remotePlans) => {
        if (mounted && remotePlans && remotePlans.length > 0) {
          const active = remotePlans.filter((p) => p.isActive);
          if (active.length > 0) setPlans(active);
        }
      })
      .catch(() => {
        // Keep fallback
      });
    return () => { mounted = false; };
  }, []);

  const loadMemberships = async () => {
    if (!session) { setMemberships([]); return; }
    try {
      setMembershipError('');
      setMemberships(await api.getCustomerSubscriptions(session.user.id));
    } catch (error) {
      setMembershipError(error instanceof Error ? error.message : 'Unable to load memberships.');
    }
  };

  useEffect(() => { void loadMemberships(); }, [session?.user.id]);

  const handleSubscribe = async (plan: SubscriptionPlan) => {
    if (!session) { onSignIn?.(); return; }
    if (purchasing) return;
    setPurchasing(true);
    let paymentCompleted = false;
    try {
      const order = await api.purchaseSubscription(session.user.id, plan.id);
      const payment = await payWithRazorpay({
        key: order.key || order.keyId || '', orderId: order.orderId,
        amount: Math.round(order.amount * 100), currency: order.currency,
        internalOrderId: plan.name,
      }, session.user);
      paymentCompleted = true;
      const membership = await api.verifySubscriptionPayment({
        ...payment, customerId: session.user.id, subscriptionId: plan.id,
      });
      if (membership?.payment_status !== 'PAID') throw new Error('Activation could not be confirmed.');
      await loadMemberships();
      Alert.alert('Subscription Activated', 'Your paid membership is now active.', [
        { text: 'OK' }, { text: 'Book Pickup', onPress: onBook },
      ]);
    } catch (error: any) {
      Alert.alert(paymentCompleted ? 'Activation Pending' : 'Payment Not Completed',
        paymentCompleted ? 'Your payment needs confirmation. Please contact support before paying again.'
          : error?.description || error?.message || 'Please try again.');
    } finally { setPurchasing(false); }
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 20) + 30 }]}
      showsVerticalScrollIndicator={false}
    >
      {session && (
        <View style={styles.heroHeader}>
          <Text style={styles.heroTitle}>Your Memberships</Text>
          {!!membershipError && <Text>{membershipError}</Text>}
          {!membershipError && memberships.length === 0 && <Text>No purchased memberships yet.</Text>}
          {memberships.map((membership) => {
            const active = membership.status === 'ACTIVE' && membership.paymentStatus === 'PAID'
              && new Date(membership.endDate).getTime() > Date.now();
            return <View key={membership.id} style={{ marginVertical: 10 }}>
              <Text style={styles.heroTagText}>{membership.planName || 'Laundry Pass'}</Text>
              <Text>{active ? 'Active' : membership.status === 'ACTIVE' ? 'Expired' : membership.status}</Text>
              <Text>{membership.remainingKg} KG remaining ? Valid until {new Date(membership.endDate).toLocaleDateString()}</Text>
              <Text>{membership.autoRenew ? 'Auto-renew enabled' : 'No automatic renewal'}</Text>
            </View>;
          })}
          <Pressable onPress={() => void loadMemberships()}><Text style={styles.heroTagText}>Refresh memberships</Text></Pressable>
        </View>
      )}
      {/* Hero Banner Header */}
      <View style={styles.heroHeader}>
        <View style={styles.heroTag}>
          <MaterialCommunityIcons name="crown" size={14} color="#FF7A00" />
          <Text style={styles.heroTagText}>LAUNDRYPASS MEMBERSHIP</Text>
        </View>
        <Text style={styles.heroTitle}>Smart Monthly Laundry Plans</Text>
        <Text style={styles.heroSubtitle}>
          Save up to 35% on doorstep laundry. Guaranteed free weekly pickups, priority express turnaround & zero delivery charges.
        </Text>
      </View>

      {/* Trust Badges */}
      <View style={styles.badgesRow}>
        <View style={styles.badgeItem}>
          <MaterialCommunityIcons name="truck-delivery-outline" size={18} color="#2563EB" />
          <Text style={styles.badgeLabel}>Free Pickups</Text>
        </View>
        <View style={styles.badgeItem}>
          <MaterialCommunityIcons name="shield-check-outline" size={18} color="#16A34A" />
          <Text style={styles.badgeLabel}>Ozone Sterilization</Text>
        </View>
        <View style={styles.badgeItem}>
          <MaterialCommunityIcons name="calendar-sync-outline" size={18} color="#D97706" />
          <Text style={styles.badgeLabel}>30-Day Validity</Text>
        </View>
      </View>

      {/* Subscription Plans Cards */}
      <View style={styles.plansStack}>
        {plans.map((plan) => {
          const isSelected = selectedPlanId === plan.id;
          return (
            <Pressable
              key={plan.id}
              style={[
                styles.planCard,
                plan.popular && styles.popularCardBorder,
                isSelected && styles.selectedPlanCard,
              ]}
              onPress={() => setSelectedPlanId(plan.id)}
            >
              {/* Popular / Best Value Ribbon */}
              {plan.popular && (
                <View style={styles.popularRibbon}>
                  <Text style={styles.popularRibbonText}>⭐ MOST POPULAR • SAVE 35%</Text>
                </View>
              )}

              {/* Plan Header */}
              <View style={styles.planHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.planName}>{plan.name}</Text>
                  {plan.originalPrice && (
                    <Text style={styles.originalPriceText}>Regular: ₹{plan.originalPrice}/mo</Text>
                  )}
                </View>

                {/* Price Tag */}
                <View style={styles.priceContainer}>
                  <Text style={styles.priceCurrency}>₹</Text>
                  <Text style={styles.priceValue}>{plan.price}</Text>
                  <Text style={styles.pricePeriod}>/mo</Text>
                </View>
              </View>

              {/* Quotas Pill Bar */}
              <View style={styles.quotasRow}>
                {plan.includedKg ? (
                  <View style={styles.quotaPill}>
                    <MaterialCommunityIcons name="scale" size={13} color="#2563EB" />
                    <Text style={styles.quotaPillText}>{plan.includedKg} KG Allowance</Text>
                  </View>
                ) : null}
                {plan.freePickupDelivery ? (
                  <View style={styles.quotaPill}>
                    <MaterialCommunityIcons name="moped" size={13} color="#FF7A00" />
                    <Text style={styles.quotaPillText}>Free Pickups</Text>
                  </View>
                ) : null}
                <View style={styles.quotaPill}>
                  <MaterialCommunityIcons name="clock-outline" size={13} color="#16A34A" />
                  <Text style={styles.quotaPillText}>{plan.validityDays} Days</Text>
                </View>
              </View>

              {/* Features List */}
              <View style={styles.perksList}>
                {(plan.features || []).map((feature: string, idx: number) => (
                  <View key={idx} style={styles.perkItem}>
                    <MaterialCommunityIcons name="check-circle" size={15} color="#16A34A" />
                    <Text style={styles.perkText}>{feature}</Text>
                  </View>
                ))}
              </View>

              {/* Action Button */}
              <Pressable
                style={styles.subscribeBtnWrap}
                disabled={purchasing}
                onPress={() => void handleSubscribe(plan)}
              >
                <LinearGradient
                  colors={plan.popular ? ['#FF7A00', '#FF5A00'] : ['#2563EB', '#1E40AF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.subscribeBtnGradient}
                >
                  <Text style={styles.subscribeBtnText}>
                    Subscribe for ₹{plan.price}/month
                  </Text>
                  <MaterialCommunityIcons name="arrow-right" size={16} color="#FFFFFF" />
                </LinearGradient>
              </Pressable>
            </Pressable>
          );
        })}
      </View>

      {/* FAQ / Terms note */}
      <View style={styles.termsNote}>
        <MaterialCommunityIcons name="information-outline" size={16} color="#94A3B8" />
        <Text style={styles.termsNoteText}>
          Plans renew monthly. Unused pickup allowances can be rescheduled within the active billing cycle. Cancel anytime from your account settings.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 16,
  },
  heroHeader: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
    marginBottom: 16,
  },
  heroTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  heroTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FF7A00',
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 19,
  },
  badgesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 8,
  },
  badgeItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  badgeLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#334155',
  },
  plansStack: {
    gap: 16,
  },
  planCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  popularCardBorder: {
    borderColor: '#FF7A00',
  },
  selectedPlanCard: {
    backgroundColor: '#FFFFFF',
  },
  popularRibbon: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFF7ED',
    paddingVertical: 5,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#FFEDD5',
  },
  popularRibbonText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#FF7A00',
    letterSpacing: 0.5,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 10,
    gap: 12,
  },
  planName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
  },
  originalPriceText: {
    fontSize: 11,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
    marginTop: 2,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceCurrency: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  priceValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#111827',
  },
  pricePeriod: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  quotasRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 14,
    flexWrap: 'wrap',
  },
  quotaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 5,
  },
  quotaPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  perksList: {
    gap: 8,
    marginBottom: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  perkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  perkText: {
    fontSize: 12.5,
    color: '#4B5563',
    fontWeight: '500',
    flex: 1,
  },
  subscribeBtnWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#FF7A00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  subscribeBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap: 6,
    borderRadius: 16,
  },
  subscribeBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  termsNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 20,
    paddingHorizontal: 8,
  },
  termsNoteText: {
    flex: 1,
    fontSize: 11.5,
    color: '#94A3B8',
    lineHeight: 16,
  },
});
