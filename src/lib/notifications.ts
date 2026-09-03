import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Configure foreground notification behavior:
 * Alerts, sounds, banners, and badges always trigger when the app is active.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Ensures high-priority Android notification channels exist.
 */
export async function setupAndroidNotificationChannels(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('orders', {
      name: 'Order Updates',
      description: 'Real-time alerts on laundry pickup, care progress, and delivery',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
      lightColor: '#FF7A00',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
      enableLights: true,
      enableVibrate: true,
    });

    await Notifications.setNotificationChannelAsync('promotions', {
      name: 'Offers & Discounts',
      description: 'Exclusive coupons and special laundry deals',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      lightColor: '#3B82F6',
    });
  }
}

function isNotificationPermissionGranted(permission: Notifications.NotificationPermissionsStatus): boolean {
  if (Platform.OS === 'ios') {
    const iosStatus = permission.ios?.status;
    return (
      iosStatus === Notifications.IosAuthorizationStatus.AUTHORIZED ||
      iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL ||
      iosStatus === Notifications.IosAuthorizationStatus.EPHEMERAL
    );
  }

  return permission.status === 'granted';
}

/**
 * Runs once when the app opens. It lets Android/iOS show their native prompt
 * only before the customer has made a choice; a denial is never re-prompted.
 */
export async function requestNotificationPermissionOnAppOpen(): Promise<boolean> {
  try {
    await setupAndroidNotificationChannels();

    const current = await Notifications.getPermissionsAsync();
    if (isNotificationPermissionGranted(current)) return true;

    // A native permission dialog can only be presented before the customer has
    // made their initial choice. After a denial, Android/iOS settings own it.
    if (current.status !== 'undetermined') {
      console.log('[Push] Notifications are not allowed. The user can change this in device settings.');
      return false;
    }

    const requested = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });

    if (!isNotificationPermissionGranted(requested)) {
      console.log('[Push] Notification permission was not granted.');
      return false;
    }

    return true;
  } catch (err) {
    console.warn('[Push] Could not initialize notification permission:', err);
    return false;
  }
}

/**
 * Returns the native Android FCM registration token. This intentionally never
 * obtains an Expo Push token: the backend sends through Firebase Admin only.
 */
export async function getFirebasePushToken(): Promise<string | null> {
  try {
    await setupAndroidNotificationChannels();

    const permission = await Notifications.getPermissionsAsync();
    if (!isNotificationPermissionGranted(permission)) return null;

    if (Platform.OS !== 'android') {
      console.warn('[Push] Native FCM registration is currently configured for Android only.');
      return null;
    }

    const deviceToken = await Notifications.getDevicePushTokenAsync();
    if (deviceToken?.data && typeof deviceToken.data === 'string' && deviceToken.data.length > 10) {
      console.log('[Push] Native Firebase FCM device token obtained.');
      return deviceToken.data;
    }

    return null;
  } catch (err) {
    console.warn('[Push] Could not obtain a native Firebase FCM token:', err);
    return null;
  }
}
