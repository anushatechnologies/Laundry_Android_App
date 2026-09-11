import { DeliveryFeeCalculation, PricingSettings, ExpressTier } from '../../types/domain';

export const PINCODE_COORDINATES: Record<string, { lat: number; lng: number; area: string }> = {
  // Hyderabad & Cyberabad Region
  '500072': { lat: 17.4938, lng: 78.3995, area: 'Kukatpally / KPHB' },
  '500085': { lat: 17.4912, lng: 78.4011, area: 'KPHB Colony / JNTU' },
  '500081': { lat: 17.4483, lng: 78.3915, area: 'Madhapur / Hitech City' },
  '500084': { lat: 17.4699, lng: 78.3578, area: 'Kondapur / Botanical Garden' },
  '500032': { lat: 17.4401, lng: 78.3489, area: 'Gachibowli / Financial District' },
  '500104': { lat: 17.4200, lng: 78.3680, area: 'Siri Sampada Arcade 1 / Khajaguda / Gachibowli' },
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

export interface LaundryHubSummary {
  id: string;
  name: string;
  code: string;
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  baseDistanceKm: number;
  baseDeliveryFare: number;
  perKmFare: number;
  freeDeliveryAbove: number;
  maxServiceRadiusKm: number;
  pincodes: string[];
}

export const LAUNDRY_HUBS: LaundryHubSummary[] = [
  {
    id: 'HUB-HYD-01',
    name: 'Hyderabad Cyber Hub & Processing Plant',
    code: 'HUB-HYD-01',
    city: 'Hyderabad',
    address: 'Survey 64, Hitech City Main Road, Madhapur, Hyderabad - 500081 (Serving Khajaguda / Gachibowli)',
    latitude: 17.4483,
    longitude: 78.3915,
    baseDistanceKm: 3,
    baseDeliveryFare: 30,
    perKmFare: 10,
    freeDeliveryAbove: 499,
    maxServiceRadiusKm: 35,
    pincodes: [
      '500081','500032','500104','500084','500072','500085','500033','500034','500089','500075',
      '500049','500050','500090','500018','500082','500016','500003','500026','500009',
      '500015','500011','500062','500047','500040','500056','500014','500055','500037',
      '500008','500028','500004','500001','500029','500020','500044','500007','500017',
      '500039','500076','500068','500074','500070','500035','500036','500059','500053',
      '500077','500030','500052','500088','500043'
    ],
  },
  {
    id: 'HUB-HYD-02',
    name: 'Anusha Laundry / Kukatpally Hub',
    code: 'HUB-HYD-02',
    city: 'Hyderabad',
    address: 'Anusha Bazaar, Kukatpally, Hyderabad - 500072',
    latitude: 17.4929894,
    longitude: 78.4144426,
    baseDistanceKm: 3,
    baseDeliveryFare: 30,
    perKmFare: 10,
    freeDeliveryAbove: 499,
    maxServiceRadiusKm: 25,
    pincodes: ['500072', '500085', '500090', '500049', '500018', '500037', '500055', '500014', '500011', '500040', '500076', '500062', '500047'],
  },
  {
    id: 'HUB-RJY-01',
    name: 'Rajahmundry Central Processing Hub',
    code: 'HUB-RJY-01',
    city: 'Rajahmundry',
    address: 'Plot 18, Industrial Estate, Danavaipeta Main Road, Rajahmundry, AP - 533103',
    latitude: 17.0005,
    longitude: 81.8040,
    baseDistanceKm: 3,
    baseDeliveryFare: 30,
    perKmFare: 10,
    freeDeliveryAbove: 499,
    maxServiceRadiusKm: 35,
    pincodes: ['533101', '533102', '533103', '533104', '533105', '533106', '533001', '533002', '533003', '533004'],
  },
  {
    id: 'HUB-KAK-01',
    name: 'Kakinada Port Hub',
    code: 'HUB-KAK-01',
    city: 'Kakinada',
    address: 'Near Bhanugudi Junction, Cinema Road, Kakinada, AP - 533003',
    latitude: 16.9890,
    longitude: 82.2474,
    baseDistanceKm: 3,
    baseDeliveryFare: 30,
    perKmFare: 10,
    freeDeliveryAbove: 499,
    maxServiceRadiusKm: 30,
    pincodes: ['533005', '533006', '533007'],
  },
  {
    id: 'HUB-BGL-01',
    name: 'Bangalore HSR Hub',
    code: 'HUB-BGL-01',
    city: 'Bengaluru',
    address: 'Sector 2, 27th Main Rd, HSR Layout, Bengaluru, KA - 560102',
    latitude: 12.9121,
    longitude: 77.6446,
    baseDistanceKm: 3,
    baseDeliveryFare: 30,
    perKmFare: 10,
    freeDeliveryAbove: 499,
    maxServiceRadiusKm: 30,
    pincodes: ['560034', '560102', '560095', '560068', '560076'],
  },
];

export function findNearestLaundryHub(
  lat?: number,
  lng?: number,
  pincode?: string,
  hubs: LaundryHubSummary[] = LAUNDRY_HUBS
): LaundryHubSummary {
  const defaultHub: LaundryHubSummary = hubs[0] ?? LAUNDRY_HUBS[0]!;
  const cleanPin = pincode ? String(pincode).trim() : '';

  if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
    if (cleanPin) {
      const territoryHubs = hubs.filter((h) => h.pincodes.includes(cleanPin));
      const firstTerritory = territoryHubs[0];
      if (firstTerritory) {
        let bestHub = firstTerritory;
        let minD = haversineKm(bestHub.latitude, bestHub.longitude, lat, lng);
        for (let i = 1; i < territoryHubs.length; i++) {
          const current = territoryHubs[i];
          if (current) {
            const d = haversineKm(current.latitude, current.longitude, lat, lng);
            if (d < minD) {
              minD = d;
              bestHub = current;
            }
          }
        }
        return bestHub;
      }
    }

    let closestHub: LaundryHubSummary = defaultHub;
    let minDistance = haversineKm(closestHub.latitude, closestHub.longitude, lat, lng);
    for (let i = 1; i < hubs.length; i++) {
      const current = hubs[i];
      if (current) {
        const d = haversineKm(current.latitude, current.longitude, lat, lng);
        if (d < minDistance) {
          minDistance = d;
          closestHub = current;
        }
      }
    }
    return closestHub;
  }

  if (cleanPin) {
    const matched = hubs.find((h) => h.pincodes.includes(cleanPin));
    if (matched) return matched;
  }

  return defaultHub;
}

export interface LocalDeliveryParams {
  customerLat?: number;
  customerLng?: number;
  customerPincode?: string;
  subtotal?: number;
  expressTier?: ExpressTier;
  pricingSettings?: PricingSettings | null;
  hubId?: string;
}

export function calculateLocalDeliveryFee(params: LocalDeliveryParams): DeliveryFeeCalculation {
  const {
    customerLat,
    customerLng,
    customerPincode,
    subtotal = 0,
    expressTier = 'REGULAR',
    pricingSettings,
    hubId,
  } = params;

  let targetLat = typeof customerLat === 'number' && !isNaN(customerLat) && customerLat !== 0 ? customerLat : undefined;
  let targetLng = typeof customerLng === 'number' && !isNaN(customerLng) && customerLng !== 0 ? customerLng : undefined;

  if ((!targetLat || !targetLng) && customerPincode) {
    const cleanPin = String(customerPincode).trim();
    const pinData = PINCODE_COORDINATES[cleanPin];
    if (pinData) {
      targetLat = pinData.lat;
      targetLng = pinData.lng;
    }
  }

  // Find nearest laundry hub based on location and pincode
  const servicingHub = hubId
    ? LAUNDRY_HUBS.find((h) => h.id === hubId || h.code === hubId) || findNearestLaundryHub(targetLat, targetLng, customerPincode)
    : findNearestLaundryHub(targetLat, targetLng, customerPincode);

  const hubLat = servicingHub.latitude;
  const hubLng = servicingHub.longitude;
  const baseKm = servicingHub.baseDistanceKm ?? pricingSettings?.baseDistanceKm ?? 3;
  const stdFee = servicingHub.baseDeliveryFare ?? pricingSettings?.standardDeliveryFee ?? 30;
  const baseFee = servicingHub.baseDeliveryFare ?? pricingSettings?.baseDeliveryFee ?? stdFee;
  const perKm = servicingHub.perKmFare ?? pricingSettings?.perKmRateAfterBase ?? 10;
  const freeThreshold = servicingHub.freeDeliveryAbove ?? pricingSettings?.freeDeliveryThreshold ?? 499;

  let distanceKm = 0;
  let hasGps = false;

  if (targetLat && targetLng) {
    hasGps = true;
    distanceKm = parseFloat(haversineKm(hubLat, hubLng, targetLat, targetLng).toFixed(1));
  } else {
    distanceKm = baseKm;
  }

  const isFreeDelivery = subtotal >= freeThreshold;
  let deliveryFee = 0;
  let breakdown = '';

  if (isFreeDelivery) {
    deliveryFee = 0;
    breakdown = `🎉 Free delivery unlocked (Order ₹${subtotal} ≥ ₹${freeThreshold}) • Distance: ${distanceKm} km from ${servicingHub.name}`;
  } else {
    if (distanceKm <= baseKm) {
      deliveryFee = baseFee;
      breakdown = `📍 Distance: ${distanceKm} km from ${servicingHub.name} • Base ${baseKm} km slab (₹${baseFee})`;
    } else {
      const extraKm = parseFloat((distanceKm - baseKm).toFixed(1));
      deliveryFee = Math.round(baseFee + extraKm * perKm);
      breakdown = `📍 Distance: ${distanceKm} km from ${servicingHub.name} • Base ${baseKm} km (₹${baseFee}) + ${extraKm} km × ₹${perKm}/km = ₹${deliveryFee}`;
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
    storeName: servicingHub.name || pricingSettings?.storeName || 'LaundryFresh Central Hub',
    storeAddress: servicingHub.address || pricingSettings?.storeAddress || '',
    storeLatitude: hubLat,
    storeLongitude: hubLng,
    breakdown,
    hubId: servicingHub.id,
    hubName: servicingHub.name,
  };
}
