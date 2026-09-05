export type PricingModel = 'PER_KG' | 'PER_ITEM';

export type ExpressTier = 'REGULAR' | 'EXPRESS_24H' | 'SAME_DAY';

export type PaymentMethod = 'ONLINE_RAZORPAY' | 'COD' | 'WALLET';

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

export type OrderStatus =
  | 'ORDER_PLACED'
  | 'PICKUP_ASSIGNED'
  | 'PICKED_UP'
  | 'RECEIVED_AT_FACILITY'
  | 'WEIGHED_VERIFIED'
  | 'WASHING'
  | 'DRYING'
  | 'IRONING'
  | 'QUALITY_CHECK'
  | 'PACKED'
  | 'DELIVERY_ASSIGNED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED';

export type AddressType = 'Home' | 'Office' | 'Other';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: 'CUSTOMER';
  preferences?: CustomerPreferences;
}

export type StarchLevel = 'NONE' | 'LIGHT' | 'MEDIUM' | 'HEAVY';
export type PackagingPreference = 'FOLDED' | 'HANGER';
export type FragrancePreference = 'FRESH' | 'LAVENDER' | 'SCENT_FREE';
export type DeliveryInstructions = 'RING_BELL' | 'LEAVE_AT_DOOR' | 'CALL_ON_ARRIVAL';

export interface CustomerPreferences {
  whatsappUpdates: boolean;
  promotionalAlerts: boolean;
  starchLevel: StarchLevel;
  packagingPreference: PackagingPreference;
  fragrancePreference: FragrancePreference;
  deliveryInstructions: DeliveryInstructions;
}

export const DEFAULT_CUSTOMER_PREFERENCES: CustomerPreferences = {
  whatsappUpdates: true,
  promotionalAlerts: false,
  starchLevel: 'NONE',
  packagingPreference: 'FOLDED',
  fragrancePreference: 'FRESH',
  deliveryInstructions: 'RING_BELL',
};

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: Customer;
}

export interface ServiceCategory {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description: string;
  isPopular?: boolean;
  color?: string;
  imageUrl?: string;
  image?: string;
}

export interface Subcategory {
  id: string;
  categoryTag: string;
  name: string;
  imageUrl?: string;
  isActive: boolean;
  sortOrder: number;
}

export interface ClothType {
  id: string;
  name: string;
  icon: string;
  categoryTag: string;
  categoryLabel: string;
  subCategory?: string;
  description?: string;
  isActive: boolean;
  sortOrder: number;
  imageUrl?: string;
  image?: string;
}

export interface ServiceMaster {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  imageUrl?: string;
  image?: string;
  pricingType: PricingModel | 'FIXED_PACKAGE';
  baseKgPrice?: number;
  minOrderKg?: number;
  serviceCode?: string;
  turnaroundHours: number;
  description: string;
  isActive: boolean;
}

export interface ServicePriceItem {
  id: string;
  clothTypeId: string;
  clothName: string;
  clothIcon: string;
  categoryTag: string;
  serviceId: string;
  serviceName: string;
  price: number;
  expressPrice?: number;
  turnaroundHours: number;
  isActive: boolean;
  imageUrl?: string;
  image?: string;
}

export interface PricingSettings {
  taxPercentage: number;
  minOrderValue: number;
  freeDeliveryThreshold: number;
  standardDeliveryFee: number;
  expressDeliveryFee: number;
  extraKgPrice: number;
  isGstEnabled?: boolean;
}

export interface Catalog {
  categories: ServiceCategory[];
  subcategories?: Subcategory[];
  clothTypes: ClothType[];
  serviceMasters: ServiceMaster[];
  priceMatrix: ServicePriceItem[];
  settings: PricingSettings;
  perKgServices: ServiceMaster[];
}

export interface CartItem {
  id: string;
  serviceId: string;
  serviceName: string;
  categoryName: string;
  pricingModel: PricingModel;
  unitPrice: number;
  quantity: number;
  unit: string;
  subtotal: number;
  specialInstructions?: string;
  clothId?: string;
  clothName?: string;
  turnaroundHours?: number;
  imageUrl?: string;
}

export interface CustomerAddress {
  id: string;
  type: AddressType;
  contactName?: string;
  contactPhone?: string;
  houseNo?: string;
  area?: string;
  street: string;
  landmark?: string;
  city: string;
  state?: string;
  pincode: string;
  instructions?: string;
  isDefault?: boolean;
}

export interface PickupSlot {
  id: string;
  hubId: string;
  date: string;
  startTime: string;
  endTime: string;
  maxOrders: number;
  bookedOrders: number;
  maxKg: number;
  bookedKg: number;
  isAvailable: boolean;
  isActive: boolean;
  isPast?: boolean;
}

export interface PincodeCheck {
  isServiceable: boolean;
  serviceable?: boolean;
  pincode: string;
  areaName?: string;
  city?: string;
  message?: string;
  zone?: {
    standardFee: number;
    minFreeOrderValue: number;
    expressAvailable: boolean;
  };
}

export interface Coupon {
  id: string;
  code: string;
  title: string;
  description: string;
  discountType: 'FLAT' | 'PERCENTAGE';
  discountValue: number;
  minOrderValue: number;
  maxDiscountCap?: number;
  firstOrderOnly: boolean;
  expiryDate: string;
  usageCount?: number;
  isActive: boolean;
}

export interface CouponApplication {
  isValid: boolean;
  discount: number;
  message: string;
  coupon?: Coupon;
}

export interface BulkPricingSlab {
  id: string;
  weightKg: number;
  regularPrice: number;
  expressPrice: number;
  regularTatHours: number;
  expressTatHours: number;
}

export interface BulkPricingService {
  serviceId: string;
  serviceName: string;
  icon?: string;
  pricing: BulkPricingSlab[];
}

export interface BulkPricingFeed {
  laundryType: 'MIXED_LAUNDRY';
  services: BulkPricingService[];
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  durationMonths: number;
  price: number;
  originalPrice?: number;
  validityDays: number;
  includedKg: number;
  freePickupDelivery: boolean;
  priorityService: boolean;
  maxFamilyMembers: number;
  features: string[];
  popular: boolean;
  isActive: boolean;
}

export interface OrderStatusHistoryItem {
  status: OrderStatus;
  title: string;
  description: string;
  timestamp: string;
  updatedBy?: string;
}

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  address: CustomerAddress;
  items: CartItem[];
  expressTier: ExpressTier;
  pickupSlot: { date: string; slot: string };
  deliverySlot?: { date: string; slot: string };
  currentStatus: OrderStatus;
  statusHistory: OrderStatusHistoryItem[];
  itemTotal: number;
  discountAmount: number;
  couponCode?: string;
  pickupDeliveryFee: number;
  expressFee: number;
  taxAmount: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface TrackingOrder {
  id: string;
  currentStatus: OrderStatus;
  statusHistory: OrderStatusHistoryItem[];
  pickupSlot?: { date: string; slot: string };
  deliverySlot?: { date: string; slot: string };
  paymentStatus: PaymentStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface RazorpayPaymentOrder {
  key: string;
  orderId: string;
  amount: number;
  currency: string;
  internalOrderId: string;
  isMock?: boolean;
}

export interface CheckoutInput {
  address: CustomerAddress;
  slot: PickupSlot;
  expressTier: ExpressTier;
  paymentMethod: PaymentMethod;
  couponCode?: string;
  notes?: string;
  useWallet?: boolean;
  onLaunchOnlinePayment?: (paymentOrder: RazorpayPaymentOrder) => Promise<{
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }>;
}

export interface HubBranch {
  id: string;
  name: string;
  code: string;
  city: string;
  state: string;
  address: string;
  latitude: number;
  longitude: number;
  contactPhone: string;
  capacityKgPerDay: number;
  operatingHours: string;
  maxServiceRadiusKm: number;
  baseDistanceKm: number;
  baseDeliveryFare: number;
  perKmFare: number;
  freeDeliveryAbove: number;
  pincodes: string[];
  isActive: boolean;
  distanceKm?: number;
  estimatedDeliveryFee?: number;
  isFreeDelivery?: boolean;
  withinRadius?: boolean;
  isServicingPincode?: boolean;
  isRecommended?: boolean;
}

export interface FareCalculationResponse {
  assignedHub?: {
    id: string;
    name: string;
    code: string;
    city: string;
    phone: string;
    address: string;
  };
  distanceKm: number;
  deliveryFee: number;
  isFreeDelivery: boolean;
  freeDeliveryThreshold: number;
  expressFee: number;
  totalPickupDeliveryFee: number;
  estimatedTurnaroundHours: number;
  calculationNote: string;
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string;
  badgeText?: string;
  imageUrl: string;
  couponCode?: string;
  discountPercent?: number;
  actionType?: 'CATEGORY' | 'SERVICE' | 'OFFER' | 'BOOK' | 'URL';
  actionTarget?: string;
  displayOrder: number;
  isActive: boolean;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PolicyData {
  support: {
    phone: string;
    whatsapp: string;
    email: string;
    timings: string;
    address: string;
  };
  refundPolicy: {
    title: string;
    lastUpdated: string;
    highlights: string[];
  };
  privacyPolicy: {
    title: string;
    lastUpdated: string;
    highlights: string[];
  };
  termsPolicy: {
    title: string;
    lastUpdated: string;
    highlights: string[];
  };
}

export interface CustomerSubscription {
  id: string;
  customerId: string;
  subscriptionId: string;
  planName: string;
  status: string;
  isActive: boolean;
  paymentId?: string;
  paymentStatus: string;
  amount: number;
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  usedKg: number;
  remainingKg: number;
  includedKg: number;
  ordersCount: number;
  features: string[];
}

export interface WalletTransaction {
  id: string;
  type: 'CREDIT' | 'DEBIT';
  category: 'WELCOME_BONUS' | 'REFERRAL_REWARD' | 'TOPUP_RAZORPAY' | 'ORDER_PAYMENT' | 'DISPUTE_REFUND' | 'CASH_RECHARGE';
  amount: number;
  balanceAfter: number;
  referenceId?: string | null;
  description: string;
  createdAt: string;
}

export interface WalletData {
  customerId: string;
  balance: number;
  rewardPoints: number;
  transactions: WalletTransaction[];
}

export interface ReferralFriend {
  id: string;
  name: string;
  phoneMasked: string;
  createdAt: string;
  bonusAwarded: number;
  status: string;
}

export interface ReferralSettings {
  enabled: boolean;
  referrerReward: number;
  friendReward: number;
  minimumFirstOrder: number;
  minimumRedemptionOrder: number;
  rewardValidityDays: number;
  shareUrl: string;
}

export interface ReferralSummary {
  code: string | null;
  rewardAmount?: number;
  friendBonus?: number;
  stats: {
    invited: number;
    qualified?: number;
    totalEarned?: number;
    available?: number;
  };
  friends?: ReferralFriend[];
  history?: any[];
  rewards?: any[];
  shareMessage?: string;
  settings?: ReferralSettings | null;
  canApply?: boolean;
  applied?: any;
}

export interface InAppNotification {
  id: string;
  customerId: string;
  title: string;
  body: string;
  type: 'ORDER' | 'OFFER' | 'SYSTEM' | string;
  channel: 'orders' | 'promotions' | string;
  data?: Record<string, any>;
  isRead: boolean;
  createdAt: string;
}

