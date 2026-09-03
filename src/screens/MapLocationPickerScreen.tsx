import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  StyleSheet,
  Text,
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
} from '@/services/location/locationService';
import type {
  CustomerLocation,
  CustomerLocationSource,
  LocationPermissionPromptMode,
} from '@/services/location/types';

interface MapLocationPickerScreenProps {
  initialLocation?: CustomerLocation | null;
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

// This is only the initial map viewport for the service region, never a selected customer address.
const DEFAULT_MAP_VIEWPORT: Coordinates = { latitude: 17.385, longitude: 78.4867 };
const DEFAULT_MAP_ZOOM = 16;

const MAP_HTML = `
<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>
      html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #e5e3df; overflow: hidden; }
      .leaflet-control-attribution, .leaflet-control-zoom { display: none !important; }
      .google-logo { position: absolute; bottom: 20px; left: 10px; z-index: 800; pointer-events: none; }
      .google-logo img { height: 18px; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <div class="google-logo"><img src="https://maps.gstatic.com/mapfiles/api-3/images/google4.png" alt="Google" /></div>
    <script>
      var map = L.map('map', {
        center: [${DEFAULT_MAP_VIEWPORT.latitude}, ${DEFAULT_MAP_VIEWPORT.longitude}],
        zoom: ${DEFAULT_MAP_ZOOM},
        zoomControl: false,
        attributionControl: false
      });
      L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
      }).addTo(map);

      var isProgrammaticMove = false;
      window.setMapCenter = function(latitude, longitude, zoom) {
        isProgrammaticMove = true;
        map.setView([latitude, longitude], zoom || ${DEFAULT_MAP_ZOOM});
      };
      map.on('dragstart', function() {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'drag_start' }));
        }
      });
      map.on('moveend', function() {
        if (isProgrammaticMove) {
          isProgrammaticMove = false;
          return;
        }
        var center = map.getCenter();
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'center_changed', latitude: center.lat, longitude: center.lng
          }));
        }
      });
      setTimeout(function() {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'map_ready' }));
        }
      }, 300);
    </script>
  </body>
</html>
`;

function getInitialCoordinates(location?: CustomerLocation | null): Coordinates {
  if (
    location &&
    Number.isFinite(location.latitude) &&
    Number.isFinite(location.longitude)
  ) {
    return { latitude: location.latitude, longitude: location.longitude };
  }
  return DEFAULT_MAP_VIEWPORT;
}

function titleForPhase(phase: LocationPhase, location: CustomerLocation | null): string {
  if (phase === 'locating' || phase === 'resolving') return 'Detecting address...';
  if (phase === 'permission-denied') return 'Turn on location';
  if (phase === 'permission-blocked') return 'Location permission is off';
  if (phase === 'location-off') return 'Turn on device location';
  if (phase === 'error') return 'Location unavailable';
  return location?.address || location?.areaName || location?.city || 'Move the map to choose a location';
}

function subtitleForPhase(phase: LocationPhase, location: CustomerLocation | null, errorMessage: string | null): string {
  if (phase === 'permission-denied') return 'Allow location to detect your delivery area automatically.';
  if (phase === 'permission-blocked') return 'Enable location permission from your phone settings.';
  if (phase === 'location-off') return 'Your device location service is currently turned off.';
  if (phase === 'error') return errorMessage || 'Drag the map to choose your pickup location.';
  const place = [location?.areaName, location?.city].filter(Boolean).join(', ');
  return [place, location?.pincode].filter(Boolean).join(' — ') || 'Finding the exact address…';
}

export function MapLocationPickerScreen({
  onLocationConfirmed,
  onBack,
  initialLocation = null,
  autoPermissionPrompt = 'never',
}: MapLocationPickerScreenProps) {
  const insets = useSafeAreaInsets();
  const [coords, setCoords] = useState<Coordinates>(() => getInitialCoordinates(initialLocation));
  const [resolvedLocation, setResolvedLocation] = useState<CustomerLocation | null>(initialLocation);
  const [selectionSource, setSelectionSource] = useState<CustomerLocationSource>(
    initialLocation?.source === 'gps' ? 'gps' : 'manual',
  );
  const [phase, setPhase] = useState<LocationPhase>('locating');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const webViewRef = useRef<any>(null);
  const selectionVersionRef = useRef(0);
  const autoLocateAttemptedRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);
  const phaseRef = useRef<LocationPhase>(phase);

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

  useEffect(() => {
    if (autoLocateAttemptedRef.current) return;
    autoLocateAttemptedRef.current = true;
    void handleLocateMe(autoPermissionPrompt);
  }, [autoPermissionPrompt, handleLocateMe]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Returning from Settings should re-check the OS state without triggering another prompt.
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

  const onWebViewMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'map_ready') {
        setMapReady(true);
        return;
      }
      if (data.type === 'drag_start') {
        setSelectionSource('manual');
        return;
      }
      if (
        data.type === 'center_changed' &&
        typeof data.latitude === 'number' &&
        typeof data.longitude === 'number'
      ) {
        void resolveSelection(data.latitude, data.longitude, 'manual');
      }
    } catch {
      // Ignore malformed messages from the embedded map.
    }
  }, [resolveSelection]);

  const handleEnableLocationServices = useCallback(async () => {
    setPhase('locating');
    const enabled = await enableLocationServices();
    if (!enabled) {
      setPhase('location-off');
      return;
    }
    await handleLocateMe('never');
  }, [handleLocateMe]);

  const handleConfirm = useCallback(async () => {
    if (!resolvedLocation || phase !== 'ready') return;
    if (resolvedLocation.isServiceable === false) {
      setErrorMessage(resolvedLocation.serviceabilityMessage || "LaundryFresh isn't available in this area yet. Choose another location.");
      return;
    }
    if (resolvedLocation.isServiceable === null) {
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

  const needsRecoveryAction = phase === 'permission-denied' || phase === 'permission-blocked' || phase === 'location-off' || phase === 'error';
  const canUseLocation = phase === 'ready' && Boolean(resolvedLocation) && resolvedLocation?.isServiceable !== false && resolvedLocation?.isServiceable !== null;
  const serviceabilityText = resolvedLocation?.isServiceable === true
    ? resolvedLocation.serviceabilityMessage || 'LaundryFresh is available in this area.'
    : resolvedLocation?.isServiceable === false
      ? resolvedLocation.serviceabilityMessage || "LaundryFresh isn't available in this area yet."
      : resolvedLocation?.isServiceable === null
        ? resolvedLocation.serviceabilityMessage || 'Checking service availability…'
        : null;

  const WebViewComponent = WebView as any;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <View style={StyleSheet.absoluteFill}>
        <WebViewComponent
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: MAP_HTML }}
          style={styles.webView}
          onMessage={onWebViewMessage}
          javaScriptEnabled
          domStorageEnabled
          scrollEnabled={false}
        />

        <View pointerEvents="none" style={styles.centerPinContainer}>
          <View style={styles.pinWrapper}>
            <MaterialCommunityIcons name="map-marker" size={48} color="#111827" />
            <View style={styles.pinInnerWhiteDot} />
          </View>
          <View style={styles.groundShadowDot} />
        </View>

        <SafeAreaView edges={['top']} style={[styles.topBar, { top: insets.top + 6 }]}>
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
            onPress={() => void handleLocateMe('always')}
            accessibilityRole="button"
            accessibilityLabel="Use current location"
          >
            {phase === 'locating' ? <ActivityIndicator size="small" color="#FF6418" /> : <MaterialCommunityIcons name="crosshairs-gps" size={22} color="#111827" />}
          </Pressable>
        </SafeAreaView>
      </View>

      <SafeAreaView edges={['bottom']} style={styles.bottomCardWrapper}>
        <View style={styles.bottomCardContent}>
          <View style={styles.dragHintRow}>
            <MaterialCommunityIcons name="map-marker" size={13} color="#FF6418" />
            <Text style={styles.dragHintText}>Drag the map to adjust your location</Text>
          </View>

          <View style={styles.addressRow}>
            <View style={styles.pinIconContainer}>
              <MaterialCommunityIcons name="map-marker" size={24} color="#FF6418" />
            </View>
            <View style={styles.addressTextCol}>
              <Text style={styles.addressTitle} numberOfLines={1}>{titleForPhase(phase, resolvedLocation)}</Text>
              <Text style={styles.addressSubtitle} numberOfLines={2}>{subtitleForPhase(phase, resolvedLocation, errorMessage)}</Text>
            </View>
          </View>

          {serviceabilityText ? (
            <View style={[
              styles.serviceabilityRow,
              resolvedLocation?.isServiceable === true ? styles.serviceabilitySuccess : styles.serviceabilityWarning,
            ]}>
              <MaterialCommunityIcons
                name={resolvedLocation?.isServiceable === true ? 'check-circle' : 'information-outline'}
                size={14}
                color={resolvedLocation?.isServiceable === true ? '#15803D' : '#B45309'}
              />
              <Text style={[
                styles.serviceabilityText,
                resolvedLocation?.isServiceable === true ? styles.serviceabilitySuccessText : styles.serviceabilityWarningText,
              ]}>{serviceabilityText}</Text>
            </View>
          ) : null}

          {phase === 'permission-denied' ? (
            <Pressable style={({ pressed }) => [styles.useLocationBtn, pressed && styles.buttonPressed]} onPress={() => void handleLocateMe('always')}>
              <Text style={styles.useLocationBtnText}>Allow Location</Text>
            </Pressable>
          ) : phase === 'permission-blocked' ? (
            <Pressable style={({ pressed }) => [styles.useLocationBtn, pressed && styles.buttonPressed]} onPress={() => void openLocationSettings()}>
              <Text style={styles.useLocationBtnText}>Open Settings</Text>
            </Pressable>
          ) : phase === 'location-off' ? (
            <Pressable style={({ pressed }) => [styles.useLocationBtn, pressed && styles.buttonPressed]} onPress={() => void handleEnableLocationServices()}>
              <Text style={styles.useLocationBtnText}>Turn On Location</Text>
            </Pressable>
          ) : phase === 'error' ? (
            <Pressable style={({ pressed }) => [styles.useLocationBtn, pressed && styles.buttonPressed]} onPress={() => void handleLocateMe('always')}>
              <Text style={styles.useLocationBtnText}>Try Again</Text>
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.useLocationBtn, (pressed && canUseLocation) && styles.buttonPressed, (!canUseLocation || isSubmitting) && styles.btnDisabled]}
              onPress={() => void handleConfirm()}
              disabled={!canUseLocation || isSubmitting}
            >
              {isSubmitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                <View style={styles.btnContentRow}>
                  <Text style={styles.useLocationBtnText}>Use This Location</Text>
                  <MaterialCommunityIcons name="arrow-right" size={20} color="#FFFFFF" />
                </View>
              )}
            </Pressable>
          )}

          {needsRecoveryAction ? (
            <Text style={styles.manualHint}>You can also drag the map and select a delivery location manually.</Text>
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#E5E3DF' },
  webView: { flex: 1, backgroundColor: '#E5E3DF' },
  centerPinContainer: {
    position: 'absolute', top: '50%', left: '50%', marginLeft: -24, marginTop: -48,
    alignItems: 'center', justifyContent: 'center', zIndex: 10,
  },
  pinWrapper: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  pinInnerWhiteDot: { position: 'absolute', top: 13, width: 12, height: 12, borderRadius: 6, backgroundColor: '#FFFFFF' },
  groundShadowDot: { width: 8, height: 4, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.28)', marginTop: -3 },
  topBar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 20 },
  circularButton: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 5,
  },
  buttonPressed: { opacity: 0.88, transform: [{ scale: 0.97 }] },
  bottomCardWrapper: {
    position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    shadowColor: '#000000', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 24, zIndex: 999,
  },
  bottomCardContent: { paddingTop: 14, paddingBottom: 20, paddingHorizontal: 20 },
  dragHintRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 8 },
  dragHintText: { fontSize: 12, color: '#6B7280', fontWeight: '600' },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  pinIconContainer: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center' },
  addressTextCol: { flex: 1 },
  addressTitle: { fontSize: 15.5, fontWeight: '800', color: '#111827', marginBottom: 2 },
  addressSubtitle: { fontSize: 12, color: '#6B7280', fontWeight: '500', lineHeight: 17 },
  serviceabilityRow: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 12 },
  serviceabilitySuccess: { backgroundColor: '#F0FDF4' },
  serviceabilityWarning: { backgroundColor: '#FFFBEB' },
  serviceabilityText: { flex: 1, fontSize: 11.5, fontWeight: '700' },
  serviceabilitySuccessText: { color: '#15803D' },
  serviceabilityWarningText: { color: '#B45309' },
  useLocationBtn: {
    backgroundColor: '#FF6418', borderRadius: 16, height: 52, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#FF6418', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8,
  },
  btnContentRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnDisabled: { opacity: 0.55 },
  useLocationBtnText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 },
  manualHint: { color: '#6B7280', fontSize: 11.5, fontWeight: '600', textAlign: 'center', marginTop: 10, lineHeight: 16 },
});
