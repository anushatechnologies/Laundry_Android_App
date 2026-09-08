import { DeliveryFeeCalculation, PricingSettings, ExpressTier } from '../../types/domain';

export const PINCODE_COORDINATES: Record<string, { lat: number; lng: number; area: string }> = {
  // Hyderabad & Cyberabad Region
  '500072': { lat: 17.4938, lng: 78.3995, area: 'Kukatpally / KPHB' },
  '500085': { lat: 17.4912, lng: 78.4011, area: 'KPHB Colony / JNTU' },
  '500081': { lat: 17.4483, lng: 78.3915, area: 'Madhapur / Hitech City' },
  '500084': { lat: 17.4699, lng: 78.3578, area: 'Kondapur / Botanical Garden' },
  '500032': { lat: 17.4401, lng: 78.3489, area: 'Gachibowli / Financial District' },
  '500033': { lat: 17.4319, lng: 78.4073, area: 'Jubilee Hills' },
  '500034': { lat: 17.4156, lng: 78.4357, area: 'Banjara Hills' },
  '500018': { lat: 17.4578, lng: 78.4428, area: 'Erragadda / Sanath Nagar' },
  '500016': { lat: 17.4447, lng: 78.4664, area: 'Begumpet' },
  '500003': { lat: 17.4399, lng: 78.4983, area: 'Secunderabad' },
  '500082': { lat: 17.4265, lng: 78.4533, area: 'Somajiguda / Punjagutta' },
  '500090': { lat: 17.5186, lng: 78.3845, area: 'Nizampet / Pragathi Nagar' },
  '500049': { lat: 17.4968, lng: 78.3614, area: 'Miyapur' },
  '500055': { lat: 17.5180, lng: 78.4350, area: 'Quthbullapur / Chintal' },
  '500038': { lat: 17.4428, lng: 78.4485, area: 'Ameerpet / SR Nagar' },
  '500079': { lat: 17.3457, lng: 78.5322, area: 'Karmanghat / LB Nagar' },
  '500008': { lat: 17.3970, lng: 78.4398, area: 'Mehdipatnam' },
  '500028': { lat: 17.3850, lng: 78.4470, area: 'Masab Tank' },
  '500019': { lat: 17.4520, lng: 78.3880, area: 'HITEC City Phase 2' },
  '500050': { lat: 17.4870, lng: 78.3180, area: 'Chandanagar / Lingampally' },
  '500089': { lat: 17.3870, lng: 78.3640, area: 'Manikonda / Puppalaguda' },
  '500075': { lat: 17.3750, lng: 78.3290, area: 'Narsingi / Gandipet' },

  // Andhra Pradesh - Rajahmundry Hub Network
  '533101': { lat: 16.9891, lng: 81.784, area: 'Rajahmundry Central / Main Road' },
  '533102': { lat: 17.0005, lng: 81.78, area: 'Aryapuram / Danavaipeta' },
  '533103': { lat: 17.02, lng: 81.8, area: 'Danavaipeta / Lalitha Nagar' },
  '533104': { lat: 17.015, lng: 81.81, area: 'Morampudi / Prakash Nagar' },
  '533105': { lat: 16.975, lng: 81.79, area: 'Innespeta / Kambala Cheruvu' },
  '533106': { lat: 16.96, lng: 81.82, area: 'Dowleswaram / Cotton Barrage' },
};

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface LocalDeliveryParams {
  customerLat?: number;
  customerLng?: number;
  customerPincode?: string;
  subtotal?: number;
  expressTier?: ExpressTier;
  pricingSettings?: PricingSettings | null;
}

export function calculateLocalDeliveryFee(params: LocalDeliveryParams): DeliveryFeeCalculation {
  const {
    customerLat,
    customerLng,
    customerPincode,
    subtotal = 0,
    expressTier = 'REGULAR',
    pricingSettings,
  } = params;

  const storeLat = pricingSettings?.storeLatitude ?? 17.492989;
  const storeLng = pricingSettings?.storeLongitude ?? 78.414442;
  const storeName = pricingSettings?.storeName || 'LaundryFresh Central Hub';
  const storeAddress = pricingSettings?.storeAddress || 'Anusha Bazaar, Kukatpally, Hyderabad - 500072';

  const baseKm = pricingSettings?.baseDistanceKm ?? 3;
  const stdFee = pricingSettings?.standardDeliveryFee ?? 30;
  const baseFee = pricingSettings?.baseDeliveryFee ?? stdFee;
  const perKm = pricingSettings?.perKmRateAfterBase ?? 10;
  const freeThreshold = pricingSettings?.freeDeliveryThreshold ?? 499;

  let distanceKm = 0;
  let hasGps = false;

  if (
    typeof customerLat === 'number' &&
    typeof customerLng === 'number' &&
    !isNaN(customerLat) &&
    !isNaN(customerLng) &&
    customerLat !== 0 &&
    customerLng !== 0
  ) {
    hasGps = true;
    distanceKm = parseFloat(haversineKm(storeLat, storeLng, customerLat, customerLng).toFixed(1));
  } else if (customerPincode) {
    const cleanPin = String(customerPincode).trim();
    const pinData = PINCODE_COORDINATES[cleanPin];
    if (pinData) {
      hasGps = true;
      distanceKm = parseFloat(haversineKm(storeLat, storeLng, pinData.lat, pinData.lng).toFixed(1));
    } else {
      distanceKm = baseKm;
    }
  } else {
    distanceKm = baseKm;
  }

  const isFreeDelivery = subtotal >= freeThreshold;
  let deliveryFee = 0;
  let breakdown = '';

  if (isFreeDelivery) {
    deliveryFee = 0;
    breakdown = `🎉 Free delivery unlocked (Order ₹${subtotal} ≥ ₹${freeThreshold}) • Distance: ${distanceKm} km from Hub`;
  } else {
    if (distanceKm <= baseKm) {
      deliveryFee = baseFee;
      breakdown = `📍 Distance: ${distanceKm} km from Hub • Base ${baseKm} km slab (₹${baseFee})`;
    } else {
      const extraKm = parseFloat((distanceKm - baseKm).toFixed(1));
      deliveryFee = Math.round(baseFee + extraKm * perKm);
      breakdown = `📍 Distance: ${distanceKm} km from Hub • Base ${baseKm} km (₹${baseFee}) + ${extraKm} km × ₹${perKm}/km = ₹${deliveryFee}`;
    }
  }

  const expressFeeFromSettings = pricingSettings?.expressDeliveryFee ?? 80;
  const sameDayFeeFromSettings = pricingSettings?.sameDayDeliveryFee ?? (expressFeeFromSettings * 2);
  const expressFee = expressTier === 'EXPRESS_24H'
    ? expressFeeFromSettings
    : expressTier === 'SAME_DAY'
    ? sameDayFeeFromSettings
    : 0;

  const isGstEnabled = pricingSettings?.isGstEnabled !== false;
  const taxPercentage = isGstEnabled ? (pricingSettings?.taxPercentage ?? 5) : 0;
  const taxableAmount = Math.max(0, subtotal + deliveryFee + expressFee);
  const taxAmount = Number((taxableAmount * (taxPercentage / 100)).toFixed(2));
  const finalTotal = Number((taxableAmount + taxAmount).toFixed(2));

  return {
    deliveryFee,
    distanceKm,
    hasGps,
    isFreeDelivery,
    freeDeliveryThreshold: freeThreshold,
    standardDeliveryFee: stdFee,
    baseDistanceKm: baseKm,
    baseDeliveryFee: baseFee,
    perKmRateAfterBase: perKm,
    expressFee,
    expressDeliveryFee: expressFeeFromSettings,
    sameDayDeliveryFee: sameDayFeeFromSettings,
    taxPercentage,
    isGstEnabled,
    taxAmount,
    subtotal,
    finalTotal,
    storeName,
    storeAddress,
    storeLatitude: storeLat,
    storeLongitude: storeLng,
    breakdown,
  };
}
