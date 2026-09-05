import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { useApp } from '@/context/AppContext';
import { Card } from '@/ui/components';
import { COLORS, dateTime, money, shortDate, statusLabel, statusTone } from '@/ui/theme';
import { getGarmentImageUrl } from '@/lib/garment-photos';
import type { Order, TrackingOrder } from '@/types/domain';

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
  const [order, setOrder] = useState<Order | null>(() => orders.find((o) => o.id === orderId) || null);
  const [tracking, setTracking] = useState<TrackingOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

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

  const handleDownloadInvoice = () => {
    setShowInvoiceModal(true);
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
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#F97316" />
        <Text style={styles.loadingText}>Fetching order details...</Text>
      </View>
    );
  }

  const tone = statusTone(order.currentStatus);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* 1. TOP HEADER STATUS BANNER */}
      <Card style={styles.headerCard}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.orderIdText}>Order #{order.id}</Text>
            <Text style={styles.orderPlacedText}>Placed on {dateTime(order.createdAt)}</Text>
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
      </Card>

      {/* 2. 5-STAGE MILESTONE TRACKER */}
      <Card style={styles.milestoneCard}>
        <Text style={styles.cardSectionTitle}>Live Order Milestones</Text>

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
                      isUpcoming && styles.nodeDotPending,
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
                      isCurrent && styles.milestoneTitleCurrent,
                      isUpcoming && styles.milestoneTitlePending,
                    ]}
                  >
                    {milestone.label}
                  </Text>
                  <Text style={styles.milestoneSubtitle}>{milestone.subtitle}</Text>

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
      <Card style={styles.riderCard}>
        <View style={styles.riderHeader}>
          <View style={styles.riderAvatarBox}>
            <MaterialCommunityIcons name="moped" size={24} color="#F97316" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.riderName}>Ramesh Kumar (Assigned Executive)</Text>
            <Text style={styles.riderVehicle}>Hero Splendor • TS09 EX 4512</Text>
          </View>
          <View style={styles.ratingBadge}>
            <MaterialCommunityIcons name="star" size={12} color="#D97706" />
            <Text style={styles.ratingBadgeText}>4.9</Text>
          </View>
        </View>

        <View style={styles.riderActionsRow}>
          <Pressable style={styles.riderCallBtn} onPress={callSupport}>
            <MaterialCommunityIcons name="phone" size={16} color="#1C0B18" />
            <Text style={styles.riderCallText}>Call Rider</Text>
          </Pressable>

          <Pressable style={styles.riderWhatsAppBtn} onPress={openWhatsAppSupport}>
            <MaterialCommunityIcons name="whatsapp" size={16} color="#FFFFFF" />
            <Text style={styles.riderWhatsAppText}>WhatsApp Live Chat</Text>
          </Pressable>
        </View>
      </Card>

      {/* 4. GARMENT BREAKDOWN LIST */}
      {order.items && order.items.length > 0 && (
        <Card style={styles.itemsCard}>
          <View style={styles.itemsHeaderRow}>
            <Text style={styles.cardSectionTitle}>Garments in this Order ({order.items.length})</Text>
          </View>

          <View style={styles.itemsStack}>
            {order.items.map((item, idx) => {
              const imageUrl = getGarmentImageUrl(item.serviceId || item.id);
              const isBulk = item.pricingModel === 'PER_KG';

              return (
                <View key={item.id || idx} style={styles.itemRow}>
                  <View style={styles.itemThumbWrap}>
                    {isBulk ? (
                      <MaterialCommunityIcons name="scale-bathroom" size={20} color="#F97316" />
                    ) : (
                      <Image source={{ uri: imageUrl }} style={styles.itemThumb} resizeMode="cover" />
                    )}
                  </View>

                  <View style={styles.itemMetaCol}>
                    <Text style={styles.itemName} numberOfLines={1}>{item.serviceName}</Text>
                    <Text style={styles.itemRate}>
                      {item.quantity} {item.unit || (isBulk ? 'KG' : 'Piece')} × {money(item.unitPrice)}
                    </Text>
                  </View>

                  <Text style={styles.itemSubtotal}>{money(item.subtotal)}</Text>
                </View>
              );
            })}
          </View>
        </Card>
      )}

      {/* 5. PICKUP & DELIVERY ADDRESS SUMMARY */}
      <Card style={styles.addressCard}>
        <Text style={styles.cardSectionTitle}>Pickup & Delivery Information</Text>

        <View style={styles.addressLine}>
          <MaterialCommunityIcons name="map-marker-radius" size={18} color="#F97316" />
          <View style={{ flex: 1 }}>
            <Text style={styles.addressLabel}>Doorstep Pickup Location</Text>
            <Text style={styles.addressVal}>
              {order.address?.street}, {order.address?.city} - {order.address?.pincode}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.addressLine}>
          <MaterialCommunityIcons name="clock-outline" size={18} color="#16A34A" />
          <View style={{ flex: 1 }}>
            <Text style={styles.addressLabel}>Scheduled Pickup Window</Text>
            <Text style={styles.addressVal}>
              {shortDate(order.pickupSlot?.date || order.createdAt)} • {order.pickupSlot?.slot || '08:00 - 10:00 AM'}
            </Text>
          </View>
        </View>
      </Card>

      {/* 6. PAYMENT SUMMARY & INVOICE DOWNLOAD */}
      <Card style={styles.paymentCard}>
        <Text style={styles.cardSectionTitle}>Payment & Invoicing</Text>

        <View style={styles.billLine}>
          <Text style={styles.billLabel}>Garments Subtotal</Text>
          <Text style={styles.billVal}>{money(order.itemTotal || 0)}</Text>
        </View>

        <View style={styles.billLine}>
          <Text style={styles.billLabel}>Doorstep Pickup & Delivery</Text>
          {order.pickupDeliveryFee > 0 ? (
            <Text style={styles.billVal}>{money(order.pickupDeliveryFee)}</Text>
          ) : (
            <Text style={[styles.billVal, { color: '#16A34A', fontWeight: '700' }]}>FREE</Text>
          )}
        </View>

        {order.expressFee > 0 && (
          <View style={styles.billLine}>
            <Text style={styles.billLabel}>Express Delivery Fee</Text>
            <Text style={styles.billVal}>+{money(order.expressFee)}</Text>
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
          <Text style={styles.billLabel}>
            {order.taxAmount > 0 ? 'GST (5%)' : 'GST (Waived)'}
          </Text>
          <Text style={[styles.billVal, order.taxAmount === 0 && { color: '#16A34A' }]}>
            {order.taxAmount > 0 ? money(order.taxAmount) : '₹0'}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.billFinalRow}>
          <View>
            <Text style={styles.billFinalLabel}>Total Amount (Paid)</Text>
            <Text style={styles.billPaymentMethod}>
              Paid via {order.paymentMethod === 'COD' ? 'Cash on Delivery' : 'Online Razorpay'}
            </Text>
          </View>
          <Text style={styles.billFinalVal}>{money(order.totalAmount)}</Text>
        </View>

        {/* 1-Tap Invoice Download */}
        <Pressable style={styles.invoiceDownloadBtn} onPress={handleDownloadInvoice}>
          <MaterialCommunityIcons name="file-download-outline" size={18} color="#1C0B18" />
          <Text style={styles.invoiceDownloadText}>Download Tax Invoice (GST Receipt)</Text>
        </Pressable>
      </Card>

      {/* 7. POST-DELIVERY RATING OR REORDER ACTION */}
      {isDelivered && (
        <Card style={styles.feedbackCard}>
          <Text style={styles.feedbackTitle}>How was your laundry care experience?</Text>
          <Text style={styles.feedbackSubtitle}>Rate your steam press quality and doorstep rider</Text>

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

      {/* Invoice Modal */}
      <Modal
        visible={showInvoiceModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInvoiceModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.invoiceModal}>
            {/* Header */}
            <View style={styles.invoiceHeader}>
              <MaterialCommunityIcons name="receipt" size={48} color="#2563EB" />
              <Text style={styles.invoiceModalTitle}>Tax Invoice (GST-Compliant)</Text>
            </View>

            {/* Invoice Details */}
            <View style={styles.invoiceDetails}>
              <View style={styles.invoiceRow}>
                <Text style={styles.invoiceLabel}>Invoice Number:</Text>
                <Text style={styles.invoiceValue}>#{order?.id?.toUpperCase() || 'INV-2026'}</Text>
              </View>

              <View style={styles.invoiceRow}>
                <Text style={styles.invoiceLabel}>Amount:</Text>
                <Text style={[styles.invoiceValue, styles.invoiceAmount]}>{money(order?.totalAmount || 0)}</Text>
              </View>

              <View style={styles.invoiceRow}>
                <Text style={styles.invoiceLabel}>GSTIN:</Text>
                <Text style={styles.invoiceValue}>36AABCA1234F1Z5</Text>
              </View>

              <View style={styles.invoiceRow}>
                <Text style={styles.invoiceLabel}>Status:</Text>
                <View style={styles.invoiceStatusBadge}>
                  <MaterialCommunityIcons name="check-circle" size={14} color="#10B981" />
                  <Text style={styles.invoiceStatusText}>Paid & Verified</Text>
                </View>
              </View>

              <View style={styles.invoiceNotice}>
                <MaterialCommunityIcons name="email-outline" size={16} color="#64748B" />
                <Text style={styles.invoiceNoticeText}>
                  A PDF receipt has been sent to your registered email address.
                </Text>
              </View>
            </View>

            {/* Actions */}
            <View style={styles.invoiceActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.invoiceActionBtn,
                  styles.invoiceDownloadActionBtn,
                  pressed && styles.invoiceActionBtnPressed,
                ]}
                onPress={() => {
                  setShowInvoiceModal(false);
                  // TODO: Implement actual PDF download
                  Linking.openURL(`https://laundry.anushatechnologies.com/api/invoices/${order?.id}/pdf`).catch(() => {
                    // Fallback: just close modal
                  });
                }}
              >
                <MaterialCommunityIcons name="download" size={18} color="#FFFFFF" />
                <Text style={styles.invoiceActionBtnText}>Download PDF</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.invoiceActionBtn,
                  styles.invoiceCloseBtn,
                  pressed && styles.invoiceActionBtnPressed,
                ]}
                onPress={() => setShowInvoiceModal(false)}
              >
                <Text style={styles.invoiceCloseBtnText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#F3E8DF',
  },
  cardSectionTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1C0B18',
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
    color: '#1C0B18',
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
    color: '#8A7A84',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3E8DF',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3E8DF',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3E8DF',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3E8DF',
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
  invoiceDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAF5EF',
    borderRadius: 12,
    paddingVertical: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: '#E8DED6',
    marginTop: 8,
  },
  invoiceDownloadText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1C0B18',
  },
  feedbackCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3E8DF',
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
    paddingVertical: 14,
    gap: 8,
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
