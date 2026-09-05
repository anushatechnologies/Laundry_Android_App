import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import { api } from '@/lib/api';
import { RazorpayModal } from '@/components/RazorpayModal';
import { getCurrentCustomerLocation } from '@/services/location/locationService';
import { AppButton, AppInput, Card, Chip, EmptyState, SectionTitle } from '@/ui/components';
import { COLORS, localDateString, money, shortDate } from '@/ui/theme';
import { getGarmentImageUrl } from '@/lib/garment-photos';
import type { Coupon, CustomerAddress, ExpressTier, PaymentMethod, PickupSlot, PricingSettings, RazorpayPaymentOrder } from '@/types/domain';
import type { RazorpayResult } from '@/lib/payments';
import type { CustomerLocation } from '@/services/location/types';

type BookingStage = 'BAG' | 'DETAILS' | 'REVIEW' | 'SUCCESS';
type AddressDraft = Omit<CustomerAddress, 'id'>;

function newAddressDraft(name: string, phone: string): AddressDraft {
  return {
    type: 'Home',
    contactName: name,
    contactPhone: phone,
    street: '',
    landmark: '',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '',
    isDefault: true,
  };
}

interface BookScreenProps {
  onViewOrders: () => void;
  initialCouponCode?: string;
  deliveryLocation?: CustomerLocation | null;
  onRequireSignIn: () => void;
  onBrowseServices: () => void;
  resumeCheckout?: boolean;
  onCheckoutResumed?: () => void;
}

const QUICK_COUPONS = [
  { code: 'FIRST50', label: '50% OFF (First Order)', discount: '50%' },
  { code: 'SILKSPA', label: '₹150 OFF on Silk & Bridal', discount: '₹150' },
  { code: 'BULKSAVE', label: '₹100 OFF on 5KG+ Laundry', discount: '₹100' },
];

export function BookScreen({
  onViewOrders,
  initialCouponCode,
  deliveryLocation = null,
  onRequireSignIn,
  onBrowseServices,
  resumeCheckout = false,
  onCheckoutResumed,
}: BookScreenProps) {
  const {
    session,
    catalog,
    cart,
    cartSummary,
    addresses,
    orders,
    addCartItem,
    addGarmentToCart,
    addBulkToCart,
    setCartQuantity,
    removeFromCart,
    getSlots,
    validatePincode,
    saveAddress,
    checkout,
    isCheckingOut,
  } = useApp();

  const [stage, setStage] = useState<BookingStage>('BAG');
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [addingAddress, setAddingAddress] = useState(false);
  const [draft, setDraft] = useState<AddressDraft>(() => newAddressDraft(session?.user.name || '', session?.user.phone || ''));
  const [pincodeCheck, setPincodeCheck] = useState<{ isServiceable: boolean; message?: string } | null>(null);
  const [selectedAddressServiceable, setSelectedAddressServiceable] = useState<boolean | null>(null);
  const [selectedAddressMessage, setSelectedAddressMessage] = useState<string | null>(null);
  const [checkingAddressServiceable, setCheckingAddressServiceable] = useState(false);
  const [slotDate, setSlotDate] = useState(localDateString());
  const [slots, setSlots] = useState<PickupSlot[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [expressTier, setExpressTier] = useState<ExpressTier>('REGULAR');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('ONLINE_RAZORPAY');
  const [couponCode, setCouponCode] = useState(initialCouponCode || '');
  const [couponApplied, setCouponApplied] = useState(Boolean(initialCouponCode));
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [completedOrderId, setCompletedOrderId] = useState<string | null>(null);
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [presetImgErrors, setPresetImgErrors] = useState<Record<string, boolean>>({});
  const [pricingSettings, setPricingSettings] = useState<PricingSettings | null>(catalog?.settings || null);
  const [availableCoupons, setAvailableCoupons] = useState<Coupon[]>([]);
  const [razorpayModalVisible, setRazorpayModalVisible] = useState(false);
  const [pendingPaymentOrder, setPendingPaymentOrder] = useState<RazorpayPaymentOrder | null>(null);
  const [paymentResolver, setPaymentResolver] = useState<{
    resolve: (res: RazorpayResult) => void;
    reject: (err: any) => void;
  } | null>(null);

  const pickupDates = useMemo(() => Array.from({ length: 7 }, (_, index) => localDateString(index)), []);
  const selectedAddress = addresses.find((a) => a.id === selectedAddressId) || addresses.find((a) => a.isDefault) || addresses[0];
  const selectedSlot = slots.find((s) => s.id === selectedSlotId && s.isAvailable && !s.isPast);

  // Validate serviceability when an address is selected or pre-filled
  useEffect(() => {
    const pin = selectedAddress?.pincode?.trim();
    if (!pin || pin.length < 6) {
      setSelectedAddressServiceable(null);
      setSelectedAddressMessage(null);
      return;
    }
    let active = true;
    setCheckingAddressServiceable(true);
    validatePincode(pin)
      .then((res) => {
        if (active) {
          const ok = Boolean(res.isServiceable || res.serviceable);
          setSelectedAddressServiceable(ok);
          setSelectedAddressMessage(res.message || (ok ? 'Serviceable for doorstep pickup' : 'Not currently serviceable for pickup'));
        }
      })
      .catch(() => {
        if (active) setSelectedAddressServiceable(null);
      })
      .finally(() => {
        if (active) setCheckingAddressServiceable(false);
      });
    return () => { active = false; };
  }, [selectedAddress?.id, selectedAddress?.pincode, validatePincode]);

  // The location picker confirms an area, while checkout still needs a flat or
  // house number. Prefill that checkout form instead of silently creating an
  // incomplete saved address.
  useEffect(() => {
    if (!deliveryLocation || addresses.length > 0) return;

    const street = deliveryLocation.formattedAddress || deliveryLocation.address || '';
    const landmark = deliveryLocation.areaName || deliveryLocation.locality || '';
    if (!street && !deliveryLocation.pincode) return;

    setDraft((current) => ({
      ...current,
      street: current.street || street,
      landmark: current.landmark || landmark,
      city: deliveryLocation.city || current.city || 'Hyderabad',
      state: deliveryLocation.state || current.state || 'Telangana',
      pincode: current.pincode || deliveryLocation.pincode || '',
    }));

    if (typeof deliveryLocation.isServiceable === 'boolean') {
      setPincodeCheck({
        isServiceable: deliveryLocation.isServiceable,
        message: deliveryLocation.serviceabilityMessage,
      });
    }
  }, [
    addresses.length,
    deliveryLocation?.address,
    deliveryLocation?.areaName,
    deliveryLocation?.city,
    deliveryLocation?.formattedAddress,
    deliveryLocation?.isServiceable,
    deliveryLocation?.locality,
    deliveryLocation?.pincode,
    deliveryLocation?.serviceabilityMessage,
    deliveryLocation?.state,
  ]);

  // GPS auto-fill shares the central permission, GPS, reverse-geocode, and serviceability flow.
  const handleUseCurrentLocation = async () => {
    try {
      setFetchingLocation(true);
      const locationResult = await getCurrentCustomerLocation('always');
      if (!locationResult.ok) {
        Alert.alert('Location unavailable', locationResult.message, [{ text: 'OK' }]);
        return;
      }

      const location = locationResult.location;

      // Reverse geocode using backend API (which calls Google Maps) or Expo
      const pincode = location.pincode || '';
      const street = location.formattedAddress || location.address || '';
      const city = location.city || '';
      const state = location.state || '';
      const landmark = location.areaName || location.locality || '';

      setDraft((prev) => ({
        ...prev,
        street: street || prev.street,
        pincode: pincode || prev.pincode,
        city: city || prev.city,
        state: state || prev.state,
        landmark: landmark || prev.landmark,
      }));

      if (location.isServiceable !== null && location.isServiceable !== undefined) {
        setPincodeCheck({ isServiceable: location.isServiceable, message: location.serviceabilityMessage });
      }

      if (pincode || street) {
        Alert.alert(
          '📍 Location Detected',
          `Address auto-filled from GPS.${pincode ? ` Pincode: ${pincode}.` : ''} Please verify and fill in your flat/house number.'`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Could Not Detect Address', 'Please enter your address manually.');
      }
    } catch (err) {
      Alert.alert('Location Error', 'Could not get your location. Please enter address manually.');
    } finally {
      setFetchingLocation(false);
    }
  };

  useEffect(() => {
    api.getPricingSettings()
      .then((res) => { if (res) setPricingSettings(res); })
      .catch(() => undefined);
    api.getCoupons()
      .then((items) => { if (items && items.length) setAvailableCoupons(items); })
      .catch(() => undefined);
  }, []);

  const handleApplyCoupon = async (code: string) => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return;
    if (!cartSummary.itemTotal) {
      Alert.alert('Empty Bag', 'Please add garments to your bag first before applying a coupon.');
      return;
    }
    try {
      const isFirstOrder = !orders.some((o) => o.currentStatus !== 'CANCELLED');
      const res = await api.applyCoupon(cleanCode, cartSummary.itemTotal, isFirstOrder);
      if (!res.isValid) {
        Alert.alert('Coupon Notice', res.message || 'That coupon is not valid for this order.');
        return;
      }
      setCouponCode(cleanCode);
      setCouponApplied(true);
      setCouponDiscount(Math.round(res.discount));
      Alert.alert('Coupon Applied! 🎉', `${res.message}\nYou saved ₹${Math.round(res.discount)}!`);
    } catch (err: any) {
      Alert.alert('Coupon Error', err?.message || 'Could not validate coupon.');
    }
  };

  useEffect(() => {
    if (initialCouponCode && cartSummary.itemTotal > 0 && !couponApplied) {
      handleApplyCoupon(initialCouponCode);
    }
  }, [initialCouponCode, cartSummary.itemTotal]);

  useEffect(() => {
    let active = true;
    setLoadingSlots(true);
    getSlots(slotDate)
      .then((items) => {
        if (!active) return;
        setSlots(items);
        const firstAvailable = items.find((s) => s.isAvailable && !s.isPast);
        if (firstAvailable) setSelectedSlotId(firstAvailable.id);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoadingSlots(false);
      });
    return () => {
      active = false;
    };
  }, [getSlots, slotDate]);

  const handleRemoveCoupon = () => {
    setCouponCode('');
    setCouponApplied(false);
    setCouponDiscount(0);
  };

  const standardDeliveryFee = pricingSettings?.standardDeliveryFee ?? 30;
  const freeDeliveryThreshold = pricingSettings?.freeDeliveryThreshold ?? 499;
  const isFreeDelivery = cartSummary.itemTotal >= freeDeliveryThreshold;
  const deliveryFee = isFreeDelivery ? 0 : standardDeliveryFee;

  const expressCharge = expressTier === 'EXPRESS_24H'
    ? (pricingSettings?.expressDeliveryFee ?? 80)
    : expressTier === 'SAME_DAY'
      ? (pricingSettings?.expressDeliveryFee ? pricingSettings.expressDeliveryFee * 2 : 160)
      : 0;

  const taxableAmount = Math.max(0, cartSummary.itemTotal - couponDiscount + deliveryFee + expressCharge);
  const isGstEnabled = pricingSettings?.isGstEnabled !== false;
  const taxPercentage = isGstEnabled ? (pricingSettings?.taxPercentage ?? 5) : 0;
  const gstCharge = Math.round(taxableAmount * (taxPercentage / 100));
  const finalPayable = Math.max(0, taxableAmount + gstCharge);
  const totalSavings = couponDiscount + (isFreeDelivery ? standardDeliveryFee : 0);

  const handleLaunchOnlinePayment = (paymentOrder: RazorpayPaymentOrder): Promise<RazorpayResult> => {
    return new Promise((resolve, reject) => {
      if (paymentOrder.isMock || paymentOrder.key?.includes('mock') || paymentOrder.orderId?.startsWith('order_sand_')) {
        resolve({
          razorpay_order_id: paymentOrder.orderId,
          razorpay_payment_id: `pay_sand_${Date.now()}`,
          razorpay_signature: '0'.repeat(64),
        });
        return;
      }

      setPendingPaymentOrder(paymentOrder);
      setPaymentResolver({ resolve, reject });
      setRazorpayModalVisible(true);
    });
  };

  const handlePaymentSuccess = (result: RazorpayResult) => {
    setRazorpayModalVisible(false);
    if (paymentResolver) {
      paymentResolver.resolve(result);
      setPaymentResolver(null);
    }
  };

  const handlePaymentCancel = () => {
    setRazorpayModalVisible(false);
    if (paymentResolver) {
      paymentResolver.reject(new Error('Payment was cancelled by user.'));
      setPaymentResolver(null);
    }
  };

  const handlePaymentError = (errMsg: string) => {
    setRazorpayModalVisible(false);
    if (paymentResolver) {
      paymentResolver.reject(new Error(errMsg || 'Payment failed.'));
      setPaymentResolver(null);
    }
  };

  const continueToDetails = () => {
    if (!cart.length) {
      Alert.alert('Empty Bag', 'Please add at least one garment or bulk laundry package.');
      return;
    }
    if (!session) {
      onRequireSignIn();
      return;
    }
    setStage('DETAILS');
  };

  const continueToReview = async () => {
    if (!selectedAddress) {
      Alert.alert('Address Required', 'Please select or add a doorstep pickup address.');
      return;
    }
    const pin = selectedAddress.pincode?.trim();
    if (pin) {
      try {
        const check = await validatePincode(pin);
        const ok = Boolean(check.isServiceable || check.serviceable);
        if (!ok) {
          Alert.alert(
            'Address Not Serviceable',
            check.message || `Doorstep pickup is not available for PIN ${pin} yet. Please select or add an address in a serviceable area.`,
            [{ text: 'OK' }]
          );
          return;
        }
      } catch (e) {
        // network issue fallback
      }
    }
    if (!selectedSlot) {
      Alert.alert('Time Slot Required', 'Please choose an available pickup time slot.');
      return;
    }
    setStage('REVIEW');
  };

  const placeOrder = async () => {
    if (!selectedAddress || !selectedSlot) return;
    const pin = selectedAddress.pincode?.trim();
    if (pin) {
      try {
        const check = await validatePincode(pin);
        const ok = Boolean(check.isServiceable || check.serviceable);
        if (!ok) {
          Alert.alert(
            'Address Not Serviceable',
            check.message || `Doorstep pickup is not available for PIN ${pin} yet. Please choose a serviceable address.`,
            [{ text: 'OK' }]
          );
          return;
        }
      } catch (e) {
        // network issue fallback
      }
    }
    try {
      const result = await checkout({
        address: selectedAddress,
        slot: selectedSlot,
        expressTier,
        paymentMethod,
        couponCode: couponApplied ? couponCode : undefined,
        notes: notes.trim() || undefined,
        onLaunchOnlinePayment: paymentMethod === 'ONLINE_RAZORPAY' ? handleLaunchOnlinePayment : undefined,
      });
      if (result.paymentOutcome === 'PAID' || result.paymentOutcome === 'COD') {
        setCompletedOrderId(result.order.id);
        setStage('SUCCESS');
      }
    } catch (error: any) {
      const errMsg = error instanceof Error ? error.message : String(error || '');
      const isPaymentCancel =
        paymentMethod === 'ONLINE_RAZORPAY' &&
        (errMsg.toLowerCase().includes('cancel') ||
         errMsg.toLowerCase().includes('dismiss') ||
         errMsg.toLowerCase().includes('incomplete'));

      if (isPaymentCancel) {
        Alert.alert(
          'Payment Incomplete',
          'Your online payment was cancelled or not completed.\n\nYour order has NOT been placed. Your bag items have been saved so you can try again or switch to Cash on Delivery (COD).',
          [
            {
              text: 'Switch to COD',
              onPress: () => setPaymentMethod('COD'),
            },
            {
              text: 'Retry Online',
              style: 'cancel',
            },
          ]
        );
      } else {
        Alert.alert(
          'Booking Failed',
          errMsg || 'Please check your connection and try again.',
          [{ text: 'OK' }]
        );
      }
    }
  };

  // --- STAGE 4: SUCCESS ---
  if (stage === 'SUCCESS') {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.successContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.successIconBox}>
          <MaterialCommunityIcons name="check-decagram" size={64} color="#16A34A" />
        </View>

        <Text style={styles.successTitle}>Pickup Scheduled! 🎉</Text>
        <Text style={styles.successSubtitle}>
          Order #{completedOrderId} has been confirmed. Our executive will arrive with digital scales at your chosen slot.
        </Text>

        <Card style={styles.successCard}>
          <View style={styles.successRow}>
            <MaterialCommunityIcons name="calendar-clock" size={20} color="#F97316" />
            <View style={{ flex: 1 }}>
              <Text style={styles.successRowLabel}>Pickup Time Slot</Text>
              <Text style={styles.successRowVal}>{shortDate(slotDate)} • {`${selectedSlot?.startTime} - ${selectedSlot?.endTime}`}</Text>
            </View>
          </View>

          <View style={styles.successDivider} />

          <View style={styles.successRow}>
            <MaterialCommunityIcons name="map-marker-radius" size={20} color="#16A34A" />
            <View style={{ flex: 1 }}>
              <Text style={styles.successRowLabel}>Pickup Address</Text>
              <Text style={styles.successRowVal} numberOfLines={2}>
                {selectedAddress?.street}, {selectedAddress?.city} - {selectedAddress?.pincode}
              </Text>
            </View>
          </View>

          <View style={styles.successDivider} />

          <View style={styles.successRow}>
            <MaterialCommunityIcons name="credit-card-check" size={20} color="#3B82F6" />
            <View style={{ flex: 1 }}>
              <Text style={styles.successRowLabel}>Estimated Total</Text>
              <Text style={styles.successRowVal}>{money(finalPayable)} ({paymentMethod === 'COD' ? 'Pay on Delivery' : 'Online Paid'})</Text>
            </View>
          </View>
        </Card>

        <Pressable style={styles.trackOrderBtn} onPress={onViewOrders}>
          <MaterialCommunityIcons name="moped" size={18} color="#FFFFFF" />
          <Text style={styles.trackOrderBtnText}>Track Order Status Live</Text>
          <MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" />
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <View style={styles.root}>
      {/* 1. TOP STEP PROGRESS INDICATOR */}
      <View style={styles.stepHeader}>
        <View style={styles.stepsRow}>
          <Pressable
            style={[styles.stepDot, stage === 'BAG' ? styles.stepDotActive : styles.stepDotCompleted]}
            onPress={() => setStage('BAG')}
          >
            <Text style={[styles.stepDotNum, (stage === 'BAG' || stage === 'DETAILS' || stage === 'REVIEW') && styles.stepDotNumActive]}>
              1
            </Text>
          </Pressable>
          <View style={[styles.stepLine, (stage === 'DETAILS' || stage === 'REVIEW') && styles.stepLineActive]} />

          <Pressable
            style={[styles.stepDot, stage === 'DETAILS' ? styles.stepDotActive : stage === 'REVIEW' ? styles.stepDotCompleted : styles.stepDotPending]}
            onPress={() => { if (cart.length > 0 && session) setStage('DETAILS'); }}
          >
            <Text style={[styles.stepDotNum, (stage === 'DETAILS' || stage === 'REVIEW') && styles.stepDotNumActive]}>
              2
            </Text>
          </Pressable>
          <View style={[styles.stepLine, stage === 'REVIEW' && styles.stepLineActive]} />

          <Pressable
            style={[styles.stepDot, stage === 'REVIEW' ? styles.stepDotActive : styles.stepDotPending]}
            onPress={() => { if (selectedAddress && selectedSlot) setStage('REVIEW'); }}
          >
            <Text style={[styles.stepDotNum, stage === 'REVIEW' && styles.stepDotNumActive]}>
              3
            </Text>
          </Pressable>
        </View>

        <View style={styles.stepLabelsRow}>
          <Text style={[styles.stepLabelText, stage === 'BAG' && styles.stepLabelTextActive]}>1. Bag</Text>
          <Text style={[styles.stepLabelText, stage === 'DETAILS' && styles.stepLabelTextActive]}>2. Pickup & Slot</Text>
          <Text style={[styles.stepLabelText, stage === 'REVIEW' && styles.stepLabelTextActive]}>3. Pay & Review</Text>
        </View>
      </View>

      {/* 2. MAIN BODY ACCORDING TO ACTIVE STAGE */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ================= STAGE 1: BAG ================= */}
        {stage === 'BAG' && (
          <View style={styles.stageWrap}>
            <View style={styles.stageTitleRow}>
              <Text style={styles.stageTitle}>Garments in Your Bag ({cartSummary.itemCount})</Text>
              <Text style={styles.stageSubtitle}>Review items or adjust quantity before scheduling</Text>
            </View>

            {cart.length === 0 ? (
              <View style={styles.luxuryEmptyCartWrap}>
                {/* Visual Icon Badge */}
                <View style={styles.emptyIconCircle}>
                  <MaterialCommunityIcons name="shopping" size={48} color="#FF7A00" />
                </View>
                <Text style={styles.luxuryEmptyTitle}>Your Laundry Bag is Empty</Text>
                <Text style={styles.luxuryEmptySubtitle}>
                  Choose from expert dry cleaning, everyday wash & fold, or popular laundry bundles below.
                </Text>

                {/* Primary CTA Button */}
                <Pressable
                  style={({ pressed }) => [styles.emptyExploreHeroBtn, pressed && { opacity: 0.9 }]}
                  onPress={onBrowseServices}
                >
                  <MaterialCommunityIcons name="hanger" size={18} color="#FFFFFF" />
                  <Text style={styles.emptyExploreHeroText}>Explore All Garments & Services</Text>
                  <MaterialCommunityIcons name="arrow-right" size={16} color="#FFFFFF" />
                </Pressable>

                {/* Quick-Add Popular Presets */}
                <View style={styles.emptyQuickAddSection}>
                  <Text style={styles.emptyQuickAddHeading}>⚡ Popular 1-Tap Laundry Bundles</Text>
                  <View style={styles.emptyQuickAddList}>
                    {[
                      {
                        id: 'bulk-srv-m-wash-fold-5kg',
                        serviceId: 'srv-m-wash-fold',
                        clothId: 'bulk',
                        clothName: 'Bulk Laundry (5 KG)',
                        serviceName: 'Everyday Wash & Fold (5 KG)',
                        categoryTag: 'BULK' as const,
                        unitPrice: 60,
                        quantity: 5,
                        subtotal: 300,
                        unit: 'KG',
                        pricingModel: 'PER_KG' as const,
                        turnaroundHours: 24,
                        imageUrl: 'https://laundry-storage-2026.s3.ap-south-1.amazonaws.com/banners/banner-bulk.jpg',
                        fallbackUrl: 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?auto=format&fit=crop&w=300&q=80',
                        desc: 'Everyday casuals, t-shirts & bedsheets',
                      },
                      {
                        id: 'cloth-shirt-srv-wash-iron',
                        serviceId: 'srv-m-wash-iron',
                        clothId: 'cloth-shirt',
                        clothName: "Men's Shirt",
                        serviceName: 'Office Shirts Steam Press (5 Pcs)',
                        categoryTag: 'MENS' as const,
                        unitPrice: 25,
                        quantity: 5,
                        subtotal: 125,
                        unit: 'Pcs',
                        pricingModel: 'PER_ITEM' as const,
                        turnaroundHours: 24,
                        imageUrl: 'https://laundry-storage-2026.s3.ap-south-1.amazonaws.com/garments/cloth-shirt.jpg',
                        fallbackUrl: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=300&q=80',
                        desc: 'Crisp hanger-finished executive shirts',
                      },
                      {
                        id: 'cloth-saree-silk-srv-dry-clean',
                        serviceId: 'srv-m-dry-clean',
                        clothId: 'cloth-saree-silk',
                        clothName: 'Pure Silk Saree',
                        serviceName: 'Silk Saree Roll Polish & Care',
                        categoryTag: 'WOMENS' as const,
                        unitPrice: 180,
                        quantity: 1,
                        subtotal: 180,
                        unit: 'Pc',
                        pricingModel: 'PER_ITEM' as const,
                        turnaroundHours: 48,
                        imageUrl: 'https://laundry-storage-2026.s3.ap-south-1.amazonaws.com/garments/cloth-saree-silk.jpg',
                        fallbackUrl: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=300&q=80',
                        desc: 'Gentle organic dry cleaning & roll polish',
                      },
                    ].map((preset) => (
                      <View key={preset.id} style={styles.quickAddRowCard}>
                        <Image
                          source={{ uri: presetImgErrors[preset.id] ? (preset as any).fallbackUrl : preset.imageUrl }}
                          style={styles.quickAddThumb}
                          resizeMode="cover"
                          onError={() => setPresetImgErrors((prev) => ({ ...prev, [preset.id]: true }))}
                        />
                        <View style={styles.quickAddInfo}>
                          <Text style={styles.quickAddName} numberOfLines={1}>{preset.serviceName}</Text>
                          <Text style={styles.quickAddDesc} numberOfLines={1}>{preset.desc}</Text>
                          <Text style={styles.quickAddRate}>₹{preset.subtotal} ({preset.quantity} {preset.unit})</Text>
                        </View>
                        <Pressable
                          style={({ pressed }) => [styles.quickAddActionBtn, pressed && { opacity: 0.85 }]}
                          onPress={() => {
                            addCartItem({
                              id: preset.id,
                              clothId: preset.clothId,
                              serviceId: preset.serviceId,
                              clothName: preset.clothName,
                              serviceName: preset.serviceName,
                              categoryName: preset.categoryTag,
                              unitPrice: preset.unitPrice,
                              quantity: preset.quantity,
                              subtotal: preset.subtotal,
                              unit: preset.unit,
                              pricingModel: preset.pricingModel,
                              turnaroundHours: preset.turnaroundHours,
                              imageUrl: preset.imageUrl,
                            });
                          }}
                        >
                          <MaterialCommunityIcons name="plus" size={16} color="#FFFFFF" />
                          <Text style={styles.quickAddBtnText}>ADD</Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.cartItemsStack}>
                {cart.map((item) => {
                  const isBulk = item.pricingModel === 'PER_KG' || item.clothId === 'bulk' || item.id.startsWith('bulk');
                  // Robust cloth ID extraction
                  let rawClothId = item.clothId;
                  if (!rawClothId) {
                    if (item.id.includes('-srv-')) {
                      rawClothId = item.id.split('-srv-')[0];
                    } else if (item.id.startsWith('cloth-')) {
                      const parts = item.id.split('-');
                      rawClothId = `${parts[0]}-${parts[1]}`;
                    } else {
                      rawClothId = item.id;
                    }
                  }
                  const imageUrl = getGarmentImageUrl(rawClothId || 'cloth-shirt', item.imageUrl, item.categoryName, item.serviceName);

                  return (
                    <View key={item.id} style={styles.cartCard}>
                      <View style={styles.cartCardThumb}>
                        <Image
                          source={{ uri: imageUrl }}
                          style={styles.cartImage}
                          resizeMode="cover"
                        />
                      </View>

                      <View style={styles.cartCardDetails}>
                        <Text style={styles.cartItemName} numberOfLines={1}>{item.serviceName ? item.serviceName.replace(/\s*\((null|undefined)\)/gi, '').trim() : 'Garment'}</Text>
                        <Text style={styles.cartItemRate}>₹{item.unitPrice}/{item.unit || (isBulk ? 'KG' : 'Piece')}</Text>

                        <View style={styles.cartCardActions}>
                          {/* Trash Delete Action */}
                          <Pressable
                            style={{ marginRight: 6 }}
                            onPress={() => removeFromCart(item.id)}
                            hitSlop={8}
                          >
                            <MaterialCommunityIcons name="trash-can-outline" size={17} color="#94A3B8" />
                          </Pressable>

                          <View style={styles.stepperContainer}>
                            <Pressable
                              style={styles.stepperBtn}
                              onPress={() => {
                                if (isBulk && item.quantity <= 3) {
                                  removeFromCart(item.id);
                                } else if (item.quantity <= 1) {
                                  removeFromCart(item.id);
                                } else {
                                  setCartQuantity(item.id, item.quantity - 1);
                                }
                              }}
                              hitSlop={8}
                            >
                              <MaterialCommunityIcons name="minus" size={13} color="#FFFFFF" />
                            </Pressable>

                            <Text style={styles.stepperCountText}>{item.quantity}{isBulk ? 'kg' : ''}</Text>

                            <Pressable
                              style={styles.stepperBtn}
                              onPress={() => setCartQuantity(item.id, item.quantity + 1)}
                              hitSlop={8}
                            >
                              <MaterialCommunityIcons name="plus" size={13} color="#FFFFFF" />
                            </Pressable>
                          </View>

                          <Text style={styles.cartItemSubtotal}>{money(item.subtotal)}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Turnaround Quality Assurance Box */}
            <View style={styles.assuranceBox}>
              <View style={styles.assuranceRow}>
                <MaterialCommunityIcons name="shield-check" size={18} color="#16A34A" />
                <Text style={styles.assuranceText}>100% Free Re-wash Guarantee on all dry cleaned garments</Text>
              </View>
              <View style={styles.assuranceRow}>
                <MaterialCommunityIcons name="lightning-bolt" size={18} color="#EA580C" />
                <Text style={styles.assuranceText}>Standard 24H-48H delivery • 12H Express available at next step</Text>
              </View>
            </View>
          </View>
        )}

        {/* ================= STAGE 2: DETAILS (Address & Slot) ================= */}
        {stage === 'DETAILS' && (
          <View style={styles.stageWrap}>
            {/* 1. PICKUP ADDRESS SELECTOR */}
            <View style={styles.stageTitleRow}>
              <Text style={styles.stageTitle}>1. Doorstep Pickup Address</Text>
              <Text style={styles.stageSubtitle}>Where should our executive collect your laundry?</Text>
            </View>

            {addresses.length === 0 || addingAddress ? (
              <Card style={styles.addressFormCard}>
                <View style={styles.formTitleRow}>
                  <Text style={styles.formSectionTitle}>Enter Pickup Address</Text>
                  <Pressable
                    style={[styles.gpsBtn, fetchingLocation && styles.gpsBtnLoading]}
                    onPress={handleUseCurrentLocation}
                    disabled={fetchingLocation}
                  >
                    <MaterialCommunityIcons
                      name={fetchingLocation ? 'loading' : 'crosshairs-gps'}
                      size={16}
                      color={fetchingLocation ? '#A1A1AA' : '#F97316'}
                    />
                    <Text style={[styles.gpsBtnText, fetchingLocation && styles.gpsBtnTextLoading]}>
                      {fetchingLocation ? 'Detecting...' : 'Use Current Location'}
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.typeChipsRow}>
                  {(['Home', 'Office', 'Other'] as const).map((t) => (
                    <Chip
                      key={t}
                      label={t}
                      active={draft.type === t}
                      onPress={() => setDraft((c) => ({ ...c, type: t }))}
                    />
                  ))}
                </View>

                <AppInput
                  label="Contact Person Name *"
                  placeholder="Full Name"
                  value={draft.contactName}
                  onChangeText={(contactName) => setDraft((c) => ({ ...c, contactName }))}
                />

                <AppInput
                  label="10-Digit Mobile Number *"
                  placeholder="e.g. 9876543210"
                  keyboardType="phone-pad"
                  value={draft.contactPhone}
                  onChangeText={(contactPhone) => setDraft((c) => ({ ...c, contactPhone }))}
                />

                <AppInput
                  label="Flat / Building / Street Address *"
                  placeholder="e.g. Flat 402, Royal Residency, Road No 12"
                  value={draft.street}
                  onChangeText={(street) => setDraft((c) => ({ ...c, street }))}
                />

                <AppInput
                  label="Landmark / Area (Optional)"
                  placeholder="e.g. Near HITEC City Metro, Madhapur"
                  value={draft.landmark}
                  onChangeText={(landmark) => setDraft((c) => ({ ...c, landmark }))}
                />

                <View style={styles.twoColRow}>
                  <View style={{ flex: 1 }}>
                    <AppInput
                      label="City *"
                      placeholder="Hyderabad"
                      value={draft.city}
                      onChangeText={(city) => setDraft((c) => ({ ...c, city }))}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppInput
                      label="6-Digit Pincode *"
                      placeholder="500081"
                      keyboardType="number-pad"
                      value={draft.pincode}
                      onChangeText={(pincode) => setDraft((c) => ({ ...c, pincode }))}
                    />
                  </View>
                </View>

                <View style={styles.formBtnRow}>
                  {addresses.length > 0 && (
                    <AppButton title="Cancel" variant="outline" compact onPress={() => setAddingAddress(false)} />
                  )}
                  <AppButton
                    title="Save Address"
                    compact
                    onPress={async () => {
                      if (!draft.street.trim() || !draft.pincode.trim()) {
                        Alert.alert('Required', 'Please enter street and pincode.');
                        return;
                      }
                      const saved = await saveAddress({ ...draft, id: `addr_${Date.now()}` });
                      setSelectedAddressId(saved.id);
                      setAddingAddress(false);
                    }}
                  />
                </View>
              </Card>
            ) : (
              <View style={styles.savedAddressesStack}>
                {addresses.map((item) => {
                  const isSelected = (selectedAddressId || selectedAddress?.id) === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      style={[styles.addressSelectCard, isSelected && styles.addressSelectCardActive]}
                      onPress={() => setSelectedAddressId(item.id)}
                    >
                      <View style={styles.addressRadioRow}>
                        <MaterialCommunityIcons
                          name={isSelected ? 'radiobox-marked' : 'radiobox-blank'}
                          size={20}
                          color={isSelected ? '#F97316' : '#8A7A84'}
                        />
                        <View style={styles.addressTagBadge}>
                          <Text style={styles.addressTagText}>{item.type}</Text>
                        </View>
                      </View>

                      <Text style={styles.addressCardName}>{item.contactName} • +91 {item.contactPhone}</Text>
                      <Text style={styles.addressCardStreet}>{item.street}, {item.city} - {item.pincode}</Text>
                      {isSelected && selectedAddressServiceable === false ? (
                        <View style={styles.addressServiceNotice}>
                          <MaterialCommunityIcons name="alert-circle" size={14} color="#DC2626" />
                          <Text style={styles.addressServiceNoticeText}>
                            {selectedAddressMessage || `PIN ${item.pincode} is not currently serviceable for pickup.`}
                          </Text>
                        </View>
                      ) : isSelected && selectedAddressServiceable === true ? (
                        <View style={styles.addressServiceAvailableNotice}>
                          <MaterialCommunityIcons name="check-circle" size={13} color="#16A34A" />
                          <Text style={styles.addressServiceAvailableText}>
                            Serviceable for doorstep pickup
                          </Text>
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}

                <Pressable style={styles.addNewAddrBtn} onPress={() => setAddingAddress(true)}>
                  <MaterialCommunityIcons name="plus-circle-outline" size={18} color="#F97316" />
                  <Text style={styles.addNewAddrBtnText}>Add Another Pickup Address</Text>
                </Pressable>
              </View>
            )}

            {/* 2. PICKUP DATE CALENDAR TILES */}
            <View style={[styles.stageTitleRow, { marginTop: 20 }]}>
              <Text style={styles.stageTitle}>2. Choose Pickup Date</Text>
              <Text style={styles.stageSubtitle}>Executive will arrive on selected day</Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateTilesScroll}>
              {pickupDates.map((dateStr, idx) => {
                const isSelected = slotDate === dateStr;
                const d = new Date(dateStr);
                const dayName = idx === 0 ? 'Today' : idx === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short' });
                const dateNum = d.getDate();
                const monthName = d.toLocaleDateString('en-US', { month: 'short' });

                return (
                  <Pressable
                    key={dateStr}
                    style={[styles.dateTile, isSelected && styles.dateTileActive]}
                    onPress={() => setSlotDate(dateStr)}
                  >
                    <Text style={[styles.dateTileDay, isSelected && styles.dateTileDayActive]}>{dayName}</Text>
                    <Text style={[styles.dateTileNum, isSelected && styles.dateTileNumActive]}>{dateNum}</Text>
                    <Text style={[styles.dateTileMonth, isSelected && styles.dateTileMonthActive]}>{monthName}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* 3. TIME SLOT GRID */}
            <View style={[styles.stageTitleRow, { marginTop: 20 }]}>
              <Text style={styles.stageTitle}>3. Pickup Time Slot</Text>
              <Text style={styles.stageSubtitle}>Select 2-hour collection window</Text>
            </View>

            <View style={styles.slotGrid}>
              {slots.map((slot) => {
                const isSelected = selectedSlotId === slot.id;
                const isPast = slot.isPast;
                const isAvailable = slot.isAvailable && !isPast;

                return (
                  <Pressable
                    key={slot.id}
                    disabled={!isAvailable}
                    style={[
                      styles.slotCard,
                      isSelected && styles.slotCardActive,
                      !isAvailable && styles.slotCardDisabled,
                    ]}
                    onPress={() => setSelectedSlotId(slot.id)}
                  >
                    <View style={styles.slotCardTop}>
                      <MaterialCommunityIcons
                        name="clock-time-four-outline"
                        size={16}
                        color={isSelected ? '#F97316' : !isAvailable ? '#D1D5DB' : '#1C0B18'}
                      />
                      {isAvailable ? (
                        <View style={styles.slotCapBadge}>
                          <Text style={styles.slotCapText}>{slot.maxOrders - slot.bookedOrders} slots</Text>
                        </View>
                      ) : (
                        <Text style={styles.slotFullText}>Full</Text>
                      )}
                    </View>
                    <Text style={[styles.slotLabel, isSelected && styles.slotLabelActive, !isAvailable && styles.slotLabelDisabled]}>
                      {`${slot.startTime} - ${slot.endTime}`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* 4. EXPRESS 12H TOGGLE */}
            <View style={styles.expressBox}>
              <View style={styles.expressLeft}>
                <View style={styles.expressBadge}>
                  <MaterialCommunityIcons name="lightning-bolt" size={14} color="#EA580C" />
                  <Text style={styles.expressBadgeText}>EXPRESS 12H DELIVERY</Text>
                </View>
                <Text style={styles.expressTitle}>Need clothes back tomorrow morning?</Text>
                <Text style={styles.expressSubtitle}>Priority processing + guaranteed 12-hour return (+₹99)</Text>
              </View>

              <Pressable
                style={[styles.expressToggleBtn, expressTier === 'EXPRESS_24H' && styles.expressToggleBtnActive]}
                onPress={() => setExpressTier(expressTier === 'EXPRESS_24H' ? 'REGULAR' : 'EXPRESS_24H')}
              >
                <Text style={[styles.expressToggleText, expressTier === 'EXPRESS_24H' && styles.expressToggleTextActive]}>
                  {expressTier === 'EXPRESS_24H' ? 'Added ✓' : '+ Add ₹99'}
                </Text>
              </Pressable>
            </View>

            {/* 5. CARE NOTES */}
            <View style={{ marginTop: 14 }}>
              <Text style={styles.inputLabel}>Special Care / Stain Instructions (Optional)</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="e.g. Heavy coffee stain on cuff, please use gentle silk press..."
                placeholderTextColor="#A1A1AA"
                value={notes}
                onChangeText={setNotes}
                multiline
              />
            </View>
          </View>
        )}

        {/* ================= STAGE 3: REVIEW & PAYMENT ================= */}
        {stage === 'REVIEW' && (
          <View style={styles.stageWrap}>
            {/* Delivery Overview Card */}
            <Card style={styles.overviewCard}>
              <View style={styles.overviewRow}>
                <MaterialCommunityIcons name="map-marker" size={18} color="#F97316" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.overviewLabel}>Pickup Point</Text>
                  <Text style={styles.overviewVal}>{selectedAddress?.street}, {selectedAddress?.city}</Text>
                </View>
                <Pressable onPress={() => setStage('DETAILS')}>
                  <Text style={styles.editLink}>Change</Text>
                </Pressable>
              </View>

              <View style={styles.overviewDivider} />

              <View style={styles.overviewRow}>
                <MaterialCommunityIcons name="clock-outline" size={18} color="#16A34A" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.overviewLabel}>Scheduled Slot</Text>
                  <Text style={styles.overviewVal}>{shortDate(slotDate)} • {`${selectedSlot?.startTime} - ${selectedSlot?.endTime}`}</Text>
                </View>
                <Pressable onPress={() => setStage('DETAILS')}>
                  <Text style={styles.editLink}>Change</Text>
                </Pressable>
              </View>

              {expressTier === 'EXPRESS_24H' && (
                <>
                  <View style={styles.overviewDivider} />
                  <View style={styles.overviewRow}>
                    <MaterialCommunityIcons name="lightning-bolt" size={18} color="#EA580C" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.overviewLabel}>Speed</Text>
                      <Text style={styles.overviewVal}>⚡ 12-Hour Priority Express</Text>
                    </View>
                  </View>
                </>
              )}
            </Card>

            {/* COUPON SECTION */}
            <View style={styles.couponSection}>
              <Text style={styles.couponHeaderTitle}>Offers & Discount Coupons</Text>

              {couponApplied ? (
                <View style={styles.appliedCouponBox}>
                  <View style={styles.appliedCouponLeft}>
                    <MaterialCommunityIcons name="check-circle" size={18} color="#16A34A" />
                    <View>
                      <Text style={styles.appliedCouponCode}>{couponCode} Applied</Text>
                      <Text style={styles.appliedCouponSaving}>Saved ₹{couponDiscount} on this order</Text>
                    </View>
                  </View>
                  <Pressable onPress={handleRemoveCoupon} hitSlop={10}>
                    <Text style={styles.removeCouponText}>Remove</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.couponInputRow}>
                  <TextInput
                    style={styles.couponInput}
                    placeholder="Enter promo code (e.g. FIRST50)"
                    placeholderTextColor="#A1A1AA"
                    value={couponCode}
                    onChangeText={setCouponCode}
                    autoCapitalize="characters"
                  />
                  <Pressable style={styles.applyBtn} onPress={() => handleApplyCoupon(couponCode)}>
                    <Text style={styles.applyBtnText}>Apply</Text>
                  </Pressable>
                </View>
              )}

              {/* Quick Coupon Pills */}
              {!couponApplied && (
                <View style={styles.quickCouponsRow}>
                  {(availableCoupons.length > 0
                    ? availableCoupons.slice(0, 5).map((c) => ({
                        code: c.code,
                        label: c.description || (c.discountType === 'PERCENTAGE' ? `${c.discountValue}% OFF` : `₹${c.discountValue} OFF`),
                      }))
                    : QUICK_COUPONS
                  ).map((c) => (
                    <Pressable
                      key={c.code}
                      style={styles.quickCouponChip}
                      onPress={() => handleApplyCoupon(c.code)}
                    >
                      <MaterialCommunityIcons name="tag" size={12} color="#EA580C" />
                      <Text style={styles.quickCouponChipText}>{c.code}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {/* PAYMENT METHOD SELECTION */}
            <View style={styles.paymentSection}>
              <Text style={styles.paymentHeaderTitle}>Payment Method</Text>

              <Pressable
                style={[styles.paymentTile, paymentMethod === 'ONLINE_RAZORPAY' && styles.paymentTileActive]}
                onPress={() => setPaymentMethod('ONLINE_RAZORPAY')}
              >
                <MaterialCommunityIcons
                  name={paymentMethod === 'ONLINE_RAZORPAY' ? 'radiobox-marked' : 'radiobox-blank'}
                  size={20}
                  color={paymentMethod === 'ONLINE_RAZORPAY' ? '#F97316' : '#8A7A84'}
                />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.paymentTileName}>UPI / Google Pay / PhonePe / Cards</Text>
                  <Text style={styles.paymentTileSub}>256-Bit Encrypted Secure Razorpay Gateway</Text>
                </View>
                <MaterialCommunityIcons name="shield-check" size={18} color="#16A34A" />
              </Pressable>

              <Pressable
                style={[styles.paymentTile, paymentMethod === 'COD' && styles.paymentTileActive]}
                onPress={() => setPaymentMethod('COD')}
              >
                <MaterialCommunityIcons
                  name={paymentMethod === 'COD' ? 'radiobox-marked' : 'radiobox-blank'}
                  size={20}
                  color={paymentMethod === 'COD' ? '#F97316' : '#8A7A84'}
                />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.paymentTileName}>Pay on Delivery (Cash / UPI at Doorstep)</Text>
                  <Text style={styles.paymentTileSub}>Pay rider after verifying freshly washed clothes</Text>
                </View>
                <MaterialCommunityIcons name="cash" size={18} color="#F97316" />
              </Pressable>
            </View>

            {/* ITEMIZED BILL SUMMARY */}
            <Card style={styles.billCard}>
              <Text style={styles.billCardTitle}>Bill Breakdown</Text>

              <View style={styles.billLine}>
                <Text style={styles.billLineLabel}>Items Subtotal ({cartSummary.itemCount} items)</Text>
                <Text style={styles.billLineVal}>{money(cartSummary.itemTotal)}</Text>
              </View>

              <View style={styles.billLine}>
                <Text style={styles.billLineLabel}>Doorstep Pickup & Delivery</Text>
                {isFreeDelivery ? (
                  <Text style={[styles.billLineVal, { color: '#16A34A', fontWeight: '700' }]}>FREE</Text>
                ) : (
                  <Text style={styles.billLineVal}>{money(deliveryFee)}</Text>
                )}
              </View>

              {expressCharge > 0 && (
                <View style={styles.billLine}>
                  <Text style={styles.billLineLabel}>12H Priority Express Fee</Text>
                  <Text style={styles.billLineVal}>+₹{expressCharge}</Text>
                </View>
              )}

              {couponDiscount > 0 && (
                <View style={styles.billLine}>
                  <Text style={[styles.billLineLabel, { color: '#16A34A' }]}>Coupon Discount ({couponCode})</Text>
                  <Text style={[styles.billLineVal, { color: '#16A34A', fontWeight: '700' }]}>-₹{couponDiscount}</Text>
                </View>
              )}

              <View style={styles.billLine}>
                <Text style={styles.billLineLabel}>
                  {!isGstEnabled || taxPercentage === 0
                    ? 'GST (Temporarily Waived)'
                    : `GST (${taxPercentage}%)`}
                </Text>
                <Text style={[styles.billLineVal, (!isGstEnabled || taxPercentage === 0) && { color: '#16A34A' }]}>
                  {!isGstEnabled || taxPercentage === 0 ? '₹0 (0%)' : `₹${gstCharge}`}
                </Text>
              </View>

              <View style={styles.billDivider} />

              <View style={styles.billFinalRow}>
                <View>
                  <Text style={styles.billGrandLabel}>Total Payable</Text>
                  {totalSavings > 0 && (
                    <Text style={styles.billSavingsText}>You saved ₹{totalSavings} on this order</Text>
                  )}
                </View>
                <Text style={styles.billGrandVal}>{money(finalPayable)}</Text>
              </View>
            </Card>
          </View>
        )}
      </ScrollView>

      {/* 3. STICKY BOTTOM CHECKOUT ACTION BAR */}
      <View style={styles.stickyFooter}>
        {stage === 'BAG' && cart.length === 0 ? (
          <Pressable
            style={({ pressed }) => [styles.footerFullExploreBtn, pressed && { opacity: 0.9 }]}
            onPress={onBrowseServices}
          >
            <MaterialCommunityIcons name="hanger" size={20} color="#FFFFFF" />
            <Text style={styles.footerFullExploreText}>Browse All Garments & Services</Text>
            <MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" />
          </Pressable>
        ) : (
          <>
            <View style={styles.footerPriceCol}>
              <Text style={styles.footerPriceLabel}>Final Amount</Text>
              <Text style={styles.footerPriceVal}>{money(finalPayable)}</Text>
            </View>

            {stage === 'BAG' && (
              <Pressable style={styles.footerPrimaryBtn} onPress={continueToDetails}>
                <Text style={styles.footerPrimaryBtnText}>Proceed to Pickup & Slots</Text>
                <MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" />
              </Pressable>
            )}
          </>
        )}

        {stage === 'DETAILS' && (
          <Pressable style={styles.footerPrimaryBtn} onPress={continueToReview}>
            <Text style={styles.footerPrimaryBtnText}>Review & Pay</Text>
            <MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" />
          </Pressable>
        )}

        {stage === 'REVIEW' && (
          <Pressable
            style={[styles.footerPrimaryBtn, isCheckingOut && { opacity: 0.7 }]}
            onPress={placeOrder}
            disabled={isCheckingOut}
          >
            <MaterialCommunityIcons name="lock" size={16} color="#FFFFFF" />
            <Text style={styles.footerPrimaryBtnText}>
              {isCheckingOut ? 'Scheduling Pickup...' : `Confirm & Place Order`}
            </Text>
            <MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" />
          </Pressable>
        )}
      </View>

      {/* RAZORPAY WEBVIEW MODAL */}
      {pendingPaymentOrder && (
        <RazorpayModal
          visible={razorpayModalVisible}
          paymentOrder={pendingPaymentOrder}
          onSuccess={handlePaymentSuccess}
          onCancel={handlePaymentCancel}
          onError={handlePaymentError}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  luxuryEmptyCartWrap: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FFF7ED',
    borderWidth: 2,
    borderColor: '#FED7AA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#FF7A00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  luxuryEmptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },
  luxuryEmptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 16,
    marginBottom: 18,
  },
  emptyExploreHeroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FF7A00',
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 13,
    shadowColor: '#FF7A00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 24,
  },
  emptyExploreHeroText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '800',
  },
  emptyQuickAddSection: {
    width: '100%',
    marginTop: 4,
  },
  emptyQuickAddHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  emptyQuickAddList: {
    gap: 10,
  },
  quickAddRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    gap: 10,
  },
  quickAddThumb: {
    width: 58,
    height: 58,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
  },
  quickAddInfo: {
    flex: 1,
  },
  quickAddName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  quickAddDesc: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 3,
  },
  quickAddRate: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FF7A00',
  },

  root: {
    flex: 1,
    backgroundColor: '#FCF9F7',
  },
  stepHeader: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderColor: '#F3E8DF',
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FAF5EF',
    borderWidth: 2,
    borderColor: '#E5DCD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: '#F97316',
    borderColor: '#F97316',
  },
  stepDotCompleted: {
    backgroundColor: '#16A34A',
    borderColor: '#16A34A',
  },
  stepDotPending: {
    backgroundColor: '#FAF5EF',
  },
  stepDotNum: {
    fontSize: 12,
    fontWeight: '800',
    color: '#8A7A84',
  },
  stepDotNumActive: {
    color: '#FFFFFF',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#E5DCD5',
    marginHorizontal: 8,
  },
  stepLineActive: {
    backgroundColor: '#16A34A',
  },
  stepLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  stepLabelText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8A7A84',
  },
  stepLabelTextActive: {
    color: '#F97316',
    fontWeight: '900',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  stageWrap: {
    gap: 14,
  },
  stageTitleRow: {
    marginBottom: 4,
  },
  stageTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#1C0B18',
    letterSpacing: -0.3,
  },
  stageSubtitle: {
    fontSize: 12,
    color: '#8A7A84',
    marginTop: 2,
  },
  emptyCartWrap: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 6,
  },
  emptyCartTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1C0B18',
    marginTop: 8,
  },
  emptyCartSubtitle: {
    fontSize: 12,
    color: '#8A7A84',
    textAlign: 'center',
  },
  cartItemsStack: {
    gap: 10,
  },
  cartCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 20,
    elevation: 3,
  },
  cartCardThumb: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#FAF5EF',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartImage: {
    width: '100%',
    height: '100%',
  },
  cartCardDetails: {
    flex: 1,
  },
  cartItemName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1C0B18',
  },
  cartItemRate: {
    fontSize: 11,
    color: '#8A7A84',
    marginTop: 2,
  },
  cartCardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  cartItemSubtotal: {
    fontSize: 14,
    fontWeight: '900',
    color: '#F97316',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16A34A',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
    gap: 6,
  },
  stepperBtn: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperCountText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
    minWidth: 14,
    textAlign: 'center',
  },
  assuranceBox: {
    backgroundColor: '#FAF5EF',
    borderRadius: 16,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: '#F3E8DF',
  },
  assuranceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  assuranceText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: '#4A3B45',
    lineHeight: 15,
  },
  footerBrowseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#4F46E5',
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 13,
    flex: 1,
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  addressFormCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  formTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  gpsBtnLoading: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E5E5E5',
  },
  gpsBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#EA580C',
  },
  gpsBtnTextLoading: {
    color: '#A1A1AA',
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 10,
  },
  formSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1C0B18',
  },
  typeChipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  formBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  savedAddressesStack: {
    gap: 10,
  },
  addressSelectCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F3E8DF',
    gap: 4,
  },
  addressSelectCardActive: {
    borderColor: '#F97316',
    borderWidth: 1.5,
    backgroundColor: '#FFF7ED',
  },
  addressRadioRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  addressTagBadge: {
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  addressTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F97316',
  },
  addressCardName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1C0B18',
  },
  addressServiceNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  addressServiceNoticeText: {
    color: '#DC2626',
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  addressServiceAvailableNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  addressServiceAvailableText: {
    color: '#16A34A',
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  addressCardStreet: {
    fontSize: 12,
    color: '#8A7A84',
    lineHeight: 16,
  },
  addNewAddrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8DED6',
    backgroundColor: '#FFFFFF',
    gap: 6,
  },
  addNewAddrBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F97316',
  },
  dateTilesScroll: {
    gap: 10,
    paddingVertical: 4,
  },
  dateTile: {
    width: 72,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3E8DF',
    alignItems: 'center',
    gap: 2,
  },
  dateTileActive: {
    backgroundColor: '#1C0B18',
    borderColor: '#1C0B18',
  },
  dateTileDay: {
    fontSize: 10,
    fontWeight: '800',
    color: '#8A7A84',
  },
  dateTileDayActive: {
    color: '#D6B36A',
  },
  dateTileNum: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1C0B18',
  },
  dateTileNumActive: {
    color: '#FFFFFF',
  },
  dateTileMonth: {
    fontSize: 10,
    color: '#8A7A84',
  },
  dateTileMonthActive: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  slotCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F3E8DF',
    gap: 6,
  },
  slotCardActive: {
    borderColor: '#F97316',
    borderWidth: 1.5,
    backgroundColor: '#FFF7ED',
  },
  slotCardDisabled: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
    opacity: 0.6,
  },
  slotCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  slotCapBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  slotCapText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#16A34A',
  },
  slotFullText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  slotLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1C0B18',
  },
  slotLabelActive: {
    color: '#F97316',
  },
  slotLabelDisabled: {
    color: '#9CA3AF',
  },
  expressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FFEDD5',
    marginTop: 14,
    gap: 12,
  },
  expressLeft: {
    flex: 1,
  },
  expressBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  expressBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#EA580C',
    letterSpacing: 0.5,
  },
  expressTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1C0B18',
  },
  expressSubtitle: {
    fontSize: 11,
    color: '#8A7A84',
    marginTop: 2,
  },
  expressToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F97316',
  },
  expressToggleBtnActive: {
    backgroundColor: '#EA580C',
    borderColor: '#EA580C',
  },
  expressToggleText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F97316',
  },
  expressToggleTextActive: {
    color: '#FFFFFF',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1C0B18',
    marginBottom: 6,
  },
  notesInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F3E8DF',
    fontSize: 13,
    color: '#1C0B18',
    minHeight: 60,
  },
  overviewCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  overviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  overviewLabel: {
    fontSize: 11,
    color: '#8A7A84',
  },
  overviewVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1C0B18',
    marginTop: 1,
  },
  editLink: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F97316',
  },
  overviewDivider: {
    height: 1,
    backgroundColor: '#F3E8DF',
    marginVertical: 10,
  },
  couponSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3E8DF',
    gap: 10,
  },
  couponHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1C0B18',
  },
  couponInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  couponInput: {
    flex: 1,
    backgroundColor: '#FAF5EF',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: '#E8DED6',
    fontSize: 13,
    fontWeight: '700',
    color: '#1C0B18',
  },
  applyBtn: {
    backgroundColor: '#1C0B18',
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  appliedCouponBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    padding: 10,
    borderRadius: 12,
  },
  appliedCouponLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  appliedCouponCode: {
    fontSize: 13,
    fontWeight: '900',
    color: '#16A34A',
  },
  appliedCouponSaving: {
    fontSize: 11,
    color: '#15803D',
  },
  removeCouponText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#EF4444',
  },
  quickCouponsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  quickCouponChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  quickCouponChipText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#EA580C',
  },
  paymentSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3E8DF',
    gap: 10,
  },
  paymentHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1C0B18',
  },
  paymentTile: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F3E8DF',
    backgroundColor: '#FCF9F7',
  },
  paymentTileActive: {
    borderColor: '#F97316',
    backgroundColor: '#FFF7ED',
  },
  paymentTileName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1C0B18',
  },
  paymentTileSub: {
    fontSize: 11,
    color: '#8A7A84',
    marginTop: 2,
  },
  billCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  billCardTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1C0B18',
    marginBottom: 4,
  },
  billLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  billLineLabel: {
    fontSize: 12,
    color: '#8A7A84',
  },
  billLineVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1C0B18',
  },
  billDivider: {
    height: 1,
    backgroundColor: '#F3E8DF',
    marginVertical: 4,
  },
  billFinalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  billGrandLabel: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1C0B18',
  },
  billSavingsText: {
    fontSize: 11,
    color: '#16A34A',
    fontWeight: '700',
  },
  billGrandVal: {
    fontSize: 18,
    fontWeight: '900',
    color: '#F97316',
  },
  stickyFooter: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: '#F3E8DF',
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
  },
  footerPriceCol: {
    justifyContent: 'center',
  },
  footerPriceLabel: {
    fontSize: 11,
    color: '#8A7A84',
  },
  footerPriceVal: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1C0B18',
  },
  footerPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF7A00',
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 16,
    gap: 8,
    shadowColor: '#FF7A00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  footerPrimaryBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  successContainer: {
    padding: 24,
    alignItems: 'center',
    paddingTop: 60,
  },
  successIconBox: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1C0B18',
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 13,
    color: '#8A7A84',
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 6,
    marginBottom: 24,
  },
  successCard: {
    width: '100%',
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    gap: 12,
    marginBottom: 24,
  },
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  successRowLabel: {
    fontSize: 11,
    color: '#8A7A84',
  },
  successRowVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1C0B18',
    marginTop: 1,
  },
  successDivider: {
    height: 1,
    backgroundColor: '#F3E8DF',
  },

  quickAddActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FF7A00',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#FF7A00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  quickAddBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  footerFullExploreBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FF7A00',
    height: 52,
    borderRadius: 16,
    shadowColor: '#FF7A00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  footerFullExploreText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  trackOrderBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F97316',
    borderRadius: 16,
    paddingVertical: 14,
    gap: 8,
  },
  trackOrderBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
