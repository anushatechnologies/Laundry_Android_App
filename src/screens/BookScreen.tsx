import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import { api } from '@/lib/api';
import { payWithRazorpay, parsePaymentError, type ParsedPaymentError } from '@/lib/payments';
import { getCurrentCustomerLocation } from '@/services/location/locationService';
import { calculateLocalDeliveryFee, PINCODE_COORDINATES } from '@/services/location/deliveryCalculator';
import { AppButton, AppInput, Card, Chip, EmptyState, SectionTitle } from '@/ui/components';
import { COLORS, localDateString, money, shortDate } from '@/ui/theme';
import { getGarmentImageUrl } from '@/lib/garment-photos';
import type { Coupon, CustomerAddress, CustomerSubscription, DeliveryFeeCalculation, ExpressTier, PaymentMethod, PickupSlot, PincodeCheck, PricingSettings, RazorpayPaymentOrder } from '@/types/domain';
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
  onClearInitialCoupon?: () => void;
  deliveryLocation?: CustomerLocation | null;
  onRequireSignIn: () => void;
  onBrowseServices: () => void;
  resumeCheckout?: boolean;
  onCheckoutResumed?: () => void;
  hasBottomTabBar?: boolean;
}

const DEFAULT_COUPONS: Coupon[] = [
  {
    id: 'cp-first50',
    code: 'FIRST50',
    title: '50% OFF (First Order)',
    description: '50% discount up to ₹250 on your first laundry order',
    discountType: 'PERCENTAGE',
    discountValue: 50,
    minOrderValue: 199,
    maxDiscountCap: 250,
    firstOrderOnly: true,
    expiryDate: '2027-12-31',
    isActive: true,
  },
  {
    id: 'cp-silkspa',
    code: 'SILKSPA',
    title: '₹150 OFF Silk & Luxury Care',
    description: 'Flat ₹150 off on orders above ₹499',
    discountType: 'FLAT',
    discountValue: 150,
    minOrderValue: 499,
    firstOrderOnly: false,
    expiryDate: '2027-12-31',
    isActive: true,
  },
  {
    id: 'cp-bulksave',
    code: 'BULKSAVE',
    title: '₹100 OFF Bulk Laundry',
    description: 'Flat ₹100 off on 5KG+ laundry orders above ₹399',
    discountType: 'FLAT',
    discountValue: 100,
    minOrderValue: 399,
    firstOrderOnly: false,
    expiryDate: '2027-12-31',
    isActive: true,
  },
  {
    id: 'cp-weekend20',
    code: 'WEEKEND20',
    title: '20% Weekend Savings',
    description: 'Save 20% up to ₹150 on dry cleaning and premium spa orders',
    discountType: 'PERCENTAGE',
    discountValue: 20,
    minOrderValue: 350,
    maxDiscountCap: 150,
    firstOrderOnly: false,
    expiryDate: '2027-12-31',
    isActive: true,
  },
  {
    id: 'cp-welcome100',
    code: 'WELCOME100',
    title: 'Flat ₹100 Off First Order',
    description: 'Flat ₹100 discount on orders above ₹299',
    discountType: 'FLAT',
    discountValue: 100,
    minOrderValue: 299,
    firstOrderOnly: true,
    expiryDate: '2027-12-31',
    isActive: true,
  },
];

export function BookScreen({
  onViewOrders,
  initialCouponCode,
  onClearInitialCoupon,
  deliveryLocation = null,
  onRequireSignIn,
  onBrowseServices,
  resumeCheckout = false,
  onCheckoutResumed,
  hasBottomTabBar = false,
}: BookScreenProps) {
  const insets = useSafeAreaInsets();
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
  const [selectedAddressZone, setSelectedAddressZone] = useState<PincodeCheck['zone'] | null>(null);
  const [selectedAddressServiceable, setSelectedAddressServiceable] = useState<boolean | null>(null);
  const [selectedAddressMessage, setSelectedAddressMessage] = useState<string | null>(null);
  const [checkingAddressServiceable, setCheckingAddressServiceable] = useState(false);
  const [draftServiceable, setDraftServiceable] = useState<boolean | null>(null);
  const [draftServiceMessage, setDraftServiceMessage] = useState<string | null>(null);
  const [checkingDraftService, setCheckingDraftService] = useState(false);
  const [slotDate, setSlotDate] = useState(localDateString());
  const [slots, setSlots] = useState<PickupSlot[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [expressTier, setExpressTier] = useState<ExpressTier>('REGULAR');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('ONLINE_RAZORPAY');
  const [useWallet, setUseWallet] = useState(true);
  const [walletBalance, setWalletBalance] = useState(0);
  const [activeSubscription, setActiveSubscription] = useState<CustomerSubscription | null>(null);
  const [useSubscription, setUseSubscription] = useState(true);
  const [couponCode, setCouponCode] = useState(initialCouponCode || '');
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [completedOrderId, setCompletedOrderId] = useState<string | null>(null);
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [presetImgErrors, setPresetImgErrors] = useState<Record<string, boolean>>({});
  const [pricingSettings, setPricingSettings] = useState<PricingSettings | null>(catalog?.settings || null);
  const [liveDeliveryCalc, setLiveDeliveryCalc] = useState<DeliveryFeeCalculation | null>(() => {
    return calculateLocalDeliveryFee({
      customerLat: deliveryLocation?.latitude,
      customerLng: deliveryLocation?.longitude,
      customerPincode: deliveryLocation?.pincode,
      subtotal: cartSummary.itemTotal,
      expressTier: 'REGULAR',
      pricingSettings: catalog?.settings || null,
    });
  });
  const [calculatingDeliveryFee, setCalculatingDeliveryFee] = useState<boolean>(false);
  const [availableCoupons, setAvailableCoupons] = useState<Coupon[]>([]);
  const [showCouponsModal, setShowCouponsModal] = useState(false);
  const [manualCouponInput, setManualCouponInput] = useState('');
  const [couponInputError, setCouponInputError] = useState('');
  const [couponErrorInline, setCouponErrorInline] = useState('');
  const [applyingCode, setApplyingCode] = useState<string | null>(null);
  const attemptedCouponRef = useRef<Set<string>>(new Set());
  const [paymentRetryModalVisible, setPaymentRetryModalVisible] = useState(false);
  const [paymentErrorInfo, setPaymentErrorInfo] = useState<ParsedPaymentError>({
    isCancelled: true,
    title: 'Payment Not Completed',
    message: 'You went back before completing the online payment.',
  });
  const [isRetryingOrder, setIsRetryingOrder] = useState(false);

  const activeCouponsList = useMemo(() => {
    if (Array.isArray(availableCoupons) && availableCoupons.length > 0) {
      return availableCoupons.filter((c) => c && c.isActive);
    }
    return DEFAULT_COUPONS;
  }, [availableCoupons]);

  useEffect(() => {
    if (session?.user?.id) {
      api.getWallet()
        .then((w) => setWalletBalance(w?.wallet?.balance ?? 0))
        .catch(() => undefined);
      api.getCustomerSubscriptions(session.user.id)
        .then((subs) => {
          if (Array.isArray(subs)) {
            const active = subs.find((s) => s && (s.isActive || s.status === 'ACTIVE'));
            setActiveSubscription(active || null);
          } else {
            setActiveSubscription(null);
          }
        })
        .catch(() => undefined);
    } else {
      setActiveSubscription(null);
    }
  }, [session?.user?.id]);


  const pickupDates = useMemo(() => Array.from({ length: 7 }, (_, index) => localDateString(index)), []);
  const safeAddresses = Array.isArray(addresses) ? addresses : [];
  const selectedAddress = safeAddresses.find((a) => a && a.id === selectedAddressId) || safeAddresses.find((a) => a && a.isDefault) || safeAddresses[0];
  const safeSlots = Array.isArray(slots) ? slots : [];
  const selectedSlot = safeSlots.find((s) => s && s.id === selectedSlotId && s.isAvailable && !s.isPast);

  // Validate serviceability when an address is selected or pre-filled
  useEffect(() => {
    const pin = selectedAddress?.pincode?.trim();
    if (!pin || pin.length < 6) {
      setSelectedAddressServiceable(null);
      setSelectedAddressMessage(null);
      setSelectedAddressZone(null);
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
          const zone = (res as any).zone || (res as any).data?.zone || null;
          setSelectedAddressZone(zone);
        }
      })
      .catch(() => {
        if (active) {
          setSelectedAddressServiceable(null);
          setSelectedAddressZone(null);
        }
      })
      .finally(() => {
        if (active) setCheckingAddressServiceable(false);
      });
    return () => { active = false; };
  }, [selectedAddress?.id, selectedAddress?.pincode, validatePincode]);

  // Validate serviceability for draft address when user is adding/typing a new address
  useEffect(() => {
    if (!addingAddress && addresses.length > 0) return;
    const pin = draft.pincode?.trim();
    if (!pin || pin.length < 6) {
      setDraftServiceable(null);
      setDraftServiceMessage(null);
      return;
    }
    let active = true;
    setCheckingDraftService(true);
    validatePincode(pin)
      .then((res) => {
        if (active) {
          const ok = Boolean(res.isServiceable || res.serviceable);
          setDraftServiceable(ok);
          setDraftServiceMessage(res.message || (ok ? 'Serviceable for doorstep pickup' : 'Not currently serviceable for pickup'));
        }
      })
      .catch(() => {
        if (active) {
          setDraftServiceable(null);
          setDraftServiceMessage(null);
        }
      })
      .finally(() => {
        if (active) setCheckingDraftService(false);
      });
    return () => { active = false; };
  }, [addingAddress, addresses.length, draft.pincode, validatePincode]);

  const draftDeliveryCalc = useMemo(() => {
    const pin = draft.pincode?.trim();
    const lat = typeof draft.latitude === 'number' && !isNaN(draft.latitude) && draft.latitude !== 0 ? draft.latitude : undefined;
    const lng = typeof draft.longitude === 'number' && !isNaN(draft.longitude) && draft.longitude !== 0 ? draft.longitude : undefined;
    return calculateLocalDeliveryFee({
      customerLat: lat,
      customerLng: lng,
      customerPincode: pin || undefined,
      subtotal: cartSummary.itemTotal,
      expressTier,
      pricingSettings,
    });
  }, [draft.latitude, draft.longitude, draft.pincode, cartSummary.itemTotal, expressTier, pricingSettings]);

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
      latitude: current.latitude ?? deliveryLocation.latitude,
      longitude: current.longitude ?? deliveryLocation.longitude,
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
    deliveryLocation?.latitude,
    deliveryLocation?.locality,
    deliveryLocation?.longitude,
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
        latitude: location.latitude,
        longitude: location.longitude,
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
      .then((items) => { if (Array.isArray(items) && items.length) setAvailableCoupons(items); })
      .catch(() => undefined);
  }, []);

  // Fetch live delivery fee from backend calculation engine based on customer coordinates/pincode
  useEffect(() => {
    const isAddingNew = addingAddress || addresses.length === 0;
    const rawLat = isAddingNew
      ? (draft.latitude || undefined)
      : (selectedAddress?.latitude ?? deliveryLocation?.latitude ?? (draft.latitude || undefined));
    const rawLng = isAddingNew
      ? (draft.longitude || undefined)
      : (selectedAddress?.longitude ?? deliveryLocation?.longitude ?? (draft.longitude || undefined));
    const lat = typeof rawLat === 'number' && !isNaN(rawLat) && rawLat !== 0 ? rawLat : undefined;
    const lng = typeof rawLng === 'number' && !isNaN(rawLng) && rawLng !== 0 ? rawLng : undefined;
    const pin = (isAddingNew
      ? draft.pincode
      : (selectedAddress?.pincode || deliveryLocation?.pincode || draft.pincode) || '').trim();

    // Instant local calculation: displays exact distance & slab immediately without waiting
    const localCalc = calculateLocalDeliveryFee({
      customerLat: lat,
      customerLng: lng,
      customerPincode: pin || undefined,
      subtotal: cartSummary.itemTotal,
      expressTier,
      pricingSettings,
    });
    setLiveDeliveryCalc(localCalc);

    if (!pin && !lat) return;

    let active = true;
    setCalculatingDeliveryFee(true);

    api.calculateDeliveryFee({
      customerLat: lat,
      customerLng: lng,
      customerPincode: pin || undefined,
      subtotal: cartSummary.itemTotal,
      isExpress: expressTier !== 'REGULAR',
      expressTier,
    })
      .then((res) => {
        const calc = (res as any)?.data ?? res;
        if (active && calc && typeof calc.deliveryFee === 'number') {
          setLiveDeliveryCalc(calc);
        }
      })
      .catch(() => {
        // Fallback to local calculation (already active)
      })
      .finally(() => {
        if (active) setCalculatingDeliveryFee(false);
      });

    return () => { active = false; };
  }, [
    addingAddress,
    addresses.length,
    selectedAddress?.id,
    selectedAddress?.latitude,
    selectedAddress?.longitude,
    selectedAddress?.pincode,
    deliveryLocation?.latitude,
    deliveryLocation?.longitude,
    deliveryLocation?.pincode,
    draft.latitude,
    draft.longitude,
    draft.pincode,
    cartSummary.itemTotal,
    expressTier,
    pricingSettings,
  ]);

  // Subscription Perks Calculation
  const subHasFreeDelivery = Boolean(
    useSubscription &&
    activeSubscription &&
    (activeSubscription.freePickupDelivery ||
      (Array.isArray(activeSubscription.features) &&
        activeSubscription.features.some(
          (f) => typeof f === 'string' && (f.toLowerCase().includes('free pickup') || f.toLowerCase().includes('zero delivery'))
        )))
  );

  const freeDeliveryThreshold = liveDeliveryCalc?.freeDeliveryThreshold ?? selectedAddressZone?.minFreeOrderValue ?? pricingSettings?.freeDeliveryThreshold ?? 499;
  const standardDeliveryFee = liveDeliveryCalc?.standardDeliveryFee ?? selectedAddressZone?.standardFee ?? pricingSettings?.standardDeliveryFee ?? 30;
  const isFreeDelivery = subHasFreeDelivery || (cartSummary.itemTotal >= freeDeliveryThreshold);
  const deliveryFee = isFreeDelivery
    ? 0
    : (liveDeliveryCalc?.deliveryFee ?? (cartSummary.itemTotal < 499 ? standardDeliveryFee : 0));

  // Subscription Weight Quota Calculation (Bulk KG + Garments estimated weight):
  const bulkKg = Number(cartSummary?.totalKg || 0);
  const safeCart = Array.isArray(cart) ? cart : [];
  const pieceCount = safeCart.filter((item) => item && item.pricingModel !== 'PER_KG').reduce((sum, item) => sum + (Number(item?.quantity) || 0), 0);
  const pieceKg = Number((pieceCount * 0.25).toFixed(1));
  const orderWeightKg = bulkKg > 0 ? Number((bulkKg + pieceKg).toFixed(1)) : Math.max(1, pieceKg);

  const subKgRemaining = (useSubscription && activeSubscription) ? (Number(activeSubscription.remainingKg) || 0) : 0;
  const subKgUsed = Math.min(subKgRemaining, orderWeightKg);
  const subQuotaFraction = orderWeightKg > 0 ? Math.min(1, subKgUsed / orderWeightKg) : 0;
  const subQuotaDiscount = (useSubscription && activeSubscription && subKgRemaining > 0)
    ? Math.min(cartSummary?.itemTotal || 0, Number(((cartSummary?.itemTotal || 0) * subQuotaFraction).toFixed(2)))
    : 0;

  const expressFeeFromSettings = liveDeliveryCalc?.expressDeliveryFee ?? pricingSettings?.expressDeliveryFee ?? 80;
  const sameDayFeeFromSettings = liveDeliveryCalc?.sameDayDeliveryFee ?? pricingSettings?.sameDayDeliveryFee ?? (expressFeeFromSettings * 2);

  const expressCharge = expressTier === 'EXPRESS_24H'
    ? expressFeeFromSettings
    : expressTier === 'SAME_DAY'
    ? sameDayFeeFromSettings
    : 0;

  const isGstEnabled = (liveDeliveryCalc?.isGstEnabled !== undefined) ? liveDeliveryCalc.isGstEnabled : (pricingSettings?.isGstEnabled !== false);
  const taxPercentage = isGstEnabled ? (liveDeliveryCalc?.taxPercentage ?? pricingSettings?.taxPercentage ?? 5) : 0;
  const preCouponTaxable = Math.max(0, cartSummary.itemTotal - subQuotaDiscount) + deliveryFee + expressCharge;
  const preCouponGst = Number((preCouponTaxable * (taxPercentage / 100)).toFixed(2));
  const preCouponTotal = Number((preCouponTaxable + preCouponGst).toFixed(2));

  const taxableAmount = Math.max(0, cartSummary.itemTotal - subQuotaDiscount - couponDiscount + deliveryFee + expressCharge);
  const gstCharge = Number((taxableAmount * (taxPercentage / 100)).toFixed(2));
  const preWalletTotal = Math.max(0, Number((taxableAmount + gstCharge).toFixed(2)));
  const walletDeduction = (useWallet && walletBalance > 0) ? Math.min(walletBalance, preWalletTotal) : 0;
  const finalPayable = Math.max(0, Number((preWalletTotal - walletDeduction).toFixed(2)));
  const totalSavings = subQuotaDiscount + couponDiscount + (isFreeDelivery ? standardDeliveryFee : 0) + walletDeduction;

  const deliveryDistanceNote = useMemo(() => {
    if (subHasFreeDelivery) {
      return '💎 Free Doorstep Delivery Unlocked via Active Membership';
    }
    if (isFreeDelivery) {
      return `🎉 Free delivery unlocked (Order ≥ ${money(freeDeliveryThreshold)})`;
    }
    if (liveDeliveryCalc?.breakdown) {
      return liveDeliveryCalc.breakdown;
    }
    if (liveDeliveryCalc?.distanceKm && liveDeliveryCalc.distanceKm > 0) {
      return `📍 Distance: ${liveDeliveryCalc.distanceKm} km from Central Hub`;
    }
    return `Standard delivery fee ${money(standardDeliveryFee)}`;
  }, [subHasFreeDelivery, isFreeDelivery, liveDeliveryCalc?.breakdown, liveDeliveryCalc?.distanceKm, freeDeliveryThreshold, standardDeliveryFee]);

  const handleApplyCoupon = async (code: string, isManual: boolean = true) => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      if (isManual) setCouponInputError('Please enter a valid coupon code.');
      return;
    }
    if (!cartSummary.itemTotal) {
      if (isManual) setCouponInputError('Please add garments to your bag first.');
      return;
    }

    setApplyingCode(cleanCode);
    setCouponInputError('');
    setCouponErrorInline('');

    try {
      const isFirstOrder = !(Array.isArray(orders) && orders.some((o) => o && o.currentStatus !== 'CANCELLED'));
      const res = await api.applyCoupon(cleanCode, preCouponTotal, isFirstOrder);
      if (!res.isValid) {
        setCouponApplied(false);
        setCouponDiscount(0);
        if (isManual) {
          setCouponInputError(res.message || 'That coupon is not valid for this order.');
        } else {
          setCouponErrorInline(res.message || '');
        }
        return;
      }
      setCouponCode(cleanCode);
      setCouponApplied(true);
      setCouponDiscount(Number(res.discount));
      setCouponInputError('');
      setCouponErrorInline('');
      setShowCouponsModal(false);
      setManualCouponInput('');
    } catch (err: any) {
      if (isManual) {
        setCouponInputError(err?.message || 'Could not validate coupon.');
      }
    } finally {
      setApplyingCode(null);
    }
  };

  // Safe auto-apply: only runs once per unique coupon code without popup alerts
  useEffect(() => {
    if (initialCouponCode && cartSummary.itemTotal > 0 && !couponApplied && pricingSettings) {
      const clean = initialCouponCode.trim().toUpperCase();
      if (!attemptedCouponRef.current.has(clean)) {
        attemptedCouponRef.current.add(clean);
        onClearInitialCoupon?.();
        handleApplyCoupon(clean, false);
      }
    }
  }, [initialCouponCode, cartSummary.itemTotal, pricingSettings, couponApplied]);

  // Dynamically recalculate percentage coupon or re-verify when cart items change
  useEffect(() => {
    if (!couponApplied || !couponCode || !pricingSettings) return;

    const isFirstOrder = !(Array.isArray(orders) && orders.some((o) => o && o.currentStatus !== 'CANCELLED'));
    api.applyCoupon(couponCode, preCouponTotal, isFirstOrder)
      .then((res) => {
        if (res.isValid) {
          setCouponDiscount(Number(res.discount));
        } else {
          setCouponApplied(false);
          setCouponDiscount(0);
          setCouponErrorInline(res.message || 'Coupon removed: minimum order value not met');
        }
      })
      .catch(() => undefined);
  }, [cartSummary.itemTotal, expressTier, pricingSettings]);

  useEffect(() => {
    let active = true;
    setLoadingSlots(true);
    getSlots(slotDate)
      .then((items) => {
        if (!active) return;
        const safeItems = Array.isArray(items) ? items : [];
        setSlots(safeItems);
        const firstAvailable = safeItems.find((s) => s && s.isAvailable && !s.isPast);
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
    setCouponInputError('');
    setCouponErrorInline('');
  };

  const handleLaunchOnlinePayment = (paymentOrder: RazorpayPaymentOrder): Promise<RazorpayResult> => {
    if (!session) return Promise.reject(new Error('Please sign in to pay.'));
    return payWithRazorpay(paymentOrder, session.user);
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

  const placeOrder = async (overrideMethod?: PaymentMethod) => {
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

    const effectiveMethod = overrideMethod || paymentMethod;
    if (overrideMethod) {
      setPaymentMethod(overrideMethod);
    }

    try {
      setIsRetryingOrder(true);
      const isZeroPayable = finalPayable === 0;
      const isSubscriptionPaid = isZeroPayable && subQuotaDiscount > 0;
      const isFullWalletPayment = isZeroPayable ? (!isSubscriptionPaid) : (useWallet && walletBalance >= preWalletTotal);
      const effectivePaymentMethod: PaymentMethod = isSubscriptionPaid
        ? 'SUBSCRIPTION'
        : isFullWalletPayment
        ? 'WALLET'
        : effectiveMethod;

      const result = await checkout({
        address: selectedAddress,
        slot: selectedSlot,
        expressTier,
        paymentMethod: effectivePaymentMethod,
        useWallet: useWallet && walletBalance > 0,
        customerSubscriptionId: (useSubscription && activeSubscription) ? activeSubscription.id : undefined,
        subscriptionKgUsed: (useSubscription && activeSubscription && subKgUsed > 0) ? subKgUsed : undefined,
        subscriptionDiscount: (useSubscription && activeSubscription && subQuotaDiscount > 0) ? subQuotaDiscount : undefined,
        walletDeduction: walletDeduction > 0 ? walletDeduction : undefined,
        couponCode: couponApplied ? couponCode : undefined,
        notes: notes.trim() || undefined,
        onLaunchOnlinePayment: !isZeroPayable && !isFullWalletPayment && effectiveMethod === 'ONLINE_RAZORPAY' ? handleLaunchOnlinePayment : undefined,
      });

      // Background refresh of wallet & subscription usage
      if (session?.user?.id) {
        api.getWallet().then((w) => setWalletBalance(w?.wallet?.balance ?? 0)).catch(() => undefined);
        api.getCustomerSubscriptions(session.user.id).then((subs) => {
          if (Array.isArray(subs)) {
            const active = subs.find((s) => s && (s.isActive || s.status === 'ACTIVE'));
            setActiveSubscription(active || null);
          }
        }).catch(() => undefined);
      }

      setPaymentRetryModalVisible(false);

      if (result.paymentOutcome === 'PAID' || result.paymentOutcome === 'COD') {
        setCompletedOrderId(result.order.id);
        setStage('SUCCESS');
      }
    } catch (error: any) {
      console.warn('[Checkout] Order placement or payment error:', error);
      const parsed = parsePaymentError(error);
      setPaymentErrorInfo(parsed);
      setPaymentRetryModalVisible(true);
    } finally {
      setIsRetryingOrder(false);
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
              <Text style={styles.successRowVal}>
                {shortDate(slotDate)} • {selectedSlot?.startTime && selectedSlot?.endTime ? `${selectedSlot.startTime} - ${selectedSlot.endTime}` : 'Flexible Collection Window'}
              </Text>
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
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
          contentContainerStyle={[styles.scrollContent, hasBottomTabBar && { paddingBottom: 190 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
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
                  <MaterialCommunityIcons name="shopping" size={44} color="#16A34A" />
                </View>
                <Text style={styles.luxuryEmptyTitle}>Your Laundry Bag is Empty</Text>
                <Text style={styles.luxuryEmptySubtitle}>
                  Choose from expert dry cleaning, everyday wash & fold, steam pressing, and premium fabric spa.
                </Text>

                {/* Primary CTA Button: Explore Garments */}
                <TouchableOpacity
                  style={styles.emptyPrimaryBtn}
                  onPress={onBrowseServices}
                  activeOpacity={0.85}
                  accessibilityLabel="Book a Service and Explore Garments"
                >
                  <MaterialCommunityIcons name="hanger" size={22} color="#FFFFFF" />
                  <Text style={styles.emptyPrimaryBtnText}>Explore Garments & Services</Text>
                  <MaterialCommunityIcons name="arrow-right" size={20} color="#FFFFFF" />
                </TouchableOpacity>

                {/* Secondary Horizontal Button: Browse Categories */}
                <TouchableOpacity
                  style={styles.emptySecondaryBtn}
                  onPress={onBrowseServices}
                  activeOpacity={0.85}
                  accessibilityLabel="Browse all categories"
                >
                  <View style={styles.emptySecondaryLeft}>
                    <View style={styles.emptySecondaryIconCircle}>
                      <MaterialCommunityIcons name="view-grid-outline" size={18} color="#16A34A" />
                    </View>
                    <Text style={styles.emptySecondaryBtnText}>Browse by Categories</Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color="#64748B" />
                </TouchableOpacity>

                {/* Trust Highlights */}
                <View style={styles.emptyTrustBox}>
                  <View style={styles.emptyTrustItem}>
                    <View style={[styles.emptyTrustIconWrap, { backgroundColor: '#DCFCE7' }]}>
                      <MaterialCommunityIcons name="moped" size={16} color="#16A34A" />
                    </View>
                    <Text style={styles.emptyTrustText}>Free Doorstep Pickup & Delivery</Text>
                  </View>
                  <View style={styles.emptyTrustItem}>
                    <View style={[styles.emptyTrustIconWrap, { backgroundColor: '#D1FAE5' }]}>
                      <MaterialCommunityIcons name="shield-check" size={16} color="#059669" />
                    </View>
                    <Text style={styles.emptyTrustText}>German Eco Care & 100% Color Protection</Text>
                  </View>
                  <View style={styles.emptyTrustItem}>
                    <View style={[styles.emptyTrustIconWrap, { backgroundColor: '#EFF6FF' }]}>
                      <MaterialCommunityIcons name="clock-fast" size={16} color="#2563EB" />
                    </View>
                    <Text style={styles.emptyTrustText}>Fast 24-48 Hour Turnaround Available</Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.cartItemsStack}>
                {safeCart.map((item) => {
                  const itemId = typeof item.id === 'string' ? item.id : String(item.id || '');
                  const isBulk = item.pricingModel === 'PER_KG' || item.clothId === 'bulk' || itemId.startsWith('bulk');
                  // Robust cloth ID extraction
                  let rawClothId = item.clothId;
                  if (!rawClothId) {
                    if (itemId.includes('-srv-')) {
                      rawClothId = itemId.split('-srv-')[0];
                    } else if (itemId.startsWith('cloth-')) {
                      const parts = itemId.split('-');
                      rawClothId = `${parts[0]}-${parts[1]}`;
                    } else {
                      rawClothId = itemId;
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

            {/* Dynamic Delivery Autocalculation Progress Bar */}
            {cart.length > 0 && (
              <View style={[styles.deliveryProgressCard, isFreeDelivery && styles.deliveryProgressCardFree]}>
                <View style={styles.deliveryProgressTop}>
                  <View style={[styles.deliveryProgressIconCircle, isFreeDelivery && styles.deliveryProgressIconCircleFree]}>
                    <MaterialCommunityIcons
                      name={isFreeDelivery ? 'truck-check' : 'truck-delivery'}
                      size={20}
                      color={isFreeDelivery ? '#16A34A' : '#0F766E'}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.deliveryProgressTitle, isFreeDelivery && { color: '#16A34A' }]}>
                      {isFreeDelivery
                        ? '🎉 Free Doorstep Delivery Unlocked!'
                        : `Add ${money(Math.max(0, Math.ceil(freeDeliveryThreshold - cartSummary.itemTotal)))} more for FREE Delivery`}
                    </Text>
                    <Text style={styles.deliveryProgressSub}>
                      {isFreeDelivery
                        ? `You saved ${money(standardDeliveryFee)} on pickup & delivery charges!`
                        : `Free doorstep delivery on orders above ${money(freeDeliveryThreshold)} across Hyderabad`}
                    </Text>
                  </View>
                </View>

                {!isFreeDelivery && (
                  <View style={styles.progressBarTrack}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${Math.min(100, Math.max(8, (cartSummary.itemTotal / freeDeliveryThreshold) * 100))}%` },
                      ]}
                    />
                  </View>
                )}
              </View>
            )}

            {/* ================= BIGBASKET-STYLE COUPONS & OFFERS SECTION ================= */}
            {cart.length > 0 && (
              <View style={styles.bbCouponCardContainer}>
                {!couponApplied ? (
                  <Pressable
                    style={({ pressed }) => [styles.bbCouponCard, pressed && { opacity: 0.92 }]}
                    onPress={() => {
                      setCouponInputError('');
                      setShowCouponsModal(true);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Avail offers and coupons"
                  >
                    <View style={styles.bbCouponLeft}>
                      <View style={styles.bbCouponIconCircle}>
                        <MaterialCommunityIcons name="ticket-percent" size={22} color="#16A34A" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.bbCouponTitle}>Avail Offers / Coupons</Text>
                          {activeCouponsList.length > 0 && (
                            <View style={styles.bbCouponCountBadge}>
                              <Text style={styles.bbCouponCountText}>{activeCouponsList.length} OFFERS</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.bbCouponSubtitle} numberOfLines={1}>
                          {couponErrorInline ? couponErrorInline : 'Tap to view exclusive promo codes and savings'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.bbCouponApplyAction}>
                      <Text style={styles.bbCouponApplyActionText}>View All</Text>
                      <MaterialCommunityIcons name="chevron-right" size={18} color="#16A34A" />
                    </View>
                  </Pressable>
                ) : (
                  <View style={styles.bbCouponAppliedCard}>
                    <View style={styles.bbCouponAppliedLeft}>
                      <View style={styles.bbCouponAppliedIconCircle}>
                        <MaterialCommunityIcons name="check-decagram" size={22} color="#16A34A" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={styles.bbCouponAppliedCode}>{couponCode}</Text>
                          <View style={styles.bbCouponAppliedBadge}>
                            <Text style={styles.bbCouponAppliedBadgeText}>APPLIED</Text>
                          </View>
                        </View>
                        <Text style={styles.bbCouponAppliedSaving}>
                          You saved ₹{couponDiscount} with this coupon! 🎉
                        </Text>
                      </View>
                    </View>
                    <View style={styles.bbCouponAppliedActions}>
                      <Pressable
                        onPress={() => {
                          setCouponInputError('');
                          setShowCouponsModal(true);
                        }}
                        hitSlop={8}
                        style={{ marginRight: 12 }}
                      >
                        <Text style={styles.bbCouponChangeText}>Change</Text>
                      </Pressable>
                      <Pressable onPress={handleRemoveCoupon} hitSlop={8}>
                        <Text style={styles.bbCouponRemoveText}>Remove</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* UPFRONT BILL BREAKDOWN IN STAGE 1 (BAG) */}
            {cart.length > 0 && (
              <Card style={styles.billCard}>
                <View style={styles.billCardHeaderRow}>
                  <Text style={styles.billCardTitle}>Bill Summary</Text>
                  <View style={styles.billSecureBadge}>
                    <MaterialCommunityIcons name="calculator-variant-outline" size={13} color="#166534" />
                    <Text style={styles.billSecureText}>Live Backend Rate</Text>
                  </View>
                </View>

                {/* 1. Items subtotal */}
                <View style={styles.billLine}>
                  <View>
                    <Text style={styles.billLineLabel}>Items Subtotal ({cartSummary.itemCount} items)</Text>
                    <Text style={styles.billLineSubtext}>Care & dry clean base charges</Text>
                  </View>
                  <Text style={styles.billLineVal}>{money(cartSummary.itemTotal)}</Text>
                </View>

                {/* 2. Pickup & Delivery fee */}
                <View style={styles.billLine}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text style={styles.billLineLabel}>Doorstep Pickup & Delivery</Text>
                      {liveDeliveryCalc?.distanceKm && liveDeliveryCalc.distanceKm > 0 ? (
                        <View style={{ backgroundColor: '#E0F2FE', paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 6 }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: '#0369A1' }}>
                            📍 {liveDeliveryCalc.distanceKm} km
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.billLineSubtext}>
                      {deliveryDistanceNote}
                    </Text>
                  </View>
                  {isFreeDelivery ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.billStrikethrough}>{money(standardDeliveryFee)}</Text>
                      <Text style={[styles.billLineVal, { color: '#16A34A', fontWeight: '800' }]}>FREE</Text>
                    </View>
                  ) : (
                    <Text style={styles.billLineVal}>{money(deliveryFee)}</Text>
                  )}
                </View>

                {/* 3. Coupon Discount */}
                {couponDiscount > 0 && (
                  <View style={styles.billLine}>
                    <View>
                      <Text style={[styles.billLineLabel, { color: '#16A34A' }]}>Coupon Discount ({couponCode})</Text>
                      <Text style={[styles.billLineSubtext, { color: '#15803D' }]}>Promo savings applied</Text>
                    </View>
                    <Text style={[styles.billLineVal, { color: '#16A34A', fontWeight: '800' }]}>-{money(couponDiscount)}</Text>
                  </View>
                )}

                {/* 4. GST */}
                <View style={styles.billLine}>
                  <View>
                    <Text style={styles.billLineLabel}>
                      {!isGstEnabled || taxPercentage === 0 ? 'GST (Temporarily Waived)' : `GST & Taxes (${taxPercentage}%)`}
                    </Text>
                    <Text style={styles.billLineSubtext}>{!isGstEnabled || taxPercentage === 0 ? 'GST waived by merchant' : `${taxPercentage}% GST on taxable subtotal`}</Text>
                  </View>
                  <Text style={[styles.billLineVal, (!isGstEnabled || taxPercentage === 0) && { color: '#16A34A' }]}>
                    {!isGstEnabled || taxPercentage === 0 ? '₹0 (0%)' : money(gstCharge)}
                  </Text>
                </View>

                <View style={styles.billDivider} />

                {/* Grand Total Row */}
                <View style={styles.billFinalRow}>
                  <View>
                    <Text style={styles.billGrandLabel}>Estimated Total</Text>
                    {totalSavings > 0 && (
                      <Text style={styles.billSavingsText}>🎉 You saved {money(totalSavings)} on this order</Text>
                    )}
                  </View>
                  <Text style={styles.billGrandVal}>{money(finalPayable)}</Text>
                </View>
              </Card>
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
            {/* PICKUP ADDRESS SELECTOR */}
            <View style={styles.stageTitleRow}>
              <Text style={styles.stageTitle}>Doorstep Pickup Address</Text>
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
                      onChangeText={(pincode) => {
                        const cleaned = pincode.replace(/[^0-9]/g, '').slice(0, 6);
                        const pinCoords = PINCODE_COORDINATES[cleaned];
                        setDraft((c) => ({
                          ...c,
                          pincode: cleaned,
                          latitude: pinCoords?.lat ?? c.latitude,
                          longitude: pinCoords?.lng ?? c.longitude,
                        }));
                      }}
                    />
                  </View>
                </View>

                {/* Live Delivery Calculation for New Address */}
                {draft.pincode.trim().length === 6 && (
                  <View style={styles.newAddressDeliveryPreview}>
                    {checkingDraftService ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <ActivityIndicator size="small" color="#F97316" />
                        <Text style={{ fontSize: 12, color: '#EA580C', fontWeight: '600' }}>
                          Checking serviceability & calculating delivery fee...
                        </Text>
                      </View>
                    ) : draftServiceable === false ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <MaterialCommunityIcons name="alert-circle" size={16} color="#DC2626" />
                        <Text style={{ fontSize: 12, color: '#DC2626', fontWeight: '700', flex: 1 }}>
                          {draftServiceMessage || `PIN ${draft.pincode} is not currently serviceable for pickup.`}
                        </Text>
                      </View>
                    ) : (
                      <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                            <MaterialCommunityIcons name="check-circle" size={15} color="#16A34A" />
                            <Text style={{ fontSize: 12, fontWeight: '800', color: '#166534' }}>
                              Serviceable for Doorstep Pickup
                            </Text>
                          </View>
                          <View style={[styles.addressPricePill, draftDeliveryCalc.isFreeDelivery && styles.addressPricePillFree]}>
                            <Text style={[styles.addressPricePillText, draftDeliveryCalc.isFreeDelivery && styles.addressPricePillTextFree]}>
                              {draftDeliveryCalc.isFreeDelivery ? 'FREE DELIVERY' : money(draftDeliveryCalc.deliveryFee)}
                            </Text>
                          </View>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                          <MaterialCommunityIcons name="truck-delivery" size={14} color="#15803D" />
                          <Text style={{ fontSize: 11, color: '#15803D', fontWeight: '600', flex: 1 }}>
                            {draftDeliveryCalc.isFreeDelivery
                              ? `Free delivery unlocked (Order ≥ ${money(draftDeliveryCalc.freeDeliveryThreshold)}) • ${draftDeliveryCalc.distanceKm} km from Hub`
                              : `Estimated distance: ${draftDeliveryCalc.distanceKm} km from Central Hub • Base ₹${draftDeliveryCalc.baseDeliveryFee}`}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                )}

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
                      if (draft.pincode.trim().length !== 6) {
                        Alert.alert('Invalid Pincode', 'Please enter a valid 6-digit pincode.');
                        return;
                      }
                      if (draftServiceable === false) {
                        Alert.alert('Not Serviceable', draftServiceMessage || `PIN ${draft.pincode} is not currently serviceable.`);
                        return;
                      }
                      const pinCoords = PINCODE_COORDINATES[draft.pincode.trim()];
                      const toSave = {
                        ...draft,
                        latitude: draft.latitude ?? pinCoords?.lat,
                        longitude: draft.longitude ?? pinCoords?.lng,
                        id: `addr_${Date.now()}`,
                      };
                      const saved = await saveAddress(toSave);
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
                  const itemCalc = calculateLocalDeliveryFee({
                    customerLat: item.latitude,
                    customerLng: item.longitude,
                    customerPincode: item.pincode,
                    subtotal: cartSummary.itemTotal,
                    expressTier,
                    pricingSettings,
                  });
                  const activeCalc = isSelected ? (liveDeliveryCalc || itemCalc) : itemCalc;

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

                      {isSelected ? (
                        <>
                          {selectedAddressServiceable === false ? (
                            <View style={styles.addressServiceNotice}>
                              <MaterialCommunityIcons name="alert-circle" size={14} color="#DC2626" />
                              <Text style={styles.addressServiceNoticeText}>
                                {selectedAddressMessage || `PIN ${item.pincode} is not currently serviceable for pickup.`}
                              </Text>
                            </View>
                          ) : (
                            <View style={styles.addressServiceAvailableNotice}>
                              <MaterialCommunityIcons name="check-circle" size={13} color="#16A34A" />
                              <Text style={styles.addressServiceAvailableText}>
                                Serviceable for doorstep pickup
                              </Text>
                            </View>
                          )}

                          {/* Selected Address Delivery Fee Card */}
                          <View style={[styles.addressDeliveryBox, activeCalc.isFreeDelivery && styles.addressDeliveryBoxFree]}>
                            <View style={styles.addressDelivMainRow}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                                <MaterialCommunityIcons
                                  name={activeCalc?.isFreeDelivery ? 'gift-outline' : 'truck-delivery'}
                                  size={18}
                                  color={activeCalc?.isFreeDelivery ? '#16A34A' : '#EA580C'}
                                />
                                <Text style={[styles.addressDelivLabel, Boolean(activeCalc?.isFreeDelivery) && { color: '#166534' }]}>
                                  {activeCalc?.isFreeDelivery ? 'Free Delivery Unlocked' : 'Delivery Fee'}
                                </Text>
                                {calculatingDeliveryFee && (
                                  <ActivityIndicator size="small" color="#F97316" style={{ transform: [{ scale: 0.7 }] }} />
                                )}
                              </View>
                              <View style={[styles.addressPricePill, Boolean(activeCalc?.isFreeDelivery) && styles.addressPricePillFree]}>
                                <Text style={[styles.addressPricePillText, Boolean(activeCalc?.isFreeDelivery) && styles.addressPricePillTextFree]}>
                                  {activeCalc?.isFreeDelivery ? 'FREE' : money(activeCalc?.deliveryFee ?? 0)}
                                </Text>
                              </View>
                            </View>
                            <Text style={[styles.addressDelivSubtext, Boolean(activeCalc?.isFreeDelivery) && { color: '#15803D' }]}>
                              {activeCalc?.isFreeDelivery
                                ? `Order ₹${cartSummary.itemTotal} ≥ ₹${activeCalc?.freeDeliveryThreshold ?? 499} • ${activeCalc?.distanceKm ?? 0} km from Central Hub`
                                : `📍 ${activeCalc?.distanceKm ?? 0} km from Central Hub • Base ${activeCalc?.baseDistanceKm ?? 3} km slab (₹${activeCalc?.baseDeliveryFee ?? 30})${((activeCalc?.distanceKm ?? 0) > (activeCalc?.baseDistanceKm ?? 3)) ? ` + ${((activeCalc?.distanceKm ?? 0) - (activeCalc?.baseDistanceKm ?? 3)).toFixed(1)} km × ₹${activeCalc?.perKmRateAfterBase ?? 10}/km` : ''}`}
                            </Text>
                          </View>
                        </>
                      ) : (
                        /* Unselected Address Delivery Preview */
                        <View style={styles.addressUnselectedDelivRow}>
                          <MaterialCommunityIcons name="truck-delivery-outline" size={14} color="#78716C" />
                          <Text style={styles.addressUnselectedDelivText}>
                            Delivery: {itemCalc?.isFreeDelivery ? 'FREE' : money(itemCalc?.deliveryFee ?? 0)} • {itemCalc?.distanceKm ?? 0} km from hub
                          </Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}

                <Pressable style={styles.addNewAddrBtn} onPress={() => setAddingAddress(true)}>
                  <MaterialCommunityIcons name="plus-circle-outline" size={18} color="#F97316" />
                  <Text style={styles.addNewAddrBtnText}>Add Another Pickup Address</Text>
                </Pressable>
              </View>
            )}

            {/* PICKUP DATE CALENDAR TILES */}
            <View style={[styles.stageTitleRow, { marginTop: 20 }]}>
              <Text style={styles.stageTitle}>Choose Pickup Date</Text>
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

            {/* PICKUP TIME SLOT GRID */}
            <View style={[styles.stageTitleRow, { marginTop: 20 }]}>
              <Text style={styles.stageTitle}>Select Pickup Time Slot</Text>
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

            {/* 4. CHOOSE DELIVERY SPEED */}
            <View style={styles.speedSection}>
              <View style={styles.speedSectionHeader}>
                <MaterialCommunityIcons name="lightning-bolt" size={16} color="#EA580C" />
                <Text style={styles.speedSectionTitle}>CHOOSE DELIVERY SPEED</Text>
              </View>

              <View style={styles.speedOptionsStack}>
                {/* 1. REGULAR (48h) */}
                <Pressable
                  style={[styles.speedOptionCard, expressTier === 'REGULAR' && styles.speedOptionCardActive]}
                  onPress={() => setExpressTier('REGULAR')}
                >
                  <View style={styles.speedOptionRadio}>
                    <MaterialCommunityIcons
                      name={expressTier === 'REGULAR' ? 'radiobox-marked' : 'radiobox-blank'}
                      size={18}
                      color={expressTier === 'REGULAR' ? '#16A34A' : '#94A3B8'}
                    />
                  </View>
                  <View style={styles.speedOptionInfo}>
                    <View style={styles.speedOptionTitleRow}>
                      <Text style={[styles.speedOptionName, expressTier === 'REGULAR' && styles.speedOptionNameActive]}>
                        Standard Care (48 Hours)
                      </Text>
                      <View style={[styles.speedFeeBadge, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
                        <Text style={[styles.speedFeeText, { color: '#16A34A' }]}>
                          {isFreeDelivery ? 'FREE' : money(standardDeliveryFee)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.speedOptionSub}>
                      Eco wash & industrial steam pressing • 2-day return
                    </Text>
                  </View>
                </Pressable>

                {/* 2. EXPRESS_24H (24h) */}
                <Pressable
                  style={[styles.speedOptionCard, expressTier === 'EXPRESS_24H' && styles.speedOptionCardActiveExpress]}
                  onPress={() => setExpressTier('EXPRESS_24H')}
                >
                  <View style={styles.speedOptionRadio}>
                    <MaterialCommunityIcons
                      name={expressTier === 'EXPRESS_24H' ? 'radiobox-marked' : 'radiobox-blank'}
                      size={18}
                      color={expressTier === 'EXPRESS_24H' ? '#EA580C' : '#94A3B8'}
                    />
                  </View>
                  <View style={styles.speedOptionInfo}>
                    <View style={styles.speedOptionTitleRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <Text style={[styles.speedOptionName, expressTier === 'EXPRESS_24H' && styles.speedOptionNameActiveExpress]}>
                          ⚡ Express 24h Return
                        </Text>
                        <View style={styles.popularSpeedTag}>
                          <Text style={styles.popularSpeedTagText}>POPULAR</Text>
                        </View>
                      </View>
                      <View style={[styles.speedFeeBadge, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]}>
                        <Text style={[styles.speedFeeText, { color: '#EA580C' }]}>
                          +{money(expressFeeFromSettings)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.speedOptionSub}>
                      Priority workshop queue • Next-day morning return
                    </Text>
                  </View>
                </Pressable>

                {/* 3. SAME_DAY (12h) */}
                <Pressable
                  style={[styles.speedOptionCard, expressTier === 'SAME_DAY' && styles.speedOptionCardActiveSameDay]}
                  onPress={() => setExpressTier('SAME_DAY')}
                >
                  <View style={styles.speedOptionRadio}>
                    <MaterialCommunityIcons
                      name={expressTier === 'SAME_DAY' ? 'radiobox-marked' : 'radiobox-blank'}
                      size={18}
                      color={expressTier === 'SAME_DAY' ? '#DC2626' : '#94A3B8'}
                    />
                  </View>
                  <View style={styles.speedOptionInfo}>
                    <View style={styles.speedOptionTitleRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <Text style={[styles.speedOptionName, expressTier === 'SAME_DAY' && styles.speedOptionNameActiveSameDay]}>
                          🚀 Same-Day Emergency (12h)
                        </Text>
                      </View>
                      <View style={[styles.speedFeeBadge, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                        <Text style={[styles.speedFeeText, { color: '#DC2626' }]}>
                          +{money(sameDayFeeFromSettings)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.speedOptionSub}>
                      Morning pickup • Emergency rush return by tonight
                    </Text>
                  </View>
                </Pressable>
              </View>
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
                  <Text style={styles.overviewVal}>{selectedAddress?.street ? `${selectedAddress.street}, ${selectedAddress.city || 'Hyderabad'}` : 'Doorstep Pickup Point'}</Text>
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
                  <Text style={styles.overviewVal}>{shortDate(slotDate)} • {selectedSlot?.startTime && selectedSlot?.endTime ? `${selectedSlot.startTime} - ${selectedSlot.endTime}` : 'Flexible Collection Window'}</Text>
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
                      <Text style={styles.overviewVal}>⚡ 24-Hour Express Return</Text>
                    </View>
                  </View>
                </>
              )}

              {expressTier === 'SAME_DAY' && (
                <>
                  <View style={styles.overviewDivider} />
                  <View style={styles.overviewRow}>
                    <MaterialCommunityIcons name="rocket-launch" size={18} color="#DC2626" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.overviewLabel}>Speed</Text>
                      <Text style={styles.overviewVal}>🚀 12-Hour Same-Day Rush</Text>
                    </View>
                  </View>
                </>
              )}
            </Card>

            {/* VIP MEMBERSHIP PERKS CARD (If user has an active membership) */}
            {activeSubscription && (
              <View style={styles.subPerksCard}>
                <Pressable
                  style={styles.subPerksHeaderRow}
                  onPress={() => setUseSubscription(!useSubscription)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
                    <MaterialCommunityIcons
                      name={useSubscription ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                      size={24}
                      color="#059669"
                    />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={styles.subPerksTitle}>{activeSubscription.planName}</Text>
                        <View style={styles.subPerksActiveBadge}>
                          <Text style={styles.subPerksActiveBadgeText}>ACTIVE MEMBER</Text>
                        </View>
                      </View>
                      <Text style={styles.subPerksSubtitle}>
                        {useSubscription ? 'Membership benefits & quota applied' : 'Tap to apply membership perks'}
                      </Text>
                    </View>
                  </View>
                  <MaterialCommunityIcons name="crown" size={26} color="#D97706" />
                </Pressable>

                {useSubscription && (
                  <View style={styles.subPerksBody}>
                    <View style={styles.subPerksDivider} />
                    <View style={styles.subPerksGrid}>
                      <View style={styles.subPerksItem}>
                        <MaterialCommunityIcons name="scale-bathroom" size={16} color="#059669" />
                        <Text style={styles.subPerksItemText}>
                          Quota: <Text style={{ fontWeight: '800' }}>{activeSubscription.remainingKg ?? 0} KG</Text> available
                        </Text>
                      </View>

                      {subKgUsed > 0 && (
                        <View style={styles.subPerksItem}>
                          <MaterialCommunityIcons name="check-bold" size={16} color="#059669" />
                          <Text style={styles.subPerksItemText}>
                            Applying <Text style={{ fontWeight: '800' }}>{subKgUsed} KG</Text> for this order
                          </Text>
                        </View>
                      )}

                      {subHasFreeDelivery && (
                        <View style={styles.subPerksItem}>
                          <MaterialCommunityIcons name="truck-fast-outline" size={16} color="#059669" />
                          <Text style={[styles.subPerksItemText, { fontWeight: '800', color: '#059669' }]}>
                            100% Free Doorstep Delivery
                          </Text>
                        </View>
                      )}
                    </View>

                    {subQuotaDiscount > 0 && (
                      <View style={styles.subPerksSavingPill}>
                        <MaterialCommunityIcons name="party-popper" size={16} color="#047857" />
                        <Text style={styles.subPerksSavingText}>
                          Quota covers {money(subQuotaDiscount)} of your laundry cost!
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* BIGBASKET-STYLE COUPONS & OFFERS SECTION */}
            <View style={styles.bbCouponCardContainer}>
              {!couponApplied ? (
                <Pressable
                  style={({ pressed }) => [styles.bbCouponCard, pressed && { opacity: 0.92 }]}
                  onPress={() => {
                    setCouponInputError('');
                    setShowCouponsModal(true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Avail offers and coupons"
                >
                  <View style={styles.bbCouponLeft}>
                    <View style={styles.bbCouponIconCircle}>
                      <MaterialCommunityIcons name="ticket-percent" size={22} color="#16A34A" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.bbCouponTitle}>Avail Offers / Coupons</Text>
                        {activeCouponsList.length > 0 && (
                          <View style={styles.bbCouponCountBadge}>
                            <Text style={styles.bbCouponCountText}>{activeCouponsList.length} OFFERS</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.bbCouponSubtitle} numberOfLines={1}>
                        {couponErrorInline ? couponErrorInline : 'Tap to view exclusive promo codes and savings'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.bbCouponApplyAction}>
                    <Text style={styles.bbCouponApplyActionText}>View All</Text>
                    <MaterialCommunityIcons name="chevron-right" size={18} color="#16A34A" />
                  </View>
                </Pressable>
              ) : (
                <View style={styles.bbCouponAppliedCard}>
                  <View style={styles.bbCouponAppliedLeft}>
                    <View style={styles.bbCouponAppliedIconCircle}>
                      <MaterialCommunityIcons name="check-decagram" size={22} color="#16A34A" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={styles.bbCouponAppliedCode}>{couponCode}</Text>
                        <View style={styles.bbCouponAppliedBadge}>
                          <Text style={styles.bbCouponAppliedBadgeText}>APPLIED</Text>
                        </View>
                      </View>
                      <Text style={styles.bbCouponAppliedSaving}>
                        You saved ₹{couponDiscount} with this coupon! 🎉
                      </Text>
                    </View>
                  </View>
                  <View style={styles.bbCouponAppliedActions}>
                    <Pressable
                      onPress={() => {
                        setCouponInputError('');
                        setShowCouponsModal(true);
                      }}
                      hitSlop={8}
                      style={{ marginRight: 12 }}
                    >
                      <Text style={styles.bbCouponChangeText}>Change</Text>
                    </Pressable>
                    <Pressable onPress={handleRemoveCoupon} hitSlop={8}>
                      <Text style={styles.bbCouponRemoveText}>Remove</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>

            {/* LAUNDRYFRESH WALLET DEDUCTION */}
            {walletBalance > 0 && (
              <View style={styles.walletBox}>
                <Pressable
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                  onPress={() => setUseWallet(!useWallet)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
                    <MaterialCommunityIcons
                      name={useWallet ? 'checkbox-marked' : 'checkbox-blank-outline'}
                      size={24}
                      color="#16A34A"
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: '#166534' }}>
                        Use LaundryFresh Wallet
                      </Text>
                      <Text style={{ fontSize: 12, color: '#15803D', marginTop: 2 }}>
                        Balance: ₹{walletBalance.toFixed(2)} {useWallet && walletDeduction > 0 ? `• Deducting ₹${walletDeduction.toFixed(2)}` : ''}
                      </Text>
                    </View>
                  </View>
                  <MaterialCommunityIcons name="wallet-giftcard" size={26} color="#16A34A" />
                </Pressable>

                {useWallet && walletDeduction >= preWalletTotal && preWalletTotal > 0 && (
                  <View style={{ marginTop: 10, backgroundColor: '#DCFCE7', padding: 8, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#16A34A" />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#166534' }}>
                      100% of order covered by your wallet balance!
                    </Text>
                  </View>
                )}

                {useWallet && walletDeduction > 0 && finalPayable > 0 && (
                  <View style={{ marginTop: 10, backgroundColor: '#EFF6FF', padding: 8, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <MaterialCommunityIcons name="swap-horizontal-bold" size={16} color="#2563EB" />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#1D4ED8' }}>
                      Split Payment: ₹{walletDeduction.toFixed(2)} from wallet + remaining ₹{finalPayable.toFixed(2)} below
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* PAYMENT METHOD SELECTION */}
            {finalPayable === 0 ? (
              <View style={styles.zeroPayableBanner}>
                <View style={styles.zeroPayableIconWrap}>
                  <MaterialCommunityIcons name="check-decagram" size={28} color="#059669" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.zeroPayableTitle}>100% Covered — No Payment Needed</Text>
                  <Text style={styles.zeroPayableSubtitle}>
                    {subQuotaDiscount > 0 && walletDeduction > 0
                      ? 'Your order is completely covered by Membership Quota & Wallet Balance!'
                      : subQuotaDiscount > 0
                      ? 'Your order is completely covered by your Membership Quota!'
                      : 'Your order is completely covered by your LaundryFresh Wallet!'}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.paymentSection}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <Text style={styles.paymentHeaderTitle}>
                    {walletDeduction > 0 ? `Pay Remaining: ${money(finalPayable)}` : 'Payment Method'}
                  </Text>
                  {walletDeduction > 0 && (
                    <View style={styles.splitPayTag}>
                      <Text style={styles.splitPayTagText}>SPLIT PAYMENT</Text>
                    </View>
                  )}
                </View>

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
                    <Text style={styles.paymentTileSub}>
                      {walletDeduction > 0
                        ? `Pay remaining ${money(finalPayable)} via secure Razorpay Gateway`
                        : '256-Bit Encrypted Secure Razorpay Gateway'}
                    </Text>
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
                    <Text style={styles.paymentTileSub}>
                      {walletDeduction > 0
                        ? `Pay remaining ${money(finalPayable)} to rider upon delivery`
                        : 'Pay rider after verifying freshly washed clothes'}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="cash" size={18} color="#F97316" />
                </Pressable>
              </View>
            )}

            {/* ITEMIZED BILL SUMMARY */}
            <Card style={styles.billCard}>
              <View style={styles.billCardHeaderRow}>
                <Text style={styles.billCardTitle}>Bill Breakdown</Text>
                <View style={styles.billSecureBadge}>
                  <MaterialCommunityIcons name="shield-check" size={13} color="#166534" />
                  <Text style={styles.billSecureText}>100% Transparent</Text>
                </View>
              </View>

              {/* 1. Items subtotal */}
              <View style={styles.billLine}>
                <View>
                  <Text style={styles.billLineLabel}>Items Subtotal ({cartSummary.itemCount} items)</Text>
                  <Text style={styles.billLineSubtext}>Care & dry clean base charges</Text>
                </View>
                <Text style={styles.billLineVal}>{money(cartSummary.itemTotal)}</Text>
              </View>

              {/* 2. Subscription Quota Applied */}
              {subQuotaDiscount > 0 && (
                <View style={styles.billLine}>
                  <View>
                    <Text style={[styles.billLineLabel, { color: '#059669', fontWeight: '700' }]}>
                      💎 Subscription Quota ({subKgUsed} KG)
                    </Text>
                    <Text style={[styles.billLineSubtext, { color: '#047857' }]}>
                      Covered by {activeSubscription?.planName || 'Membership'}
                    </Text>
                  </View>
                  <Text style={[styles.billLineVal, { color: '#059669', fontWeight: '800' }]}>
                    -{money(subQuotaDiscount)}
                  </Text>
                </View>
              )}

              {/* 3. Pickup & Delivery fee */}
              <View style={styles.billLine}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={styles.billLineLabel}>Doorstep Pickup & Delivery</Text>
                    {liveDeliveryCalc?.distanceKm && liveDeliveryCalc.distanceKm > 0 ? (
                      <View style={{ backgroundColor: '#E0F2FE', paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 6 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#0369A1' }}>
                          📍 {liveDeliveryCalc.distanceKm} km
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.billLineSubtext}>
                    {deliveryDistanceNote}
                  </Text>
                </View>
                {isFreeDelivery ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.billStrikethrough}>{money(standardDeliveryFee)}</Text>
                    <Text style={[styles.billLineVal, { color: '#16A34A', fontWeight: '800' }]}>
                      {subHasFreeDelivery ? 'FREE (Member Perk)' : 'FREE'}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.billLineVal}>{money(deliveryFee)}</Text>
                )}
              </View>

              {/* 4. Express Delivery Surcharge */}
              {expressCharge > 0 && (
                <View style={styles.billLine}>
                  <View>
                    <Text style={styles.billLineLabel}>
                      {expressTier === 'SAME_DAY' ? '12H Same-Day Emergency Surcharge' : '24H Express Delivery Surcharge'}
                    </Text>
                    <Text style={styles.billLineSubtext}>
                      {expressTier === 'SAME_DAY' ? 'Rush processing & emergency courier delivery' : 'Priority queue & 24h express turnaround'}
                    </Text>
                  </View>
                  <Text style={styles.billLineVal}>+{money(expressCharge)}</Text>
                </View>
              )}

              {/* 5. Coupon Discount */}
              {couponDiscount > 0 && (
                <View style={styles.billLine}>
                  <View>
                    <Text style={[styles.billLineLabel, { color: '#16A34A' }]}>Coupon Discount ({couponCode})</Text>
                    <Text style={[styles.billLineSubtext, { color: '#15803D' }]}>Promo savings applied</Text>
                  </View>
                  <Text style={[styles.billLineVal, { color: '#16A34A', fontWeight: '800' }]}>-{money(couponDiscount)}</Text>
                </View>
              )}

              {/* 6. GST */}
              <View style={styles.billLine}>
                <View>
                  <Text style={styles.billLineLabel}>
                    {!isGstEnabled || taxPercentage === 0 ? 'GST (Temporarily Waived)' : `GST & Taxes (${taxPercentage}%)`}
                  </Text>
                  <Text style={styles.billLineSubtext}>{!isGstEnabled || taxPercentage === 0 ? 'GST waived by merchant' : `${taxPercentage}% GST on taxable order amount`}</Text>
                </View>
                <Text style={[styles.billLineVal, (!isGstEnabled || taxPercentage === 0) && { color: '#16A34A' }]}>
                  {!isGstEnabled || taxPercentage === 0 ? '₹0 (0%)' : money(gstCharge)}
                </Text>
              </View>

              {/* 7. Wallet */}
              {walletDeduction > 0 && (
                <View style={styles.billLine}>
                  <View>
                    <Text style={[styles.billLineLabel, { color: '#16A34A', fontWeight: '700' }]}>
                      LaundryFresh Wallet Used
                    </Text>
                    <Text style={[styles.billLineSubtext, { color: '#15803D' }]}>
                      Deducted from ₹{walletBalance.toFixed(2)} balance
                    </Text>
                  </View>
                  <Text style={[styles.billLineVal, { color: '#16A34A', fontWeight: '800' }]}>
                    -₹{walletDeduction.toFixed(2)}
                  </Text>
                </View>
              )}

              <View style={styles.billDivider} />

              {/* Grand Total Row */}
              <View style={styles.billFinalRow}>
                <View>
                  <Text style={styles.billGrandLabel}>Total Payable</Text>
                  {totalSavings > 0 && (
                    <Text style={styles.billSavingsText}>🎉 You saved {money(totalSavings)} on this order</Text>
                  )}
                </View>
                <Text style={styles.billGrandVal}>{money(finalPayable)}</Text>
              </View>
            </Card>
          </View>
        )}
      </ScrollView>

      {/* Keep the empty-bag view flush with the app tab bar. Its explore action
          already appears in the empty state above, so a second footer only creates
          an empty white strip. */}
      {!(stage === 'BAG' && cart.length === 0) && (
      <View style={[styles.stickyFooter, hasBottomTabBar && { bottom: Platform.OS === 'ios' ? 76 : 66 }]}>
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
              <Text style={styles.footerPriceLabel}>
                {finalPayable === 0 ? 'Total Due' : walletDeduction > 0 ? 'Payable Now' : 'Final Amount'}
              </Text>
              <Text style={styles.footerPriceVal}>{money(finalPayable)}</Text>
              {stage !== 'BAG' && (
                <Text style={[styles.footerPriceSub, isFreeDelivery && { color: '#16A34A' }]}>
                  {subHasFreeDelivery
                    ? '💎 Member Free Delivery'
                    : isFreeDelivery
                    ? '🎉 Free delivery'
                    : `Incl. ${money(deliveryFee)} delivery`}
                </Text>
              )}
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
            onPress={() => placeOrder()}
            disabled={isCheckingOut}
          >
            <MaterialCommunityIcons
              name={finalPayable === 0 ? 'check-decagram' : 'lock'}
              size={16}
              color="#FFFFFF"
            />
            <Text style={styles.footerPrimaryBtnText}>
              {isCheckingOut
                ? 'Scheduling Pickup...'
                : finalPayable === 0
                ? 'Confirm Order (₹0 • 100% Covered)'
                : walletDeduction > 0
                ? `Pay Remaining ${money(finalPayable)} & Book`
                : paymentMethod === 'COD'
                ? 'Confirm & Place Order (COD)'
                : `Pay ${money(finalPayable)} & Place Order`}
            </Text>
            <MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" />
          </Pressable>
        )}
      </View>
      )}

      {/* ================= BIGBASKET-STYLE AVAILABLE COUPONS BOTTOM SHEET MODAL ================= */}
      <Modal
        visible={showCouponsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowCouponsModal(false);
          setCouponInputError('');
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.bbModalOverlay}
        >
          <Pressable
            style={styles.bbModalBackdrop}
            onPress={() => {
              setShowCouponsModal(false);
              setCouponInputError('');
            }}
          />
          <View style={styles.bbModalSheet}>
            {/* Top Drag Handle */}
            <View style={styles.bbSheetHandle} />

            {/* Modal Header */}
            <View style={styles.bbModalHeader}>
              <View>
                <Text style={styles.bbModalTitle}>Apply Coupon</Text>
                <Text style={styles.bbModalSubtitle}>
                  Order Total: {money(preCouponTotal)}
                </Text>
              </View>
              <Pressable
                style={styles.bbModalCloseBtn}
                onPress={() => {
                  setShowCouponsModal(false);
                  setCouponInputError('');
                }}
                hitSlop={10}
              >
                <MaterialCommunityIcons name="close" size={20} color="#64748B" />
              </Pressable>
            </View>

            {/* Manual Coupon Code Input Box */}
            <View style={styles.bbInputSection}>
              <View style={styles.bbInputRow}>
                <MaterialCommunityIcons name="ticket-outline" size={20} color="#94A3B8" style={{ marginLeft: 12 }} />
                <TextInput
                  style={styles.bbTextInput}
                  placeholder="Enter coupon code"
                  placeholderTextColor="#94A3B8"
                  value={manualCouponInput}
                  onChangeText={(text) => {
                    setManualCouponInput(text.toUpperCase());
                    setCouponInputError('');
                  }}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
                <Pressable
                  style={[
                    styles.bbInputApplyBtn,
                    !manualCouponInput.trim() && styles.bbInputApplyBtnDisabled,
                  ]}
                  disabled={!manualCouponInput.trim() || applyingCode !== null}
                  onPress={() => handleApplyCoupon(manualCouponInput, true)}
                >
                  {applyingCode === manualCouponInput.trim() ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.bbInputApplyText}>APPLY</Text>
                  )}
                </Pressable>
              </View>
              {couponInputError ? (
                <View style={styles.bbInputErrorRow}>
                  <MaterialCommunityIcons name="alert-circle-outline" size={14} color="#EF4444" />
                  <Text style={styles.bbInputErrorText}>{couponInputError}</Text>
                </View>
              ) : null}
            </View>

            {/* Coupons List Header */}
            <View style={styles.bbListHeader}>
              <Text style={styles.bbListTitle}>AVAILABLE OFFERS & COUPONS</Text>
            </View>

            <ScrollView
              style={styles.bbCouponsScroll}
              contentContainerStyle={{ paddingBottom: 32 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {(Array.isArray(activeCouponsList) ? activeCouponsList : []).map((coupon) => {
                const isCurrent = couponApplied && couponCode === coupon.code;
                const minVal = Number(coupon.minOrderValue || 0);
                const isFirstOrder = !(Array.isArray(orders) && orders.some((o) => o && o.currentStatus !== 'CANCELLED'));
                const isFirstOrderOk = !coupon.firstOrderOnly || isFirstOrder;
                const isMinOrderOk = Number(preCouponTotal || 0) >= minVal;
                const isEligible = Boolean(isFirstOrderOk && isMinOrderOk);

                return (
                  <TouchableOpacity
                    key={coupon.code}
                    activeOpacity={isEligible && !isCurrent ? 0.88 : 1}
                    onPress={() => {
                      if (isEligible && !isCurrent && applyingCode === null) {
                        handleApplyCoupon(coupon.code, true);
                      }
                    }}
                    style={[
                      styles.bbTicketCard,
                      isCurrent && styles.bbTicketCardCurrent,
                      !isEligible && styles.bbTicketCardDisabled,
                    ]}
                  >
                    {/* Ticket notches */}
                    <View style={styles.bbTicketNotchTop} />
                    <View style={styles.bbTicketNotchBottom} />

                    <View style={styles.bbTicketMain}>
                      {/* Code badge + Action button */}
                      <View style={styles.bbTicketTopRow}>
                        <View style={styles.bbCodeBadge}>
                          <MaterialCommunityIcons name="ticket-percent-outline" size={14} color="#16A34A" />
                          <Text style={styles.bbTicketCodeText}>{coupon.code}</Text>
                        </View>

                        {isCurrent ? (
                          <TouchableOpacity
                            style={styles.bbAppliedPill}
                            onPress={handleRemoveCoupon}
                            activeOpacity={0.7}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <MaterialCommunityIcons name="check" size={14} color="#16A34A" />
                            <Text style={styles.bbAppliedPillText}>APPLIED</Text>
                            <Text style={styles.bbRemoveInlineText}>• Remove</Text>
                          </TouchableOpacity>
                        ) : isEligible ? (
                          <TouchableOpacity
                            style={styles.bbTicketApplyBtn}
                            disabled={applyingCode !== null}
                            onPress={() => handleApplyCoupon(coupon.code, true)}
                            activeOpacity={0.8}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            {applyingCode === coupon.code ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <Text style={styles.bbTicketApplyText}>APPLY</Text>
                            )}
                          </TouchableOpacity>
                        ) : (
                          <View style={styles.bbTicketIneligiblePill}>
                            <Text style={styles.bbTicketIneligiblePillText}>NOT ELIGIBLE</Text>
                          </View>
                        )}
                      </View>

                      {/* Savings Headline */}
                      <Text style={styles.bbSavingHeadline}>
                        Save {coupon.discountType === 'PERCENTAGE' ? `${coupon.discountValue}%` : `₹${coupon.discountValue}`}
                        {coupon.maxDiscountCap ? ` (up to ₹${coupon.maxDiscountCap})` : ''} on this order
                      </Text>

                      {/* Description */}
                      <Text style={styles.bbTicketDesc}>{coupon.description}</Text>

                      {/* Terms / Conditions footer */}
                      <View style={styles.bbTicketFooter}>
                        <Text style={styles.bbTicketMinOrder}>
                          • Min. cart value: ₹{coupon.minOrderValue}
                        </Text>
                        {coupon.firstOrderOnly && (
                          <Text style={styles.bbTicketFirstOrder}>
                            • Valid on 1st order only
                          </Text>
                        )}
                      </View>

                      {/* Real-time Ineligibility Reason Banner */}
                      {!isEligible && (
                        <View style={styles.bbIneligibilityNotice}>
                          {!isFirstOrderOk ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <MaterialCommunityIcons name="account-cancel-outline" size={14} color="#DC2626" />
                              <Text style={styles.bbIneligibilityNoticeText}>
                                Valid on first order only (Already used)
                              </Text>
                            </View>
                          ) : !isMinOrderOk ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <MaterialCommunityIcons name="basket-plus-outline" size={14} color="#EA580C" />
                              <Text style={styles.bbIneligibilityNoticeText}>
                                Add items worth ₹{Math.max(0, coupon.minOrderValue - Math.round(preCouponTotal))} more to unlock
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ================= SWIGGY/ZEPTO-STYLE PAYMENT RETRY / CANCELLATION MODAL ================= */}
      <Modal
        visible={paymentRetryModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setPaymentRetryModalVisible(false)}
      >
        <View style={styles.payRetryOverlay}>
          <Pressable
            style={styles.payRetryBackdrop}
            onPress={() => setPaymentRetryModalVisible(false)}
          />
          <View style={styles.payRetrySheet}>
            {/* Sheet Handle */}
            <View style={styles.payRetryHandle} />

            <ScrollView
              bounces={false}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[styles.payRetryScrollContent, { paddingBottom: Math.max(insets.bottom, 24) }]}
            >
              {/* Icon & Title */}
              <View style={styles.payRetryHeader}>
                <View
                  style={[
                    styles.payRetryIconCircle,
                    paymentErrorInfo.isCancelled
                      ? { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }
                      : { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={paymentErrorInfo.isCancelled ? 'credit-card-refresh-outline' : 'alert-circle-outline'}
                    size={30}
                    color={paymentErrorInfo.isCancelled ? '#EA580C' : '#DC2626'}
                  />
                </View>

                <Text style={styles.payRetryTitle}>
                  {paymentErrorInfo.title || (paymentErrorInfo.isCancelled ? 'Payment Not Completed' : 'Payment Failed')}
                </Text>

                <Text style={styles.payRetrySubtitle}>
                  {paymentErrorInfo.message || 'You went back before completing the online payment.'}
                </Text>
              </View>

              {/* Order Snapshot Card */}
              <View style={styles.payRetryOrderCard}>
                <View style={styles.payRetryOrderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <MaterialCommunityIcons name="shopping-outline" size={18} color="#64748B" />
                    <Text style={styles.payRetryOrderLabel}>Total Order Amount</Text>
                  </View>
                  <Text style={styles.payRetryOrderAmount}>{money(finalPayable)}</Text>
                </View>

                <View style={styles.payRetryOrderDivider} />

                <View style={styles.payRetryOrderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <MaterialCommunityIcons name="clock-outline" size={18} color="#64748B" />
                    <Text style={styles.payRetryOrderSublabel}>Pickup Slot</Text>
                  </View>
                  <Text style={styles.payRetryOrderSubval}>
                    {shortDate(slotDate)} • {selectedSlot?.startTime && selectedSlot?.endTime ? `${selectedSlot.startTime} - ${selectedSlot.endTime}` : 'Flexible Collection Window'}
                  </Text>
                </View>

                <View style={styles.payRetrySafePill}>
                  <MaterialCommunityIcons name="shield-check" size={15} color="#16A34A" />
                  <Text style={styles.payRetrySafeText}>
                    Your laundry bag items are completely safe.
                  </Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.payRetryActions}>
                {/* Option 1: Retry Online Payment */}
                <Pressable
                  style={({ pressed }) => [
                    styles.payRetryPrimaryBtn,
                    pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
                    isRetryingOrder && { opacity: 0.6 },
                  ]}
                  disabled={isRetryingOrder}
                  onPress={() => {
                    setPaymentRetryModalVisible(false);
                    setTimeout(() => {
                      placeOrder('ONLINE_RAZORPAY');
                    }, 250);
                  }}
                >
                  <MaterialCommunityIcons name="refresh" size={20} color="#FFFFFF" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.payRetryPrimaryBtnText}>
                      {isRetryingOrder ? 'Processing...' : `Retry Online Payment (${money(finalPayable)})`}
                    </Text>
                    <Text style={styles.payRetryPrimaryBtnSub}>Instant UPI, GPay, PhonePe, Cards & NetBanking</Text>
                  </View>
                  <MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" />
                </Pressable>

                {/* Option 2: Pay via Cash on Delivery (COD) */}
                <Pressable
                  style={({ pressed }) => [
                    styles.payRetryCodBtn,
                    pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
                    isRetryingOrder && { opacity: 0.6 },
                  ]}
                  disabled={isRetryingOrder}
                  onPress={() => {
                    setPaymentRetryModalVisible(false);
                    setTimeout(() => {
                      placeOrder('COD');
                    }, 250);
                  }}
                >
                  <View style={styles.payRetryCodIconCircle}>
                    <MaterialCommunityIcons name="cash-multiple" size={20} color="#16A34A" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.payRetryCodBtnTitle}>Pay on Delivery (COD / UPI)</Text>
                    <Text style={styles.payRetryCodBtnSub}>Confirm pickup now • Pay pilot at doorstep</Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color="#16A34A" />
                </Pressable>

                {/* Option 3: Cancel / Change Payment Method */}
                <Pressable
                  style={({ pressed }) => [
                    styles.payRetryCancelBtn,
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() => setPaymentRetryModalVisible(false)}
                >
                  <Text style={styles.payRetryCancelBtnText}>
                    Change Payment Method / Review Bag
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

    </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  deliveryProgressCard: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FFEDD5',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  deliveryProgressCardFree: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  deliveryProgressTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  deliveryProgressIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFEDD5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deliveryProgressIconCircleFree: {
    backgroundColor: '#DCFCE7',
  },
  deliveryProgressTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1C0B18',
  },
  deliveryProgressSub: {
    fontSize: 11,
    color: '#8A7A84',
    marginTop: 2,
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#FED7AA',
    borderRadius: 3,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#16A34A',
    borderRadius: 3,
  },
  billCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3E8DF',
    gap: 10,
    marginTop: 14,
  },
  billLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  billLineLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1C0B18',
  },
  billLineSubtext: {
    fontSize: 10,
    color: '#8A7A84',
    marginTop: 2,
  },
  billLineVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1C0B18',
  },
  billStrikethrough: {
    fontSize: 11,
    color: '#8A7A84',
    textDecorationLine: 'line-through',
  },
  billCardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  billCardTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1C0B18',
  },
  billSecureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  billSecureText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#166534',
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
    marginTop: 2,
  },
  billGrandVal: {
    fontSize: 18,
    fontWeight: '900',
    color: '#F97316',
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
    backgroundColor: '#16A34A',
    borderColor: '#16A34A',
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
    color: '#16A34A',
    fontWeight: '900',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 0,  // No top padding - stage header provides spacing
    paddingBottom: 110,
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
  luxuryEmptyCartWrap: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 12,
    gap: 14,
  },
  emptyIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    borderWidth: 2,
    borderColor: '#86EFAC',
  },
  luxuryEmptyTitle: {
    fontSize: 21,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  luxuryEmptySubtitle: {
    fontSize: 13.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
    marginBottom: 6,
  },
  emptyPrimaryBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#16A34A',
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 20,
    marginVertical: 4,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  emptySecondaryBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  emptySecondaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  emptySecondaryIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySecondaryBtnText: {
    color: '#0F172A',
    fontSize: 14.5,
    fontWeight: '800',
  },
  emptyTrustBox: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 8,
  },
  emptyTrustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  emptyTrustIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTrustText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#334155',
    flex: 1,
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
  newAddressDeliveryPreview: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 10,
    marginTop: 2,
    marginBottom: 4,
  },
  addressDeliveryBox: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
  },
  addressDeliveryBoxFree: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  addressDelivMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addressDelivLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#9A3412',
  },
  addressDelivSubtext: {
    fontSize: 11,
    color: '#C2410C',
    marginTop: 4,
    lineHeight: 15,
  },
  addressPricePill: {
    backgroundColor: '#EA580C',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  addressPricePillFree: {
    backgroundColor: '#16A34A',
  },
  addressPricePillText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  addressPricePillTextFree: {
    color: '#FFFFFF',
  },
  addressUnselectedDelivRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F3E8DF',
  },
  addressUnselectedDelivText: {
    fontSize: 11,
    color: '#78716C',
    fontWeight: '600',
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
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: '#F3E8DF',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
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
  footerPriceSub: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EA580C',
    marginTop: 1,
  },
  footerPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16A34A',
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 16,
    gap: 8,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
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
    backgroundColor: '#16A34A',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#16A34A',
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
    backgroundColor: '#16A34A',
    height: 52,
    borderRadius: 16,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
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
    backgroundColor: '#16A34A',
    borderRadius: 16,
    paddingVertical: 14,
    gap: 8,
  },
  trackOrderBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  // BigBasket-Style Coupon Card (Bag & Review)
  bbCouponCardContainer: {
    marginVertical: 12,
  },
  bbCouponCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#FED7AA',
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  bbCouponLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  bbCouponIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bbCouponTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
  },
  bbCouponCountBadge: {
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  bbCouponCountText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#EA580C',
    letterSpacing: 0.3,
  },
  bbCouponSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  bbCouponApplyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingLeft: 6,
  },
  bbCouponApplyActionText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#16A34A',
  },
  bbCouponAppliedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderRadius: 16,
    padding: 14,
  },
  bbCouponAppliedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  bbCouponAppliedIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bbCouponAppliedCode: {
    fontSize: 14,
    fontWeight: '900',
    color: '#166534',
    letterSpacing: 0.5,
  },
  bbCouponAppliedBadge: {
    backgroundColor: '#BBF7D0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  bbCouponAppliedBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#166534',
  },
  bbCouponAppliedSaving: {
    fontSize: 12,
    fontWeight: '600',
    color: '#15803D',
    marginTop: 2,
  },
  bbCouponAppliedActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bbCouponChangeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0284C7',
  },
  bbCouponRemoveText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#DC2626',
  },

  // BigBasket Available Coupons Bottom Sheet Modal
  bbModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  bbModalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  bbModalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '84%',
    paddingTop: 10,
    paddingHorizontal: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  bbSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#CBD5E1',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  bbModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  bbModalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  bbModalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  bbModalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bbInputSection: {
    paddingVertical: 14,
  },
  bbInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    height: 48,
    overflow: 'hidden',
  },
  bbTextInput: {
    flex: 1,
    paddingHorizontal: 10,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  bbInputApplyBtn: {
    backgroundColor: '#16A34A',
    height: '100%',
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bbInputApplyBtnDisabled: {
    backgroundColor: '#CBD5E1',
  },
  bbInputApplyText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  bbInputErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  bbInputErrorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
  },
  bbListHeader: {
    paddingVertical: 6,
    marginBottom: 8,
  },
  bbListTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  bbCouponsScroll: {
    flexGrow: 0,
  },
  bbTicketCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    marginBottom: 14,
    padding: 14,
    position: 'relative',
    overflow: 'hidden',
  },
  bbTicketCardCurrent: {
    borderColor: '#86EFAC',
    backgroundColor: '#F0FDF4',
    borderStyle: 'solid',
  },
  bbTicketCardDisabled: {
    opacity: 0.7,
    backgroundColor: '#FAFAFA',
  },
  bbTicketNotchTop: {
    position: 'absolute',
    top: -8,
    left: 20,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  bbTicketNotchBottom: {
    position: 'absolute',
    bottom: -8,
    left: 20,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  bbTicketMain: {
    gap: 6,
  },
  bbTicketTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 36,
  },
  bbCodeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderStyle: 'dashed',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  bbTicketCodeText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#16A34A',
    letterSpacing: 0.6,
  },
  bbTicketApplyBtn: {
    backgroundColor: '#16A34A',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
    minWidth: 76,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  bbTicketApplyText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  bbAppliedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  bbAppliedPillText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#16A34A',
  },
  bbRemoveInlineText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
    marginLeft: 2,
  },
  bbTicketIneligiblePill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  bbTicketIneligiblePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.3,
  },
  bbSavingHeadline: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  bbTicketDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
  },
  bbTicketFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  bbTicketMinOrder: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  bbTicketFirstOrder: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EA580C',
  },
  bbIneligibilityNotice: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 4,
  },
  bbIneligibilityNoticeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DC2626',
  },
  // Delivery Speed Options Styles
  speedSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  speedSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  speedSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  speedOptionsStack: {
    gap: 10,
  },
  speedOptionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  speedOptionCardActive: {
    borderColor: '#16A34A',
    backgroundColor: '#F0FDF4',
  },
  speedOptionCardActiveExpress: {
    borderColor: '#EA580C',
    backgroundColor: '#FFF7ED',
  },
  speedOptionCardActiveSameDay: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  speedOptionRadio: {
    marginTop: 2,
  },
  speedOptionInfo: {
    flex: 1,
  },
  speedOptionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 3,
  },
  speedOptionName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  speedOptionNameActive: {
    color: '#16A34A',
    fontWeight: '800',
  },
  speedOptionNameActiveExpress: {
    color: '#C2410C',
    fontWeight: '800',
  },
  speedOptionNameActiveSameDay: {
    color: '#B91C1C',
    fontWeight: '800',
  },
  popularSpeedTag: {
    backgroundColor: '#EA580C',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  popularSpeedTagText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  speedFeeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  speedFeeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  speedOptionSub: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
  },
  // Swiggy/Zepto-style Payment Retry Modal Styles
  payRetryOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
  },
  payRetryBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  payRetrySheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 0,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 20,
  },
  payRetryScrollContent: {
    paddingBottom: 24,
  },
  payRetryHandle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 12,
  },
  payRetryHeader: {
    alignItems: 'center',
    marginBottom: 14,
  },
  payRetryIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  payRetryTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  payRetrySubtitle: {
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 4,
    paddingHorizontal: 10,
  },
  payRetryOrderCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 14,
  },
  payRetryOrderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  payRetryOrderLabel: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  payRetryOrderAmount: {
    fontSize: 18,
    fontWeight: '900',
    color: '#EA580C',
  },
  payRetryOrderDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 8,
  },
  payRetryOrderSublabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  payRetryOrderSubval: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  payRetrySafePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 8,
  },
  payRetrySafeText: {
    fontSize: 11,
    color: '#166534',
    fontWeight: '700',
  },
  payRetryActions: {
    gap: 10,
    marginTop: 2,
  },
  payRetryPrimaryBtn: {
    backgroundColor: '#059669',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  payRetryPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  payRetryPrimaryBtnSub: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  payRetryCodBtn: {
    backgroundColor: '#F0FDF4',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  payRetryCodIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  payRetryCodBtnTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#166534',
  },
  payRetryCodBtnSub: {
    fontSize: 11,
    color: '#15803D',
    marginTop: 1,
  },
  payRetryCancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  payRetryCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },

  // VIP Membership Perks Card
  subPerksCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  subPerksHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subPerksTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#065F46',
  },
  subPerksActiveBadge: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  subPerksActiveBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#166534',
    letterSpacing: 0.5,
  },
  subPerksSubtitle: {
    fontSize: 12,
    color: '#047857',
    marginTop: 2,
  },
  subPerksBody: {
    marginTop: 10,
  },
  subPerksDivider: {
    height: 1,
    backgroundColor: '#BBF7D0',
    marginVertical: 10,
  },
  subPerksGrid: {
    gap: 8,
  },
  subPerksItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subPerksItemText: {
    fontSize: 13,
    color: '#065F46',
  },
  subPerksSavingPill: {
    marginTop: 10,
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subPerksSavingText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#047857',
  },

  // Wallet Deduction Box
  walletBox: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },

  // Zero-Payable Banner
  zeroPayableBanner: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#6EE7B7',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  zeroPayableIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zeroPayableTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#065F46',
  },
  zeroPayableSubtitle: {
    fontSize: 12,
    color: '#047857',
    marginTop: 3,
    lineHeight: 17,
  },

  // Split Payment Tag
  splitPayTag: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#93C5FD',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
  },
  splitPayTagText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#1D4ED8',
    letterSpacing: 0.4,
  },

  // In-Content Bag Proceed CTA
  inContentProceedBtn: {
    backgroundColor: '#16A34A',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginTop: 14,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  inContentProceedBtnTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  inContentProceedBtnSub: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.92)',
    marginTop: 2,
  },
  inContentProceedBtnIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
});
