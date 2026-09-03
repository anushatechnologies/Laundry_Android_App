/**
 * One normalized location model shared by the customer app.
 *
 * `source` describes how the active delivery location was chosen. A saved
 * location is only a cache used while a fresh foreground GPS lookup runs.
 */
export type CustomerLocationSource = 'gps' | 'manual' | 'saved';

export type LocationPermissionStatus = 'granted' | 'denied' | 'undetermined' | 'blocked';

export type LocationFailureReason =
  | 'permission-denied'
  | 'permission-blocked'
  | 'services-disabled'
  | 'position-unavailable'
  | 'reverse-geocode-failed';

export interface CustomerLocation {
  latitude: number;
  longitude: number;
  address?: string;
  formattedAddress?: string;
  street?: string;
  locality?: string;
  subLocality?: string;
  areaName?: string;
  city?: string;
  district?: string;
  state?: string;
  country?: string;
  pincode?: string;
  hubName?: string;
  source: CustomerLocationSource;
  accuracy?: number;
  isServiceable?: boolean | null;
  serviceabilityMessage?: string;
  updatedAt: string;
}

export interface CustomerLocationState {
  /** The address the customer selected for pickup and delivery. */
  deliveryLocation: CustomerLocation | null;
  /** The phone's most recently detected foreground GPS location. */
  currentLocation: CustomerLocation | null;
  loading: boolean;
  permissionStatus: LocationPermissionStatus;
  locationServicesEnabled: boolean | null;
  error: string | null;
  lastUpdated: string | null;
}

export interface LocationPermissionInfo {
  status: LocationPermissionStatus;
  canAskAgain: boolean;
}

export type LocationPermissionPromptMode = 'never' | 'if-undetermined' | 'always';

export type LocationRefreshResult =
  | {
      ok: true;
      location: CustomerLocation;
      permissionStatus: 'granted';
      locationServicesEnabled: true;
    }
  | {
      ok: false;
      reason: LocationFailureReason;
      permissionStatus: LocationPermissionStatus;
      locationServicesEnabled: boolean | null;
      message: string;
    };

