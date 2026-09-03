import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppButton, Card } from '@/ui/components';
import { COLORS } from '@/ui/theme';

export type PickupLocationState = 'idle' | 'locating' | 'ready' | 'denied';

interface PickupLocationCardProps {
  state: PickupLocationState;
  address?: string;
  detail?: string;
  isServiceable?: boolean | null;
  onUseLocation: () => void | Promise<void>;
  onUseManualEntry?: () => void;
}

/**
 * A lightweight in-app pickup-location preview. GPS coordinates are reverse-geocoded
 * by the existing backend, so the component needs no client Google Maps key.
 */
export function PickupLocationCard({ state, address, detail, isServiceable, onUseLocation, onUseManualEntry }: PickupLocationCardProps) {
  const locating = state === 'locating';
  const hasLocation = state === 'ready' && Boolean(address);
  const statusText = isServiceable === true ? 'Pickup available' : isServiceable === false ? 'Check pincode' : hasLocation ? 'Location captured' : 'Precise pickup location';
  const statusIcon: ComponentProps<typeof MaterialCommunityIcons>['name'] = isServiceable === true ? 'check-circle' : isServiceable === false ? 'information-outline' : 'crosshairs-gps';
  const statusColor = isServiceable === true ? COLORS.success : isServiceable === false ? COLORS.warning : COLORS.plum;

  return (
    <Card style={styles.card}>
      <View style={styles.mapCanvas}>
        <View style={[styles.road, styles.roadOne]} />
        <View style={[styles.road, styles.roadTwo]} />
        <View style={[styles.road, styles.roadThree]} />
        <View style={[styles.block, styles.blockOne]} />
        <View style={[styles.block, styles.blockTwo]} />
        <View style={[styles.block, styles.blockThree]} />
        <View style={styles.mapBadge}>
          <View style={[styles.mapBadgeDot, locating && styles.mapBadgeDotLoading]} />
          <Text style={styles.mapBadgeText}>{locating ? 'Finding you' : 'PICKUP MAP'}</Text>
        </View>
        <View style={styles.pinHalo}>
          <View style={styles.pinCircle}>
            <MaterialCommunityIcons name={hasLocation ? 'map-marker-check' : 'map-marker'} size={31} color={COLORS.white} />
          </View>
        </View>
        <View style={styles.mapScale}><Text style={styles.mapScaleText}>Nearby</Text></View>
      </View>

      <View style={styles.infoRow}>
        <View style={[styles.statusIcon, { backgroundColor: `${statusColor}18` }]}>
          <MaterialCommunityIcons name={statusIcon} size={19} color={statusColor} />
        </View>
        <View style={styles.infoCopy}>
          <Text style={styles.infoTitle}>{hasLocation ? address : 'Use your current location'}</Text>
          <Text style={styles.infoDetail}>{hasLocation ? detail || 'Confirm the address details below before saving.' : 'We use it only to fill your pickup address and check service availability.'}</Text>
        </View>
      </View>

      <AppButton title={locating ? 'Finding your location...' : hasLocation ? 'Refresh current location' : 'Use my current location'} icon="crosshairs-gps" onPress={onUseLocation} loading={locating} variant={hasLocation ? 'outline' : 'primary'} />
      {onUseManualEntry ? (
        <Pressable accessibilityRole="button" onPress={onUseManualEntry} style={({ pressed }) => [styles.manualButton, pressed && styles.pressed]}>
          <MaterialCommunityIcons name="pencil-outline" size={15} color={COLORS.plum} />
          <Text style={styles.manualText}>Enter address manually instead</Text>
        </Pressable>
      ) : null}
      {state === 'denied' ? <Text style={styles.deniedNote}>Location permission is optional. You can continue by entering your address manually.</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 0, overflow: 'hidden', backgroundColor: COLORS.white },
  mapCanvas: { height: 130, overflow: 'hidden', backgroundColor: COLORS.blush, position: 'relative' },
  road: { position: 'absolute', borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.92)' },
  roadOne: { width: 330, height: 17, top: 38, left: -50, transform: [{ rotate: '-10deg' }] },
  roadTwo: { width: 17, height: 220, top: -38, right: 92, transform: [{ rotate: '18deg' }] },
  roadThree: { width: 270, height: 14, bottom: 24, right: -42, transform: [{ rotate: '10deg' }] },
  block: { position: 'absolute', borderRadius: 13, borderWidth: 1, borderColor: 'rgba(91,33,79,0.08)', backgroundColor: 'rgba(255,255,255,0.42)' },
  blockOne: { width: 78, height: 45, top: 15, left: 22, transform: [{ rotate: '-9deg' }] },
  blockTwo: { width: 65, height: 53, bottom: 10, left: 55, transform: [{ rotate: '12deg' }] },
  blockThree: { width: 92, height: 49, top: 20, right: 28, transform: [{ rotate: '8deg' }] },
  mapBadge: { position: 'absolute', top: 11, left: 11, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.93)', borderRadius: 99, paddingHorizontal: 9, paddingVertical: 6 },
  mapBadgeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.plum },
  mapBadgeDotLoading: { backgroundColor: COLORS.gold },
  mapBadgeText: { color: COLORS.plumDark, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  pinHalo: { position: 'absolute', top: 35, left: '50%', marginLeft: -29, width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(91,33,79,0.15)', alignItems: 'center', justifyContent: 'center' },
  pinCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.plum, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: COLORS.white, shadowColor: COLORS.plumDark, shadowOpacity: 0.18, shadowRadius: 7, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  mapScale: { position: 'absolute', right: 11, bottom: 10, backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 7, paddingHorizontal: 7, paddingVertical: 4 },
  mapScaleText: { color: COLORS.muted, fontSize: 9, fontWeight: '700' },
  infoRow: { flexDirection: 'row', gap: 10, padding: 14, paddingBottom: 9 },
  statusIcon: { width: 35, height: 35, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  infoCopy: { flex: 1 },
  infoTitle: { color: COLORS.plumDark, fontSize: 13, fontWeight: '900' },
  infoDetail: { color: COLORS.muted, fontSize: 11, lineHeight: 16, marginTop: 2 },
  manualButton: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 9, marginBottom: 6 },
  manualText: { color: COLORS.plum, fontSize: 11, fontWeight: '800' },
  deniedNote: { color: COLORS.muted, fontSize: 10, lineHeight: 15, textAlign: 'center', paddingHorizontal: 15, paddingBottom: 13 },
  pressed: { opacity: 0.68 },
});
