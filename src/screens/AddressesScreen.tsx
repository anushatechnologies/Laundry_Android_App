import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import { getCurrentCustomerLocation } from '@/services/location/locationService';
import { PickupLocationCard, type PickupLocationState } from '@/ui/PickupLocationCard';
import { AppButton, AppInput, Card, Chip, EmptyState, SectionTitle } from '@/ui/components';
import { COLORS } from '@/ui/theme';
import type { AddressType, CustomerAddress } from '@/types/domain';

interface AddressesScreenProps {
  onBook: () => void;
  onSignIn?: () => void;
}

type AddressDraft = Omit<CustomerAddress, 'id'>;

function initialDraft(name: string, phone: string): AddressDraft {
  return {
    type: 'Home',
    contactName: name,
    contactPhone: phone,
    street: '',
    landmark: '',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '',
    isDefault: true,
  };
}

export function AddressesScreen({ onBook, onSignIn }: AddressesScreenProps) {
  const { session, addresses, saveAddress, deleteAddress, validatePincode } = useApp();
  const [creating, setCreating] = useState(addresses.length === 0);
  const [draft, setDraft] = useState<AddressDraft>(() => initialDraft(session?.user.name || '', session?.user.phone || ''));
  const [availability, setAvailability] = useState<{ valid: boolean; message?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [locationState, setLocationState] = useState<PickupLocationState>('idle');
  const [locationSummary, setLocationSummary] = useState('');

  // --- GUEST VIEW (If not logged in) ---
  if (!session) {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.guestContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.guestIllustrationBox}>
          <MaterialCommunityIcons name="map-marker-radius-outline" size={54} color="#F97316" />
        </View>

        <Text style={styles.guestTitle}>Saved Pickup Addresses</Text>
        <Text style={styles.guestSubtitle}>
          Sign in to save Home, Office, and Apartment addresses for 1-tap express laundry pickups.
        </Text>

        <View style={styles.guestBenefitsCard}>
          <Text style={styles.guestBenefitsHeader}>Address features with an account:</Text>
          <View style={styles.guestBenefitRow}>
            <MaterialCommunityIcons name="home-outline" size={20} color="#16A34A" />
            <Text style={styles.guestBenefitText}>Save multiple delivery points (Home, Work, Villa)</Text>
          </View>
          <View style={styles.guestBenefitRow}>
            <MaterialCommunityIcons name="crosshairs-gps" size={20} color="#3B82F6" />
            <Text style={styles.guestBenefitText}>Precise GPS pin matching to nearest processing hub</Text>
          </View>
          <View style={styles.guestBenefitRow}>
            <MaterialCommunityIcons name="shield-check-outline" size={20} color="#F97316" />
            <Text style={styles.guestBenefitText}>Serviceability verification across all 6-digit pincodes</Text>
          </View>
        </View>

        <Pressable
          style={styles.guestPrimaryBtn}
          onPress={onSignIn}
          accessibilityLabel="Sign in to save addresses"
        >
          <MaterialCommunityIcons name="login" size={18} color="#FFFFFF" />
          <Text style={styles.guestPrimaryBtnText}>Sign In to Save Addresses</Text>
          <MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" />
        </Pressable>

        <Pressable
          style={styles.guestSecondaryBtn}
          onPress={onBook}
          accessibilityLabel="Book a new laundry pickup"
        >
          <MaterialCommunityIcons name="calendar-plus" size={18} color="#1C0B18" />
          <Text style={styles.guestSecondaryBtnText}>Book a Pickup</Text>
        </Pressable>
      </ScrollView>
    );
  }

  const checkPincode = async () => {
    const pin = draft.pincode.replace(/\D/g, '');
    if (pin.length !== 6) {
      setAvailability({ valid: false, message: 'Enter a six-digit pincode.' });
      return false;
    }
    try {
      const result = await validatePincode(pin);
      const valid = Boolean(result.isServiceable || result.serviceable);
      setAvailability({ valid, message: result.message });
      if (result.city) setDraft((current) => ({ ...current, city: result.city || current.city }));
      return valid;
    } catch (error) {
      setAvailability({ valid: false, message: error instanceof Error ? error.message : 'Unable to check this pincode.' });
      return false;
    }
  };

  const useLocation = async () => {
    setMessage(null);
    setLocationState('locating');
    try {
      const result = await getCurrentCustomerLocation('always');
      if (!result.ok) {
        setLocationState('denied');
        setMessage(result.message);
        return;
      }

      const resolved = result.location;
      setDraft((prev) => ({
        ...prev,
        street: resolved.formattedAddress || resolved.address || prev.street,
        city: resolved.city || prev.city,
        state: resolved.state || prev.state,
        pincode: resolved.pincode || prev.pincode,
      }));
      setLocationSummary(resolved.formattedAddress || resolved.address || 'Location detected.');
      setLocationState('ready');
      if (resolved.isServiceable !== null && resolved.isServiceable !== undefined) {
        setAvailability({ valid: resolved.isServiceable, message: resolved.serviceabilityMessage });
      } else if (resolved.pincode) {
        const validation = await validatePincode(resolved.pincode);
        setAvailability({ valid: Boolean(validation.isServiceable || validation.serviceable), message: validation.message });
      }
    } catch (error) {
      setLocationState('denied');
      setMessage(error instanceof Error ? error.message : 'Failed to detect location.');
    }
  };

  const handleSave = async () => {
    if (!draft.contactName?.trim() || !draft.contactPhone?.trim() || !draft.street.trim() || !draft.pincode.trim()) {
      Alert.alert('Required Fields', 'Please complete contact name, phone, address, and pincode.');
      return;
    }
    const pinValid = await checkPincode();
    if (!pinValid) {
      Alert.alert('Unserviceable', 'Please enter a serviceable pincode.');
      return;
    }
    setSaving(true);
    try {
      await saveAddress(draft);
      setCreating(false);
      setDraft(initialDraft(session?.user.name || '', session?.user.phone || ''));
      Alert.alert('Saved', 'Pickup address has been saved successfully.');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not save address.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Saved Addresses</Text>
        <Text style={styles.subtitle}>Doorstep pickup and delivery locations.</Text>
      </View>

      {creating ? (
        <Card style={styles.formCard}>
          <Text style={styles.formTitle}>Add New Address</Text>

          <PickupLocationCard
            state={locationState}
            address={locationSummary}
            isServiceable={availability?.valid}
            onUseLocation={useLocation}
          />

          <View style={styles.typeRow}>
            {(['Home', 'Office', 'Other'] as AddressType[]).map((t) => (
              <Chip
                key={t}
                label={t}
                active={draft.type === t}
                onPress={() => setDraft((c) => ({ ...c, type: t }))}
              />
            ))}
          </View>

          <AppInput
            label="Contact Person Name *"
            placeholder="Your full name"
            value={draft.contactName}
            onChangeText={(contactName) => setDraft((c) => ({ ...c, contactName }))}
          />

          <AppInput
            label="Phone Number *"
            placeholder="10-digit mobile number"
            keyboardType="phone-pad"
            value={draft.contactPhone}
            onChangeText={(contactPhone) => setDraft((c) => ({ ...c, contactPhone }))}
          />

          <AppInput
            label="House / Flat / Street Address *"
            placeholder="e.g. Flat 402, Sunshine Heights, Road No 10"
            value={draft.street}
            onChangeText={(street) => setDraft((c) => ({ ...c, street }))}
          />

          <AppInput
            label="Landmark (Optional)"
            placeholder="e.g. Near HDFC Bank"
            value={draft.landmark}
            onChangeText={(landmark) => setDraft((c) => ({ ...c, landmark }))}
          />

          <AppInput
            label="6-Digit Pincode *"
            placeholder="500081"
            keyboardType="number-pad"
            value={draft.pincode}
            onChangeText={(pincode) => setDraft((c) => ({ ...c, pincode }))}
          />

          {availability && (
            <View style={[styles.statusBox, availability.valid ? styles.statusBoxSuccess : styles.statusBoxError]}>
              <MaterialCommunityIcons
                name={availability.valid ? 'check-circle' : 'alert-circle'}
                size={16}
                color={availability.valid ? '#16A34A' : '#DC2626'}
              />
              <Text style={[styles.statusBoxText, { color: availability.valid ? '#16A34A' : '#DC2626' }]}>
                {availability.message || (availability.valid ? 'Pincode is serviceable for 24H laundry.' : 'Location currently unserviceable.')}
              </Text>
            </View>
          )}

          <View style={styles.formActions}>
            {addresses.length > 0 && (
              <AppButton title="Cancel" variant="outline" compact onPress={() => setCreating(false)} />
            )}
            <AppButton
              title={saving ? 'Saving Address...' : 'Save Address'}
              compact
              loading={saving}
              onPress={handleSave}
            />
          </View>
        </Card>
      ) : (
        <View style={styles.addressList}>
          <AppButton
            title="+ Add New Pickup Address"
            icon="map-marker-plus"
            style={{ paddingVertical: 4 }}
            onPress={() => {
              setDraft(initialDraft(session?.user.name || '', session?.user.phone || ''));
              setCreating(true);
            }}
          />

          {addresses.map((item) => (
            <Card key={item.id} style={styles.addressCard}>
              <View style={styles.addressTop}>
                <View style={styles.addressTypeBadge}>
                  <MaterialCommunityIcons
                    name={item.type === 'Home' ? 'home-outline' : item.type === 'Office' ? 'briefcase-outline' : 'map-marker-outline'}
                    size={14}
                    color="#F97316"
                  />
                  <Text style={styles.addressTypeText}>{item.type}</Text>
                </View>
                {item.isDefault && <Text style={styles.defaultBadge}>Default</Text>}
              </View>

              <Text style={styles.addressName}>{item.contactName} • {item.contactPhone}</Text>
              <Text style={styles.addressStreet}>{item.street}</Text>
              {item.landmark ? <Text style={styles.addressLandmark}>Landmark: {item.landmark}</Text> : null}
              <Text style={styles.addressCity}>{item.city}, {item.state} - {item.pincode}</Text>

              <View style={styles.addressActions}>
                <Pressable
                  style={styles.deleteBtn}
                  onPress={() => {
                    Alert.alert('Delete Address', 'Are you sure you want to remove this saved address?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => void deleteAddress(item.id) },
                    ]);
                  }}
                >
                  <MaterialCommunityIcons name="trash-can-outline" size={16} color="#EF4444" />
                  <Text style={styles.deleteBtnText}>Remove</Text>
                </Pressable>
              </View>
            </Card>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAF5EF' },
  content: { padding: 16, paddingBottom: 40, gap: 14 },
  guestContainer: { padding: 24, paddingTop: 40, paddingBottom: 60, alignItems: 'center' },
  guestIllustrationBox: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  guestTitle: { fontSize: 22, fontWeight: '900', color: '#1C0B18', textAlign: 'center', letterSpacing: -0.3 },
  guestSubtitle: { fontSize: 13, color: '#8A7A84', textAlign: 'center', lineHeight: 19, marginTop: 6, marginBottom: 24, paddingHorizontal: 10 },
  guestBenefitsCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#F3E8DF',
    marginBottom: 24,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  guestBenefitsHeader: { fontSize: 13, fontWeight: '800', color: '#1C0B18', marginBottom: 4 },
  guestBenefitRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  guestBenefitText: { flex: 1, fontSize: 12, fontWeight: '600', color: '#4A3B45', lineHeight: 16 },
  guestPrimaryBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F97316',
    borderRadius: 16,
    paddingVertical: 14,
    gap: 8,
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 12,
  },
  guestPrimaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  guestSecondaryBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5DCD5',
    borderRadius: 16,
    paddingVertical: 14,
    gap: 8,
  },
  guestSecondaryBtnText: { color: '#1C0B18', fontSize: 14, fontWeight: '700' },
  header: { marginBottom: 4 },
  title: { fontSize: 26, fontWeight: '900', color: '#1C0B18', letterSpacing: -0.3 },
  subtitle: { fontSize: 14, color: '#8A7A84', marginTop: 4 },
  formCard: { padding: 16, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F3E8DF', gap: 12 },
  formTitle: { fontSize: 16, fontWeight: '900', color: '#1C0B18', marginBottom: 4 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  statusBox: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 10, gap: 8 },
  statusBoxSuccess: { backgroundColor: '#DCFCE7' },
  statusBoxError: { backgroundColor: '#FEE2E2' },
  statusBoxText: { fontSize: 12, fontWeight: '700' },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  addressList: { gap: 12 },
  addressCard: { padding: 18, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F3E8DF', gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  addressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addressTypeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF7ED', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10, gap: 6 },
  addressTypeText: { fontSize: 14, fontWeight: '800', color: '#F97316' },
  defaultBadge: { fontSize: 13, fontWeight: '800', color: '#16A34A', backgroundColor: '#DCFCE7', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  addressName: { fontSize: 17, fontWeight: '900', color: '#1C0B18', marginTop: 4 },
  addressStreet: { fontSize: 15, color: '#4A3B45', lineHeight: 22 },
  addressLandmark: { fontSize: 14, color: '#8A7A84' },
  addressCity: { fontSize: 14, color: '#8A7A84', fontWeight: '600' },
  addressActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10, borderTopWidth: 1, borderTopColor: '#F7F2EE', paddingTop: 10 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF2F2', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  deleteBtnText: { fontSize: 13, color: '#EF4444', fontWeight: '800' },
});
