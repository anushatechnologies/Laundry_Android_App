import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import { useTheme } from '@/context/ThemeContext';
import { api } from '@/lib/api';
import { AppButton, Card } from '@/ui/components';
import { COLORS, dateTime, money, shortDate, statusLabel, statusTone } from '@/ui/theme';
import { getGarmentImageUrl } from '@/lib/garment-photos';
import { downloadInvoicePdf, shareInvoicePdf } from '@/lib/invoice';
import { InvoiceViewerModal, InvoiceActionModal } from '@/components/InvoiceViewerModal';
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
  const { session, orders, refreshOrders, isRefreshing, trackOrder, refreshWallet } = useApp();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  // The floating tab bar is absolutely positioned over the scroll view.
  // Keep enough room for its pill, shadow, and Android gesture area.
  const scrollBottomClearance = Math.max(insets.bottom, 12) + 196;
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [tracking, setTracking] = useState<TrackingOrder | null>(null);
  const [loadingTracking, setLoadingTracking] = useState(false);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [filter, setFilter] = useState<OrderFilter>('ALL');
  const [invoiceOptionsOrder, setInvoiceOptionsOrder] = useState<Order | null>(null);
  const [viewingInvoiceOrderId, setViewingInvoiceOrderId] = useState<string | null>(null);

  const handleCancelOrder = useCallback((order: Order) => {
    if (!order) return;
    const paidAmount = (order.paymentStatus === 'PAID' ? Number(order.totalAmount || 0) : 0) + Number(order.walletDeduction || 0);
    const hasKg = Number(order.subscriptionKgUsed || 0) > 0;
    
    let promptDetails = 'Are you sure you want to cancel this order?\n';
    if (paidAmount > 0) {
      promptDetails += `\n• Paid amount of ₹${paidAmount.toFixed(2)} will be refunded directly to your LaundryFresh Wallet.`;
    }
    if (hasKg) {
      promptDetails += `\n• ${order.subscriptionKgUsed} KG fabric quota will be restored to your active subscription.`;
    }
    if (paidAmount === 0 && !hasKg) {
      promptDetails += '\n• This order will be cancelled immediately.';
    }

    Alert.alert(
      'Cancel Order',
      promptDetails,
      [
        { text: 'Keep Order', style: 'cancel' },
        {
          text: 'Yes, Cancel Order',
          style: 'destructive',
          onPress: async () => {
            setCancellingOrderId(order.id);
            try {
              const res = await api.cancelOrder(order.id, {
                customerId: session?.user?.id,
                reason: 'Customer cancelled from app',
              });
              if (res && res.success) {
                if (selectedOrder?.id === order.id) {
                  setSelectedOrder((prev) => (prev ? { ...prev, currentStatus: 'CANCELLED', paymentStatus: (paidAmount > 0 ? 'REFUNDED' : prev.paymentStatus) as any } : null));
                }
                await Promise.all([
                  refreshOrders().catch(() => undefined),
                  refreshWallet().catch(() => undefined),
                ]);
                Alert.alert(
                  'Order Cancelled',
                  res.message || 'Your order has been cancelled and any paid balance credited to your wallet.'
                );
              } else {
                Alert.alert('Unable to Cancel', (res as any)?.message || 'Could not cancel this order.');
              }
            } catch (err: any) {
              Alert.alert('Cancellation Error', err?.message || 'Failed to cancel order. Please contact support.');
            } finally {
              setCancellingOrderId(null);
            }
          },
        },
      ],
      { cancelable: true }
    );
  }, [session?.user?.id, selectedOrder?.id, refreshOrders, refreshWallet]);

  const handleViewInvoice = useCallback((orderId: string) => {
    setViewingInvoiceOrderId(orderId);
  }, []);

  const handleDownloadInvoice = useCallback((orderId: string) => {
    void downloadInvoicePdf(orderId).catch(() => {
      Alert.alert('Invoice unavailable', 'Please try downloading the invoice again in a moment.');
    });
  }, []);

  const handleShareInvoice = useCallback((orderId: string) => {
    void shareInvoicePdf(orderId).catch(() => {
      Alert.alert('Share unavailable', 'Unable to share invoice right now. Please try again.');
    });
  }, []);

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
      <ScrollView
        style={[styles.root, { backgroundColor: colors.background }]}
        contentContainerStyle={[styles.guestContainer, { paddingBottom: scrollBottomClearance }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.guestIllustrationBox}>
          <MaterialCommunityIcons name="clipboard-text-clock-outline" size={56} color="#16A34A" />
        </View>

        <Text style={[styles.guestTitle, isDark && { color: colors.textHeading }]}>Track Your Orders Live</Text>
        <Text style={[styles.guestSubtitle, isDark && { color: colors.textCaption }]}>
          Sign in with your mobile number to view active pickups, live washing milestones, driver contact & digital tax invoices.
        </Text>

        <View style={[styles.guestBenefitsCard, isDark && { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.guestBenefitsHeader, isDark && { color: colors.textHeading }]}>What you get with an account:</Text>
          
          <View style={styles.guestBenefitRow}>
            <MaterialCommunityIcons name="moped" size={20} color="#16A34A" />
            <Text style={[styles.guestBenefitText, isDark && { color: colors.textBody }]}>Real-time 30-min pickup & delivery tracking</Text>
          </View>

          <View style={styles.guestBenefitRow}>
            <MaterialCommunityIcons name="washing-machine" size={20} color="#3B82F6" />
            <Text style={[styles.guestBenefitText, isDark && { color: colors.textBody }]}>5-Stage fabric care & steam spa milestones</Text>
          </View>

          <View style={styles.guestBenefitRow}>
            <MaterialCommunityIcons name="receipt" size={20} color="#0F766E" />
            <Text style={[styles.guestBenefitText, isDark && { color: colors.textBody }]}>Itemized GST invoices & secure online receipts</Text>
          </View>

          <View style={styles.guestBenefitRow}>
            <MaterialCommunityIcons name="whatsapp" size={20} color="#10B981" />
            <Text style={[styles.guestBenefitText, isDark && { color: colors.textBody }]}>Direct WhatsApp updates when laundry is ready</Text>
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
          <MaterialCommunityIcons name="calendar-plus" size={18} color={isDark ? colors.textHeading : "#1C0B18"} />
          <Text style={[styles.guestSecondaryBtnText, isDark && { color: colors.textHeading }]}>Book a New Laundry Pickup</Text>
        </Pressable>
      </ScrollView>
    );
  }

function cleanItemDisplayName(item: any): string {
  if (item?.clothName && !item.clothName.includes('null') && item.clothName !== 'null') {
    const sName = item?.serviceName && !item.serviceName.includes('null') ? item.serviceName : 'Steam Care & Press';
    const cleanServiceName = sName.replace(/^\s*\((.*)\)\s*$/, '$1').trim();
    return `${item.clothName} • ${cleanServiceName}`;
  }
  const raw = item?.serviceName || item?.name || item?.clothName || '';
  if (!raw || raw.includes('null') || raw.trim() === '(null)' || raw.trim() === 'null') {
    if (item?.pricingModel === 'PER_KG' || item?.unit === 'KG') {
      return 'Everyday Wash & Fold (Bulk)';
    }
    return item?.categoryName ? `${item.categoryName} Garment Care` : 'Premium Garment Care';
  }
  let cleaned = raw.replace(/null\s*\(null\)/gi, 'Premium Garment Care').replace(/\(null\)/gi, '').trim();
  const matchParen = cleaned.match(/^([^(]+?)\s*\((.+)\)\s*$/);
  if (matchParen) {
    const garment = matchParen[1].trim();
    const service = matchParen[2].trim();
    return `${garment} • ${service}`;
  }
  return cleaned;
}

  // --- DETAIL VIEW: Tracking Modal / Sheet ---
  if (selectedOrder) {
    const currentMilestoneIdx = milestoneIndexForStatus(selectedOrder.currentStatus);
    const assignedDriver = (selectedOrder as any)?.assignedDeliveryAgent || (selectedOrder as any)?.assignedPickupAgent || tracking?.assignedDeliveryAgent || tracking?.assignedPickupAgent || null;
    const isDeliveryStage = ['DELIVERY_ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED'].includes(selectedOrder.currentStatus);
    const resolvedDriverName = assignedDriver?.name || (selectedOrder as any)?.driverName || tracking?.driverName || null;
    const hasDriver = Boolean(resolvedDriverName);
    const driverName = resolvedDriverName || (isDeliveryStage ? 'Assigning Delivery Pilot...' : 'Assigning Pickup Pilot...');
    const driverPhone = assignedDriver?.phone || (selectedOrder as any)?.driverPhone || tracking?.driverPhone || '+91 91219 99999';
    const driverVehicle = assignedDriver?.vehicle || (isDeliveryStage ? 'Delivery Van' : 'Valet Pilot Bike');
    const driverRating = assignedDriver?.rating || '4.9';

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
      void downloadInvoicePdf(selectedOrder.id).catch(() => {
        Alert.alert('Invoice unavailable', 'Please try downloading the invoice again in a moment.');
      });
    };

    const garmentsSubtotal = selectedOrder.itemTotal || selectedOrder.items?.reduce((acc, it) => acc + (it.subtotal || 0), 0) || 0;
    const deliveryFee = selectedOrder.pickupDeliveryFee || 0;
    const expressFee = selectedOrder.expressFee || 0;
    const taxAmount = selectedOrder.taxAmount || 0;
    const discountAmount = selectedOrder.discountAmount || 0;
    const grandTotal = (selectedOrder as any).pricing?.finalTotal || selectedOrder.totalAmount || (garmentsSubtotal + deliveryFee + expressFee + taxAmount - discountAmount);

    return (
      <>
        <ScrollView
          style={[styles.root, { backgroundColor: colors.background }]}
          contentContainerStyle={[styles.content, { paddingBottom: scrollBottomClearance }]}
          showsVerticalScrollIndicator={false}
        >
        {/* Top Navigation Row */}
        <Pressable style={styles.backBtn} onPress={() => setSelectedOrder(null)}>
          <MaterialCommunityIcons name="arrow-left" size={20} color={COLORS.plumDark} />
          <Text style={styles.backBtnText}>Back to All Orders</Text>
        </Pressable>

        {/* Order Header Summary */}
        <Card style={styles.orderHeaderCard}>
          <View style={styles.orderHeaderTop}>
            <View style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
              <Text style={[styles.orderIdText, isDark && { color: colors.textHeading }]} numberOfLines={1} ellipsizeMode="middle">Order #{selectedOrder.id}</Text>
              <Text style={[styles.orderPlacedTime, isDark && { color: colors.textCaption }]}>Placed on {dateTime(selectedOrder.createdAt)}</Text>
            </View>
              <View style={[styles.statusBadge, { backgroundColor: statusTone(selectedOrder.currentStatus, colors).backgroundColor }]}>
                <Text style={[styles.statusBadgeText, { color: statusTone(selectedOrder.currentStatus, colors).color }]}>
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

          {/* Quick Header Tax Invoice Action with View and Download */}
          <View
            style={[
              styles.headerInvoiceBar,
              isDark && styles.headerInvoiceBarDark,
            ]}
          >
            <Pressable
              style={styles.headerInvoiceLeft}
              onPress={() => handleViewInvoice(selectedOrder.id)}
              accessibilityRole="button"
              accessibilityLabel="View Tax Invoice"
            >
              <View style={[styles.headerInvoiceIconCircle, isDark && styles.headerInvoiceIconCircleDark]}>
                <MaterialCommunityIcons name="file-pdf-box" size={20} color={isDark ? '#4ADE80' : '#16A34A'} />
              </View>
              <View style={styles.headerInvoiceTextCol}>
                <Text style={[styles.headerInvoiceTitle, isDark && styles.headerInvoiceTitleDark]} numberOfLines={1}>
                  Tax Invoice (GST PDF)
                </Text>
                <Text style={[styles.headerInvoiceSub, isDark && styles.headerInvoiceSubDark]} numberOfLines={1}>
                  Official itemized receipt
                </Text>
              </View>
            </Pressable>

            <View style={styles.headerInvoiceActionsGroup}>
              <Pressable
                style={({ pressed }) => [
                  styles.headerInvoiceViewBtn,
                  isDark && styles.headerInvoiceViewBtnDark,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={() => handleViewInvoice(selectedOrder.id)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="View Tax Invoice"
              >
                <MaterialCommunityIcons name="eye-outline" size={13} color={isDark ? '#86EFAC' : '#15803D'} />
                <Text style={[styles.headerInvoiceViewBtnText, isDark && styles.headerInvoiceViewBtnTextDark]}>View</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.headerInvoiceBadge,
                  isDark && styles.headerInvoiceBadgeDark,
                  pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                ]}
                onPress={() => setInvoiceOptionsOrder(selectedOrder)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Invoice download and share options"
              >
                <MaterialCommunityIcons name="download" size={13} color={isDark ? '#064E3B' : '#FFFFFF'} />
                <Text style={[styles.headerInvoiceBadgeText, isDark && styles.headerInvoiceBadgeTextDark]}>PDF</Text>
              </Pressable>
            </View>
          </View>
        </Card>

        {/* LIVE 5-STAGE MILESTONE TIMELINE */}
        <Card style={styles.milestoneCard}>
          <Text style={[styles.milestoneSectionTitle, isDark && { color: colors.textHeading }]}>Live Order Milestones</Text>

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
                        !isCurrent && !isUpcoming && isDark && { color: colors.textBody },
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
              <MaterialCommunityIcons name={isDeliveryStage ? 'truck-delivery' : 'moped'} size={24} color="#16A34A" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.driverNameRow}>
                <Text style={[styles.driverNameText, isDark && { color: colors.textHeading }]}>
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
              <Text style={[styles.driverVehicleText, isDark && { color: colors.textCaption }]}>
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
          <Text style={[styles.supportCardTitle, isDark && { color: colors.textHeading }]}>Need Quick Assistance?</Text>
          <Text style={[styles.supportCardSubtitle, isDark && { color: colors.textCaption }]}>
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
            <Text style={[styles.itemsSectionTitle, isDark && { color: colors.textHeading }]}>Garments & Services ({selectedOrder.items.length})</Text>
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
                      <MaterialCommunityIcons name="scale-bathroom" size={22} color="#16A34A" />
                    ) : (
                      <Image
                        source={{ uri: itemImageUrl }}
                        style={styles.itemThumbImage}
                        resizeMode="cover"
                      />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemName, isDark && { color: colors.textHeading }]} numberOfLines={2}>{displayName}</Text>
                    <Text style={[styles.itemDetail, isDark && { color: colors.textCaption }]}>
                      {item.quantity} {item.unit || (isBulk ? 'KG' : 'Piece')} × {money(item.unitPrice)}
                    </Text>
                  </View>
                  <Text style={[styles.itemSubtotal, isDark && { color: colors.textHeading }]}>{money(item.subtotal)}</Text>
                </View>
              );
            })}
          </Card>
        ) : null}

        {/* Itemized Bill Breakdown & Tax Invoice - ALWAYS SHOWN */}
        <Card style={styles.billCard}>
          <View style={styles.billBreakdownSection}>
            <Text style={[styles.billSectionHeader, isDark && { color: colors.textHeading }]}>Bill Breakdown</Text>

            <View style={styles.billLineItem}>
              <Text style={[styles.billLineLabel, isDark && { color: colors.textCaption }]}>Garments Subtotal</Text>
              <Text style={[styles.billLineValue, isDark && { color: colors.textHeading }]}>{money(garmentsSubtotal)}</Text>
            </View>

            <View style={styles.billLineItem}>
              <Text style={[styles.billLineLabel, isDark && { color: colors.textCaption }]}>Doorstep Pickup & Delivery</Text>
              {deliveryFee > 0 ? (
                <Text style={styles.billLineValue}>{money(deliveryFee)}</Text>
              ) : (
                <Text style={[styles.billLineValue, { color: '#16A34A', fontWeight: '800' }]}>FREE</Text>
              )}
            </View>

            {expressFee > 0 ? (
              <View style={styles.billLineItem}>
                <Text style={[styles.billLineLabel, isDark && { color: colors.textCaption }]}>Express Care Surcharge</Text>
                <Text style={[styles.billLineValue, isDark && { color: colors.textHeading }]}>+{money(expressFee)}</Text>
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
              <Text style={[styles.billLineLabel, isDark && { color: colors.textCaption }]}>GST / Taxes (5%)</Text>
              <Text style={[styles.billLineValue, isDark && { color: colors.textHeading }]}>{taxAmount > 0 ? money(taxAmount) : '₹0'}</Text>
            </View>

            <View style={styles.billGrandRow}>
              <View>
                <Text style={[styles.billGrandLabel, isDark && { color: colors.textHeading }]}>Total Amount (Inc. GST)</Text>
                <Text style={styles.billPaymentStatusSub}>
                  {selectedOrder.paymentStatus === 'PAID' ? '✓ Paid Online via Razorpay' : 'Pay on Delivery / Pending'}
                </Text>
              </View>
              <Text style={styles.billGrandValue}>{money(grandTotal)}</Text>
            </View>

            {/* Tax Invoice & Official Payment Receipt Section */}
            <View style={[styles.billInvoiceBox, isDark && styles.billInvoiceBoxDark]}>
              <Pressable
                style={styles.billInvoiceHeaderRow}
                onPress={() => handleViewInvoice(selectedOrder.id)}
                accessibilityRole="button"
                accessibilityLabel="View Tax Invoice"
              >
                <View style={[styles.billInvoiceIconBadge, isDark && styles.billInvoiceIconBadgeDark]}>
                  <MaterialCommunityIcons name="file-pdf-box" size={22} color={isDark ? '#4ADE80' : '#16A34A'} />
                </View>
                <View style={styles.billInvoiceTextWrap}>
                  <Text style={[styles.billInvoiceTitle, isDark && styles.billInvoiceTitleDark]}>
                    Tax Invoice (GST PDF)
                  </Text>
                  <Text style={[styles.billInvoiceSubtitle, isDark && styles.billInvoiceSubtitleDark]}>
                    Itemized official invoice & payment receipt
                  </Text>
                </View>
              </Pressable>

              <View style={styles.billInvoiceActionsRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.billInvoiceViewBtn,
                    isDark && styles.billInvoiceViewBtnDark,
                    pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
                  ]}
                  onPress={() => handleViewInvoice(selectedOrder.id)}
                  accessibilityRole="button"
                  accessibilityLabel="View Tax Invoice in app"
                >
                  <MaterialCommunityIcons name="eye-outline" size={15} color={isDark ? '#86EFAC' : '#15803D'} />
                  <Text style={[styles.billInvoiceViewBtnText, isDark && styles.billInvoiceViewBtnTextDark]}>
                    View Invoice
                  </Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.billInvoiceDownloadBtn,
                    isDark && styles.billInvoiceDownloadBtnDark,
                    pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                  ]}
                  onPress={() => setInvoiceOptionsOrder(selectedOrder)}
                  accessibilityRole="button"
                  accessibilityLabel="Invoice download and share options"
                >
                  <MaterialCommunityIcons name="download" size={15} color={isDark ? '#064E3B' : '#FFFFFF'} />
                  <Text style={[styles.billInvoiceDownloadBtnText, isDark && styles.billInvoiceDownloadBtnTextDark]}>
                    PDF Options
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Card>

        {/* Cancel Order Action - available before pickup */}
        {['ORDER_PLACED', 'PICKUP_ASSIGNED'].includes(selectedOrder.currentStatus) ? (
          <View style={{ marginTop: 14, marginBottom: 20, paddingHorizontal: 4 }}>
            <Pressable
              style={({ pressed }) => [
                styles.cancelOrderBtn,
                pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
                cancellingOrderId === selectedOrder.id && { opacity: 0.6 },
              ]}
              onPress={() => handleCancelOrder(selectedOrder)}
              disabled={cancellingOrderId === selectedOrder.id}
              accessibilityRole="button"
              accessibilityLabel="Cancel this order"
            >
              <MaterialCommunityIcons name="close-circle-outline" size={18} color="#DC2626" />
              <Text style={styles.cancelOrderBtnText}>
                {cancellingOrderId === selectedOrder.id ? 'Cancelling Order...' : 'Cancel Order'}
              </Text>
            </Pressable>
            <Text style={[styles.cancelOrderSubtext, isDark && { color: colors.textCaption }]}>
              Free cancellation before pickup. Any paid amount is credited to your wallet instantly.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* In-App Invoice Viewer Modal */}
      <InvoiceViewerModal
        visible={!!viewingInvoiceOrderId}
        orderId={viewingInvoiceOrderId}
        onClose={() => setViewingInvoiceOrderId(null)}
      />

      {/* Invoice Options Action Sheet Modal */}
      <InvoiceActionModal
        visible={!!invoiceOptionsOrder}
        order={invoiceOptionsOrder}
        onClose={() => setInvoiceOptionsOrder(null)}
        onView={handleViewInvoice}
        onDownload={handleDownloadInvoice}
        onShare={handleShareInvoice}
      />
      </>
    );
  }

  // --- ALL ORDERS LIST VIEW (Authenticated) ---
  return (
    <>
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingBottom: scrollBottomClearance }]}
      showsVerticalScrollIndicator={false}
      stickyHeaderIndices={[0]}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          colors={['#0F766E', '#16A34A']}
          tintColor="#0F766E"
        />
      }
    >
      {/* Sticky Top Header: Title, Subtitle, Refresh & Horizontal Filter Tabs */}
      <View style={[styles.topHeaderSection, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <View style={styles.headerTextCol}>
            <Text style={[styles.headerTitle, isDark && { color: colors.textHeading }]}>My Orders</Text>
            <Text style={[styles.headerSubtitle, isDark && { color: colors.textCaption }]} numberOfLines={1}>
              Track pickups, washes, and doorstep deliveries
            </Text>
          </View>
        </View>

        {/* Horizontal Filter Tabs (All Orders / Active Pickups / Delivered) */}
        <View style={styles.filterRow}>
          {(['ALL', 'ACTIVE', 'COMPLETED'] as OrderFilter[]).map((tab) => {
            const isSelected = filter === tab;
            return (
              <Pressable
                key={tab}
                style={[
                  styles.filterChip,
                  isDark && styles.filterChipDark,
                  isSelected && (isDark ? styles.filterChipActiveDark : styles.filterChipActive),
                ]}
                onPress={() => setFilter(tab)}
                accessibilityRole="tab"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`Show ${tab === 'ALL' ? 'all orders' : tab === 'ACTIVE' ? 'active pickups' : 'delivered orders'}`}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isDark && styles.filterChipTextDark,
                    isSelected && styles.filterChipTextActive,
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.82}
                >
                  {tab === 'ALL' ? 'All Orders' : tab === 'ACTIVE' ? 'Active Pickups' : 'Delivered'}
                </Text>
              </Pressable>
            );
          })}
        </View>
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
                  backgroundColor: colors.primary, borderRadius: 12,
                  paddingHorizontal: 16, paddingVertical: 11,
                  elevation: 3, shadowColor: colors.primary,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3, shadowRadius: 4,
                }}
                onPress={onBrowseServices}
                accessibilityRole="button"
                accessibilityLabel="Browse laundry services"
              >
                <MaterialCommunityIcons name="hanger" size={16} color="#FFFFFF" />
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>Browse Services</Text>
              </Pressable>
            )}
            <Pressable
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                backgroundColor: colors.orange, borderRadius: 12,
                paddingHorizontal: 16, paddingVertical: 11,
                elevation: 3, shadowColor: colors.orange,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3, shadowRadius: 4,
              }}
              onPress={onBook}
              accessibilityRole="button"
              accessibilityLabel="Book a laundry pickup"
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
                style={[styles.orderCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => setSelectedOrder(order)}
                accessibilityRole="button"
                accessibilityLabel={`Order ${order.id}, ${statusLabel(order.currentStatus)}, total ${money((order as any).pricing?.finalTotal || order.totalAmount)}. Open order details.`}
              >
                {/* Top Row: ID + Status Badge */}
                <View style={styles.cardTopRow}>
                  <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                    <Text style={[styles.cardOrderId, isDark && { color: colors.textHeading }]} numberOfLines={1} ellipsizeMode="middle">Order #{order.id}</Text>
                    <Text style={[styles.cardDate, isDark && { color: colors.textCaption }]}>{dateTime(order.createdAt)}</Text>
                  </View>

                  <View style={[styles.statusBadge, { backgroundColor: statusTone(order.currentStatus, colors).backgroundColor }]}>
                    <Text style={[styles.statusBadgeText, { color: statusTone(order.currentStatus, colors).color }]}>
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
                        { backgroundColor: colors.section },
                        step <= milestoneIdx && styles.progressBarSegmentActive,
                        isDelivered && styles.progressBarSegmentDelivered,
                      ]}
                    />
                  ))}
                </View>

                {/* Current Stage Highlight */}
                <View style={[styles.stageHighlightRow, { backgroundColor: colors.primarySoft, borderColor: colors.border }]}>
                  <MaterialCommunityIcons
                    name={ORDER_MILESTONES[milestoneIdx]?.icon as any || 'washing-machine'}
                    size={16}
                    color={colors.primaryLight}
                  />
                    <Text style={[styles.stageHighlightText, { color: colors.primaryLight }]} numberOfLines={1}>
                    {ORDER_MILESTONES[milestoneIdx]?.label || statusLabel(order.currentStatus)}
                  </Text>
                </View>

                {/* Bottom Row: Total & Action Chevron */}
                <View style={styles.cardBottomRow}>
                  <Text style={[styles.cardTotal, { color: colors.textCaption }]}>
                    Total: <Text style={[styles.cardTotalBold, { color: colors.textHeading }]}>{money((order as any).pricing?.finalTotal || order.totalAmount)}</Text>
                  </Text>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {['ORDER_PLACED', 'PICKUP_ASSIGNED'].includes(order.currentStatus) ? (
                      <Pressable
                        style={({ pressed }) => [styles.cardCancelBtn, pressed && { opacity: 0.8 }]}
                        onPress={(e) => {
                          e.stopPropagation?.();
                          handleCancelOrder(order);
                        }}
                        hitSlop={8}
                        accessibilityLabel={`Cancel Order #${order.id}`}
                      >
                        <MaterialCommunityIcons name="close-circle-outline" size={14} color="#DC2626" />
                        <Text style={styles.cardCancelBtnText}>Cancel</Text>
                      </Pressable>
                    ) : null}

                    <Pressable
                      style={({ pressed }) => [
                        styles.cardInvoiceBtn,
                        isDark && styles.cardInvoiceBtnDark,
                        pressed && { opacity: 0.8 },
                      ]}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        setInvoiceOptionsOrder(order);
                      }}
                      hitSlop={8}
                      accessibilityLabel={`Invoice options for Order #${order.id}`}
                    >
                      <MaterialCommunityIcons
                        name="receipt-text-outline"
                        size={15}
                        color={isDark ? '#86EFAC' : '#059669'}
                      />
                      <Text style={[styles.cardInvoiceBtnText, isDark && styles.cardInvoiceBtnTextDark]}>
                        Invoice
                      </Text>
                    </Pressable>

                    <View style={styles.viewDetailLink}>
                      <Text style={styles.viewDetailText}>Track Live Status</Text>
                      <MaterialCommunityIcons name="chevron-right" size={16} color="#16A34A" />
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>

    {/* In-App Invoice Viewer Modal */}
    <InvoiceViewerModal
      visible={!!viewingInvoiceOrderId}
      orderId={viewingInvoiceOrderId}
      onClose={() => setViewingInvoiceOrderId(null)}
    />

    {/* Invoice Options Action Sheet Modal */}
    <InvoiceActionModal
      visible={!!invoiceOptionsOrder}
      order={invoiceOptionsOrder}
      onClose={() => setInvoiceOptionsOrder(null)}
      onView={handleViewInvoice}
      onDownload={handleDownloadInvoice}
      onShare={handleShareInvoice}
    />
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8F9FE',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 0,  // No top padding - header provides spacing
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
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#DCFCE7',
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
    backgroundColor: '#16A34A',
    borderRadius: 16,
    paddingVertical: 14,
    gap: 8,
    shadowColor: '#16A34A',
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
  topHeaderSection: {
    paddingTop: 12,
    paddingBottom: 4,
    gap: 12,
    width: '100%',
    zIndex: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  headerTextCol: {
    flex: 1,
    paddingRight: 10,
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.line,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  refreshBtnDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 8,
  },
  filterChip: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E8EAF6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  filterChipDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  filterChipActive: {
    backgroundColor: '#1A1A2E',
    borderColor: '#1A1A2E',
    shadowColor: '#1A1A2E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  filterChipActiveDark: {
    backgroundColor: '#16A34A',
    borderColor: '#16A34A',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 3,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textAlign: 'center',
  },
  filterChipTextDark: {
    color: '#94A3B8',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  ordersStack: {
    gap: 12,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E8EAF6',
    shadowColor: '#3F51B5',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    gap: 16,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardOrderId: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1A1A2E',
    letterSpacing: -0.3,
  },
  cardDate: {
    fontSize: 11,
    color: '#8A7A84',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  progressBarWrapper: {
    flexDirection: 'row',
    gap: 7,
  },
  progressBarSegment: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E8EAF6',
  },
  progressBarSegmentActive: {
    backgroundColor: '#16A34A',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 2,
  },
  progressBarSegmentDelivered: {
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 2,
  },
  stageHighlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  stageHighlightText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#15803D',
    flex: 1,
    letterSpacing: -0.2,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F0F2F8',
    paddingTop: 14,
    marginTop: 2,
  },
  cardTotal: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  cardTotalBold: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1A1A2E',
    letterSpacing: -0.3,
  },
  viewDetailLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  viewDetailText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 0.2,
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
    padding: 18,
    borderRadius: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E8EAF6',
    shadowColor: '#3F51B5',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
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
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8EAF6',
    shadowColor: '#3F51B5',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
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
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  milestoneDotCompleted: {
    backgroundColor: '#10B981',
  },
  milestoneDotCurrent: {
    backgroundColor: '#16A34A',
    shadowColor: '#16A34A',
    shadowOpacity: 0.5,
  },
  milestoneDotPending: {
    backgroundColor: '#E5E7EB',
  },
  timelineConnector: {
    width: 3,
    flex: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 2,
  },
  timelineConnectorActive: {
    backgroundColor: '#10B981',
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
    color: '#16A34A',
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
    backgroundColor: '#16A34A',
  },
  livePulseText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
  },
  driverCard: {
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#DCFCE7',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
    gap: 14,
  },
  driverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  driverAvatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#86EFAC',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
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
    color: '#0F766E',
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
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    paddingVertical: 12,
    gap: 7,
    shadowColor: '#1A1A2E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  driverCallActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  driverWhatsAppActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    borderRadius: 14,
    paddingVertical: 12,
    gap: 7,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  driverWhatsAppActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  supportCard: {
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8EAF6',
    shadowColor: '#3F51B5',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
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
    backgroundColor: '#10B981',
    borderRadius: 14,
    paddingVertical: 12,
    gap: 7,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  supportBtnTextWhite: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  supportBtnCall: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F9FE',
    borderRadius: 14,
    paddingVertical: 12,
    gap: 7,
    borderWidth: 2,
    borderColor: '#E8EAF6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  supportBtnTextDark: {
    color: '#1A1A2E',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  itemsCard: {
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: '#E8EAF6',
    shadowColor: '#3F51B5',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
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
    color: '#0F766E',
  },
  billCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E8EAF6',
    marginTop: 14,
    shadowColor: '#3F51B5',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  billInvoiceBox: {
    backgroundColor: '#F0FDF4',
    borderRadius: 14,
    padding: 12,
    marginTop: 14,
    borderWidth: 1.5,
    borderColor: '#DCFCE7',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    gap: 10,
  },
  billInvoiceBoxDark: {
    backgroundColor: '#064E3B',
    borderColor: '#047857',
    shadowColor: '#000000',
  },
  billInvoiceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  billInvoiceIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  billInvoiceIconBadgeDark: {
    backgroundColor: '#14532D',
  },
  billInvoiceTextWrap: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  billInvoiceTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 0.1,
  },
  billInvoiceTitleDark: {
    color: '#F0FDF4',
  },
  billInvoiceSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#16A34A',
    marginTop: 1,
  },
  billInvoiceSubtitleDark: {
    color: '#86EFAC',
  },
  billInvoiceActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  billInvoiceViewBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'nowrap',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#16A34A',
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  billInvoiceViewBtnDark: {
    backgroundColor: '#14532D',
    borderColor: '#10B981',
  },
  billInvoiceViewBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#15803D',
  },
  billInvoiceViewBtnTextDark: {
    color: '#86EFAC',
  },
  billInvoiceDownloadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'nowrap',
    gap: 6,
    backgroundColor: '#16A34A',
    borderWidth: 1.5,
    borderColor: '#15803D',
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 10,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  billInvoiceDownloadBtnDark: {
    backgroundColor: '#10B981',
    borderColor: '#34D399',
    shadowColor: '#000000',
  },
  billInvoiceDownloadBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  billInvoiceDownloadBtnTextDark: {
    color: '#064E3B',
  },
  headerInvoiceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDF4',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 14,
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    gap: 8,
  },
  headerInvoiceBarDark: {
    backgroundColor: '#064E3B',
    borderColor: '#047857',
    shadowColor: '#000000',
  },
  headerInvoiceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  headerInvoiceIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  headerInvoiceIconCircleDark: {
    backgroundColor: '#14532D',
    borderColor: '#16A34A',
  },
  headerInvoiceTextCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  headerInvoiceTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 0.1,
  },
  headerInvoiceTitleDark: {
    color: '#F0FDF4',
  },
  headerInvoiceSub: {
    fontSize: 10.5,
    fontWeight: '500',
    color: '#16A34A',
    marginTop: 1,
  },
  headerInvoiceSubDark: {
    color: '#86EFAC',
  },
  headerInvoiceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'nowrap',
    gap: 4,
    backgroundColor: '#16A34A',
    borderWidth: 1.5,
    borderColor: '#15803D',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    flexShrink: 0,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 2,
  },
  headerInvoiceBadgeDark: {
    backgroundColor: '#10B981',
    borderColor: '#34D399',
    shadowColor: '#000000',
  },
  headerInvoiceBadgeText: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  headerInvoiceBadgeTextDark: {
    color: '#064E3B',
  },
  headerInvoiceActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  headerInvoiceViewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'nowrap',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#16A34A',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    flexShrink: 0,
  },
  headerInvoiceViewBtnDark: {
    backgroundColor: '#14532D',
    borderColor: '#10B981',
  },
  headerInvoiceViewBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#15803D',
  },
  headerInvoiceViewBtnTextDark: {
    color: '#86EFAC',
  },
  cardInvoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#6EE7B7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  cardInvoiceBtnDark: {
    backgroundColor: '#064E3B',
    borderColor: '#047857',
  },
  cardInvoiceBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#047857',
    letterSpacing: 0.2,
  },
  cardInvoiceBtnTextDark: {
    color: '#86EFAC',
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
  cancelOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 6,
  },
  cancelOrderBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#DC2626',
  },
  cancelOrderSubtext: {
    fontSize: 11,
    color: '#6F626A',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 15,
  },
  cardCancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  cardCancelBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
});
