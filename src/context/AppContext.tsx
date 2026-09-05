import { PermissionsAndroid, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { getGarmentImageUrl } from '@/lib/garment-photos';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { api, configureApiSession, createOrderPayload } from '@/lib/api';
import { requestFirebasePhoneOtp, confirmFirebasePhoneOtp, signOutFirebasePhoneAuth } from '@/lib/firebase-phone-auth';
import {
  getFirebasePushToken,
  requestNotificationPermissionOnAppOpen,
  parseNotificationAction,
  type NotificationNavAction,
} from '@/lib/notifications';
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
  readPreferences,
  writePreferences,
} from '@/lib/storage';
import {
  type AuthSession,
  type CartItem,
  type Catalog,
  type CheckoutInput,
  type CustomerAddress,
  type CustomerPreferences,
  DEFAULT_CUSTOMER_PREFERENCES,
  type InAppNotification,
  type Order,
  type PincodeCheck,
  type PickupSlot,
  type TrackingOrder,
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
  inAppNotifications: InAppNotification[];
  unreadNotificationCount: number;
  fetchNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  deleteNotificationItem: (id: string) => Promise<void>;
  pendingNavAction: NotificationNavAction | null;
  clearPendingNavAction: () => void;
  toggleWishlist: (itemId: string) => void;
  isInWishlist: (itemId: string) => boolean;
  requestOtp: (phone: string) => Promise<void>;
  signIn: (otp: string, name?: string, email?: string) => Promise<void>;
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
  preferences: CustomerPreferences;
  updatePreferences: (updates: Partial<CustomerPreferences>) => Promise<void>;
  deleteAccount: () => Promise<void>;
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
  const [preferences, setPreferences] = useState<CustomerPreferences>(DEFAULT_CUSTOMER_PREFERENCES);
  const [inAppNotifications, setInAppNotifications] = useState<InAppNotification[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState<number>(0);
  const [pendingNavAction, setPendingNavAction] = useState<NotificationNavAction | null>(null);
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
      const [nextOrders, nextAddresses, nextWishlist, nextPreferences] = await Promise.all([
        api.getOrders(session.user.id),
        api.getAddresses(session.user.id),
        api.getWishlist(session.user.id).catch(() => []),
        api.getPreferences(session.user.id).catch(() => null),
      ]);
      setOrders(nextOrders);
      setAddresses(nextAddresses);
      if (nextPreferences) {
        setPreferences(nextPreferences);
        void writePreferences(nextPreferences, session.user.id);
      }
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
        const [storedCart, storedWishlist, storedPreferences, onboardingComplete] = await Promise.all([
          readCart(storedSession?.user?.id).catch(() => []),
          readWishlist(storedSession?.user?.id).catch(() => []),
          readPreferences(storedSession?.user?.id).catch(() => DEFAULT_CUSTOMER_PREFERENCES),
          readOnboardingComplete().catch(() => false),
        ]);
        if (!active) return;
        setSession(storedSession);
        setCart(normaliseCart(storedCart));
        setWishlist(storedWishlist);
        setPreferences(storedPreferences);
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

  const pendingPhoneRef = useRef<string | null>(null);
  const useBackendOtpRef = useRef<boolean>(false);

  // High-Reliability OTP Strategy:
  // 1. Primary: Fast2SMS Indian SMS Gateway (Direct delivery to Indian mobile numbers via recharged Fast2SMS account)
  // 2. Fallback: Google Firebase Phone Auth (if backend SMS gateway is unreachable)
  const requestOtp = useCallback(async (phone: string) => {
    pendingPhoneRef.current = phone;

    // 1. Dispatch via Fast2SMS Indian Gateway
    try {
      const res = await api.sendOtp(phone);
      if (res.success) {
        useBackendOtpRef.current = true;
        console.log('[Phone Auth] Real OTP SMS sent via Fast2SMS gateway:', res.gateway);
        return;
      }
    } catch (backendErr: any) {
      console.warn('[Phone Auth] Fast2SMS dispatch failed, trying Firebase native auth fallback:', backendErr?.message);
    }

    // 2. Fallback to Firebase Phone Auth
    try {
      await requestFirebasePhoneOtp(phone);
      useBackendOtpRef.current = false;
      console.log('[Phone Auth] Verification code requested via Firebase Phone Auth.');
    } catch (firebaseErr: any) {
      throw new Error(firebaseErr instanceof Error ? firebaseErr.message : 'Could not send verification code.');
    }
  }, []);

  // Confirms OTP via either Backend Fast2SMS verification or Firebase Phone Auth
  const signIn = useCallback(async (otp: string, name?: string, email?: string) => {
    let nextSession: AuthSession;

    if (useBackendOtpRef.current && pendingPhoneRef.current) {
      try {
        nextSession = await api.verifyOtp(pendingPhoneRef.current, otp, name, email);
      } catch (backendVerifyErr) {
        // If backend verify failed, try firebase confirm as secondary fallback
        try {
          const result = await confirmFirebasePhoneOtp(otp);
          nextSession = await api.loginWithFirebase(result.idToken, name, email);
        } catch {
          throw backendVerifyErr;
        }
      }
    } else {
      try {
        const result = await confirmFirebasePhoneOtp(otp);
        nextSession = await api.loginWithFirebase(result.idToken, name, email);
      } catch (firebaseConfirmErr) {
        if (pendingPhoneRef.current) {
          console.log('[Phone Auth] Firebase confirmation failed, trying backend verify-otp fallback...');
          nextSession = await api.verifyOtp(pendingPhoneRef.current, otp, name, email);
        } else {
          throw firebaseConfirmErr;
        }
      }
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
    try {
      const fcmToken = await getFirebasePushToken();
      if (fcmToken) {
        await api.unregisterPushDevice(fcmToken).catch(() => {});
      }
    } catch {}
    configureApiSession(null);
    setSession(null);
    setOrders([]);
    setAddresses([]);
    setInAppNotifications([]);
    setUnreadNotificationCount(0);
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
      imageUrl: 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/banners/banner-4.jpg',
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
      const payload = createOrderPayload(session, cart, input);
      await api.reserveSlot(input.slot.id, Math.max(totalKg, 1));
      const order = await api.createOrder(payload);

      // COD: Confirm order and empty cart immediately
      if (input.paymentMethod === 'COD') {
        setOrders((current) => [order, ...current.filter((candidate) => candidate.id !== order.id)]);
        setCart([]);
        return { order, paymentOutcome: 'COD' };
      }

      let paymentCompleted = false;
      // Online Razorpay Payment Flow:
      // DO NOT add order to orders list and DO NOT clear cart until payment succeeds!
      try {
        const paymentOrder = await api.createRazorpayOrder(order.id);
        const paymentResult = input.onLaunchOnlinePayment
          ? await input.onLaunchOnlinePayment(paymentOrder)
          : await payWithRazorpay(paymentOrder, session.user);
        paymentCompleted = true;
        const paymentStatus = await api.verifyRazorpayPayment({
          internalOrderId: order.id,
          ...paymentResult,
        });

        const paidOrder = { ...order, ...paymentStatus };

        // Payment successful & verified: Confirm order and empty bag
        setOrders((current) => [paidOrder, ...current.filter((candidate) => candidate.id !== paidOrder.id)]);
        setCart([]);
        return { order: paidOrder, paymentOutcome: 'PAID' };
      } catch (err) {
        if (paymentCompleted) {
          setOrders((current) => [order, ...current.filter((candidate) => candidate.id !== order.id)]);
          setCart([]);
          throw new Error(`Payment needs confirmation for order ${order.id}. Please contact support before paying again.`);
        }
        // Online payment failed, dismissed, or was cancelled by user
        // Mark backend order cancelled so no pickup is scheduled
        await api.markRazorpayPaymentFailed(order.id).catch(() => undefined);

        // Ensure this unconfirmed order NEVER appears in customer's order history
        setOrders((current) => current.filter((o) => o.id !== order.id));

        // Restore bag items so customer can retry or switch to COD
        setCart(cartSnapshot);

        const errDetail = err && typeof err === 'object' && 'description' in err
          ? (err as any).description
          : err instanceof Error
            ? err.message
            : 'Payment was not completed.';
        throw new Error(errDetail || 'Payment cancelled');
      }
    } finally {
      setIsCheckingOut(false);
    }
  }, [cart, session]);

  // Check notification status on startup. The sequential prompt flow is coordinated
  // by permissionCoordinator on first launch so it never conflicts with location dialogs.
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        if (Platform.OS === 'android') {
          if (Platform.Version >= 33) {
            const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
            if (isMounted) setNotificationsAllowed(granted);
          } else {
            if (isMounted) setNotificationsAllowed(true);
          }
        } else {
          const res = await Notifications.getPermissionsAsync();
          if (isMounted) setNotificationsAllowed(res.status === 'granted');
        }
      } catch {
        if (isMounted) setNotificationsAllowed(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!session?.accessToken) {
      setInAppNotifications([]);
      setUnreadNotificationCount(0);
      return;
    }
    try {
      const res = await api.getNotifications();
      if (res && Array.isArray(res.data)) {
        setInAppNotifications(res.data);
        setUnreadNotificationCount(res.unreadCount ?? res.data.filter((n) => !n.isRead).length);
      }
    } catch (err) {
      console.warn('[Notifications] Error fetching feed:', err);
    }
  }, [session?.accessToken]);

  const markNotificationRead = useCallback(async (id: string) => {
    setInAppNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    setUnreadNotificationCount((prev) => Math.max(0, prev - 1));
    if (session?.accessToken) {
      api.markNotificationAsRead(id).catch(() => {});
    }
  }, [session?.accessToken]);

  const markAllNotificationsRead = useCallback(async () => {
    setInAppNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadNotificationCount(0);
    if (session?.accessToken) {
      api.markAllNotificationsAsRead().catch(() => {});
    }
  }, [session?.accessToken]);

  const deleteNotificationItem = useCallback(async (id: string) => {
    setInAppNotifications((prev) => {
      const item = prev.find((n) => n.id === id);
      if (item && !item.isRead) {
        setUnreadNotificationCount((c) => Math.max(0, c - 1));
      }
      return prev.filter((n) => n.id !== id);
    });
    if (session?.accessToken) {
      api.deleteNotification(id).catch(() => {});
    }
  }, [session?.accessToken]);

  const clearPendingNavAction = useCallback(() => {
    setPendingNavAction(null);
  }, []);

  // Listen for push notifications in foreground and notification response (taps)
  useEffect(() => {
    const receivedSub = Notifications.addNotificationReceivedListener(() => {
      // Whenever any push notification arrives, auto-refresh the in-app feed
      void fetchNotifications();
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const action = parseNotificationAction(response);
      if (action) {
        setPendingNavAction(action);
      }
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [fetchNotifications]);

  // Fetch notifications whenever session changes
  useEffect(() => {
    if (session?.accessToken) {
      void fetchNotifications();
    }
  }, [session?.accessToken, fetchNotifications]);

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

  const updatePreferences = useCallback(async (updates: Partial<CustomerPreferences>) => {
    setPreferences((current) => {
      const next: CustomerPreferences = { ...current, ...updates };
      void writePreferences(next, session?.user?.id);
      return next;
    });

    if (session?.user?.id) {
      try {
        const synced = await api.updatePreferences(session.user.id, updates);
        setPreferences(synced);
        void writePreferences(synced, session.user.id);
      } catch (err) {
        console.warn('Could not sync preferences to backend:', err);
      }
    }
  }, [session?.user?.id]);

  const deleteAccount = useCallback(async () => {
    if (session?.user?.id) {
      try {
        await api.deleteAccount(session.user.id);
      } catch (err) {
        console.warn('Backend deleteAccount failed:', err);
      }
    }
    await signOut();
  }, [session?.user?.id, signOut]);

  const value = useMemo<AppContextValue>(() => ({
    ready,
    session,
    hasCompletedOnboarding,
    catalog,
    cart,
    cartSummary,
    wishlist,
    inAppNotifications,
    unreadNotificationCount,
    fetchNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotificationItem,
    pendingNavAction,
    clearPendingNavAction,
    toggleWishlist,
    isInWishlist,
    addresses,
    orders,
    preferences,
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
    updatePreferences,
    deleteAccount,
    getSlots,
    validatePincode,
    reverseGeocode,
    saveAddress,
    deleteAddress,
    trackOrder,
    checkout,
  }), [
    ready, session, hasCompletedOnboarding, catalog, cart, cartSummary, wishlist, inAppNotifications, unreadNotificationCount,
    fetchNotifications, markNotificationRead, markAllNotificationsRead, deleteNotificationItem, pendingNavAction, clearPendingNavAction,
    toggleWishlist, isInWishlist, addresses, orders, preferences, isRefreshing, isCheckingOut, catalogError,
    requestOtp, signIn, signOut, completeOnboarding, refreshCatalog, refreshOrders, refreshAccountData, addCartItem, addGarmentToCart, addBulkToCart,
    setCartQuantity, removeFromCart, updateUserProfile, updatePreferences, deleteAccount, getSlots, validatePincode, reverseGeocode, saveAddress, deleteAddress,
    trackOrder, checkout,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppProvider.');
  return value;
}
