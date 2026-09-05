import { AppState } from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { readUserLocation, writeUserLocation, type StoredUserLocation } from '@/lib/storage';
import { getCurrentCustomerLocation, LOCATION_STALE_TIME } from './locationService';
import type {
  CustomerLocation,
  CustomerLocationState,
  LocationPermissionPromptMode,
  LocationRefreshResult,
} from './types';

const EMPTY_LOCATION_STATE: CustomerLocationState = {
  deliveryLocation: null,
  currentLocation: null,
  loading: false,
  permissionStatus: 'undetermined',
  locationServicesEnabled: null,
  error: null,
  lastUpdated: null,
};

function hydrateStoredLocation(stored: StoredUserLocation | null): CustomerLocation | null {
  if (!stored || typeof stored.latitude !== 'number' || typeof stored.longitude !== 'number') return null;
  if (!Number.isFinite(stored.latitude) || !Number.isFinite(stored.longitude)) return null;

  return {
    ...stored,
    latitude: stored.latitude,
    longitude: stored.longitude,
    source: stored.source === 'manual' || stored.source === 'gps' || stored.source === 'saved'
      ? stored.source
      : 'saved',
    updatedAt: stored.updatedAt || new Date(0).toISOString(),
  };
}

interface UseCustomerLocationOptions {
  /** `null` keeps a guest cache; a signed-in customer gets an isolated cache. */
  ownerId?: string | null;
  /** Enable startup and foreground GPS refresh only after onboarding is complete. */
  refreshOnForeground: boolean;
}

/**
 * The one app-root location state. It intentionally keeps the physical GPS
 * position separate from the delivery address the customer selected.
 */
export function useCustomerLocation({ ownerId = null, refreshOnForeground }: UseCustomerLocationOptions) {
  const [state, setState] = useState<CustomerLocationState>(EMPTY_LOCATION_STATE);
  const [hydrated, setHydrated] = useState(false);
  const deliveryLocationRef = useRef<CustomerLocation | null>(null);
  const refreshPromiseRef = useRef<Promise<LocationRefreshResult | null> | null>(null);
  const ownerGenerationRef = useRef(0);
  const lastGpsRefreshAtRef = useRef(0);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    let active = true;
    const generation = ownerGenerationRef.current + 1;
    ownerGenerationRef.current = generation;
    deliveryLocationRef.current = null;
    setHydrated(false);
    setState(EMPTY_LOCATION_STATE);

    void readUserLocation(ownerId)
      .then((stored) => {
        if (!active || ownerGenerationRef.current !== generation) return;
        const deliveryLocation = hydrateStoredLocation(stored);
        deliveryLocationRef.current = deliveryLocation;
        setState({
          ...EMPTY_LOCATION_STATE,
          deliveryLocation,
          currentLocation: deliveryLocation ? { ...deliveryLocation, source: 'saved' } : null,
          lastUpdated: deliveryLocation?.updatedAt || null,
        });
      })
      .finally(() => {
        if (active && ownerGenerationRef.current === generation) setHydrated(true);
      });

    return () => {
      active = false;
    };
  }, [ownerId]);

  const saveDeliveryLocation = useCallback(async (location: CustomerLocation) => {
    const normalized: CustomerLocation = {
      ...location,
      source: location.source === 'saved' ? 'manual' : location.source,
      updatedAt: location.updatedAt || new Date().toISOString(),
    };
    deliveryLocationRef.current = normalized;
    if (normalized.source === 'gps') lastGpsRefreshAtRef.current = Date.now();

    setState((current) => ({
      ...current,
      deliveryLocation: normalized,
      lastUpdated: normalized.updatedAt,
      error: null,
    }));
    await writeUserLocation(normalized, ownerId).catch(() => undefined);
  }, [ownerId]);

  const refreshCurrentLocation = useCallback((permissionPromptMode: LocationPermissionPromptMode = 'never') => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;
    const ownerGeneration = ownerGenerationRef.current;

    setState((current) => ({ ...current, loading: true, error: null }));
    const request = getCurrentCustomerLocation(permissionPromptMode)
      .then(async (result) => {
        if (ownerGenerationRef.current !== ownerGeneration) return null;

        if (!result.ok) {
          setState((current) => ({
            ...current,
            loading: false,
            permissionStatus: result.permissionStatus,
            locationServicesEnabled: result.locationServicesEnabled,
            error: result.message,
          }));
          return result;
        }

        lastGpsRefreshAtRef.current = Date.now();
        const activeDelivery = deliveryLocationRef.current;
        // A confirmed pickup address is deliberate, even when it was originally
        // chosen from GPS. Keep physical GPS fresh separately, but never move a
        // delivery address without an explicit customer action.
        const shouldUpdateDeliveryAddress = !activeDelivery;
        const deliveryLocation = shouldUpdateDeliveryAddress ? result.location : activeDelivery;
        if (shouldUpdateDeliveryAddress) {
          deliveryLocationRef.current = result.location;
          await writeUserLocation(result.location, ownerId).catch(() => undefined);
        }

        if (ownerGenerationRef.current !== ownerGeneration) return null;
        setState((current) => ({
          ...current,
          deliveryLocation,
          currentLocation: result.location,
          loading: false,
          permissionStatus: result.permissionStatus,
          locationServicesEnabled: result.locationServicesEnabled,
          error: null,
          lastUpdated: result.location.updatedAt,
        }));
        return result;
      })
      .finally(() => {
        refreshPromiseRef.current = null;
      });

    refreshPromiseRef.current = request;
    return request;
  }, [ownerId]);

  useEffect(() => {
    if (!hydrated || !refreshOnForeground) return;
    // Auto-refresh location on initial hydration if no delivery location exists
    // or if the last GPS update is stale
    const hasNoLocation = !deliveryLocationRef.current;
    const isStale = Date.now() - lastGpsRefreshAtRef.current >= LOCATION_STALE_TIME;
    
    if (hasNoLocation || isStale) {
      // Use 'if-undetermined' to silently get location if permission already granted
      void refreshCurrentLocation('if-undetermined');
    }
  }, [hydrated, refreshCurrentLocation, refreshOnForeground]);

  useEffect(() => {
    if (!hydrated || !refreshOnForeground) return;

    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;
      if ((previousState === 'background' || previousState === 'inactive') && nextState === 'active') {
        if (Date.now() - lastGpsRefreshAtRef.current < LOCATION_STALE_TIME) return;
        void refreshCurrentLocation('never');
      }
    });
    return () => subscription.remove();
  }, [hydrated, refreshCurrentLocation, refreshOnForeground]);

  return {
    state,
    hydrated,
    saveDeliveryLocation,
    refreshCurrentLocation,
  };
}
