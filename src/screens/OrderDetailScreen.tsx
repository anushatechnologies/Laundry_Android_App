import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useApp } from '@/context/AppContext';
import { useTheme } from '@/context/ThemeContext';
import { Card } from '@/ui/components';
import { COLORS, dateTime, money, shortDate, statusLabel, statusTone } from '@/ui/theme';
import { getGarmentImageUrl } from '@/lib/garment-photos';
import { downloadInvoicePdf, shareInvoicePdf } from '@/lib/invoice';
import { InvoiceViewerModal, InvoiceActionModal } from '@/components/InvoiceViewerModal';
import type { Order, TrackingOrder } from '@/types/domain';

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

interface OrderDetailScreenProps {
  orderId: string;
  onBack: () => void;
  onBook: () => void;
  onHelp?: () => void;
}

const ORDER_MILESTONES = [
  {
    key: 'ORDER_PLACED',
    label: 'Order Confirmed',
    subtitle: 'Slot reserved with digital weighing scales',
    icon: 'check-circle',
    statuses: ['ORDER_PLACED'],
  },
  {
    key: 'PICKUP_ASSIGNED',
    label: 'Rider En Route for Pickup',
    subtitle: 'Executive collecting and tagging garments',
    icon: 'moped',
    statuses: ['PICKUP_ASSIGNED', 'PICKED_UP', 'RECEIVED_AT_FACILITY', 'WEIGHED_VERIFIED'],
  },
  {
    key: 'WASHING_AND_IRONING',
    label: 'In Fabric Spa & Steam Care',
    subtitle: 'Ultrasonic stain lift, organic wash & 3D pressing',
    icon: 'washing-machine',
    statuses: ['WASHING', 'DRYING', 'IRONING', 'QUALITY_CHECK', 'PACKED'],
  },
  {
    key: 'OUT_FOR_DELIVERY',
    label: 'Out for Doorstep Delivery',
    subtitle: 'Fresh clothes dispatched in breathable dust bags',
    icon: 'truck-delivery',
    statuses: ['DELIVERY_ASSIGNED', 'OUT_FOR_DELIVERY'],
  },
  {
    key: 'DELIVERED',
    label: 'Delivered Fresh & Crisp',
    subtitle: 'Enjoy your revitalized designer clothes',
    icon: 'home-heart',
    statuses: ['DELIVERED', 'COMPLETED'],
  },
];

function milestoneIndexForStatus(status: string): number {
  for (let i = ORDER_MILESTONES.length - 1; i >= 0; i--) {
    const milestone = ORDER_MILESTONES[i];
    if (milestone && milestone.statuses.includes(status)) return i;
  }
  return 0;
}

export function OrderDetailScreen({
  orderId,
  onBack,
  onBook,
  onHelp,
}: OrderDetailScreenProps) {
  const { orders, trackOrder, addCartItem } = useApp();
  const { colors, isDark } = useTheme();
  const [order, setOrder] = useState<Order | null>(() => orders.find((o) => o.id === orderId) || null);
  const [tracking, setTracking] = useState<TrackingOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [invoiceOptionsOrder, setInvoiceOptionsOrder] = useState<Order | null>(null);
  const [viewingInvoiceOrderId, setViewingInvoiceOrderId] = useState<string | null>(null);

  const handleViewInvoice = useCallback((id: string) => {
    setViewingInvoiceOrderId(id);
  }, []);

  const handleDownloadInvoice = useCallback((id: string) => {
    void downloadInvoicePdf(id).catch(() => {
      Alert.alert('Invoice unavailable', 'Please try downloading the invoice again in a moment.');
    });
  }, []);

  const handleShareInvoice = useCallback((id: string) => {
    void shareInvoicePdf(id).catch(() => {
      Alert.alert('Share unavailable', 'Unable to share invoice right now. Please try again.');
    });
  }, []);

  useEffect(() => {
    let active = true;
    const found = orders.find((o) => o.id === orderId);
    if (found) setOrder(found);

    setLoading(true);
    trackOrder(orderId)
      .then((res) => {
        if (!active) return;
        setTracking(res);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [orderId, orders, trackOrder]);

  const currentMilestoneIdx = order ? milestoneIndexForStatus(order.currentStatus) : 0;
  const isDelivered = order ? ['DELIVERED', 'COMPLETED'].includes(order.currentStatus) : false;

  const handleReorder = () => {
    if (!order?.items || order.items.length === 0) {
      onBook();
      return;
    }

    order.items.forEach((item) => {
      addCartItem({
        id: `reorder-${item.id || item.serviceId}-${Date.now()}`,
        serviceId: item.serviceId || item.id,
        serviceName: item.serviceName,
        categoryName: 'Reorder',
        pricingModel: item.pricingModel || 'PER_ITEM',
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        unit: item.unit || 'Piece',
        subtotal: item.subtotal,
      });
    });

    Alert.alert('Items Added to Bag! 🎉', 'All garments from this order have been added to your laundry bag.', [
      { text: 'View Bag & Checkout', onPress: onBook },
    ]);
  };

  const openWhatsAppSupport = () => {
    const message = `Hi LaundryFresh Support, I need assistance with Order #${orderId}`;
    void Linking.openURL(`whatsapp://send?phone=+919121999999&text=${encodeURIComponent(message)}`);
  };

  const callSupport = () => {
    void Linking.openURL('tel:+919121999999');
  };

  if (!order) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#F97316" />
        <Text style={[styles.loadingText, { color: colors.textCaption }]}>Fetching order details...</Text>
      </View>
    );
  }

  const tone = statusTone(order.currentStatus, colors);

  return (
    <ScrollView style={[styles.root, { backgroundColor: colors.background }]} contentContainerStyle={[styles.content, { paddingBottom: 180 }]} showsVerticalScrollIndicator={false}>
      {/* 1. TOP HEADER STATUS BANNER */}
      <Card style={styles.headerCard}>
        <View style={styles.headerTopRow}>
          <View style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
            <Text style={styles.orderIdText} numberOfLines={1} ellipsizeMode="middle">Order #{order.id}</Text>
            <Text style={[styles.orderPlacedText, { color: colors.textCaption }]}>Placed on {dateTime(order.createdAt)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: tone.backgroundColor }]}>
            <Text style={[styles.statusBadgeText, { color: tone.color }]}>
              {statusLabel(order.currentStatus)}
            </Text>
          </View>
        </View>

        {(order as any).assignedHub ? (
          <View style={styles.hubStrip}>
            <MaterialCommunityIcons name="office-building-marker" size={16} color="#D6B36A" />
            <Text style={styles.hubStripText}>
              Processing Facility: <Text style={styles.hubStripBold}>{(order as any).assignedHub.name}</Text>
            </Text>
          </View>
        ) : null}

        {/* Prominent Header Tax Invoice Action with View and Download */}
        <View
          style={[
            styles.headerInvoiceBar,
            isDark && styles.headerInvoiceBarDark,
          ]}
        >
          <Pressable
            style={styles.headerInvoiceLeft}
            onPress={() => handleViewInvoice(order.id)}
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
                Itemized official receipt & breakdown
              </Text>
            </View>
          </Pressable>

          <View style={styles.headerInvoiceActionsGroup}>
            <Pressable
              style={({ pressed }) => [
                styles.headerInvoiceViewBtn,
                {
                  backgroundColor: isDark ? '#064E3B' : '#FFFFFF',
                  borderColor: isDark ? '#10B981' : '#059669',
                },
                pressed && { opacity: 0.8 },
              ]}
              onPress={() => handleViewInvoice(order.id)}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="View Tax Invoice"
            >
              <MaterialCommunityIcons name="eye-outline" size={13} color={isDark ? '#86EFAC' : '#059669'} />
              <Text style={[styles.headerInvoiceViewBtnText, { color: isDark ? '#86EFAC' : '#059669' }]}>View</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.headerInvoiceBadge,
                {
                  backgroundColor: isDark ? '#10B981' : '#059669',
                },
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              ]}
              onPress={() => setInvoiceOptionsOrder(order)}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Invoice download and share options"
            >
              <MaterialCommunityIcons name="download" size={13} color="#FFFFFF" />
              <Text style={[styles.headerInvoiceBadgeText, { color: '#FFFFFF' }]}>PDF</Text>
            </Pressable>
          </View>
        </View>
      </Card>

      {/* 2. 5-STAGE MILESTONE TRACKER */}
      <Card style={[styles.milestoneCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardSectionTitle, { color: colors.textHeading }]}>Live Order Milestones</Text>

        <View style={styles.timelineList}>
          {ORDER_MILESTONES.map((milestone, idx) => {
            const isPast = idx < currentMilestoneIdx;
            const isCurrent = idx === currentMilestoneIdx;
            const isUpcoming = idx > currentMilestoneIdx;

            return (
              <View key={milestone.key} style={styles.milestoneRow}>
                {/* Node & Connector */}
                <View style={styles.nodeCol}>
                  <View
                    style={[
                      styles.nodeDot,
                      isPast && styles.nodeDotDone,
                      isCurrent && styles.nodeDotCurrent,
                      isUpcoming && (isDark ? { backgroundColor: colors.border } : styles.nodeDotPending),
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={milestone.icon as any}
                      size={15}
                      color={isUpcoming ? '#9CA3AF' : '#FFFFFF'}
                    />
                  </View>

                  {idx < ORDER_MILESTONES.length - 1 && (
                    <View
                      style={[
                        styles.nodeLine,
                        isDark && { backgroundColor: colors.border },
                        idx < currentMilestoneIdx && styles.nodeLineActive,
                      ]}
                    />
                  )}
                </View>

                {/* Details */}
                <View style={styles.milestoneDetails}>
                  <Text
                    style={[
                      styles.milestoneTitle,
                      { color: isUpcoming ? colors.textCaption : colors.textHeading },
                      isCurrent && styles.milestoneTitleCurrent,
                      isUpcoming && styles.milestoneTitlePending,
                    ]}
                  >
                    {milestone.label}
                  </Text>
                  <Text style={[styles.milestoneSubtitle, { color: colors.textCaption }]}>{milestone.subtitle}</Text>

                  {isCurrent ? (
                    <View style={styles.livePulse}>
                      <View style={styles.livePulseDot} />
                      <Text style={styles.livePulseText}>In Progress Right Now</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      </Card>

      {/* 3. ASSIGNED RIDER & SUPPORT CARD */}
      {(() => {
        const assignedDriver = (order as any).assignedDeliveryAgent || (order as any).assignedPickupAgent || tracking?.assignedDeliveryAgent || tracking?.assignedPickupAgent;
        const isDelivery = ['DELIVERY_ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED'].includes(order.currentStatus);
        const hasAssignedDriver = Boolean(assignedDriver && assignedDriver.name);

        if (!hasAssignedDriver) {
          return (
            <Card style={[styles.riderCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.riderHeader}>
                <View style={[styles.riderAvatarBox, { backgroundColor: '#FEF3C7' }]}>
                  <MaterialCommunityIcons name={isDelivery ? 'truck-delivery-outline' : 'moped-outline'} size={24} color="#D97706" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.riderName}>{isDelivery ? 'Assigning Delivery Pilot...' : 'Assigning Pickup Pilot...'}</Text>
                  <Text style={styles.riderVehicle}>
                    {isDelivery ? 'Dispatched from central facility soon' : 'Operations hub will allocate your valet pilot'}
                  </Text>
                </View>
                <View style={[styles.ratingBadge, { backgroundColor: '#FEF3C7' }]}>
                  <Text style={[styles.ratingBadgeText, { color: '#B45309', fontWeight: '700', fontSize: 10 }]}>PENDING</Text>
                </View>
              </View>
              <View style={{ marginTop: 8, paddingHorizontal: 4 }}>
                <Text style={{ fontSize: 12, color: colors.textBody, lineHeight: 17 }}>
                  Our operations team is allocating the nearest partner for your {isDelivery ? 'doorstep delivery' : 'pickup slot'}. Real pilot details and live contact buttons will appear here once assigned in Admin Panel.
                </Text>
              </View>
            </Card>
          );
        }

        const riderName = assignedDriver.name;
        const riderPhone = assignedDriver.phone || '+91 91219 99999';
        const riderVehicle = (assignedDriver as any).vehicle || (isDelivery ? 'Delivery Van' : 'Valet Pilot Bike');
        const riderRating = (assignedDriver as any).rating || 4.9;

        const callRider = () => {
          void Linking.openURL(`tel:${riderPhone.replace(/\s+/g, '')}`);
        };

        const whatsAppRider = () => {
          const cleanNum = riderPhone.replace(/\D/g, '');
          const phoneWithCountry = cleanNum.length === 10 ? `91${cleanNum}` : cleanNum;
          const msg = `Hi ${riderName}, regarding Order #${order.id}: `;
          void Linking.openURL(`whatsapp://send?phone=${phoneWithCountry}&text=${encodeURIComponent(msg)}`);
        };

        return (
          <Card style={[styles.riderCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.riderHeader}>
              <View style={[styles.riderAvatarBox, { backgroundColor: colors.section }]}>
                <MaterialCommunityIcons name={isDelivery ? 'truck-delivery' : 'moped'} size={24} color="#F97316" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.riderName, { color: colors.textHeading }]}>{riderName}</Text>
                <Text style={[styles.riderVehicle, { color: colors.textCaption }]}>{riderVehicle}</Text>
              </View>
              <View style={styles.ratingBadge}>
                <MaterialCommunityIcons name="star" size={12} color="#D97706" />
                <Text style={styles.ratingBadgeText}>{riderRating}</Text>
              </View>
            </View>

            <View style={styles.riderActionsRow}>
              <Pressable style={[styles.riderCallBtn, { backgroundColor: colors.section, borderColor: colors.border }]} onPress={callRider}>
                <MaterialCommunityIcons name="phone" size={16} color={colors.textHeading} />
                <Text style={[styles.riderCallText, { color: colors.textHeading }]}>Call Pilot</Text>
              </Pressable>

              <Pressable style={styles.riderWhatsAppBtn} onPress={whatsAppRider}>
                <MaterialCommunityIcons name="whatsapp" size={16} color="#FFFFFF" />
                <Text style={styles.riderWhatsAppText}>WhatsApp Chat</Text>
              </Pressable>
            </View>
          </Card>
        );
      })()}

      {/* 4. GARMENT BREAKDOWN LIST */}
      {order.items && order.items.length > 0 && (
        <Card style={[styles.itemsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.itemsHeaderRow}>
            <Text style={[styles.cardSectionTitle, { color: colors.textHeading }]}>Garments in this Order ({order.items.length})</Text>
          </View>

          <View style={styles.itemsStack}>
            {order.items.map((item, idx) => {
              const displayName = cleanItemDisplayName(item);
              const isBulk = item.pricingModel === 'PER_KG';
              const imageUrl = (item as any).imageUrl || getGarmentImageUrl(
                item.clothId || item.id,
                (item as any).imageUrl,
                item.categoryName,
                displayName
              );

              return (
                <View key={item.id || idx} style={[styles.itemRow, { borderBottomColor: colors.border }]}>
                  <View style={[styles.itemThumbWrap, { backgroundColor: colors.section }]}>
                    {isBulk ? (
                      <MaterialCommunityIcons name="scale-bathroom" size={20} color="#F97316" />
                    ) : (
                      <Image source={{ uri: imageUrl }} style={styles.itemThumb} resizeMode="cover" />
                    )}
                  </View>

                  <View style={styles.itemMetaCol}>
                    <Text style={[styles.itemName, { color: colors.textHeading }]} numberOfLines={2}>{displayName}</Text>
                    <Text style={[styles.itemRate, { color: colors.textCaption }]}>
                      {item.quantity} {item.unit || (isBulk ? 'KG' : 'Piece')} × {money(item.unitPrice)}
                    </Text>
                  </View>

                  <Text style={[styles.itemSubtotal, { color: colors.textHeading }]}>{money(item.subtotal)}</Text>
                </View>
              );
            })}
          </View>
        </Card>
      )}

      {/* 5. PICKUP & DELIVERY ADDRESS SUMMARY */}
      <Card style={[styles.addressCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardSectionTitle, { color: colors.textHeading }]}>Pickup & Delivery Information</Text>

        <View style={styles.addressLine}>
          <MaterialCommunityIcons name="map-marker-radius" size={18} color="#F97316" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.addressLabel, { color: colors.textCaption }]}>Doorstep Pickup Location</Text>
            <Text style={[styles.addressVal, { color: colors.textHeading }]}>
              {order.address?.street}, {order.address?.city} - {order.address?.pincode}
            </Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.addressLine}>
          <MaterialCommunityIcons name="clock-outline" size={18} color="#16A34A" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.addressLabel, { color: colors.textCaption }]}>Scheduled Pickup Window</Text>
            <Text style={[styles.addressVal, { color: colors.textHeading }]}>
              {shortDate(order.pickupSlot?.date || order.createdAt)} • {order.pickupSlot?.slot || '08:00 - 10:00 AM'}
            </Text>
          </View>
        </View>
      </Card>

      {/* 6. ORDER BILL SUMMARY */}
      <Card style={[styles.billCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardSectionTitle, { color: colors.textHeading }]}>Order Bill Summary</Text>

        <View style={styles.billLine}>
          <Text style={[styles.billLabel, { color: colors.textCaption }]}>Garments Subtotal</Text>
          <Text style={[styles.billVal, { color: colors.textHeading }]}>{money(order.itemTotal || 0)}</Text>
        </View>

        <View style={styles.billLine}>
          <Text style={[styles.billLabel, { color: colors.textCaption }]}>Doorstep Pickup & Delivery</Text>
          {order.pickupDeliveryFee > 0 ? (
            <Text style={[styles.billVal, { color: colors.textHeading }]}>{money(order.pickupDeliveryFee)}</Text>
          ) : (
            <Text style={[styles.billVal, { color: '#16A34A', fontWeight: '700' }]}>FREE</Text>
          )}
        </View>

        {order.expressFee > 0 && (
          <View style={styles.billLine}>
            <Text style={[styles.billLabel, { color: colors.textCaption }]}>Express Delivery Fee</Text>
            <Text style={[styles.billVal, { color: colors.textHeading }]}>+{money(order.expressFee)}</Text>
          </View>
        )}

        {order.discountAmount > 0 && (
          <View style={styles.billLine}>
            <Text style={[styles.billLabel, { color: '#16A34A' }]}>
              Coupon Discount {order.couponCode ? `(${order.couponCode})` : ''}
            </Text>
            <Text style={[styles.billVal, { color: '#16A34A', fontWeight: '700' }]}>
              -{money(order.discountAmount)}
            </Text>
          </View>
        )}

        <View style={styles.billLine}>
          <Text style={[styles.billLabel, { color: colors.textCaption }]}>
            {order.taxAmount > 0 ? 'GST (5%)' : 'GST (Waived)'}
          </Text>
          <Text style={[styles.billVal, { color: colors.textHeading }, order.taxAmount === 0 && { color: '#16A34A' }]}>
            {order.taxAmount > 0 ? money(order.taxAmount) : '₹0'}
          </Text>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.billFinalRow}>
          <View>
            <Text style={[styles.billFinalLabel, { color: colors.textHeading }]}>Total Amount (Paid)</Text>
            <Text style={[styles.billPaymentMethod, { color: colors.textCaption }]}>
              Paid via {order.paymentMethod === 'COD' ? 'Cash on Delivery' : 'Online Razorpay'}
            </Text>
          </View>
          <Text style={styles.billFinalVal}>{money(order.totalAmount)}</Text>
        </View>

        {/* Tax Invoice & Official Payment Receipt Section */}
        <View style={[styles.billInvoiceBox, isDark && styles.billInvoiceBoxDark]}>
          <Pressable
            style={styles.billInvoiceHeaderRow}
            onPress={() => handleViewInvoice(order.id)}
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
                {
                  backgroundColor: isDark ? '#064E3B' : '#FFFFFF',
                  borderColor: isDark ? '#10B981' : '#059669',
                },
                pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
              ]}
              onPress={() => handleViewInvoice(order.id)}
              accessibilityRole="button"
              accessibilityLabel="View Tax Invoice in app"
            >
              <MaterialCommunityIcons name="eye-outline" size={15} color={isDark ? '#86EFAC' : '#059669'} />
              <Text style={[styles.billInvoiceViewBtnText, { color: isDark ? '#86EFAC' : '#059669' }]}>
                View Invoice
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.billInvoiceDownloadBtn,
                {
                  backgroundColor: isDark ? '#10B981' : '#059669',
                },
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              ]}
              onPress={() => setInvoiceOptionsOrder(order)}
              accessibilityRole="button"
              accessibilityLabel="Invoice download and share options"
            >
              <MaterialCommunityIcons name="download" size={15} color="#FFFFFF" />
              <Text style={[styles.billInvoiceDownloadBtnText, { color: '#FFFFFF' }]}>PDF Options</Text>
            </Pressable>
          </View>
        </View>
      </Card>

      {/* 7. POST-DELIVERY RATING OR REORDER ACTION */}
      {isDelivered && (
        <Card style={[styles.feedbackCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.feedbackTitle, { color: colors.textHeading }]}>How was your laundry care experience?</Text>
          <Text style={[styles.feedbackSubtitle, { color: colors.textCaption }]}>Rate your steam press quality and doorstep rider</Text>

          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable
                key={star}
                onPress={() => {
                  setRating(star);
                  Alert.alert('Thank you! ⭐', `You rated ${star} stars. Your feedback helps us maintain 5-star quality.`);
                }}
                hitSlop={8}
              >
                <MaterialCommunityIcons
                  name={rating && rating >= star ? 'star' : 'star-outline'}
                  size={32}
                  color="#F59E0B"
                />
              </Pressable>
            ))}
          </View>
        </Card>
      )}

      {/* 8. REORDER BUTTON */}
      <Pressable style={styles.reorderBtn} onPress={handleReorder}>
        <MaterialCommunityIcons name="repeat" size={18} color="#FFFFFF" />
        <Text style={styles.reorderBtnText}>Reorder this Bag (1-Tap)</Text>
      </Pressable>

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FCF9F7',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 0,  // No top padding - header provides spacing
    paddingBottom: 40,
    gap: 14,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FCF9F7',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#8A7A84',
    fontWeight: '700',
  },
  headerCard: {
    backgroundColor: '#1C0B18',
    borderRadius: 20,
    padding: 18,
    gap: 12,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderIdText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  orderPlacedText: {
    fontSize: 12,
    color: '#D6B36A',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  hubStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  hubStripText: {
    fontSize: 12,
    color: '#FFFFFF',
  },
  hubStripBold: {
    fontWeight: '900',
    color: '#4ADE80',
  },
  milestoneCard: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
  },
  cardSectionTitle: {
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 14,
  },
  timelineList: {
    paddingLeft: 4,
  },
  milestoneRow: {
    flexDirection: 'row',
    minHeight: 56,
  },
  nodeCol: {
    alignItems: 'center',
    width: 32,
  },
  nodeDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  nodeDotDone: {
    backgroundColor: '#16A34A',
  },
  nodeDotCurrent: {
    backgroundColor: '#F97316',
  },
  nodeDotPending: {
    backgroundColor: '#E5E7EB',
  },
  nodeLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 2,
  },
  nodeLineActive: {
    backgroundColor: '#16A34A',
  },
  milestoneDetails: {
    flex: 1,
    marginLeft: 12,
    paddingBottom: 16,
    justifyContent: 'center',
  },
  milestoneTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  milestoneTitleCurrent: {
    color: '#F97316',
    fontWeight: '900',
  },
  milestoneTitlePending: {
    color: '#9CA3AF',
  },
  milestoneSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  livePulse: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F97316',
  },
  livePulseText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F97316',
  },
  riderCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    gap: 14,
  },
  riderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  riderAvatarBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  riderName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1C0B18',
  },
  riderVehicle: {
    fontSize: 11,
    color: '#8A7A84',
    marginTop: 2,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 2,
  },
  ratingBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D97706',
  },
  riderActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  riderCallBtn: {
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
  riderCallText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1C0B18',
  },
  riderWhatsAppBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16A34A',
    borderRadius: 12,
    paddingVertical: 10,
    gap: 6,
  },
  riderWhatsAppText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  itemsCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
  },
  itemsHeaderRow: {
    marginBottom: 10,
  },
  itemsStack: {
    gap: 10,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F7F2EE',
  },
  itemThumbWrap: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#FAF5EF',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemThumb: {
    width: '100%',
    height: '100%',
  },
  itemMetaCol: {
    flex: 1,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1C0B18',
  },
  itemRate: {
    fontSize: 11,
    color: '#8A7A84',
    marginTop: 1,
  },
  itemSubtotal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1C0B18',
  },
  addressCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    gap: 10,
  },
  addressLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  addressLabel: {
    fontSize: 11,
    color: '#8A7A84',
  },
  addressVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1C0B18',
    marginTop: 2,
    lineHeight: 17,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3E8DF',
    marginVertical: 4,
  },
  paymentCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    gap: 8,
  },
  billCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    gap: 8,
  },
  billLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  billLabel: {
    fontSize: 12,
    color: '#8A7A84',
  },
  billVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1C0B18',
  },
  billFinalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  billFinalLabel: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1C0B18',
  },
  billPaymentMethod: {
    fontSize: 11,
    color: '#8A7A84',
  },
  billFinalVal: {
    fontSize: 17,
    fontWeight: '900',
    color: '#F97316',
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
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    paddingVertical: 9,
    borderRadius: 10,
  },
  billInvoiceViewBtnDark: {
    backgroundColor: '#14532D',
    borderColor: '#15803D',
  },
  billInvoiceViewBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#15803D',
  },
  billInvoiceDownloadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#16A34A',
    paddingVertical: 9,
    borderRadius: 10,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  billInvoiceDownloadBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.2,
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
    borderColor: '#DCFCE7',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    gap: 10,
  },
  headerInvoiceBarDark: {
    backgroundColor: '#064E3B',
    borderColor: '#047857',
    shadowColor: '#000000',
  },
  headerInvoiceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  },
  headerInvoiceIconCircleDark: {
    backgroundColor: '#14532D',
  },
  headerInvoiceTextCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  headerInvoiceTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 0.1,
  },
  headerInvoiceTitleDark: {
    color: '#F0FDF4',
  },
  headerInvoiceSub: {
    fontSize: 11,
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
    gap: 4,
    backgroundColor: '#16A34A',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    flexShrink: 0,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
  headerInvoiceBadgeText: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
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
    gap: 3,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    flexShrink: 0,
  },
  headerInvoiceViewBtnDark: {
    backgroundColor: '#14532D',
    borderColor: '#15803D',
  },
  headerInvoiceViewBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#15803D',
  },
  feedbackCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    alignItems: 'center',
    gap: 4,
  },
  feedbackTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1C0B18',
    textAlign: 'center',
  },
  feedbackSubtitle: {
    fontSize: 11,
    color: '#8A7A84',
    textAlign: 'center',
    marginBottom: 8,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  reorderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F97316',
    borderRadius: 16,
    paddingVertical: 16,
    gap: 8,
    marginBottom: 100,
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  reorderBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  invoiceModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  invoiceHeader: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  invoiceModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 8,
  },
  invoiceDetails: {
    padding: 20,
  },
  invoiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  invoiceLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  invoiceValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  invoiceAmount: {
    fontSize: 16,
    color: '#F97316',
  },
  invoiceStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  invoiceStatusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
  },
  invoiceNotice: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  invoiceNoticeText: {
    flex: 1,
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },
  invoiceActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  invoiceActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  invoiceDownloadActionBtn: {
    backgroundColor: '#2563EB',
  },
  invoiceCloseBtn: {
    backgroundColor: '#F1F5F9',
  },
  invoiceActionBtnPressed: {
    opacity: 0.7,
  },
  invoiceActionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  invoiceCloseBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
});
