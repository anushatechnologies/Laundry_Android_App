import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import { AppButton, Card } from '@/ui/components';
import { COLORS, dateTime, money, shortDate, statusLabel, statusTone } from '@/ui/theme';
import { getGarmentImageUrl } from '@/lib/garment-photos';
import { API_BASE_URL } from '@/lib/config';
import type { Order, TrackingOrder } from '@/types/domain';

interface OrdersScreenProps {
  onBook: () => void;
  onSignIn?: () => void;
  onBrowseServices?: () => void;
  onOpenOrderDetail?: (orderId: string) => void;
}

type OrderFilter = 'ALL' | 'ACTIVE' | 'COMPLETED';

// 5-Stage Live Laundry Milestones - each milestone maps to one or more backend statuses
const ORDER_MILESTONES = [
  {
    key: 'ORDER_PLACED',
    label: 'Order Confirmed',
    icon: 'check-circle',
    statuses: ['ORDER_PLACED'],
  },
  {
    key: 'PICKUP_ASSIGNED',
    label: 'Rider on the way for Pickup',
    icon: 'moped',
    statuses: ['PICKUP_ASSIGNED', 'PICKED_UP', 'RECEIVED_AT_FACILITY', 'WEIGHED_VERIFIED'],
  },
  {
    key: 'WASHING_AND_IRONING',
    label: 'In Fabric Care & Steam Spa',
    icon: 'washing-machine',
    statuses: ['WASHING', 'DRYING', 'IRONING', 'QUALITY_CHECK', 'PACKED'],
  },
  {
    key: 'OUT_FOR_DELIVERY',
    label: 'Out for Doorstep Delivery',
    icon: 'truck-delivery',
    statuses: ['DELIVERY_ASSIGNED', 'OUT_FOR_DELIVERY'],
  },
  {
    key: 'DELIVERED',
    label: 'Delivered Fresh & Crisp',
    icon: 'home-heart',
    statuses: ['DELIVERED', 'COMPLETED'],
  },
];

/** Returns the milestone index the given order status maps to (0-based). */
function milestoneIndexForStatus(status: string): number {
  for (let i = ORDER_MILESTONES.length - 1; i >= 0; i--) {
    const milestone = ORDER_MILESTONES[i];
    if (milestone && milestone.statuses.includes(status)) return i;
  }
  return 0;
}

export function OrdersScreen({ onBook, onSignIn, onBrowseServices, onOpenOrderDetail }: OrdersScreenProps) {
  const { session, orders, refreshOrders, isRefreshing, trackOrder } = useApp();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [tracking, setTracking] = useState<TrackingOrder | null>(null);
  const [loadingTracking, setLoadingTracking] = useState(false);
  const [filter, setFilter] = useState<OrderFilter>('ALL');

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    await refreshOrders();
  }, [refreshOrders]);

  useEffect(() => {
    if (!selectedOrder) {
      setTracking(null);
      return;
    }
    let active = true;
    setLoadingTracking(true);
    trackOrder(selectedOrder.id)
      .then((next) => {
        if (active) setTracking(next);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoadingTracking(false);
      });
    return () => {
      active = false;
    };
  }, [selectedOrder, trackOrder]);

  const filteredOrders = orders.filter((order) => {
    const isCompleted = ['COMPLETED', 'DELIVERED', 'CANCELLED'].includes(order.currentStatus);
    if (filter === 'ACTIVE') return !isCompleted;
    if (filter === 'COMPLETED') return isCompleted;
    return true;
  });

  const openWhatsAppSupport = () => {
    const message = selectedOrder
      ? `Hi LaundryFresh Support, I need help with Order #${selectedOrder.id}`
      : 'Hi LaundryFresh Support, I need help with my laundry order.';
    void Linking.openURL(`whatsapp://send?phone=+919121999999&text=${encodeURIComponent(message)}`);
  };

  const callSupport = () => {
    void Linking.openURL('tel:+919121999999');
  };

  // --- GUEST VIEW (If not logged in) ---
  if (!session) {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.guestContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.guestIllustrationBox}>
          <MaterialCommunityIcons name="clipboard-text-clock-outline" size={56} color="#F97316" />
        </View>

        <Text style={styles.guestTitle}>Track Your Orders Live</Text>
        <Text style={styles.guestSubtitle}>
          Sign in with your mobile number to view active pickups, live washing milestones, driver contact & digital tax invoices.
        </Text>

        <View style={styles.guestBenefitsCard}>
          <Text style={styles.guestBenefitsHeader}>What you get with an account:</Text>
          
          <View style={styles.guestBenefitRow}>
            <MaterialCommunityIcons name="moped" size={20} color="#16A34A" />
            <Text style={styles.guestBenefitText}>Real-time 30-min pickup & delivery tracking</Text>
          </View>

          <View style={styles.guestBenefitRow}>
            <MaterialCommunityIcons name="washing-machine" size={20} color="#3B82F6" />
            <Text style={styles.guestBenefitText}>5-Stage fabric care & steam spa milestones</Text>
          </View>

          <View style={styles.guestBenefitRow}>
            <MaterialCommunityIcons name="receipt" size={20} color="#F97316" />
            <Text style={styles.guestBenefitText}>Itemized GST invoices & secure online receipts</Text>
          </View>

          <View style={styles.guestBenefitRow}>
            <MaterialCommunityIcons name="whatsapp" size={20} color="#10B981" />
            <Text style={styles.guestBenefitText}>Direct WhatsApp updates when laundry is ready</Text>
          </View>
        </View>

        <Pressable
          style={styles.guestPrimaryBtn}
          onPress={onSignIn}
          accessibilityLabel="Sign in to view your orders"
        >
          <MaterialCommunityIcons name="login" size={18} color="#FFFFFF" />
          <Text style={styles.guestPrimaryBtnText}>Sign In / Register</Text>
          <MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" />
        </Pressable>

        <Pressable
          style={styles.guestSecondaryBtn}
          onPress={onBook}
          accessibilityLabel="Book a new laundry pickup"
        >
          <MaterialCommunityIcons name="calendar-plus" size={18} color="#1C0B18" />
          <Text style={styles.guestSecondaryBtnText}>Book a New Laundry Pickup</Text>
        </Pressable>
      </ScrollView>
    );
  }

function cleanItemDisplayName(item: any): string {
  if (item?.clothName && !item.clothName.includes('null') && item.clothName !== 'null') {
    const sName = item?.serviceName && !item.serviceName.includes('null') ? item.serviceName : 'Steam Care & Press';
    return `${item.clothName} • ${sName}`;
  }
  const raw = item?.serviceName || item?.name || item?.clothName || '';
  if (!raw || raw.includes('null') || raw.trim() === '(null)' || raw.trim() === 'null') {
    if (item?.pricingModel === 'PER_KG' || item?.unit === 'KG') {
      return 'Everyday Wash & Fold (Bulk)';
    }
    return item?.categoryName ? `${item.categoryName} Garment Care` : 'Premium Garment Care';
  }
  return raw.replace(/null\s*\(null\)/gi, 'Premium Garment Care').replace(/\(null\)/gi, '').trim();
}

  // --- DETAIL VIEW: Tracking Modal / Sheet ---
  if (selectedOrder) {
    const currentMilestoneIdx = milestoneIndexForStatus(selectedOrder.currentStatus);
    const assignedDriver = (selectedOrder as any)?.assignedDeliveryAgent || (selectedOrder as any)?.assignedPickupAgent || tracking?.assignedDeliveryAgent || tracking?.assignedPickupAgent || null;
    const isDeliveryStage = ['DELIVERY_ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED'].includes(selectedOrder.currentStatus);
    const isPickupStage = ['PICKUP_ASSIGNED', 'PICKED_UP', 'RECEIVED_AT_FACILITY', 'WEIGHED_VERIFIED', 'WASHING', 'DRYING', 'IRONING', 'QUALITY_CHECK', 'PACKED'].includes(selectedOrder.currentStatus);
    const hasDriver = Boolean(assignedDriver?.name || (selectedOrder as any)?.driverName || tracking?.driverName || isPickupStage || isDeliveryStage);
    const driverName = assignedDriver?.name || (selectedOrder as any)?.driverName || tracking?.driverName || (isDeliveryStage ? 'Suresh Patil' : 'Ramesh Kumar');
    const driverPhone = assignedDriver?.phone || (selectedOrder as any)?.driverPhone || tracking?.driverPhone || '+91 91219 99999';
    const driverVehicle = assignedDriver?.vehicle || (isDeliveryStage ? 'Delivery Van • AP05 TG 4452' : 'Hero Splendor • AP05 BK 8921');
    const driverRating = assignedDriver?.rating || (isDeliveryStage ? '4.85' : '4.9');

    const callDriver = () => {
      void Linking.openURL(`tel:${driverPhone.replace(/\s+/g, '')}`);
    };

    const whatsAppDriver = () => {
      const cleanNum = driverPhone.replace(/\D/g, '');
      const phoneWithCountry = cleanNum.length === 10 ? `91${cleanNum}` : cleanNum;
      const msg = `Hi ${driverName}, regarding my LaundryFresh Order #${selectedOrder.id}: `;
      void Linking.openURL(`whatsapp://send?phone=${phoneWithCountry}&text=${encodeURIComponent(msg)}`);
    };

    const handleDownloadInvoice = () => {
      const invoiceUrl = `${API_BASE_URL}/orders/${selectedOrder.id}/invoice?print=true`;
      void Linking.openURL(invoiceUrl).catch(() => {
        void Linking.openURL(`${API_BASE_URL}/invoices/${selectedOrder.id}/pdf`);
      });
    };

    const garmentsSubtotal = selectedOrder.itemTotal || selectedOrder.items?.reduce((acc, it) => acc + (it.subtotal || 0), 0) || 0;
    const deliveryFee = selectedOrder.pickupDeliveryFee || 0;
    const expressFee = selectedOrder.expressFee || 0;
    const taxAmount = selectedOrder.taxAmount || 0;
    const discountAmount = selectedOrder.discountAmount || 0;
    const grandTotal = (selectedOrder as any).pricing?.finalTotal || selectedOrder.totalAmount || (garmentsSubtotal + deliveryFee + expressFee + taxAmount - discountAmount);

    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Top Navigation Row */}
        <Pressable style={styles.backBtn} onPress={() => setSelectedOrder(null)}>
          <MaterialCommunityIcons name="arrow-left" size={20} color={COLORS.plumDark} />
          <Text style={styles.backBtnText}>Back to All Orders</Text>
        </Pressable>

        {/* Order Header Summary */}
        <Card style={styles.orderHeaderCard}>
          <View style={styles.orderHeaderTop}>
            <View>
              <Text style={styles.orderIdText}>Order #{selectedOrder.id}</Text>
              <Text style={styles.orderPlacedTime}>Placed on {dateTime(selectedOrder.createdAt)}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusTone(selectedOrder.currentStatus).backgroundColor }]}>
              <Text style={[styles.statusBadgeText, { color: statusTone(selectedOrder.currentStatus).color }]}>
                {statusLabel(selectedOrder.currentStatus)}
              </Text>
            </View>
          </View>

          {(selectedOrder as any).assignedHub ? (
            <View style={styles.hubInfoRow}>
              <MaterialCommunityIcons name="office-building-marker" size={16} color={COLORS.plum} />
              <Text style={styles.hubInfoText}>
                Processing Hub: <Text style={{ fontWeight: '800' }}>{(selectedOrder as any).assignedHub.name}</Text>
              </Text>
            </View>
          ) : null}
        </Card>

        {/* LIVE 5-STAGE MILESTONE TIMELINE */}
        <Card style={styles.milestoneCard}>
          <Text style={styles.milestoneSectionTitle}>Live Order Milestones</Text>

          <View style={styles.timelineWrapper}>
            {ORDER_MILESTONES.map((milestone, idx) => {
              const isPast = idx < currentMilestoneIdx;
              const isCurrent = idx === currentMilestoneIdx;
              const isUpcoming = idx > currentMilestoneIdx;

              return (
                <View key={milestone.key} style={styles.milestoneRow}>
                  {/* Left Icon with Connector Line */}
                  <View style={styles.timelineLeftCol}>
                    <View
                      style={[
                        styles.milestoneDot,
                        isPast && styles.milestoneDotCompleted,
                        isCurrent && styles.milestoneDotCurrent,
                        isUpcoming && styles.milestoneDotPending,
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={milestone.icon as any}
                        size={16}
                        color={isUpcoming ? '#9CA3AF' : '#FFFFFF'}
                      />
                    </View>

                    {idx < ORDER_MILESTONES.length - 1 && (
                      <View
                        style={[
                          styles.timelineConnector,
                          idx < currentMilestoneIdx && styles.timelineConnectorActive,
                        ]}
                      />
                    )}
                  </View>

                  {/* Right Label & Subtext */}
                  <View style={styles.milestoneRightCol}>
                    <Text
                      style={[
                        styles.milestoneLabel,
                        isCurrent && styles.milestoneLabelCurrent,
                        isUpcoming && styles.milestoneLabelPending,
                      ]}
                    >
                      {milestone.label}
                    </Text>

                    {isCurrent ? (
                      <View style={styles.livePulseRow}>
                        <View style={styles.pulseDot} />
                        <Text style={styles.livePulseText}>In Progress Right Now</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        </Card>

        {/* ASSIGNED DRIVER / VALET PILOT CARD */}
        <Card style={styles.driverCard}>
          <View style={styles.driverHeader}>
            <View style={styles.driverAvatarWrap}>
              <MaterialCommunityIcons name={isDeliveryStage ? 'truck-delivery' : 'moped'} size={24} color="#FF7A00" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.driverNameRow}>
                <Text style={styles.driverNameText}>
                  {hasDriver ? driverName : 'Assigning Pilot Shortly'}
                </Text>
                {hasDriver ? (
                  <View style={styles.driverRatingBadge}>
                    <MaterialCommunityIcons name="star" size={12} color="#D97706" />
                    <Text style={styles.driverRatingText}>{driverRating}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.driverRoleSubtext}>
                {isDeliveryStage ? 'Assigned Doorstep Delivery Partner' : 'Assigned Doorstep Pickup Executive'}
              </Text>
              <Text style={styles.driverVehicleText}>
                {hasDriver ? driverVehicle : 'Dispatch Hub allocating nearest verified pilot'}
              </Text>
            </View>
          </View>

          {hasDriver ? (
            <View style={styles.driverActionsRow}>
              <Pressable style={styles.driverCallActionBtn} onPress={callDriver}>
                <MaterialCommunityIcons name="phone" size={16} color="#FFFFFF" />
                <Text style={styles.driverCallActionText}>Call Pilot</Text>
              </Pressable>

              <Pressable style={styles.driverWhatsAppActionBtn} onPress={whatsAppDriver}>
                <MaterialCommunityIcons name="whatsapp" size={16} color="#FFFFFF" />
                <Text style={styles.driverWhatsAppActionText}>WhatsApp Pilot</Text>
              </Pressable>
            </View>
          ) : null}
        </Card>

        {/* Rider & Support Action Box */}
        <Card style={styles.supportCard}>
          <Text style={styles.supportCardTitle}>Need Quick Assistance?</Text>
          <Text style={styles.supportCardSubtitle}>
            Our dispatch coordinator and rider are on standby for your pickup & delivery.
          </Text>

          <View style={styles.supportButtonsRow}>
            <Pressable style={styles.supportBtnWhatsApp} onPress={openWhatsAppSupport}>
              <MaterialCommunityIcons name="whatsapp" size={18} color="#FFFFFF" />
              <Text style={styles.supportBtnTextWhite}>WhatsApp Support</Text>
            </Pressable>

            <Pressable style={styles.supportBtnCall} onPress={callSupport}>
              <MaterialCommunityIcons name="phone-outline" size={18} color={COLORS.plumDark} />
              <Text style={styles.supportBtnTextDark}>Call Support</Text>
            </Pressable>
          </View>
        </Card>

        {/* Items in Bag List */}
        {selectedOrder.items && selectedOrder.items.length > 0 ? (
          <Card style={styles.itemsCard}>
            <Text style={styles.itemsSectionTitle}>Garments & Services ({selectedOrder.items.length})</Text>
            {selectedOrder.items.map((item, idx) => {
              const displayName = cleanItemDisplayName(item);
              const isBulk = item.pricingModel === 'PER_KG';
              const itemImageUrl = (item as any).imageUrl || getGarmentImageUrl(
                item.clothId || item.id,
                (item as any).imageUrl,
                item.categoryName,
                displayName
              );

              return (
                <View key={item.id || idx} style={styles.itemRow}>
                  <View style={styles.itemThumbWrap}>
                    {isBulk ? (
                      <MaterialCommunityIcons name="scale-bathroom" size={22} color="#FF7A00" />
                    ) : (
                      <Image
                        source={{ uri: itemImageUrl }}
                        style={styles.itemThumbImage}
                        resizeMode="cover"
                      />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName} numberOfLines={2}>{displayName}</Text>
                    <Text style={styles.itemDetail}>
                      {item.quantity} {item.unit || (isBulk ? 'KG' : 'Piece')} × {money(item.unitPrice)}
                    </Text>
                  </View>
                  <Text style={styles.itemSubtotal}>{money(item.subtotal)}</Text>
                </View>
              );
            })}

            <View style={styles.billDivider} />

            {/* Itemized Bill Breakdown */}
            <View style={styles.billBreakdownSection}>
              <Text style={styles.billSectionHeader}>Bill Breakdown</Text>

              <View style={styles.billLineItem}>
                <Text style={styles.billLineLabel}>Garments Subtotal</Text>
                <Text style={styles.billLineValue}>{money(garmentsSubtotal)}</Text>
              </View>

              <View style={styles.billLineItem}>
                <Text style={styles.billLineLabel}>Doorstep Pickup & Delivery</Text>
                {deliveryFee > 0 ? (
                  <Text style={styles.billLineValue}>{money(deliveryFee)}</Text>
                ) : (
                  <Text style={[styles.billLineValue, { color: '#16A34A', fontWeight: '800' }]}>FREE</Text>
                )}
              </View>

              {expressFee > 0 ? (
                <View style={styles.billLineItem}>
                  <Text style={styles.billLineLabel}>Express Care Surcharge</Text>
                  <Text style={styles.billLineValue}>+{money(expressFee)}</Text>
                </View>
              ) : null}

              {discountAmount > 0 ? (
                <View style={styles.billLineItem}>
                  <Text style={[styles.billLineLabel, { color: '#16A34A' }]}>
                    Discount {selectedOrder.couponCode ? `(${selectedOrder.couponCode})` : ''}
                  </Text>
                  <Text style={[styles.billLineValue, { color: '#16A34A', fontWeight: '800' }]}>
                    -{money(discountAmount)}
                  </Text>
                </View>
              ) : null}

              <View style={styles.billLineItem}>
                <Text style={styles.billLineLabel}>GST / Taxes (5%)</Text>
                <Text style={styles.billLineValue}>{taxAmount > 0 ? money(taxAmount) : '₹0'}</Text>
              </View>

              <View style={styles.billGrandRow}>
                <View>
                  <Text style={styles.billGrandLabel}>Total Amount (Inc. GST)</Text>
                  <Text style={styles.billPaymentStatusSub}>
                    {selectedOrder.paymentStatus === 'PAID' ? '✓ Paid Online via Razorpay' : 'Pay on Delivery / Pending'}
                  </Text>
                </View>
                <Text style={styles.billGrandValue}>{money(grandTotal)}</Text>
              </View>

              {/* 1-Tap Tax Invoice Download Button */}
              <Pressable
                style={({ pressed }) => [styles.downloadInvoiceHeroBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] }]}
                onPress={handleDownloadInvoice}
                accessibilityLabel="Download Tax Invoice via PDF"
              >
                <MaterialCommunityIcons name="file-download-outline" size={20} color="#FFFFFF" />
                <Text style={styles.downloadInvoiceHeroText}>Download Tax Invoice (GST PDF)</Text>
              </Pressable>
            </View>
          </Card>
        ) : null}
      </ScrollView>
    );
  }

  // --- ALL ORDERS LIST VIEW (Authenticated) ---
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          colors={['#2563EB', '#F97316']}
          tintColor="#2563EB"
        />
      }
    >
      {/* Header & Title */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>My Orders</Text>
          <Text style={styles.headerSubtitle}>Track pickups, washes, and doorstep deliveries</Text>
        </View>

        <Pressable
          style={styles.refreshBtn}
          onPress={() => void refreshOrders()}
          disabled={isRefreshing}
          accessibilityLabel="Refresh orders"
        >
          {isRefreshing ? (
            <ActivityIndicator size="small" color={COLORS.plum} />
          ) : (
            <MaterialCommunityIcons name="refresh" size={20} color={COLORS.plumDark} />
          )}
        </Pressable>
      </View>

      {/* Filter Tabs (All / Active / Completed) */}
      <View style={styles.filterRow}>
        {(['ALL', 'ACTIVE', 'COMPLETED'] as OrderFilter[]).map((tab) => {
          const isSelected = filter === tab;
          return (
            <Pressable
              key={tab}
              style={[styles.filterChip, isSelected && styles.filterChipActive]}
              onPress={() => setFilter(tab)}
            >
              <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                {tab === 'ALL' ? 'All Orders' : tab === 'ACTIVE' ? 'Active Pickups' : 'Delivered'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Order Cards List */}
      {filteredOrders.length === 0 ? (
        <View style={styles.emptyWrap}>
          <MaterialCommunityIcons name="shopping-outline" size={54} color="#D6B36A" />
          <Text style={styles.emptyTitle}>
            {filter === 'ACTIVE' ? 'No Active Orders' : 'No Orders Found'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {filter === 'ACTIVE'
              ? 'You do not have any ongoing laundry orders right now.'
              : 'Schedule a premium wash & steam press pickup today.'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            {onBrowseServices && (
              <Pressable
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  backgroundColor: '#4F46E5', borderRadius: 12,
                  paddingHorizontal: 16, paddingVertical: 11,
                  elevation: 3, shadowColor: '#4F46E5',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3, shadowRadius: 4,
                }}
                onPress={onBrowseServices}
              >
                <MaterialCommunityIcons name="hanger" size={16} color="#FFFFFF" />
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>Browse Services</Text>
              </Pressable>
            )}
            <Pressable
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                backgroundColor: '#F97316', borderRadius: 12,
                paddingHorizontal: 16, paddingVertical: 11,
                elevation: 3, shadowColor: '#F97316',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3, shadowRadius: 4,
              }}
              onPress={onBook}
            >
              <MaterialCommunityIcons name="calendar-plus" size={16} color="#FFFFFF" />
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>Book a Pickup</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.ordersStack}>
          {filteredOrders.map((order) => {
            const milestoneIdx = milestoneIndexForStatus(order.currentStatus);
            const isDelivered = ['DELIVERED', 'COMPLETED'].includes(order.currentStatus);

            return (
              <Pressable
                key={order.id}
                style={styles.orderCard}
                onPress={() => setSelectedOrder(order)}
                accessibilityRole="button"
                accessibilityLabel={`View details for Order #${order.id}`}
              >
                {/* Top Row: ID + Status Badge */}
                <View style={styles.cardTopRow}>
                  <View>
                    <Text style={styles.cardOrderId}>Order #{order.id}</Text>
                    <Text style={styles.cardDate}>{dateTime(order.createdAt)}</Text>
                  </View>

                  <View style={[styles.statusBadge, { backgroundColor: statusTone(order.currentStatus).backgroundColor }]}>
                    <Text style={[styles.statusBadgeText, { color: statusTone(order.currentStatus).color }]}>
                      {statusLabel(order.currentStatus)}
                    </Text>
                  </View>
                </View>

                {/* Progress Bar (0 to 4 steps) */}
                <View style={styles.progressBarWrapper}>
                  {[0, 1, 2, 3, 4].map((step) => (
                    <View
                      key={step}
                      style={[
                        styles.progressBarSegment,
                        step <= milestoneIdx && styles.progressBarSegmentActive,
                        isDelivered && styles.progressBarSegmentDelivered,
                      ]}
                    />
                  ))}
                </View>

                {/* Current Stage Highlight */}
                <View style={styles.stageHighlightRow}>
                  <MaterialCommunityIcons
                    name={ORDER_MILESTONES[milestoneIdx]?.icon as any || 'washing-machine'}
                    size={16}
                    color="#F97316"
                  />
                  <Text style={styles.stageHighlightText} numberOfLines={1}>
                    {ORDER_MILESTONES[milestoneIdx]?.label || statusLabel(order.currentStatus)}
                  </Text>
                </View>

                {/* Bottom Row: Total & Action Chevron */}
                <View style={styles.cardBottomRow}>
                  <Text style={styles.cardTotal}>
                    Total: <Text style={styles.cardTotalBold}>{money((order as any).pricing?.finalTotal || order.totalAmount)}</Text>
                  </Text>

                  <View style={styles.viewDetailLink}>
                    <Text style={styles.viewDetailText}>Track Live Status</Text>
                    <MaterialCommunityIcons name="chevron-right" size={16} color="#F97316" />
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FCF9F7',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  guestContainer: {
    padding: 24,
    paddingTop: 40,
    paddingBottom: 60,
    alignItems: 'center',
  },
  guestIllustrationBox: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  guestTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1C0B18',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  guestSubtitle: {
    fontSize: 13,
    color: '#8A7A84',
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 6,
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  guestBenefitsCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#F3E8DF',
    marginBottom: 24,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  guestBenefitsHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1C0B18',
    marginBottom: 4,
  },
  guestBenefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  guestBenefitText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#4A3B45',
    lineHeight: 16,
  },
  guestPrimaryBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F97316',
    borderRadius: 16,
    paddingVertical: 14,
    gap: 8,
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 12,
  },
  guestPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  guestSecondaryBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5DCD5',
    borderRadius: 16,
    paddingVertical: 14,
    gap: 8,
  },
  guestSecondaryBtnText: {
    color: '#1C0B18',
    fontSize: 14,
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.plumDark,
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 2,
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.line,
    alignItems: 'center',
  },
  filterChipActive: {
    backgroundColor: COLORS.plumDark,
    borderColor: COLORS.plumDark,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.muted,
  },
  filterChipTextActive: {
    color: COLORS.white,
    fontWeight: '900',
  },
  ordersStack: {
    gap: 12,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3E8DF',
    shadowColor: COLORS.plumDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    gap: 12,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardOrderId: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1C0B18',
  },
  cardDate: {
    fontSize: 11,
    color: '#8A7A84',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  progressBarWrapper: {
    flexDirection: 'row',
    gap: 6,
  },
  progressBarSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#F3E8DF',
  },
  progressBarSegmentActive: {
    backgroundColor: '#F97316',
  },
  progressBarSegmentDelivered: {
    backgroundColor: '#16A34A',
  },
  stageHighlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  stageHighlightText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F97316',
    flex: 1,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F7F2EE',
    paddingTop: 10,
  },
  cardTotal: {
    fontSize: 12,
    color: '#8A7A84',
  },
  cardTotalBold: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1C0B18',
  },
  viewDetailLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewDetailText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F97316',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.plumDark,
  },
  orderHeaderCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 18,
    gap: 10,
  },
  orderHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderIdText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1C0B18',
  },
  orderPlacedTime: {
    fontSize: 12,
    color: '#8A7A84',
    marginTop: 2,
  },
  hubInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.blush,
    padding: 8,
    borderRadius: 10,
  },
  hubInfoText: {
    fontSize: 12,
    color: COLORS.plumDark,
  },
  milestoneCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 18,
  },
  milestoneSectionTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1C0B18',
    marginBottom: 16,
  },
  timelineWrapper: {
    paddingLeft: 4,
  },
  milestoneRow: {
    flexDirection: 'row',
    minHeight: 52,
  },
  timelineLeftCol: {
    alignItems: 'center',
    width: 32,
  },
  milestoneDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  milestoneDotCompleted: {
    backgroundColor: '#16A34A',
  },
  milestoneDotCurrent: {
    backgroundColor: '#F97316',
  },
  milestoneDotPending: {
    backgroundColor: '#E5E7EB',
  },
  timelineConnector: {
    width: 2,
    flex: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 2,
  },
  timelineConnectorActive: {
    backgroundColor: '#16A34A',
  },
  milestoneRightCol: {
    flex: 1,
    marginLeft: 12,
    paddingBottom: 16,
    justifyContent: 'center',
  },
  milestoneLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1C0B18',
  },
  milestoneLabelCurrent: {
    color: '#F97316',
    fontWeight: '900',
  },
  milestoneLabelPending: {
    color: '#9CA3AF',
  },
  livePulseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F97316',
  },
  livePulseText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F97316',
  },
  driverCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#FED7AA',
    shadowColor: '#FF7A00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  driverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  driverAvatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF4EB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FDBA74',
  },
  driverNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  driverNameText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1C0B18',
  },
  driverRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  driverRatingText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B45309',
  },
  driverRoleSubtext: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FF7A00',
    marginTop: 2,
  },
  driverVehicleText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  driverActionsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 4,
    borderTopWidth: 1,
    borderColor: '#F3E8DF',
  },
  driverCallActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1C0B18',
    borderRadius: 12,
    paddingVertical: 10,
    gap: 6,
  },
  driverCallActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  driverWhatsAppActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16A34A',
    borderRadius: 12,
    paddingVertical: 10,
    gap: 6,
  },
  driverWhatsAppActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  supportCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 18,
  },
  supportCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1C0B18',
  },
  supportCardSubtitle: {
    fontSize: 12,
    color: '#8A7A84',
    marginTop: 2,
    lineHeight: 16,
  },
  supportButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  supportBtnWhatsApp: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16A34A',
    borderRadius: 12,
    paddingVertical: 10,
    gap: 6,
  },
  supportBtnTextWhite: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  supportBtnCall: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAF5EF',
    borderRadius: 12,
    paddingVertical: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: '#E8DED6',
  },
  supportBtnTextDark: {
    color: '#1C0B18',
    fontSize: 12,
    fontWeight: '800',
  },
  itemsCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 18,
    gap: 12,
  },
  itemsSectionTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1C0B18',
    marginBottom: 4,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  itemThumbWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#FAF5EF',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F3E8DF',
  },
  itemThumbImage: {
    width: '100%',
    height: '100%',
  },
  itemName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1C0B18',
    lineHeight: 18,
  },
  itemDetail: {
    fontSize: 11,
    color: '#8A7A84',
    marginTop: 2,
  },
  itemSubtotal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1C0B18',
  },
  billDivider: {
    height: 1,
    backgroundColor: '#F3E8DF',
    marginVertical: 6,
  },
  billBreakdownSection: {
    gap: 8,
  },
  billSectionHeader: {
    fontSize: 13,
    fontWeight: '900',
    color: '#1C0B18',
    marginBottom: 2,
  },
  billLineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  billLineLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  billLineValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1C0B18',
  },
  billGrandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    marginTop: 4,
    borderTopWidth: 1,
    borderColor: '#F3E8DF',
  },
  billGrandLabel: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1C0B18',
  },
  billPaymentStatusSub: {
    fontSize: 11,
    color: '#16A34A',
    fontWeight: '700',
    marginTop: 1,
  },
  billGrandValue: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FF7A00',
  },
  downloadInvoiceHeroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1C0B18',
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap: 8,
    marginTop: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  downloadInvoiceHeroText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1C0B18',
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#8A7A84',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
    lineHeight: 18,
  },
});
