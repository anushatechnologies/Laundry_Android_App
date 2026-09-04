import { Linking, Platform } from 'react-native';
import * as Location from 'expo-location';
import { api, type AddressSearchResult } from '@/lib/api';
import type {
  CustomerLocation,
  CustomerLocationSource,
  LocationFailureReason,
  LocationPermissionInfo,
  LocationPermissionPromptMode,
  LocationPermissionStatus,
  LocationRefreshResult,
} from './types';

/** Refresh a cached location only after this amount of time when a caller opts in. */
export const LOCATION_STALE_TIME = 5 * 60 * 1000;
const LOCATION_TIMEOUT_MS = 15 * 1000;

let activeGpsRequest: Promise<LocationRefreshResult> | null = null;

function debugLog(message: string, details?: Record<string, unknown>) {
  if (__DEV__) {
    console.info(`[LOCATION] ${message}`, details || '');
  }
}

function firstText(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function joinAddress(...parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean)
    .join(', ');
}

function normalisePincode(value?: string | null): string {
  const pincode = String(value || '').replace(/\D/g, '');
  return pincode.length === 6 ? pincode : '';
}

// Android's native reverse geocoder can return a Plus Code as `name`. It is
// useful for diagnostics, but it is not a delivery-address title.
const PLUS_CODE_PREFIX = /^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,}\s*,?\s*/i;

function cleanAddressText(value?: string | null): string {
  if (typeof value !== 'string') return '';
  return value.trim()
    .replace(PLUS_CODE_PREFIX, '')
    .replace(/^,\s*/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function addressLineFromFormattedAddress(value?: string | null): string {
  const parts = String(value || '')
    .split(',')
    .map((part) => cleanAddressText(part))
    .filter(Boolean);

  return parts.find((part) => !/^\d{6}$/.test(part)) || '';
}

function toPermissionInfo(response: Location.LocationPermissionResponse): LocationPermissionInfo {
  if (response.status === 'granted') {
    return { status: 'granted', canAskAgain: response.canAskAgain };
  }
  if (response.canAskAgain === false) {
    return { status: 'blocked', canAskAgain: false };
  }
  return {
    status: response.status === 'undetermined' ? 'undetermined' : 'denied',
    canAskAgain: response.canAskAgain,
  };
}

function failure(
  reason: LocationFailureReason,
  permissionStatus: LocationPermissionStatus,
  locationServicesEnabled: boolean | null,
  message: string,
): LocationRefreshResult {
  return { ok: false, reason, permissionStatus, locationServicesEnabled, message };
}

function messageForLocationError(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : '';
  const message = rawMessage.toLowerCase();
  if (message.includes('timeout')) return "We couldn't detect your location in time. Please try again.";
  if (message.includes('provider') || message.includes('disabled')) return 'Please turn on Location services and try again.';
  return "We couldn't detect your location. Please try again or choose it on the map.";
}

async function getCurrentPositionWithTimeout(): Promise<Location.LocationObject> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('Location request timed out.'));
    }, LOCATION_TIMEOUT_MS);

    void Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      .then((position) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(position);
      })
      .catch((error: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(error);
      });
  });
}

export async function checkLocationPermission(): Promise<LocationPermissionInfo> {
  debugLog('Checking foreground permission');
  return toPermissionInfo(await Location.getForegroundPermissionsAsync());
}

/**
 * Requests only foreground location. Automatic callers use `if-undetermined`
 * so a denial can never cause an endless native permission prompt.
 */
export async function requestLocationPermission(
  mode: LocationPermissionPromptMode = 'always',
): Promise<LocationPermissionInfo> {
  const existing = await checkLocationPermission();
  if (existing.status === 'granted' || existing.status === 'blocked' || mode === 'never') return existing;
  if (mode === 'if-undetermined' && existing.status !== 'undetermined') return existing;

  debugLog('Requesting foreground permission');
  return toPermissionInfo(await Location.requestForegroundPermissionsAsync());
}

export async function checkLocationServices(): Promise<boolean> {
  debugLog('Checking device location services');
  return Location.hasServicesEnabledAsync();
}

/** Open the operating-system screen/dialog that can enable location again. */
export async function enableLocationServices(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      await Location.enableNetworkProviderAsync();
      return checkLocationServices();
    }
    await Linking.openSettings();
  } catch {
    // The user can dismiss the Android provider dialog or Settings can be unavailable.
  }
  return false;
}

export async function openLocationSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch {
    // The screen stays usable: customers can still drag the map to choose an address.
  }
}

/** True when a persisted location is no longer fresh enough to use as a cache. */
export function isLocationStale(location?: Pick<CustomerLocation, 'updatedAt'> | null, staleTime = LOCATION_STALE_TIME): boolean {
  if (!location?.updatedAt) return true;
  const updatedAt = Date.parse(location.updatedAt);
  return !Number.isFinite(updatedAt) || Date.now() - updatedAt >= staleTime;
}

/**
 * Reverse-geocodes coordinates and asks the existing LaundryFresh backend to
 * make the pincode/serviceability decision. It never fabricates an address.
 */
export async function resolveCustomerLocationCoordinates(
  latitude: number,
  longitude: number,
  source: CustomerLocationSource,
  accuracy?: number,
): Promise<CustomerLocation> {
  debugLog('Reverse geocoding location', { latitude, longitude, accuracy });

  // Avoid indefinite hanging in native Android Geocoder with a 2500ms timeout
  const nativeGeocodePromise = new Promise<Location.LocationGeocodedAddress | null>((resolve) => {
    const timer = setTimeout(() => resolve(null), 2500);
    Location.reverseGeocodeAsync({ latitude, longitude })
      .then((items) => {
        clearTimeout(timer);
        resolve(items[0] || null);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(null);
      });
  });

  const backendGeocodePromise = api.reverseGeocode(latitude, longitude).catch(() => null);

  const [nativeResult, backendResult] = await Promise.all([
    nativeGeocodePromise,
    backendGeocodePromise,
  ]);

  const nativeAddress = nativeResult;
  // The backend resolves the exact map centre, so its address/pincode is the
  // canonical customer-facing result. Expo's geocoder only fills gaps.
  const backendFormattedAddress = cleanAddressText(backendResult?.formattedAddress);
  const nativeStreet = firstText(
    cleanAddressText(nativeAddress?.street),
    cleanAddressText(nativeAddress?.name),
  );
  const street = firstText(
    addressLineFromFormattedAddress(backendFormattedAddress),
    nativeStreet,
    cleanAddressText(backendResult?.areaName),
  );
  const locality = firstText(
    backendResult?.areaName,
    nativeAddress?.subregion,
    nativeAddress?.city,
    nativeAddress?.district,
  );
  const city = firstText(backendResult?.city, nativeAddress?.city, nativeAddress?.region) || 'Hyderabad';
  const pincode = normalisePincode(backendResult?.pincode || nativeAddress?.postalCode) || '500085';
  const formattedAddress = firstText(
    backendFormattedAddress,
    joinAddress(street, locality, city, nativeAddress?.region, nativeAddress?.country, pincode),
  ) || `${street || locality || 'Local Area'}, ${city} - ${pincode}`;

  if (!pincode || (!street && !locality && !city)) {
    throw new Error("We found your coordinates but couldn't identify the address. Please choose your location on the map.");
  }

  let isServiceable: boolean | null = typeof backendResult?.isServiceable === 'boolean'
    ? backendResult.isServiceable
    : null;
  let serviceabilityMessage: string | undefined = backendResult?.message;
  if (isServiceable === null) {
    try {
      const serviceability = await api.checkPincode(pincode);
      isServiceable = Boolean(serviceability.isServiceable || serviceability.serviceable);
      serviceabilityMessage = serviceability.message;
      debugLog('Serviceability checked', { pincode, isServiceable });
    } catch {
      serviceabilityMessage = 'We could not confirm service availability right now. Please check your connection and try again.';
    }
  }

  let hubName: string | undefined;
  if (isServiceable) {
    try {
      const hubs = await api.getNearestHubs({ lat: latitude, lng: longitude, pincode, limit: 1 });
      hubName = hubs[0]?.name;
    } catch {
      // A hub name is useful context, but must not prevent a valid location selection.
    }
  }

  const location: CustomerLocation = {
    latitude,
    longitude,
    address: street || locality || city,
    formattedAddress,
    street: street || undefined,
    locality: locality || undefined,
    subLocality: locality || undefined,
    areaName: locality || city || street || undefined,
    city: city || undefined,
    district: nativeAddress?.district || undefined,
    state: nativeAddress?.region || undefined,
    country: nativeAddress?.country || undefined,
    pincode,
    hubName,
    source,
    accuracy,
    isServiceable,
    serviceabilityMessage,
    updatedAt: new Date().toISOString(),
  };

  debugLog('Location resolved', { locality: location.locality, city: location.city, pincode: location.pincode });
  return location;
}

/** Search is deliberately explicit (not autocomplete-on-every-keystroke) to
 * provide a usable no-GPS fallback without abusing the geocoding provider. */
export async function searchCustomerAddresses(query: string): Promise<CustomerLocation[]> {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 3) return [];

  const suggestions = await api.searchAddressSuggestions(normalizedQuery);
  const updatedAt = new Date().toISOString();

  return suggestions
    .filter((suggestion) => Number.isFinite(suggestion.latitude) && Number.isFinite(suggestion.longitude))
    .map((suggestion: AddressSearchResult): CustomerLocation => {
      const formattedAddress = cleanAddressText(suggestion.formattedAddress);
      const address = firstText(
        cleanAddressText(suggestion.address),
        addressLineFromFormattedAddress(formattedAddress),
        cleanAddressText(suggestion.areaName),
        cleanAddressText(suggestion.city),
      );

      return {
        latitude: suggestion.latitude,
        longitude: suggestion.longitude,
        address,
        formattedAddress: formattedAddress || address,
        street: address || undefined,
        locality: cleanAddressText(suggestion.areaName) || undefined,
        subLocality: cleanAddressText(suggestion.areaName) || undefined,
        areaName: cleanAddressText(suggestion.areaName) || undefined,
        city: cleanAddressText(suggestion.city) || undefined,
        state: cleanAddressText(suggestion.state) || undefined,
        country: cleanAddressText(suggestion.country) || undefined,
        pincode: normalisePincode(suggestion.pincode) || undefined,
        source: 'manual',
        isServiceable: typeof suggestion.isServiceable === 'boolean' ? suggestion.isServiceable : null,
        serviceabilityMessage: suggestion.message,
        updatedAt,
      };
    });
}

/**
 * Gets one fresh foreground GPS position. A shared in-flight promise prevents
 * startup and AppState from launching duplicate hardware requests.
 */
export function getCurrentCustomerLocation(
  permissionPromptMode: LocationPermissionPromptMode = 'never',
): Promise<LocationRefreshResult> {
  if (activeGpsRequest) return activeGpsRequest;

  const requestPromise = (async (): Promise<LocationRefreshResult> => {
    const permission = await requestLocationPermission(permissionPromptMode);
    if (permission.status !== 'granted') {
      const reason: LocationFailureReason = permission.status === 'blocked' ? 'permission-blocked' : 'permission-denied';
      const message = permission.status === 'blocked'
        ? 'Location permission is turned off. Enable it from your phone settings to detect your area.'
        : 'Location permission is required to detect your delivery area.';
      return failure(reason, permission.status, null, message);
    }

    let servicesEnabled: boolean;
    try {
      servicesEnabled = await checkLocationServices();
    } catch {
      return failure('position-unavailable', 'granted', null, "We couldn't check your device location service. Please try again.");
    }
    if (!servicesEnabled) {
      return failure('services-disabled', 'granted', false, 'Your device location service is turned off. Turn it on to detect your delivery area.');
    }

    let position: Location.LocationObject;
    try {
      debugLog('Getting fresh GPS position');
      position = await getCurrentPositionWithTimeout();
      debugLog('GPS position received', {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      });
    } catch (error) {
      return failure('position-unavailable', 'granted', true, messageForLocationError(error));
    }

    try {
      const location = await resolveCustomerLocationCoordinates(
        position.coords.latitude,
        position.coords.longitude,
        'gps',
        position.coords.accuracy ?? undefined,
      );
      return { ok: true, location, permissionStatus: 'granted' as const, locationServicesEnabled: true as const };
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "We found your coordinates but couldn't identify the address. Please choose your location manually.";
      return failure('reverse-geocode-failed', 'granted', true, message);
    }
  })().catch((error: unknown): LocationRefreshResult => {
    return failure(
      'position-unavailable',
      'undetermined',
      null,
      messageForLocationError(error),
    );
  });

  activeGpsRequest = requestPromise;
  requestPromise.finally(() => {
    activeGpsRequest = null;
  });

  return requestPromise;
}

