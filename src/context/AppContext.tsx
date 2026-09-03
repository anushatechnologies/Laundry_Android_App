import { getGarmentImageUrl } from '@/lib/garment-photos';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { api, configureApiSession, createOrderPayload } from '@/lib/api';
import { requestFirebasePhoneOtp, confirmFirebasePhoneOtp, signOutFirebasePhoneAuth, hasPendingFirebaseConfirmation } from '@/lib/firebase-phone-auth';
import { getFirebasePushToken, requestNotificationPermissionOnAppOpen } from '@/lib/notifications';
import { payWithRazorpay } from '@/lib/payments';
import {
  clearSession,
  clearCart,
  clearWishlist,
  readCart,
  readOnboardingComplete,
  readSession,
  readWishlist,
  writeCart,
  writeOnboardingComplete,
  writeSession,
  writeWishlist,
} from '@/lib/storage';
import type {
  AuthSession,
  CartItem,
  Catalog,
  CheckoutInput,
  CustomerAddress,
  Order,
  PincodeCheck,
  PickupSlot,
  TrackingOrder,
} from '@/types/domain';

interface CartSummary {
  itemTotal: number;
  totalKg: number;
  itemCount: number;
}

interface CheckoutResult {
  order: Order;
  paymentOutcome: 'PAID' | 'PENDING' | 'COD';
}

interface AppContextValue {
  ready: boolean;
  session: AuthSession | null;
  hasCompletedOnboarding: boolean;
  catalog: Catalog | null;
  cart: CartItem[];
  cartSummary: CartSummary;
  addresses: CustomerAddress[];
  orders: Order[];
  isRefreshing: boolean;
  isCheckingOut: boolean;
  catalogError: string | null;
  wishlist: string[];
  toggleWishlist: (itemId: string) => void;
  isInWishlist: (itemId: string) => boolean;
  requestOtp: (phone: string, name?: string, email?: string) => Promise<{ exists: boolean; message: string }>;  signIn: (phone: string, otp: string, name?: string, email?: string) => Promise<void>;
  signOut: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  refreshCatalog: () => Promise<void>;
  refreshOrders: () => Promise<void>;
  refreshAccountData: () => Promise<void>;
  addCartItem: (item: CartItem) => void;
  addGarmentToCart: (clothId: string, serviceId: string) => void;
  addBulkToCart: (serviceId: string, quantityKg: number) => number;
  setCartQuantity: (itemId: string, quantity: number) => void;
  removeFromCart: (itemId: string) => void;
  updateUserProfile: (name: string, email: string) => Promise<void>;
  getSlots: (date: string) => Promise<PickupSlot[]>;
  validatePincode: (pincode: string) => Promise<PincodeCheck>;
  reverseGeocode: (latitude: number, longitude: number) => Promise<{ pincode?: string; areaName?: string; city?: string; formattedAddress?: string }>;
  saveAddress: (address: Omit<CustomerAddress, 'id'> & { id?: string }) => Promise<CustomerAddress>;
  deleteAddress: (addressId: string) => Promise<void>;
  trackOrder: (orderId: string) => Promise<TrackingOrder>;
  checkout: (input: CheckoutInput) => Promise<CheckoutResult>;
}

const AppContext = createContext<AppContextValue | null>(null);

function normaliseCart(items: CartItem[]): CartItem[] {
  return items
    .filter((item) => item.quantity > 0)
    .map((item) => ({ ...item, subtotal: Number((item.unitPrice * item.quantity).toFixed(2)) }));
}

export function AppProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [notificationsAllowed, setNotificationsAllowed] = useState(false);

  useEffect(() => {
    // Fix #2: always pass the listener so token refreshes write the new token to SecureStore
    configureApiSession(session, async (next) => {
      setSession(next);
      if (next) {
        await writeSession(next);
      } else {
        await clearSession();
      }
    });
  }, [session]);

  const refreshCatalog = useCallback(async () => {
    try {
      const nextCatalog = await api.getCatalog();
      setCatalog(nextCatalog);
      setCatalogError(null);
    } catch (error) {
      setCatalogError(error instanceof Error ? error.message : 'The service catalog could not be loaded.');
    }
  }, []);

  const refreshAccountData = useCallback(async () => {
    if (!session?.user.id) return;
    setIsRefreshing(true);
    try {
      const [nextOrders, nextAddresses, nextWishlist] = await Promise.all([
        api.getOrders(session.user.id),
        api.getAddresses(session.user.id),
        api.getWishlist(session.user.id).catch(() => []),
      ]);
      setOrders(nextOrders);
      setAddresses(nextAddresses);
      if (Array.isArray(nextWishlist) && nextWishlist.length) {
        setWishlist((current) => {
          const merged = Array.from(new Set([...current, ...nextWishlist]));
          void writeWishlist(merged);
          return merged;
        });
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [session?.user.id]);

  const refreshOrders = useCallback(async () => {
    if (!session?.user.id) return;
    const nextOrders = await api.getOrders(session.user.id);
    setOrders(nextOrders);
  }, [session?.user.id]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const storedSession = await readSession().catch(() => null);
        const [storedCart, storedWishlist, onboardingComplete] = await Promise.all([
          readCart(storedSession?.user?.id).catch(() => []),
          readWishlist(storedSession?.user?.id).catch(() => []),
          readOnboardingComplete().catch(() => false),
        ]);
        if (!active) return;
        setSession(storedSession);
        setCart(normaliseCart(storedCart));
        setWishlist(storedWishlist);
        setHasCompletedOnboarding(onboardingComplete);
      } catch {
        // Safe default fallback
      } finally {
        if (active) {
          setReady(true);
          void refreshCatalog().catch(() => undefined);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [refreshCatalog]);

  useEffect(() => {
    if (!ready) return;
    void writeCart(cart).catch(() => undefined);
  }, [cart, ready]);

  useEffect(() => {
    if (!ready || !session?.user.id) {
      if (ready && !session) {
        setOrders([]);
        setAddresses([]);
      }
      return;
    }
    void refreshAccountData().catch(() => undefined);
  }, [ready, session?.user.id, refreshAccountData]);

  // Unified resilient OTP request: Try Firebase phone auth, fallback seamlessly to backend SMS OTP
  const requestOtp = useCallback(async (phone: string, name?: string, email?: string) => {
    const customer = await api.checkPhone(phone);

    try {
      await requestFirebasePhoneOtp(phone);
      return {
        exists: customer.exists,
        message: 'OTP verification code has been sent to your mobile number via SMS.',
      };
    } catch (firebaseError: any) {
      console.warn('[AUTH] Firebase phone auth unavailable, switching to backend direct SMS OTP:', firebaseError?.message);

      // Robust fallback to backend SMS OTP
      const backendOtpRes = await api.sendOtp(phone, name, email);
      return {
        exists: customer.exists,
        message: backendOtpRes.message || `Verification code sent to +91 ${phone} via SMS.`,
      };
    }
  }, []);

  // Unified auth verification: Validate via Firebase ID token or backend OTP store
  const signIn = useCallback(async (phone: string, otp: string, name?: string, email?: string) => {
    let nextSession: AuthSession;

    if (hasPendingFirebaseConfirmation()) {
      const result = await confirmFirebasePhoneOtp(otp);
      nextSession = await api.loginWithFirebase(result.idToken, name, email);
    } else {
      nextSession = await api.verifyOtp(phone, otp, name, email);
    }

    // Fix #2: pass the listener so token refreshes are persisted in SecureStore
    configureApiSession(nextSession, async (next) => {
      setSession(next);
      if (next) {
        await writeSession(next);
      } else {
        await clearSession();
      }
    });
    setSession(nextSession);
    await writeSession(nextSession);

    if (nextSession.user.id) {
      // BigBasket / Blinkit Multi-User Cart Isolation & Guest Merge Pattern:
      try {
        const userSavedCart = await readCart(nextSession.user.id);
        const guestCart = await readCart(null);
        let finalCart = userSavedCart;

        // If guest added items before logging in, merge into this user's cart
        if (guestCart.length > 0) {
          const mergedMap = new Map<string, CartItem>();
          userSavedCart.forEach((item) => mergedMap.set(item.id, { ...item }));
          guestCart.forEach((item) => {
            if (mergedMap.has(item.id)) {
              const existing = mergedMap.get(item.id)!;
              existing.quantity += item.quantity;
              existing.subtotal = existing.unitPrice * existing.quantity;
            } else {
              mergedMap.set(item.id, { ...item });
            }
          });
          finalCart = Array.from(mergedMap.values());
          await clearCart(null); // Wipe guest cart once merged
        }

        setCart(normaliseCart(finalCart));
        await writeCart(finalCart, nextSession.user.id);
      } catch {
        // Safe fallback
      }

      try {
        const merged = await api.mergeWishlist(nextSession.user.id, wishlist);
        if (Array.isArray(merged)) {
          setWishlist(merged);
          await writeWishlist(merged, nextSession.user.id);
        }
      } catch {
        // Wishlist merge is non-critical
      }
    }
  }, [wishlist]);

  const signOut = useCallback(async () => {
    configureApiSession(null);
    setSession(null);
    setOrders([]);
    setAddresses([]);
    setCart([]); // BigBasket pattern: clear active memory cart so next user never sees prior user's items
    setWishlist([]); // Clear active memory wishlist
    await clearSession();
    await signOutFirebasePhoneAuth();
  }, []);

  const toggleWishlist = useCallback((itemId: string) => {
    setWishlist((current) => {
      const isExisting = current.includes(itemId);
      const next = isExisting ? current.filter((id) => id !== itemId) : [...current, itemId];
      void writeWishlist(next, session?.user.id);

      if (session?.user.id) {
        if (isExisting) {
          void api.removeFromWishlist(session.user.id, itemId).catch(() => undefined);
        } else {
          void api.addToWishlist(session.user.id, itemId).catch(() => undefined);
        }
      }
      return next;
    });
  }, [session?.user.id]);

  const isInWishlist = useCallback((itemId: string) => {
    return wishlist.includes(itemId);
  }, [wishlist]);

  const completeOnboarding = useCallback(async () => {
    setHasCompletedOnboarding(true);
    await writeOnboardingComplete().catch(() => undefined);
  }, []);

  const addCartItem = useCallback((item: CartItem) => {
    setCart((current) => {
      const index = current.findIndex((candidate) => candidate.id === item.id);
      if (index === -1) return normaliseCart([...current, item]);
      const existing = current[index];
      if (!existing) return normaliseCart([...current, item]);
      const next = [...current];
      next[index] = { ...existing, quantity: existing.quantity + item.quantity };
      return normaliseCart(next);
    });
  }, []);

  const addGarmentToCart = useCallback((clothId: string, serviceId: string) => {
    if (!catalog) return;
    const cloth = catalog.clothTypes.find((item) => item.id === clothId);
    const price = catalog.priceMatrix.find((item) => item.clothTypeId === clothId && item.serviceId === serviceId && item.isActive);
    if (!cloth || !price) return;
    // Fix #19: unified cart item ID format shared with HomeScreen/ServicesScreen
    addCartItem({
      id: `${cloth.id}-${price.serviceId}`,
      serviceId: price.serviceId,
      serviceName: `${cloth.name} (${price.serviceName})`,
      categoryName: cloth.categoryLabel,
      pricingModel: 'PER_ITEM',
      unitPrice: price.price,
      quantity: 1,
      unit: 'Piece',
      subtotal: price.price,
      clothId: cloth.id,
      imageUrl: cloth.imageUrl || getGarmentImageUrl(cloth.id),
    });
  }, [addCartItem, catalog]);

  // Fix #9: return enforced quantity so callers can inform the user
  const addBulkToCart = useCallback((serviceId: string, quantityKg: number): number => {
    if (quantityKg <= 0) return 0;

    // 1. Try finding in serviceMasters
    let service = catalog?.serviceMasters?.find(
      (item: any) => (item.id === serviceId || (item as any).serviceCode === serviceId)
    );

    // 2. Try finding in perKgServices
    let basePrice: number = service?.baseKgPrice || 0;
    let serviceName: string = service?.name || '';
    if (!service && catalog?.perKgServices) {
      const pkg = catalog.perKgServices.find((p) => p.id === serviceId || p.name === serviceId);
      if (pkg) {
        basePrice = pkg.baseKgPrice || 0;
        serviceName = pkg.name;
      }
    }

    if (!basePrice || basePrice === 0) {
      if (serviceId.includes('express')) { basePrice = 110; serviceName = serviceName || 'Express Emergency Laundry'; }
      else if (serviceId.includes('iron')) { basePrice = 85; serviceName = serviceName || 'Wash & Steam Iron'; }
      else { basePrice = 60; serviceName = serviceName || 'Wash & Fold'; }
    }

    const minKg = (service as any)?.minOrderKg || 1;
    const quantity = Math.max(minKg, quantityKg);
    const cartId = `bulk-svc-${serviceId}`;

    addCartItem({
      id: cartId,
      serviceId: serviceId,
      serviceName: serviceName || 'Bulk Laundry (KG)',
      categoryName: 'Bulk Laundry',
      pricingModel: 'PER_KG',
      unitPrice: basePrice,
      quantity,
      unit: 'KG',
      subtotal: basePrice * quantity,
      imageUrl: 'https://laundry-storage-2026.s3.ap-south-1.amazonaws.com/banners/banner-4.jpg',
    });
    return quantity;
  }, [addCartItem, catalog]);

  const setCartQuantity = useCallback((itemId: string, quantity: number) => {
    setCart((current) => normaliseCart(current.map((item) => (item.id === itemId ? { ...item, quantity } : item))));
  }, []);

  const removeFromCart = useCallback((itemId: string) => {
    setCart((current) => current.filter((item) => item.id !== itemId));
  }, []);

  const getSlots = useCallback((date: string) => api.getSlots(date), []);
  const validatePincode = useCallback((pincode: string) => api.checkPincode(pincode), []);
  const reverseGeocode = useCallback((latitude: number, longitude: number) => api.reverseGeocode(latitude, longitude), []);

  const saveAddress = useCallback(async (address: Omit<CustomerAddress, 'id'> & { id?: string }) => {
    if (!session?.user.id) throw new Error('Please sign in to save an address.');
    // Fix #11: strip any client-invented id — the backend assigns a real one
    const { id: _clientId, ...addressWithoutId } = address;
    const saved = await api.addAddress(session.user.id, addressWithoutId as CustomerAddress);
    setAddresses((current) => {
      const rest = current.filter((candidate) => candidate.id !== saved.id);
      return saved.isDefault ? [saved, ...rest.map((candidate) => ({ ...candidate, isDefault: false }))] : [saved, ...rest];
    });
    return saved;
  }, [session?.user.id]);

  const deleteAddress = useCallback(async (addressId: string) => {
    if (!session?.user.id) throw new Error('Please sign in to manage addresses.');
    const nextAddresses = await api.deleteAddress(session.user.id, addressId);
    setAddresses(nextAddresses);
  }, [session?.user.id]);

  const trackOrder = useCallback((orderId: string) => api.getTracking(orderId), []);

  const checkout = useCallback(async (input: CheckoutInput): Promise<CheckoutResult> => {
    if (!session) throw new Error('Please sign in to complete your booking.');
    if (!cart.length) throw new Error('Your laundry bag is empty.');

    setIsCheckingOut(true);
    // Fix #8: capture cart snapshot so it can be restored if payment fails
    const cartSnapshot = [...cart];
    try {
      const totalKg = cart
        .filter((item) => item.pricingModel === 'PER_KG')
        .reduce((sum, item) => sum + item.quantity, 0);
      await api.reserveSlot(input.slot.id, Math.max(totalKg, 1));
      const order = await api.createOrder(createOrderPayload(session, cart, input));
      setOrders((current) => [order, ...current.filter((candidate) => candidate.id !== order.id)]);
      setCart([]);

            if (input.paymentMethod === 'COD') {
        return { order, paymentOutcome: 'COD' };
      }

      // Online Razorpay Payment Flow
      try {
        const paymentOrder = await api.createRazorpayOrder(order.id);
        const paymentResult = await payWithRazorpay(paymentOrder, session.user);
        const paidOrder = await api.verifyRazorpayPayment({
          internalOrderId: order.id,
          ...paymentResult,
        });
        setOrders((current) => [paidOrder, ...current.filter((candidate) => candidate.id !== paidOrder.id)]);
        return { order: paidOrder, paymentOutcome: 'PAID' };
      } catch (err) {
        // Online payment failed or was cancelled by user
        await api.markRazorpayPaymentFailed(order.id).catch(() => undefined);
        setCart(cartSnapshot);
        const errDetail = err && typeof err === 'object' && 'description' in err ? (err as any).description : err instanceof Error ? err.message : 'Payment was not completed.';
        throw new Error(`Online Payment Incomplete: ${errDetail}. Your bag items are saved. Please retry or choose Pay on Delivery.`);
      }
    } finally {
      setIsCheckingOut(false);
    }
  }, [cart, session]);

  // Ask for the operating-system notification permission as the app opens.
  // The helper only shows the prompt while the customer has not made a choice.
  useEffect(() => {
    let isMounted = true;
    requestNotificationPermissionOnAppOpen()
      .then((granted) => {
        if (isMounted) setNotificationsAllowed(granted);
      })
      .catch(() => {
        if (isMounted) setNotificationsAllowed(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Once the customer is signed in and has allowed notifications, register the
  // native Android FCM token. Firebase Admin is the only delivery provider.
  useEffect(() => {
    if (!session?.accessToken || !notificationsAllowed) return;
    let isMounted = true;
    (async () => {
      try {
        const fcmToken = await getFirebasePushToken();
        if (fcmToken && isMounted) {
          await api.registerPushDevice(fcmToken);
          console.log('[Push] Firebase FCM device token registered successfully.');
        }
      } catch (err) {
        console.log('[Push] Firebase device registration note:', err);
      }
    })();
    return () => { isMounted = false; };
  }, [notificationsAllowed, session?.accessToken]);

  const cartSummary = useMemo<CartSummary>(() => ({
    itemTotal: Number(cart.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2)),
    totalKg: cart.filter((item) => item.pricingModel === 'PER_KG').reduce((sum, item) => sum + item.quantity, 0),
    itemCount: cart.reduce((sum, item) => sum + (item.pricingModel === 'PER_KG' ? 1 : item.quantity), 0),
  }), [cart]);

  const updateUserProfile = useCallback(async (name: string, email: string) => {
    if (!session?.user.id) return;
    await api.updateProfile(session.user.id, { name, email });
    const nextSession: AuthSession = {
      ...session,
      user: {
        ...session.user,
        name,
        email,
      },
    };
    setSession(nextSession);
    await writeSession(nextSession);
  }, [session]);

  const value = useMemo<AppContextValue>(() => ({
    ready,
    session,
    hasCompletedOnboarding,
    catalog,
    cart,
    cartSummary,
    wishlist,
    toggleWishlist,
    isInWishlist,
    addresses,
    orders,
    isRefreshing,
    isCheckingOut,
    catalogError,
    requestOtp,
    signIn,
    signOut,
    completeOnboarding,
    refreshCatalog,
    refreshOrders,
    refreshAccountData,
    addCartItem,
    addGarmentToCart,
    addBulkToCart,
    setCartQuantity,
    removeFromCart,
    updateUserProfile,
    getSlots,
    validatePincode,
    reverseGeocode,
    saveAddress,
    deleteAddress,
    trackOrder,
    checkout,
  }), [
    ready, session, hasCompletedOnboarding, catalog, cart, cartSummary, wishlist, toggleWishlist, isInWishlist, addresses, orders, isRefreshing, isCheckingOut, catalogError,
    requestOtp, signIn, signOut, completeOnboarding, refreshCatalog, refreshOrders, refreshAccountData, addCartItem, addGarmentToCart, addBulkToCart,
    setCartQuantity, removeFromCart, updateUserProfile, getSlots, validatePincode, reverseGeocode, saveAddress, deleteAddress,
    trackOrder, checkout,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppProvider.');
  return value;
}
