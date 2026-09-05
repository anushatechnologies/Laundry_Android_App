import { Platform } from 'react-native';
import { API_BASE_URL } from '@/lib/config';
import type {
  AuthSession,
  Banner,
  BulkPricingFeed,
  CartItem,
  Catalog,
  CheckoutInput,
  ClothType,
  Coupon,
  CouponApplication,
  CustomerAddress,
  CustomerSubscription,
  Order,
  PincodeCheck,
  PickupSlot,
  PricingSettings,
  RazorpayPaymentOrder,
  ReferralSummary,
  ServiceMaster,
  ServicePriceItem,
  SubscriptionPlan,
  TrackingOrder,
  WalletData,
} from '@/types/domain';

type SessionListener = (session: AuthSession | null) => void | Promise<void>;

export interface AddressSearchResult {
  latitude: number;
  longitude: number;
  address?: string;
  formattedAddress?: string;
  areaName?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  isServiceable?: boolean | null;
  message?: string;
}

let activeSession: AuthSession | null = null;
let sessionListener: SessionListener | null = null;
let refreshPromise: Promise<string | null> | null = null;

export class ApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export function configureApiSession(session: AuthSession | null, listener?: SessionListener) {
  activeSession = session;
  sessionListener = listener ?? null;
}

async function updateSession(session: AuthSession | null) {
  activeSession = session;
  await sessionListener?.(session);
}

function endpoint(path: string) {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

async function parseResponse(response: Response) {
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || payload.success === false) {
    throw new ApiError(
      String(payload.message || payload.error || 'The request could not be completed.'),
      response.status,
    );
  }
  return payload;
}

async function refreshAccessToken(): Promise<string | null> {
  // Fix #4: deduplicate concurrent refresh calls with a shared promise lock
  if (refreshPromise) return refreshPromise;

  const session = activeSession;
  if (!session?.refreshToken) return null;

  refreshPromise = (async () => {
    try {
      const response = await fetch(endpoint('/customers/refresh-token'), {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      });
      const payload = await parseResponse(response) as { accessToken?: string; expiresIn?: number; data?: { accessToken?: string } };
      const accessToken = payload.accessToken || payload.data?.accessToken;
      if (!accessToken) throw new ApiError('The customer session could not be refreshed.', response.status);

      const next = { ...session, accessToken, expiresIn: payload.expiresIn || session.expiresIn };
      await updateSession(next);
      return accessToken;
    } catch (error) {
      // Fix #21: only clear session on auth errors (401/403), not on network failures
      if (error instanceof ApiError && error.status && [401, 403].includes(error.status)) {
        await updateSession(null);
      }
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function request<T>(path: string, options: RequestInit = {}, authenticated = false): Promise<T> {
  const makeRequest = async (accessToken?: string) => {
    const headers = new Headers(options.headers);
    headers.set('Accept', 'application/json');
    if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    if (authenticated && accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
    return fetch(endpoint(path), { ...options, headers });
  };

  let response: Response;
  try {
    response = await makeRequest(activeSession?.accessToken);
  } catch {
    throw new ApiError('We could not reach LaundryFresh. Check your connection and try again.');
  }

  if (authenticated && response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) response = await makeRequest(refreshed);
  }

  const payload = await parseResponse(response);
  return (payload.data === undefined ? payload : payload.data) as T;
}

export const api = {
  getReferrals: () => request<ReferralSummary>('/referrals/me', {}, true),
  applyReferral: (code: string) => request<ReferralSummary>('/referrals/apply', { method: 'POST', body: JSON.stringify({ code }) }, true),
  getWallet: () => request<WalletData>('/wallet', {}, true),
  createWalletTopupOrder: (amount: number) =>
    request<{ orderId: string; amount: number; currency: string; key: string }>(
      '/wallet/topup/create-order',
      { method: 'POST', body: JSON.stringify({ amount }) },
      true,
    ),
  verifyWalletTopup: (payload: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }) =>
    request<{ success: boolean; message: string; data: WalletData }>(
      '/wallet/topup/verify',
      { method: 'POST', body: JSON.stringify(payload) },
      true,
    ),
  checkPhone: (phone: string) => request<{ exists: boolean; message?: string }>(`/customers/check-phone?phone=${encodeURIComponent(phone)}`),

  async loginWithFirebase(idToken: string, name?: string, email?: string, referralCode?: string): Promise<AuthSession> {
    const payload = await request<AuthSession & { data?: AuthSession }>('/customers/firebase-login', {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ name, email, referralCode }),
    });
    return payload.data ?? payload;
  },

  async sendOtp(phone: string, name?: string, email?: string, referralCode?: string): Promise<{ success: boolean; message: string; gateway?: string; exists?: boolean }> {
    const payload = await request<{ success: boolean; message: string; gateway?: string; exists?: boolean }>('/customers/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, name, email, referralCode }),
    });
    return payload;
  },

  async verifyOtp(phone: string, otp: string, name?: string, email?: string, referralCode?: string): Promise<AuthSession> {
    const payload = await request<AuthSession & { data?: AuthSession }>('/customers/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, otp, name, email, referralCode }),
    });
    return payload.data ?? payload;
  },

  getCatalog: (categoryTag?: string, subcategory?: string, search?: string) => {
    const qs = new URLSearchParams();
    if (categoryTag) qs.set('category', categoryTag);
    if (subcategory) qs.set('subcategory', subcategory);
    if (search) qs.set('search', search);
    const query = qs.toString();
    return request<Catalog>(query ? `/services/catalog?${query}` : '/services/catalog');
  },
  getClothTypes: (categoryTag?: string) =>
    request<ClothType[]>(categoryTag ? `/services/cloth-types?categoryTag=${encodeURIComponent(categoryTag)}` : '/services/cloth-types'),
  getServiceMasters: () => request<ServiceMaster[]>('/services/masters'),
  getPricingMatrix: (clothId?: string, serviceId?: string) => {
    const qs = new URLSearchParams();
    if (clothId) qs.set('clothId', clothId);
    if (serviceId) qs.set('serviceId', serviceId);
    const query = qs.toString();
    return request<ServicePriceItem[]>(query ? `/services/pricing-matrix?${query}` : '/services/pricing-matrix');
  },
  getServices: (categoryId?: string) =>
    request<{ services: any[]; categories: any[] }>(categoryId ? `/services?categoryId=${encodeURIComponent(categoryId)}` : '/services'),
  getPricingSettings: () => request<PricingSettings>('/services/settings'),
  getCoupons: () => request<Coupon[]>('/coupons'),
  applyCoupon: (code: string, orderTotal: number, isFirstOrder: boolean) =>
    request<CouponApplication>('/coupons/apply', {
      method: 'POST',
      body: JSON.stringify({ code, orderTotal, isFirstOrder }),
    }, true),
  getBulkPricing: () => request<BulkPricingFeed>('/bulk-pricing'),
  getSubscriptionPlans: () => request<SubscriptionPlan[]>('/subscriptions/plans'),
  checkPincode: (pincode: string) => request<PincodeCheck>(`/pincodes/check?pin=${encodeURIComponent(pincode)}`),
  reverseGeocode: (latitude: number, longitude: number) =>
    request<{ pincode?: string; areaName?: string; city?: string; formattedAddress?: string; isServiceable?: boolean; message?: string }>(
      `/pincodes/reverse-geocode?lat=${encodeURIComponent(latitude)}&lng=${encodeURIComponent(longitude)}`,
    ),
  searchAddressSuggestions: (query: string) =>
    request<AddressSearchResult[]>(`/pincodes/search?q=${encodeURIComponent(query)}`),
  getSlots: (date: string) => request<PickupSlot[]>(`/slots?date=${encodeURIComponent(date)}`),
  reserveSlot: (slotId: string, orderKg: number) =>
    request<PickupSlot>('/slots/reserve', { method: 'POST', body: JSON.stringify({ slotId, orderKg }) }, true),
  getAddresses: (customerId: string) => request<CustomerAddress[]>(`/customers/${encodeURIComponent(customerId)}/addresses`, {}, true),
  addAddress: (customerId: string, address: CustomerAddress) =>
    request<CustomerAddress>(`/customers/${encodeURIComponent(customerId)}/addresses`, { method: 'POST', body: JSON.stringify(address) }, true),
  deleteAddress: (customerId: string, addressId: string) =>
    request<CustomerAddress[]>(`/customers/${encodeURIComponent(customerId)}/addresses/${encodeURIComponent(addressId)}`, { method: 'DELETE' }, true),
  getOrders: (customerId: string) =>
    request<Order[]>(`/orders?customerId=${encodeURIComponent(customerId)}`, {}, true),
  getTracking: (orderId: string) => request<TrackingOrder>(`/orders/${encodeURIComponent(orderId)}/track`),
  createOrder: (order: Record<string, unknown>) =>
    request<Order>('/orders', { method: 'POST', body: JSON.stringify(order) }, true),
  createRazorpayOrder: (internalOrderId: string) =>
    request<RazorpayPaymentOrder>('/payments/create-order', { method: 'POST', body: JSON.stringify({ internalOrderId }) }, true),
  verifyRazorpayPayment: (payload: {
    internalOrderId: string;
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => request<Order>('/payments/verify-signature', { method: 'POST', body: JSON.stringify(payload) }, true),
  markRazorpayPaymentFailed: (internalOrderId: string) =>
    request<Order>('/payments/mark-failed', { method: 'POST', body: JSON.stringify({ internalOrderId }) }, true),
  registerPushDevice: (pushToken: string) =>
    request<{ registered: boolean; deviceId?: string }>('/devices/register', {
      method: 'POST',
      body: JSON.stringify({ pushToken, platform: Platform.OS }),
    }, true),
  unregisterPushDevice: (pushToken: string) =>
    request<{ removed: boolean }>('/devices/register', {
      method: 'DELETE',
      body: JSON.stringify({ pushToken }),
    }, true),
  
  // Subscription APIs
  getCustomerSubscriptions: (customerId: string) =>
    request<CustomerSubscription[]>(`/subscriptions/customer/${encodeURIComponent(customerId)}`, {}, true),
  purchaseSubscription: (customerId: string, subscriptionId: string) =>
    request<{ orderId: string; keyId?: string; key?: string; amount: number; currency: string; planName: string; validityDays: number; includedKg: number }>(
      '/subscriptions/purchase',
      { method: 'POST', body: JSON.stringify({ customerId, subscriptionId }) },
      true
    ),
  verifySubscriptionPayment: (payload: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    customerId: string;
    subscriptionId: string;
  }) => request<any>('/subscriptions/verify-payment', { method: 'POST', body: JSON.stringify(payload) }, true),
  toggleSubscriptionAutoRenew: (subscriptionId: string, autoRenew: boolean) =>
    request<any>(`/subscriptions/customer/${encodeURIComponent(subscriptionId)}/toggle-auto-renew`, { method: 'PUT', body: JSON.stringify({ autoRenew }) }, true),
  cancelSubscription: (subscriptionId: string) =>
    request<any>(`/subscriptions/customer/${encodeURIComponent(subscriptionId)}/cancel`, { method: 'PUT' }, true),
  getNearestHubs: (params?: { lat?: number; lng?: number; pincode?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.lat !== undefined) qs.set('lat', String(params.lat));
    if (params?.lng !== undefined) qs.set('lng', String(params.lng));
    if (params?.pincode) qs.set('pincode', params.pincode);
    if (params?.limit) qs.set('limit', String(params.limit));
    return request<import('@/types/domain').HubBranch[]>(`/hubs/nearest?${qs.toString()}`);
  },
  calculateDeliveryFare: (payload: { customerPincode?: string; customerLat?: number; customerLng?: number; orderTotal?: number; isExpress?: boolean }) =>
    request<import('@/types/domain').FareCalculationResponse>('/hubs/calculate-fare', { method: 'POST', body: JSON.stringify(payload) }),
  getNearestHubForPincode: (pincode: string) =>
    request<{ hub: import('@/types/domain').HubBranch; isDirectTerritory: boolean }>(`/hubs/nearest-for-pincode?pincode=${encodeURIComponent(pincode)}`),
  getBanners: () => request<Banner[]>('/banners'),
  updateProfile: (customerId: string, data: { name?: string; email?: string; phone?: string; wishlist?: string[] }) =>
    request<{ id: string; name: string; email?: string; phone: string }>(`/customers/${encodeURIComponent(customerId)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }, true),
  getPreferences: (customerId: string) =>
    request<import('@/types/domain').CustomerPreferences>(`/customers/${encodeURIComponent(customerId)}/preferences`, {}, true),
  updatePreferences: (customerId: string, data: Partial<import('@/types/domain').CustomerPreferences>) =>
    request<import('@/types/domain').CustomerPreferences>(`/customers/${encodeURIComponent(customerId)}/preferences`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }, true),
  deleteAccount: (customerId: string) =>
    request<{ success: boolean; message: string }>(`/customers/${encodeURIComponent(customerId)}`, {
      method: 'DELETE',
    }, true),
  getPolicies: () => request<import('@/types/domain').PolicyData>('/customers/info/policies'),
  getWishlist: (customerId: string) => request<string[]>(`/customers/${encodeURIComponent(customerId)}/wishlist`, {}, true),
  addToWishlist: (customerId: string, itemId: string) =>
    request<string[]>(`/customers/${encodeURIComponent(customerId)}/wishlist`, {
      method: 'POST',
      body: JSON.stringify({ itemId }),
    }, true),
  removeFromWishlist: (customerId: string, itemId: string) =>
    request<string[]>(`/customers/${encodeURIComponent(customerId)}/wishlist/${encodeURIComponent(itemId)}`, {
      method: 'DELETE',
    }, true),
  mergeWishlist: (customerId: string, items: string[]) =>
    request<string[]>(`/customers/${encodeURIComponent(customerId)}/wishlist/merge`, {
      method: 'POST',
      body: JSON.stringify({ items }),
    }, true),
  
  // Chat APIs
  getChatRooms: (customerId: string) =>
    request<{ success: boolean; count: number; data: any[] }>(`/chat/rooms?customerId=${encodeURIComponent(customerId)}`, {}, true),
  createChatRoom: (customerId: string, subject?: string) =>
    request<{ success: boolean; data: any; isNew: boolean }>('/chat/rooms', {
      method: 'POST',
      body: JSON.stringify({ customerId, subject }),
    }, true),
  getChatMessages: (roomId: string, limit = 50, offset = 0) =>
    request<{ success: boolean; count: number; data: any[] }>(
      `/chat/messages/${encodeURIComponent(roomId)}?limit=${limit}&offset=${offset}`,
      {},
      true
    ),
  saveChatMessage: (data: { roomId: string; senderId: string; senderType: string; message: string; messageType?: string; attachmentUrl?: string }) =>
    request<{ success: boolean; data: any }>('/chat/messages', {
      method: 'POST',
      body: JSON.stringify(data),
    }, true),
  markMessageAsRead: (messageId: string) =>
    request<{ success: boolean; message: string }>(`/chat/messages/${encodeURIComponent(messageId)}/read`, {
      method: 'PUT',
    }, true),
  closeChatRoom: (roomId: string) =>
    request<{ success: boolean; message: string }>(`/chat/rooms/${encodeURIComponent(roomId)}/close`, {
      method: 'PUT',
    }, true),

  // Notification Feed APIs
  getNotifications: () =>
    request<{ success: boolean; data: import('@/types/domain').InAppNotification[]; unreadCount: number }>('/notifications', {}, true),
  markNotificationAsRead: (notificationId: string) =>
    request<{ success: boolean }>(`/notifications/${encodeURIComponent(notificationId)}/read`, {
      method: 'PATCH',
    }, true),
  markAllNotificationsAsRead: () =>
    request<{ success: boolean }>('/notifications/mark-all-read', {
      method: 'POST',
    }, true),
  deleteNotification: (notificationId: string) =>
    request<{ success: boolean }>(`/notifications/${encodeURIComponent(notificationId)}`, {
      method: 'DELETE',
    }, true),
};

export function createOrderPayload(session: AuthSession, cart: CartItem[], input: CheckoutInput) {
  const requiredText = (value: string | null | undefined, label: string) => {
    if (!value?.trim()) throw new Error(`Please add ${label} before booking.`);
    return value.trim();
  };
  // Normalize items to strictly match backend priceItems validation: `${clothTypeId}-${serviceId}`
  const cleanItems = cart.map((item) => {
    let cleanId = item.id.replace(/^(garment-|home-|bulk-svc-)/, '');
    let serviceId: string = item.serviceId || 'srv-m-steam-iron';

    // Guard against cases where clothId was mistakenly assigned to serviceId
    if (serviceId.startsWith('cloth-')) {
      const match = cleanId.match(/(srv-m-[a-z-]+)/);
      if (match) {
        serviceId = match[1] ?? 'srv-m-steam-iron';
      } else {
        serviceId = 'srv-m-steam-iron';
      }
    }

    // Ensure cleanId ends with -${serviceId}
    if (!cleanId.includes(serviceId)) {
      cleanId = `${cleanId}-${serviceId}`;
    }

    return {
      ...item,
      id: cleanId,
      serviceName: requiredText(item.serviceName, 'the garment service'),
      unit: requiredText(item.unit, 'the garment unit'),
      serviceId,
      categoryName: item.categoryName?.trim() || 'Laundry',
      specialInstructions: item.specialInstructions || undefined,
    };
  });

  return {
    customerId: session.user.id,
    customerName: requiredText(session.user.name || input.address.contactName, 'your name in Profile or pickup contact'),
    customerPhone: requiredText(session.user.phone || input.address.contactPhone, 'your contact phone number'),
    customerEmail: session.user.email || undefined,
    address: {
      ...input.address,
      street: requiredText(input.address.street, 'the pickup street address'),
      city: requiredText(input.address.city, 'the pickup city'),
      pincode: requiredText(input.address.pincode, 'the pickup PIN code'),
      id: input.address.id || undefined,
      landmark: input.address.landmark || undefined,
    },
    items: cleanItems,
    expressTier: input.expressTier,
    pickupSlot: { date: input.slot.date, slot: `${input.slot.startTime} - ${input.slot.endTime}` },
    couponCode: input.couponCode || undefined,
    paymentMethod: input.paymentMethod,
    notes: input.notes || undefined,
  };
}
