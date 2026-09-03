import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import {
  enableLocationServices,
  getCurrentCustomerLocation,
  openLocationSettings,
  resolveCustomerLocationCoordinates,
  searchCustomerAddresses,
} from '@/services/location/locationService';
import type {
  CustomerLocation,
  CustomerLocationSource,
  LocationPermissionPromptMode,
} from '@/services/location/types';
import { requestLocationPermissionInteractive } from '@/services/permissions/permissionCoordinator';

interface MapLocationPickerScreenProps {
  initialLocation?: CustomerLocation | null;
  initialGpsCoords?: Coordinates | null;
  initialPermissionStatus?: 'granted' | 'denied' | 'blocked';
  autoPermissionPrompt?: LocationPermissionPromptMode;
  onLocationConfirmed: (location: CustomerLocation) => void | Promise<void>;
  onBack: () => void;
}

type LocationPhase =
  | 'locating'
  | 'resolving'
  | 'ready'
  | 'permission-denied'
  | 'permission-blocked'
  | 'location-off'
  | 'error';

interface Coordinates {
  latitude: number;
  longitude: number;
}

// This is only an initial viewport for the service region, never a selected address.
const DEFAULT_MAP_VIEWPORT: Coordinates = { latitude: 17.385, longitude: 78.4867 };
const DEFAULT_MAP_ZOOM = 16;
const PLUS_CODE_PREFIX = /^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,}\s*,?\s*/i;

// OpenStreetMap tiles are used deliberately: the app has no client-side Google
// Maps SDK key, and the required OpenStreetMap/Leaflet attribution stays visible.
const MAP_HTML = `
<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>
      html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #e5e7eb; overflow: hidden; }
      .leaflet-control-attribution {
        background: rgba(255,255,255,0.88) !important;
        color: #475569 !important;
        font: 10px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
        padding: 3px 5px !important;
        border-radius: 4px 0 0 0;
      }
      .leaflet-control-attribution a { color: #2563eb !important; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script>
      var map = L.map('map', {
        center: [${DEFAULT_MAP_VIEWPORT.latitude}, ${DEFAULT_MAP_VIEWPORT.longitude}],
        zoom: ${DEFAULT_MAP_ZOOM},
        zoomControl: false,
        attributionControl: true,
        preferCanvas: true
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: ['a', 'b', 'c'],
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
      }).addTo(map);

      var isProgrammaticMove = false;
      var settleTimer = null;
      function send(message) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(message));
        }
      }
      window.setMapCenter = function(latitude, longitude, zoom) {
        isProgrammaticMove = true;
        map.setView([latitude, longitude], zoom || ${DEFAULT_MAP_ZOOM});
        window.setTimeout(function() { isProgrammaticMove = false; }, 700);
      };
      map.on('movestart', function() {
        if (!isProgrammaticMove) send({ type: 'map_moving' });
      });
      map.on('moveend', function() {
        if (isProgrammaticMove) {
          isProgrammaticMove = false;
          return;
        }
        if (settleTimer) window.clearTimeout(settleTimer);
        settleTimer = window.setTimeout(function() {
          var center = map.getCenter();
          send({ type: 'center_changed', latitude: center.lat, longitude: center.lng });
        }, 400);
      });
      map.whenReady(function() {
        send({ type: 'map_ready' });
      });
    </script>
  </body>
</html>
`;

function getInitialCoordinates(location?: CustomerLocation | null): Coordinates {
  if (
    location
    && Number.isFinite(location.latitude)
    && Number.isFinite(location.longitude)
  ) {
    return { latitude: location.latitude, longitude: location.longitude };
  }
  return DEFAULT_MAP_VIEWPORT;
}

function cleanAddressText(value?: string | null): string {
  if (typeof value !== 'string') return '';
  return value.trim().replace(PLUS_CODE_PREFIX, '').replace(/^,\s*/, '').trim();
}

function humanAddress(location: CustomerLocation | null): string {
  const candidates = [
    location?.address,
    location?.street,
    location?.formattedAddress,
    location?.areaName,
    location?.locality,
    location?.city,
  ];

  for (const candidate of candidates) {
    const cleaned = cleanAddressText(candidate);
    if (!cleaned) continue;
    const firstLine = cleaned.split(',').map((item) => item.trim()).find(Boolean);
    if (firstLine && !/^\d{6}$/.test(firstLine)) return firstLine;
  }
  return 'Move the map to choose a location';
}

function titleForPhase(phase: LocationPhase, location: CustomerLocation | null): string {
  if (phase === 'locating' || phase === 'resolving') return 'Detecting address...';
  if (phase === 'permission-denied') return 'Allow location access';
  if (phase === 'permission-blocked') return 'Location permission is off';
  if (phase === 'location-off') return 'Turn on device location';
  if (phase === 'error') return 'Location unavailable';
  return humanAddress(location);
}

function subtitleForPhase(
  phase: LocationPhase,
  location: CustomerLocation | null,
  errorMessage: string | null,
): string {
  if (phase === 'locating') return 'Finding your current location...';
  if (phase === 'resolving') return 'Checking the address and pickup availability...';
  if (phase === 'permission-denied') return 'Location permission is required to detect your delivery area automatically.';
  if (phase === 'permission-blocked') return 'Location permission is disabled. Please enable it from Settings.';
  if (phase === 'location-off') return 'Your device location service is currently turned off.';
  if (phase === 'error') return errorMessage || 'Move the map and try again, or search for an address.';

  const placeParts = [location?.areaName, location?.city]
    .map((part) => cleanAddressText(part))
    .filter((part, index, values) => Boolean(part) && values.indexOf(part) === index);
  return [...placeParts, location?.pincode].filter(Boolean).join(' - ') || 'Verify this pickup location before continuing.';
}

export function MapLocationPickerScreen({
  onLocationConfirmed,
  onBack,
  initialLocation = null,
  initialGpsCoords = null,
  initialPermissionStatus = 'denied',
  autoPermissionPrompt = 'never',
}: MapLocationPickerScreenProps) {
  const insets = useSafeAreaInsets();
  const [coords, setCoords] = useState<Coordinates>(() => {
    if (initialGpsCoords) return initialGpsCoords;
    if (initialLocation?.latitude && initialLocation?.longitude) {
      return { latitude: initialLocation.latitude, longitude: initialLocation.longitude };
    }
    return DEFAULT_MAP_VIEWPORT;
  });
  const [resolvedLocation, setResolvedLocation] = useState<CustomerLocation | null>(initialLocation);
  const [selectionSource, setSelectionSource] = useState<CustomerLocationSource>(
    initialGpsCoords ? 'gps' : initialLocation?.source === 'gps' ? 'gps' : 'manual',
  );
  const [phase, setPhase] = useState<LocationPhase>(() => {
    if (initialLocation?.address) return 'ready';
    if (initialGpsCoords) return 'locating';
    if (initialPermissionStatus === 'blocked') return 'permission-blocked';
    if (initialPermissionStatus === 'denied') return 'permission-denied';
    return 'locating';
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReloadKey, setMapReloadKey] = useState(0);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CustomerLocation[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const webViewRef = useRef<any>(null);
  const selectionVersionRef = useRef(0);
  const autoLocateAttemptedRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);
  const phaseRef = useRef<LocationPhase>(phase);
  const hasUserMovedMapRef = useRef(false);
  const initialGpsHandledRef = useRef(false);

  const centreMap = useCallback((latitude: number, longitude: number) => {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    const script = `if (window.setMapCenter) { window.setMapCenter(${latitude}, ${longitude}, ${DEFAULT_MAP_ZOOM}); } true;`;
    webViewRef.current?.injectJavaScript(script);
  }, []);

  const resolveSelection = useCallback(async (
    latitude: number,
    longitude: number,
    source: CustomerLocationSource,
  ) => {
    const selectionVersion = selectionVersionRef.current + 1;
    selectionVersionRef.current = selectionVersion;
    setCoords({ latitude, longitude });
    setSelectionSource(source);
    setResolvedLocation(null);
    setErrorMessage(null);
    setPhase('resolving');

    try {
      const location = await resolveCustomerLocationCoordinates(latitude, longitude, source);
      if (selectionVersion !== selectionVersionRef.current) return;
      setResolvedLocation(location);
      setPhase('ready');
    } catch (error) {
      if (selectionVersion !== selectionVersionRef.current) return;
      setErrorMessage(error instanceof Error ? error.message : 'We could not identify this address. Move the map and try again.');
      setResolvedLocation(null);
      setPhase('error');
    }
  }, []);

  const handleLocateMe = useCallback(async (permissionPrompt: LocationPermissionPromptMode) => {
    const selectionVersion = selectionVersionRef.current + 1;
    selectionVersionRef.current = selectionVersion;
    setResolvedLocation(null);
    setErrorMessage(null);
    setPhase('locating');

    const result = await getCurrentCustomerLocation(permissionPrompt);
    if (selectionVersion !== selectionVersionRef.current) return;

    if (!result.ok) {
      setErrorMessage(result.message);
      if (result.reason === 'permission-blocked') setPhase('permission-blocked');
      else if (result.reason === 'permission-denied') setPhase('permission-denied');
      else if (result.reason === 'services-disabled') setPhase('location-off');
      else setPhase('error');
      return;
    }

    setCoords({ latitude: result.location.latitude, longitude: result.location.longitude });
    setResolvedLocation(result.location);
    setSelectionSource('gps');
    setPhase('ready');
    centreMap(result.location.latitude, result.location.longitude);
  }, [centreMap]);

const handleInteractiveLocate = useCallback(async () => {
    setPhase('locating');
    setErrorMessage(null);
    const result = await requestLocationPermissionInteractive();
    if (!result.granted) {
      if (result.blocked) {
        setPhase('permission-blocked');
      } else {
        setPhase('permission-denied');
      }
      return;
    }

    if (result.coords) {
      setCoords(result.coords);
      setSelectionSource('gps');
      centreMap(result.coords.latitude, result.coords.longitude);
      await resolveSelection(result.coords.latitude, result.coords.longitude, 'gps');
    } else {
      await handleLocateMe('always');
    }
  }, [centreMap, handleLocateMe, resolveSelection]);

  const handleMapMoving = useCallback(() => {
    // Invalidate any in-flight GPS/reverse-geocode result before the user lets
    // go of the map, so an old green result can never confirm a new pin.
    selectionVersionRef.current += 1;
    setSelectionSource('manual');
    setResolvedLocation(null);
    setErrorMessage(null);
    setPhase('resolving');
  }, []);

  const handleSearch = useCallback(async () => {
    const query = searchQuery.trim();
    if (query.length < 3) {
      setSearchError('Enter at least 3 characters, a road, landmark, or a 6-digit PIN code.');
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setSearchResults([]);
    try {
      const results = await searchCustomerAddresses(query);
      setSearchResults(results);
      if (results.length === 0) {
        setSearchError('No verified address was found. Try a nearby landmark, road, or PIN code.');
      }
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'We could not search for this address right now.');
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  const handleSearchResult = useCallback((location: CustomerLocation) => {
    selectionVersionRef.current += 1;
    setCoords({ latitude: location.latitude, longitude: location.longitude });
    setResolvedLocation({ ...location, source: 'manual' });
    setSelectionSource('manual');
    setErrorMessage(null);
    setPhase('ready');
    setIsSearchOpen(false);
    setSearchResults([]);
    centreMap(location.latitude, location.longitude);

    if (location.isServiceable === null || location.isServiceable === undefined) {
      void resolveSelection(location.latitude, location.longitude, 'manual');
    }
  }, [centreMap, resolveSelection]);

  useEffect(() => {
    if (initialGpsCoords && !initialGpsHandledRef.current) {
      initialGpsHandledRef.current = true;
      setCoords(initialGpsCoords);
      setSelectionSource('gps');
      centreMap(initialGpsCoords.latitude, initialGpsCoords.longitude);
      void resolveSelection(initialGpsCoords.latitude, initialGpsCoords.longitude, 'gps');
    }
  }, [centreMap, initialGpsCoords, resolveSelection]);

  useEffect(() => {
    if (autoLocateAttemptedRef.current) return;
    autoLocateAttemptedRef.current = true;
    if (autoPermissionPrompt !== 'never' && !initialGpsCoords) {
      void handleLocateMe(autoPermissionPrompt);
    }
  }, [autoPermissionPrompt, handleLocateMe, initialGpsCoords]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Returning from Settings re-checks the OS state without issuing another
  // prompt; a customer always controls subsequent permission requests.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;
      const needsRecovery = phaseRef.current === 'permission-denied'
        || phaseRef.current === 'permission-blocked'
        || phaseRef.current === 'location-off';
      if ((previousState === 'background' || previousState === 'inactive') && nextState === 'active' && needsRecovery) {
        void handleLocateMe('never');
      }
    });
    return () => subscription.remove();
  }, [handleLocateMe]);

  useEffect(() => {
    if (mapReady) centreMap(coords.latitude, coords.longitude);
  }, [centreMap, coords, mapReady]);

  useEffect(() => {
    if (mapReady || mapError) return;
    const timer = setTimeout(() => {
      setMapError('The map is taking too long to load. Check your connection and try again.');
    }, 10_000);
    return () => clearTimeout(timer);
  }, [mapError, mapReady, mapReloadKey]);

  const onWebViewMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'map_ready') {
        setMapReady(true);
        setMapError(null);
        if (initialGpsCoords) {
          centreMap(initialGpsCoords.latitude, initialGpsCoords.longitude);
        }
        return;
      }
      if (data.type === 'map_moving') {
        hasUserMovedMapRef.current = true;
        handleMapMoving();
        return;
      }
      if (
        data.type === 'center_changed'
        && typeof data.latitude === 'number'
        && typeof data.longitude === 'number'
      ) {
        // Only reverse geocode center changes if the user actually dragged the map!
        // This prevents the default viewport from claiming to be detected on initial load.
        if (hasUserMovedMapRef.current) {
          void resolveSelection(data.latitude, data.longitude, 'manual');
        }
      }
    } catch {
      // Ignore malformed messages from the embedded map.
    }
  }, [centreMap, handleMapMoving, initialGpsCoords, resolveSelection]);

  const handleEnableLocationServices = useCallback(async () => {
    setPhase('locating');
    const enabled = await enableLocationServices();
    if (!enabled) {
      setPhase('location-off');
      return;
    }
    await handleLocateMe('never');
  }, [handleLocateMe]);

  const handleRetrySelection = useCallback(() => {
    void resolveSelection(coords.latitude, coords.longitude, selectionSource);
  }, [coords.latitude, coords.longitude, resolveSelection, selectionSource]);

  const handleConfirm = useCallback(async () => {
    if (!resolvedLocation || phase !== 'ready') return;
    if (resolvedLocation.isServiceable === false) {
      setErrorMessage('Pickup is not available for this PIN code yet. Choose another location.');
      return;
    }
    if (resolvedLocation.isServiceable === null || resolvedLocation.isServiceable === undefined) {
      await resolveSelection(coords.latitude, coords.longitude, selectionSource);
      return;
    }

    setIsSubmitting(true);
    try {
      await onLocationConfirmed({ ...resolvedLocation, source: selectionSource });
    } finally {
      setIsSubmitting(false);
    }
  }, [coords.latitude, coords.longitude, onLocationConfirmed, phase, resolvedLocation, resolveSelection, selectionSource]);

  const retryMap = useCallback(() => {
    setMapReady(false);
    setMapError(null);
    setMapReloadKey((value) => value + 1);
  }, []);

  const canUseLocation = phase === 'ready'
    && Boolean(resolvedLocation)
    && resolvedLocation?.isServiceable === true;
  const isCheckingSelection = phase === 'locating' || phase === 'resolving';
  const serviceability = isCheckingSelection
    ? { state: 'checking' as const, text: 'Checking pickup availability...' }
    : resolvedLocation?.isServiceable === true
      ? { state: 'available' as const, text: 'Pickup is available for this PIN code.' }
      : resolvedLocation?.isServiceable === false
        ? { state: 'unavailable' as const, text: 'Pickup is not available for this PIN code yet.' }
        : null;

  const actionLabel = phase === 'permission-denied'
    ? 'Enable Location'
    : phase === 'permission-blocked'
      ? 'Open Settings'
      : phase === 'location-off'
        ? 'Turn On Location'
        : phase === 'error'
          ? 'Try This Pin Again'
          : isSubmitting
            ? 'Saving location...'
            : isCheckingSelection
              ? 'Checking location...'
              : resolvedLocation?.isServiceable === false
                ? 'Choose another location'
                : 'Use This Location';

  const onPrimaryAction = () => {
    if (phase === 'permission-denied') void handleInteractiveLocate();
    else if (phase === 'permission-blocked') void openLocationSettings();
    else if (phase === 'location-off') void handleEnableLocationServices();
    else if (phase === 'error') handleRetrySelection();
    else void handleConfirm();
  };

  const WebViewComponent = WebView as any;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <View style={styles.mapArea}>
        <WebViewComponent
          key={mapReloadKey}
          ref={webViewRef}
          originWhitelist={['about:blank', 'https://*']}
          source={{ html: MAP_HTML }}
          style={styles.webView}
          onMessage={onWebViewMessage}
          onError={() => setMapError('The map could not load. Check your connection and try again.')}
          onHttpError={() => setMapError('The map service is unavailable right now. Please try again.')}
          javaScriptEnabled
          domStorageEnabled
          scrollEnabled={false}
        />

        {!mapError ? (
          <View pointerEvents="none" style={styles.centerPinContainer}>
            <View style={styles.pinWrapper}>
              <MaterialCommunityIcons name="map-marker" size={48} color="#111827" />
              <View style={styles.pinInnerWhiteDot} />
            </View>
            <View style={styles.groundShadowDot} />
          </View>
        ) : (
          <View style={styles.mapErrorOverlay}>
            <View style={styles.mapErrorCard}>
              <MaterialCommunityIcons name="map-outline" size={28} color="#FF6418" />
              <Text style={styles.mapErrorTitle}>Map unavailable</Text>
              <Text style={styles.mapErrorText}>{mapError}</Text>
              <Pressable style={({ pressed }) => [styles.mapRetryBtn, pressed && styles.buttonPressed]} onPress={retryMap}>
                <Text style={styles.mapRetryText}>Retry map</Text>
              </Pressable>
            </View>
          </View>
        )}

        <View style={[styles.topBar, { top: insets.top + 12 }]}>
          <Pressable
            style={({ pressed }) => [styles.circularButton, pressed && styles.buttonPressed]}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <MaterialCommunityIcons name="chevron-left" size={28} color="#111827" />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.circularButton, pressed && styles.buttonPressed]}
            onPress={() => void handleInteractiveLocate()}
            accessibilityRole="button"
            accessibilityLabel="Use current location"
          >
            {phase === 'locating'
              ? <ActivityIndicator size="small" color="#FF6418" />
              : <MaterialCommunityIcons name="crosshairs-gps" size={22} color="#111827" />}
          </Pressable>
        </View>
      </View>

      <SafeAreaView edges={['bottom']} style={styles.bottomCardWrapper}>
        <View style={styles.bottomSheetHandle} />
        <View style={styles.bottomCardContent}>
          <View style={styles.dragHintRow}>
            <MaterialCommunityIcons name="map-marker" size={13} color="#FF6418" />
            <Text style={styles.dragHintText}>Drag the map to adjust your location</Text>
          </View>

          <View style={styles.addressRow}>
            <View style={styles.pinIconContainer}>
              {isCheckingSelection
                ? <ActivityIndicator size="small" color="#FF6418" />
                : <MaterialCommunityIcons name="map-marker" size={24} color="#FF6418" />}
            </View>
            <View style={styles.addressTextCol}>
              <Text style={styles.addressTitle} numberOfLines={1}>{titleForPhase(phase, resolvedLocation)}</Text>
              <Text style={styles.addressSubtitle} numberOfLines={2}>{subtitleForPhase(phase, resolvedLocation, errorMessage)}</Text>
            </View>
          </View>

          {serviceability ? (
            <View style={[
              styles.serviceabilityRow,
              serviceability.state === 'available'
                ? styles.serviceabilitySuccess
                : serviceability.state === 'unavailable'
                  ? styles.serviceabilityWarning
                  : styles.serviceabilityChecking,
            ]}>
              {serviceability.state === 'checking'
                ? <ActivityIndicator size="small" color="#2563EB" />
                : <MaterialCommunityIcons
                    name={serviceability.state === 'available' ? 'check-circle' : 'information-outline'}
                    size={15}
                    color={serviceability.state === 'available' ? '#15803D' : '#B45309'}
                  />}
              <Text style={[
                styles.serviceabilityText,
                serviceability.state === 'available'
                  ? styles.serviceabilitySuccessText
                  : serviceability.state === 'unavailable'
                    ? styles.serviceabilityWarningText
                    : styles.serviceabilityCheckingText,
              ]}>{serviceability.text}</Text>
            </View>
          ) : null}

          {isSearchOpen ? (
            <View style={styles.searchPanel}>
              <View style={styles.searchInputRow}>
                <MaterialCommunityIcons name="magnify" size={20} color="#64748B" />
                <TextInput
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmitEditing={() => void handleSearch()}
                  placeholder="Search road, landmark, or PIN code"
                  placeholderTextColor="#94A3B8"
                  returnKeyType="search"
                  autoCorrect={false}
                  accessibilityLabel="Search for an address"
                />
                <Pressable
                  style={({ pressed }) => [styles.searchButton, pressed && styles.buttonPressed]}
                  onPress={() => void handleSearch()}
                  accessibilityRole="button"
                  accessibilityLabel="Search address"
                >
                  {isSearching ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.searchButtonText}>Search</Text>}
                </Pressable>
              </View>
              {searchError ? <Text style={styles.searchErrorText}>{searchError}</Text> : null}
              {searchResults.slice(0, 3).map((location, index) => (
                <Pressable
                  key={`${location.latitude}-${location.longitude}-${index}`}
                  style={({ pressed }) => [styles.searchResultRow, pressed && styles.resultPressed]}
                  onPress={() => handleSearchResult(location)}
                  accessibilityRole="button"
                  accessibilityLabel={`Choose ${humanAddress(location)}`}
                >
                  <MaterialCommunityIcons name="map-marker-outline" size={19} color="#FF6418" />
                  <View style={styles.searchResultTextCol}>
                    <Text style={styles.searchResultTitle} numberOfLines={1}>{humanAddress(location)}</Text>
                    <Text style={styles.searchResultSubtitle} numberOfLines={1}>{subtitleForPhase('ready', location, null)}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}

          <Pressable
            style={({ pressed }) => [
              styles.useLocationBtn,
              pressed && !isCheckingSelection && phase !== 'ready' ? styles.buttonPressed : null,
              ((phase === 'ready' && !canUseLocation) || isSubmitting || isCheckingSelection) && styles.btnDisabled,
            ]}
            onPress={onPrimaryAction}
            disabled={(phase === 'ready' && !canUseLocation) || isSubmitting || isCheckingSelection}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
          >
            {isSubmitting || isCheckingSelection ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
              <View style={styles.btnContentRow}>
                <Text style={styles.useLocationBtnText}>{actionLabel}</Text>
                {phase === 'ready' && canUseLocation ? <MaterialCommunityIcons name="arrow-right" size={20} color="#FFFFFF" /> : null}
              </View>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.searchLink, pressed && styles.buttonPressed]}
            onPress={() => {
              setIsSearchOpen((open) => !open);
              setSearchError(null);
              setSearchResults([]);
            }}
            accessibilityRole="button"
            accessibilityLabel={isSearchOpen ? 'Close address search' : 'Search address manually'}
          >
            <MaterialCommunityIcons name={isSearchOpen ? 'chevron-up' : 'magnify'} size={16} color="#2563EB" />
            <Text style={styles.searchLinkText}>{isSearchOpen ? 'Close address search' : 'Search address or PIN manually'}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#E5E7EB' },
  mapArea: { flex: 1, minHeight: 160, backgroundColor: '#E5E7EB', overflow: 'hidden' },
  webView: { flex: 1, backgroundColor: '#E5E7EB' },
  centerPinContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -24,
    marginTop: -48,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  pinWrapper: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  pinInnerWhiteDot: { position: 'absolute', top: 13, width: 12, height: 12, borderRadius: 6, backgroundColor: '#FFFFFF' },
  groundShadowDot: { width: 9, height: 4, borderRadius: 5, backgroundColor: 'rgba(15,23,42,0.28)', marginTop: -3 },
  topBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 20,
  },
  circularButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
  },
  buttonPressed: { opacity: 0.88, transform: [{ scale: 0.97 }] },
  mapErrorOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(241,245,249,0.82)',
  },
  mapErrorCard: {
    width: '100%',
    maxWidth: 300,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },
  mapErrorTitle: { marginTop: 8, fontSize: 16, fontWeight: '800', color: '#111827' },
  mapErrorText: { marginTop: 5, fontSize: 12, lineHeight: 17, color: '#64748B', textAlign: 'center' },
  mapRetryBtn: { marginTop: 14, borderRadius: 10, backgroundColor: '#FF6418', paddingHorizontal: 16, paddingVertical: 9 },
  mapRetryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  bottomCardWrapper: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.13,
    shadowRadius: 16,
    elevation: 16,
  },
  bottomSheetHandle: { width: 38, height: 4, borderRadius: 3, backgroundColor: '#E2E8F0', alignSelf: 'center', marginTop: 9 },
  bottomCardContent: { paddingTop: 8, paddingHorizontal: 20, paddingBottom: 16 },
  dragHintRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 8 },
  dragHintText: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 11 },
  pinIconContainer: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center' },
  addressTextCol: { flex: 1 },
  addressTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 2 },
  addressSubtitle: { fontSize: 12, color: '#64748B', fontWeight: '500', lineHeight: 17 },
  serviceabilityRow: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 11 },
  serviceabilitySuccess: { backgroundColor: '#F0FDF4' },
  serviceabilityWarning: { backgroundColor: '#FFFBEB' },
  serviceabilityChecking: { backgroundColor: '#EFF6FF' },
  serviceabilityText: { flex: 1, fontSize: 11.5, fontWeight: '700' },
  serviceabilitySuccessText: { color: '#15803D' },
  serviceabilityWarningText: { color: '#B45309' },
  serviceabilityCheckingText: { color: '#1D4ED8' },
  useLocationBtn: {
    minHeight: 52,
    backgroundColor: '#FF6418',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6418',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.32,
    shadowRadius: 9,
    elevation: 6,
  },
  btnContentRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnDisabled: { opacity: 0.52 },
  useLocationBtnText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.2 },
  searchLink: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 8 },
  searchLinkText: { color: '#2563EB', fontSize: 12.5, fontWeight: '700' },
  searchPanel: { marginBottom: 10 },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 46,
    paddingLeft: 12,
    paddingRight: 5,
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
    borderWidth: 1,
    borderRadius: 12,
  },
  searchInput: { flex: 1, minWidth: 0, color: '#111827', fontSize: 13, paddingVertical: 8 },
  searchButton: { minHeight: 34, paddingHorizontal: 11, borderRadius: 8, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  searchButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  searchErrorText: { marginTop: 6, color: '#B45309', fontSize: 11.5, lineHeight: 16 },
  searchResultRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  resultPressed: { backgroundColor: '#FFF7ED' },
  searchResultTextCol: { flex: 1 },
  searchResultTitle: { color: '#111827', fontSize: 12.5, fontWeight: '700' },
  searchResultSubtitle: { color: '#64748B', fontSize: 10.5, marginTop: 1 },
});
