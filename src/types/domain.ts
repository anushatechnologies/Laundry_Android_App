export type PricingModel = 'PER_KG' | 'PER_ITEM';

export type ExpressTier = 'REGULAR' | 'EXPRESS_24H' | 'SAME_DAY';

export type PaymentMethod = 'ONLINE_RAZORPAY' | 'COD';

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
}

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
}

export interface Catalog {
  categories: ServiceCategory[];
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
