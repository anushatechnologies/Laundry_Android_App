import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { getCurrentCustomerLocation } from '@/services/location/locationService';
import { AppButton, AppInput, Card } from '@/ui/components';
import { COLORS } from '@/ui/theme';

const brandLogo = require('../../assets/brand-logo.png');

interface LocationPermissionScreenProps {
  onLocationApproved: (locationData?: {
    city?: string;
    pincode?: string;
    areaName?: string;
    hubName?: string;
  }) => void | Promise<void>;
  onSkip: () => void | Promise<void>;
}

export function LocationPermissionScreen({
  onLocationApproved,
  onSkip,
}: LocationPermissionScreenProps) {
  const [isLocating, setIsLocating] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [pincodeInput, setPincodeInput] = useState('');
  const [checkingPincode, setCheckingPincode] = useState(false);
  const [pincodeMessage, setPincodeMessage] = useState<string | null>(null);

  const handleRequestLocation = async () => {
    setIsLocating(true);
    try {
      const result = await getCurrentCustomerLocation('always');
      if (!result.ok) {
        setIsLocating(false);
        Alert.alert(
          'Location Permission',
          result.message,
          [
            { text: 'Enter Manually', onPress: () => setManualMode(true) },
            { text: 'Skip to Home', onPress: onSkip },
          ]
        );
        return;
      }
      const location = result.location;
      setIsLocating(false);
      await onLocationApproved({
        city: location.city,
        pincode: location.pincode,
        areaName: location.areaName || location.address,
        hubName: location.hubName,
      });
    } catch {
      setIsLocating(false);
      Alert.alert(
        'Location Detection',
        'Could not auto-detect location. Please choose a city below to proceed to the home page.',
        [{ text: 'Choose City', onPress: () => setManualMode(true) }]
      );
    }
  };

  const handleSelectPresetCity = async (city: string, pincode: string, hubName: string) => {
    await onLocationApproved({ city, pincode, areaName: city, hubName });
  };

  const handleValidateManualPincode = async () => {
    const pin = pincodeInput.replace(/\D/g, '');
    if (pin.length !== 6) {
      setPincodeMessage('Please enter a valid 6-digit pincode.');
      return;
    }

    setCheckingPincode(true);
    setPincodeMessage(null);
    try {
      const check = await api.checkPincode(pin);
      setCheckingPincode(false);
      if (check.isServiceable || (check as any).serviceable) {
        let hubName: string | undefined;
        try {
          const hubRes = await api.getNearestHubForPincode(pin);
          if (hubRes?.hub?.name) hubName = hubRes.hub.name;
        } catch {
          // fallback
        }

        await onLocationApproved({
          city: check.city,
          pincode: pin,
          areaName: check.areaName || check.city,
          hubName,
        });
      } else {
        setPincodeMessage(check.message || 'Pincode not currently serviceable. You can still browse our services.');
      }
    } catch {
      setCheckingPincode(false);
      setPincodeMessage('Unable to check this pincode right now. Please check your connection and try again.');
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Top Header & Logo */}
        <View style={styles.brandRow}>
          <View style={styles.logoCard}>
            <Image source={brandLogo} style={styles.logo} resizeMode="contain" accessibilityLabel="LaundryFresh logo" />
          </View>
          <View style={styles.brandCopy}>
            <Text style={styles.brandName}>LaundryFresh</Text>
            <Text style={styles.brandLabel}>DOORSTEP FABRIC CARE</Text>
          </View>
        </View>

        {/* Central Visual: Radar Map Pin */}
        <View style={styles.heroCenter}>
          <View style={styles.radarOuterRing}>
            <View style={styles.radarMiddleRing}>
              <View style={styles.radarInnerCircle}>
                <MaterialCommunityIcons name="map-marker-radius" size={44} color={COLORS.gold} />
              </View>
            </View>
          </View>

          <Text style={styles.title}>Where should we deliver?</Text>
          <Text style={styles.subtitle}>
            Enable location access so we can check doorstep pickup availability, find a nearby LaundryFresh hub, and show any delivery fee before you confirm.
          </Text>
        </View>

        {/* Action Buttons */}
        {!manualMode ? (
          <View style={styles.actionStack}>
            <AppButton
              title={isLocating ? 'Finding your location...' : 'Use my location'}
              icon="crosshairs-gps"
              onPress={handleRequestLocation}
              disabled={isLocating}
              loading={isLocating}
              style={styles.primaryButton}
            />

            <AppButton
              title="Select City / Pincode Manually"
              icon="city"
              variant="outline"
              onPress={() => setManualMode(true)}
              compact
            />

            <Pressable accessibilityRole="button" accessibilityLabel="Browse services without choosing a location" onPress={onSkip} style={styles.skipButton}>
              <Text style={styles.skipText}>Browse services for now</Text>
            </Pressable>
          </View>
        ) : (
          <Card style={styles.manualCard}>
            <Text style={styles.manualHeading}>Select Your City or Pincode</Text>

            {/* Quick City Presets */}
            <View style={styles.presetsRow}>
              <Pressable
                style={styles.presetChip}
                accessibilityRole="button"
                accessibilityLabel="Choose Kukatpally, Hyderabad"
                onPress={() => handleSelectPresetCity('Hyderabad', '500072', 'Anusha Laundry (Kukatpally)')}
              >
                <MaterialCommunityIcons name="map-marker-outline" size={20} color={COLORS.plum} />
                <View>
                  <Text style={styles.presetCity}>Kukatpally, Hyderabad</Text>
                  <Text style={styles.presetHub}>Anusha Laundry Hub</Text>
                </View>
              </Pressable>

              <Pressable
                style={styles.presetChip}
                accessibilityRole="button"
                accessibilityLabel="Choose Madhapur or Hitech City"
                onPress={() => handleSelectPresetCity('Hyderabad', '500081', 'Hyderabad Cyber Hub')}
              >
                <MaterialCommunityIcons name="map-marker-outline" size={20} color={COLORS.plum} />
                <View>
                  <Text style={styles.presetCity}>Madhapur / Hitech City</Text>
                  <Text style={styles.presetHub}>Cyber Hub & Plant</Text>
                </View>
              </Pressable>

              <Pressable
                style={styles.presetChip}
                accessibilityRole="button"
                accessibilityLabel="Choose Rajahmundry"
                onPress={() => handleSelectPresetCity('Rajahmundry', '533101', 'Rajahmundry Central Hub')}
              >
                <MaterialCommunityIcons name="map-marker-outline" size={20} color={COLORS.plum} />
                <View>
                  <Text style={styles.presetCity}>Rajahmundry</Text>
                  <Text style={styles.presetHub}>Central Processing Hub</Text>
                </View>
              </Pressable>
            </View>

            {/* Pincode Input */}
            <View style={styles.pincodeBox}>
              <Text style={styles.pincodeLabel}>Or enter 6-digit Pincode:</Text>
              <View style={styles.pincodeInputRow}>
                <AppInput
                  label="Pincode"
                  value={pincodeInput}
                  onChangeText={(value) => setPincodeInput(value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="e.g. 500072"
                  keyboardType="number-pad"
                  maxLength={6}
                  containerStyle={styles.pincodeInput}
                />
                <AppButton
                  title="Apply"
                  onPress={handleValidateManualPincode}
                  loading={checkingPincode}
                  compact
                  style={styles.applyButton}
                />
              </View>
              {pincodeMessage && <Text style={styles.pincodeError}>{pincodeMessage}</Text>}
            </View>

            <View style={styles.manualActions}>
              <AppButton
                title="Use Auto GPS Location"
                icon="crosshairs-gps"
                variant="outline"
                onPress={() => setManualMode(false)}
                compact
              />
              <Pressable accessibilityRole="button" accessibilityLabel="Browse services without choosing a location" onPress={onSkip} style={styles.skipButton}>
                <Text style={styles.manualSkipText}>Browse services for now</Text>
              </Pressable>
            </View>
          </Card>
        )}

        {/* Trust Badges Footer */}
        <View style={styles.footerBadges}>
          <View style={styles.badgeItem}>
            <MaterialCommunityIcons name="shield-check-outline" size={16} color={COLORS.gold} />
            <Text style={styles.badgeText}>30-Min Doorstep Pickup</Text>
          </View>
          <View style={styles.badgeItem}>
            <MaterialCommunityIcons name="truck-fast-outline" size={16} color={COLORS.gold} />
            <Text style={styles.badgeText}>Real-Time GPS Tracking</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.plumDark },
  content: { padding: 16, justifyContent: 'space-between', minHeight: '100%' },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  logoCard: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  logo: { width: 64, height: 64, transform: [{ scale: 1.25 }] },
  brandCopy: { marginLeft: 10 },
  brandName: { color: COLORS.white, fontSize: 18, fontWeight: '900', letterSpacing: -0.2 },
  brandLabel: { color: COLORS.gold, fontSize: 8, fontWeight: '900', letterSpacing: 1.2, marginTop: 2 },
  heroCenter: { alignItems: 'center', marginVertical: 32 },
  radarOuterRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(214, 179, 106, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(214, 179, 106, 0.25)',
  },
  radarMiddleRing: {
    width: 106,
    height: 106,
    borderRadius: 53,
    backgroundColor: 'rgba(214, 179, 106, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarInnerCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.plum,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  title: {
    color: COLORS.white,
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  actionStack: { gap: 12, marginTop: 8 },
  primaryButton: { shadowColor: COLORS.gold, shadowOpacity: 0.3, elevation: 4 },
  skipButton: { paddingVertical: 10, alignItems: 'center' },
  skipText: { color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: '600' },
  manualCard: { backgroundColor: COLORS.white, padding: 16, gap: 16 },
  manualHeading: { color: COLORS.plumDark, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  presetsRow: { gap: 8 },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    backgroundColor: COLORS.cream,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  presetCity: { color: COLORS.plumDark, fontSize: 12, fontWeight: '800' },
  presetHub: { color: COLORS.plum, fontSize: 10, fontWeight: '600' },
  pincodeBox: { marginTop: 4, gap: 8 },
  pincodeLabel: { color: COLORS.muted, fontSize: 11, fontWeight: '700' },
  pincodeInputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  pincodeInput: { flex: 1 },
  applyButton: { alignSelf: 'center' },
  pincodeError: { color: COLORS.warning, fontSize: 11, fontWeight: '600' },
  manualActions: { marginTop: 4, alignItems: 'center', gap: 8 },
  manualSkipText: { color: COLORS.plum, fontSize: 12, fontWeight: '800' },
  footerBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  badgeItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badgeText: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700' },
});
