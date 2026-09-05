import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { type AuthSession, type CartItem, type CustomerPreferences, DEFAULT_CUSTOMER_PREFERENCES } from '@/types/domain';
import type { CustomerLocation } from '@/services/location/types';

const SESSION_KEY = 'laundryfresh.customer.session.v1';
const CART_KEY_BASE = 'laundryfresh.customer.cart.v1';
const WISHLIST_KEY_BASE = 'laundryfresh.customer.wishlist.v1';
const ONBOARDING_KEY = 'laundryfresh.customer.onboarding.v1';
const LEGACY_USER_LOCATION_KEY = 'laundryfresh.customer.location.v1';
const USER_LOCATION_KEY_BASE = 'laundryfresh.customer.location.v2';

/** Location cache is user-scoped so one customer's delivery address never leaks to another. */
export type StoredUserLocation = Partial<CustomerLocation>;

export function getUserLocationKey(userId?: string | null): string {
  return userId ? `${USER_LOCATION_KEY_BASE}.${userId}` : `${USER_LOCATION_KEY_BASE}.guest`;
}

export async function readSession(): Promise<AuthSession | null> {
  try {
    const value = await SecureStore.getItemAsync(SESSION_KEY);
    return value ? (JSON.parse(value) as AuthSession) : null;
  } catch {
    return null;
  }
}

export async function writeSession(session: AuthSession): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

// User-scoped storage keys to isolate carts & wishlists when multiple users log in on the same device (BigBasket / Blinkit pattern)
export function getCartKey(userId?: string | null): string {
  return userId ? `${CART_KEY_BASE}.${userId}` : `${CART_KEY_BASE}.guest`;
}

export function getWishlistKey(userId?: string | null): string {
  return userId ? `${WISHLIST_KEY_BASE}.${userId}` : `${WISHLIST_KEY_BASE}.guest`;
}

export async function readCart(userId?: string | null): Promise<CartItem[]> {
  try {
    const key = getCartKey(userId);
    let value = await AsyncStorage.getItem(key);
    // Backward compatibility: check legacy un-scoped key if guest cart not found
    if (!value && !userId) {
      value = await AsyncStorage.getItem(CART_KEY_BASE);
    }
    const parsed = value ? (JSON.parse(value) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as CartItem[]) : [];
  } catch {
    return [];
  }
}

export async function writeCart(items: CartItem[], userId?: string | null): Promise<void> {
  const key = getCartKey(userId);
  await AsyncStorage.setItem(key, JSON.stringify(items));
}

export async function clearCart(userId?: string | null): Promise<void> {
  const key = getCartKey(userId);
  await AsyncStorage.removeItem(key);
}

export async function readWishlist(userId?: string | null): Promise<string[]> {
  try {
    const key = getWishlistKey(userId);
    let value = await AsyncStorage.getItem(key);
    if (!value && !userId) {
      value = await AsyncStorage.getItem(WISHLIST_KEY_BASE);
    }
    const parsed = value ? (JSON.parse(value) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

export async function writeWishlist(items: string[], userId?: string | null): Promise<void> {
  const key = getWishlistKey(userId);
  await AsyncStorage.setItem(key, JSON.stringify(items));
}

export async function clearWishlist(userId?: string | null): Promise<void> {
  const key = getWishlistKey(userId);
  await AsyncStorage.removeItem(key);
}

/** Whether the customer has already moved past the first-launch brand experience. */
export async function readOnboardingComplete(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ONBOARDING_KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function writeOnboardingComplete(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
}

export async function readUserLocation(userId?: string | null): Promise<StoredUserLocation | null> {
  try {
    let value = await AsyncStorage.getItem(getUserLocationKey(userId));
    // Preserve a pre-v2 guest selection without ever exposing it to a signed-in customer.
    if (!value && !userId) value = await AsyncStorage.getItem(LEGACY_USER_LOCATION_KEY);
    const parsed = value ? (JSON.parse(value) as unknown) : null;
    return parsed && typeof parsed === 'object' ? (parsed as StoredUserLocation) : null;
  } catch {
    return null;
  }
}

export async function writeUserLocation(location: StoredUserLocation, userId?: string | null): Promise<void> {
  await AsyncStorage.setItem(getUserLocationKey(userId), JSON.stringify(location));
}

const PREFERENCES_KEY_BASE = 'laundryfresh.customer.preferences.v1';

export function getPreferencesKey(userId?: string | null): string {
  return userId ? `${PREFERENCES_KEY_BASE}.${userId}` : `${PREFERENCES_KEY_BASE}.guest`;
}

export async function readPreferences(userId?: string | null): Promise<CustomerPreferences> {
  try {
    const key = getPreferencesKey(userId);
    const value = await AsyncStorage.getItem(key);
    if (!value) return { ...DEFAULT_CUSTOMER_PREFERENCES };
    const parsed = JSON.parse(value);
    return { ...DEFAULT_CUSTOMER_PREFERENCES, ...(parsed && typeof parsed === 'object' ? parsed : {}) };
  } catch {
    return { ...DEFAULT_CUSTOMER_PREFERENCES };
  }
}

export async function writePreferences(prefs: CustomerPreferences, userId?: string | null): Promise<void> {
  const key = getPreferencesKey(userId);
  await AsyncStorage.setItem(key, JSON.stringify(prefs));
}
