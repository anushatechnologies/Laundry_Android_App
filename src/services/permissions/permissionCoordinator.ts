import { PermissionsAndroid, Platform } from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setupAndroidNotificationChannels } from '@/lib/notifications';

const NOTIF_PERMISSION_ASKED_KEY = 'laundryfresh.permission.notif_asked_v2';
const LOCATION_PERMISSION_ASKED_KEY = 'laundryfresh.permission.location_asked_v2';

export interface StartupPermissionResult {
  notificationsGranted: boolean;
  locationGranted: boolean;
  locationBlocked: boolean;
  gpsCoords: { latitude: number; longitude: number } | null;
}

/**
 * Requests native Android POST_NOTIFICATIONS permission on Android 13+ (API 33+).
 * Android < 13 automatically grants notification permissions at install time.
 */
export async function requestStartupNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    try {
      await setupAndroidNotificationChannels();

      // Android 13+ (API level 33+) requires runtime POST_NOTIFICATIONS permission
      if (Platform.Version >= 33) {
        const alreadyGranted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        if (alreadyGranted) {
          return true;
        }

        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        return result === PermissionsAndroid.RESULTS.GRANTED;
      }

      return true;
    } catch (err) {
      console.warn('[Permissions] Android notification request error:', err);
      return false;
    }
  } else if (Platform.OS === 'ios') {
    try {
      const current = await Notifications.getPermissionsAsync();
      if (current.status === 'granted') return true;
      if (current.status === 'undetermined') {
        const requested = await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowBadge: true, allowSound: true },
        });
        return requested.status === 'granted';
      }
      return false;
    } catch (err) {
      console.warn('[Permissions] iOS notification request error:', err);
      return false;
    }
  }

  return true;
}

/**
 * Requests native Android Location permissions (FINE + COARSE together for Android 12+).
 */
export async function requestStartupLocationPermission(): Promise<{
  granted: boolean;
  blocked: boolean;
  coords: { latitude: number; longitude: number } | null;
}> {
  if (Platform.OS === 'android') {
    try {
      const fineGranted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      const coarseGranted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
      );

      if (fineGranted || coarseGranted) {
        // Location already granted! Check if device location service is enabled
        try {
          const hasServices = await Location.hasServicesEnabledAsync();
          if (!hasServices) {
            await Location.enableNetworkProviderAsync().catch(() => {});
          }
        } catch {}
        const coords = await getQuickGpsCoordinates();
        return { granted: true, blocked: false, coords };
      }

      // Request both FINE and COARSE together (Android 12+ approximate / precise options)
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      ]);

      const fine = results[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
      const coarse = results[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION];

      const isGranted =
        fine === PermissionsAndroid.RESULTS.GRANTED ||
        coarse === PermissionsAndroid.RESULTS.GRANTED;

      const isBlocked =
        fine === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN &&
        coarse === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN;

      let coords: { latitude: number; longitude: number } | null = null;
      if (isGranted) {
        try {
          const hasServices = await Location.hasServicesEnabledAsync();
          if (!hasServices) {
            await Location.enableNetworkProviderAsync().catch(() => {});
          }
        } catch {}
        coords = await getQuickGpsCoordinates();
      }

      return { granted: isGranted, blocked: isBlocked, coords };
    } catch (err) {
      console.warn('[Permissions] Android location request error:', err);
      return { granted: false, blocked: false, coords: null };
    }
  } else {
    // iOS
    try {
      const current = await Location.getForegroundPermissionsAsync();
      if (current.status === 'granted') {
        const coords = await getQuickGpsCoordinates();
        return { granted: true, blocked: false, coords };
      }
      if (current.status === 'undetermined') {
        const requested = await Location.requestForegroundPermissionsAsync();
        const isGranted = requested.status === 'granted';
        let coords: { latitude: number; longitude: number } | null = null;
        if (isGranted) {
          coords = await getQuickGpsCoordinates();
        }
        return { granted: isGranted, blocked: !requested.canAskAgain && !isGranted, coords };
      }
      return { granted: false, blocked: !current.canAskAgain, coords: null };
    } catch (err) {
      console.warn('[Permissions] iOS location request error:', err);
      return { granted: false, blocked: false, coords: null };
    }
  }
}

/**
 * Re-requests location permission on user interaction (e.g., clicking 'Enable Location').
 */
export async function requestLocationPermissionInteractive(): Promise<{
  granted: boolean;
  blocked: boolean;
  coords: { latitude: number; longitude: number } | null;
}> {
  if (Platform.OS === 'android') {
    try {
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      ]);

      const fine = results[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
      const coarse = results[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION];

      const isGranted =
        fine === PermissionsAndroid.RESULTS.GRANTED ||
        coarse === PermissionsAndroid.RESULTS.GRANTED;

      const isBlocked =
        fine === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN &&
        coarse === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN;

      let coords: { latitude: number; longitude: number } | null = null;
      if (isGranted) {
        coords = await getQuickGpsCoordinates();
      }

      return { granted: isGranted, blocked: isBlocked, coords };
    } catch (err) {
      console.warn('[Permissions] Interactive location request error:', err);
      return { granted: false, blocked: false, coords: null };
    }
  } else {
    try {
      const requested = await Location.requestForegroundPermissionsAsync();
      const isGranted = requested.status === 'granted';
      let coords: { latitude: number; longitude: number } | null = null;
      if (isGranted) {
        coords = await getQuickGpsCoordinates();
      }
      return { granted: isGranted, blocked: !requested.canAskAgain && !isGranted, coords };
    } catch (err) {
      console.warn('[Permissions] Interactive iOS location request error:', err);
      return { granted: false, blocked: false, coords: null };
    }
  }
}

/**
 * Fast GPS coordinate fetch with last-known instant cache + balanced accuracy + IP fallback.
 */
export async function getQuickGpsCoordinates(): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const hasServices = await Location.hasServicesEnabledAsync().catch(() => false);
    if (hasServices) {
      // Fast path: Check last known position (sub-50ms instant return from OS cache)
      try {
        const lastKnown = await Location.getLastKnownPositionAsync();
        if (
          lastKnown?.coords &&
          Number.isFinite(lastKnown.coords.latitude) &&
          Number.isFinite(lastKnown.coords.longitude)
        ) {
          return {
            latitude: lastKnown.coords.latitude,
            longitude: lastKnown.coords.longitude,
          };
        }
      } catch {
        // Fall through to fresh position query
      }

      const pos = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
      ]);

      if (pos && typeof pos === 'object' && 'coords' in pos && pos.coords) {
        const { latitude, longitude } = pos.coords;
        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
          return { latitude, longitude };
        }
      }
    }
  } catch (err) {
    console.warn('[Permissions] Could not fetch GPS position:', err);
  }

  // Resilient Fallback: IP-based Geolocation (guarantees auto-location even indoors or with slow GPS fix)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const ipRes = await fetch('https://ipapi.co/json/', { signal: controller.signal });
    clearTimeout(timeout);
    if (ipRes.ok) {
      const data = await ipRes.json();
      if (Number.isFinite(data?.latitude) && Number.isFinite(data?.longitude)) {
        return { latitude: data.latitude, longitude: data.longitude };
      }
    }
  } catch {
    // Fall back to Hyderabad Hub coordinates
  }

  // Final fallback: Hyderabad central hub coordinates
  return { latitude: 17.4875, longitude: 78.3953 };
}

/**
 * Coordinated First-Launch flow:
 * Requests Notifications and Location together in a single native dialog batch.
 */
export async function runFirstLaunchPermissions(): Promise<StartupPermissionResult> {
  if (Platform.OS === 'android') {
    try {
      await setupAndroidNotificationChannels().catch(() => {});

      const permsToRequest: Array<any> = [
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      ];
      if (Number(Platform.Version) >= 33) {
        permsToRequest.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      }

      const results = await PermissionsAndroid.requestMultiple(permsToRequest);

      const fine = results[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
      const coarse = results[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION];
      const notif = results[PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS];

      const locationGranted =
        fine === PermissionsAndroid.RESULTS.GRANTED ||
        coarse === PermissionsAndroid.RESULTS.GRANTED;

      const locationBlocked =
        fine === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN &&
        coarse === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN;

      const notificationsGranted =
        Number(Platform.Version) < 33 ||
        notif === PermissionsAndroid.RESULTS.GRANTED;

      const coords = await getQuickGpsCoordinates();

      return {
        notificationsGranted,
        locationGranted,
        locationBlocked,
        gpsCoords: coords,
      };
    } catch (err) {
      console.warn('[Permissions] Coordinated Android request error:', err);
      const coords = await getQuickGpsCoordinates();
      return { notificationsGranted: false, locationGranted: true, locationBlocked: false, gpsCoords: coords };
    }
  } else {
    // iOS
    try {
      let notificationsGranted = false;
      const notifCurrent = await Notifications.getPermissionsAsync();
      if (notifCurrent.status === 'granted') {
        notificationsGranted = true;
      } else if (notifCurrent.status === 'undetermined') {
        const notifReq = await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowBadge: true, allowSound: true },
        });
        notificationsGranted = notifReq.status === 'granted';
      }

      const locCurrent = await Location.getForegroundPermissionsAsync();
      let locationGranted = locCurrent.status === 'granted';
      let locationBlocked = !locCurrent.canAskAgain && !locationGranted;

      if (!locationGranted && locCurrent.canAskAgain) {
        const locReq = await Location.requestForegroundPermissionsAsync();
        locationGranted = locReq.status === 'granted';
        locationBlocked = !locReq.canAskAgain && !locationGranted;
      }

      const coords = await getQuickGpsCoordinates();

      return {
        notificationsGranted,
        locationGranted,
        locationBlocked,
        gpsCoords: coords,
      };
    } catch (err) {
      console.warn('[Permissions] Coordinated iOS request error:', err);
      const coords = await getQuickGpsCoordinates();
      return { notificationsGranted: false, locationGranted: true, locationBlocked: false, gpsCoords: coords };
    }
  }
}
