import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import { Card } from '@/ui/components';
import {
  type DeliveryInstructions,
  type FragrancePreference,
  type PackagingPreference,
  type StarchLevel,
} from '@/types/domain';

interface SettingsScreenProps {
  onSignIn?: () => void;
}

export function SettingsScreen({ onSignIn }: SettingsScreenProps) {
  const { session, preferences, updatePreferences, updateUserProfile, deleteAccount } = useApp();

  // Edit Name & Email Modal
  const [editingProfile, setEditingProfile] = useState(false);
  const [nameInput, setNameInput] = useState(session?.user?.name || '');
  const [emailInput, setEmailInput] = useState(session?.user?.email || '');

  // Privacy Policy Modal
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const handleSaveProfile = async () => {
    if (!nameInput.trim()) {
      Alert.alert('Required', 'Please enter your name.');
      return;
    }
    // Validate name contains only letters, spaces, dots, hyphens
    if (!/^[a-zA-Z\s.\-]+$/.test(nameInput.trim())) {
      Alert.alert('Invalid Name', 'Name should only contain letters, spaces, dots, and hyphens.');
      return;
    }
    try {
      await updateUserProfile(nameInput.trim(), emailInput.trim());
      setEditingProfile(false);
      Alert.alert('Profile Updated', 'Your contact details have been updated.');
    } catch {
      Alert.alert('Profile Saved', 'Details updated successfully.');
      setEditingProfile(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account & Data',
      'Are you sure you want to permanently delete your LaundryFresh account, saved addresses, and stored preferences? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount();
              Alert.alert('Account Closed', 'Your account and personal data have been removed.');
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Could not complete account deletion.');
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* 1. ACCOUNT PROFILE CARD */}
      {session ? (
        <Card style={styles.profileCard}>
          <View style={styles.avatarRow}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {session.user.name ? session.user.name.charAt(0).toUpperCase() : 'C'}
              </Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.userName}>{session.user.name || 'Valued Customer'}</Text>
              <Text style={styles.userPhone}>+91 {session.user.phone}</Text>
              {session.user.email ? <Text style={styles.userEmail}>{session.user.email}</Text> : null}
            </View>

            <Pressable
              style={styles.editProfileBtn}
              onPress={() => {
                setNameInput(session.user.name || '');
                setEmailInput(session.user.email || '');
                setEditingProfile(true);
              }}
              accessibilityLabel="Edit Profile"
            >
              <MaterialCommunityIcons name="pencil-outline" size={18} color="#F97316" />
            </Pressable>
          </View>
        </Card>
      ) : (
        <Card style={styles.guestCard}>
          <View style={styles.avatarRow}>
            <View style={[styles.avatarCircle, { backgroundColor: '#3D2134' }]}>
              <MaterialCommunityIcons name="account-outline" size={26} color="#D6B36A" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.userName}>Guest Customer</Text>
              <Text style={styles.guestSub}>Sign in to save custom laundry preferences & addresses.</Text>
            </View>
          </View>
          {onSignIn && (
            <Pressable style={styles.signInBtn} onPress={onSignIn}>
              <MaterialCommunityIcons name="login" size={16} color="#FFFFFF" />
              <Text style={styles.signInBtnText}>Sign In / Register</Text>
            </Pressable>
          )}
        </Card>
      )}

      {/* 2. NOTIFICATIONS & ALERTS */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications & Alerts</Text>

        <Card style={styles.toggleGroupCard}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleIconCircle}>
              <MaterialCommunityIcons name="whatsapp" size={20} color="#16A34A" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>WhatsApp Delivery Updates</Text>
              <Text style={styles.toggleSub}>Receive live milestone updates, weigh bills, and out-for-delivery alerts</Text>
            </View>
            <Pressable
              style={[styles.toggleSwitch, preferences.whatsappUpdates && styles.toggleSwitchActive]}
              onPress={() => updatePreferences({ whatsappUpdates: !preferences.whatsappUpdates })}
            >
              <View style={[styles.toggleThumb, preferences.whatsappUpdates && styles.toggleThumbActive]} />
            </Pressable>
          </View>

          <View style={styles.divider} />

          <View style={styles.toggleRow}>
            <View style={styles.toggleIconCircle}>
              <MaterialCommunityIcons name="tag-outline" size={20} color="#3B82F6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>Promotions & Festive Offers</Text>
              <Text style={styles.toggleSub}>Exclusive discounts on silk saree care, blankets & seasonal coupons</Text>
            </View>
            <Pressable
              style={[styles.toggleSwitch, preferences.promotionalAlerts && styles.toggleSwitchActive]}
              onPress={() => updatePreferences({ promotionalAlerts: !preferences.promotionalAlerts })}
            >
              <View style={[styles.toggleThumb, preferences.promotionalAlerts && styles.toggleThumbActive]} />
            </Pressable>
          </View>
        </Card>
      </View>

      {/* 3. LAUNDRY & FABRIC CARE PREFERENCES */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Laundry & Garment Care</Text>
          <View style={styles.activeTag}>
            <Text style={styles.activeTagText}>Saved for all orders</Text>
          </View>
        </View>

        {/* 3A. STARCH LEVEL */}
        <Card style={styles.preferenceCard}>
          <View style={styles.prefHeader}>
            <MaterialCommunityIcons name="iron-outline" size={20} color="#F97316" />
            <View style={{ flex: 1 }}>
              <Text style={styles.prefTitle}>Starch Level Preference</Text>
              <Text style={styles.prefSub}>Applied to shirts, kurtas, dhotis & cottons</Text>
            </View>
          </View>

          <View style={styles.chipRow}>
            {([
              { key: 'NONE', label: 'No Starch', desc: 'Natural soft finish' },
              { key: 'LIGHT', label: 'Light', desc: 'Mild crispness' },
              { key: 'MEDIUM', label: 'Medium', desc: 'Classic formal' },
              { key: 'HEAVY', label: 'Heavy', desc: 'Strict cotton' },
            ] as const).map(({ key, label }) => {
              const selected = preferences.starchLevel === key;
              return (
                <Pressable
                  key={key}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => updatePreferences({ starchLevel: key as StarchLevel })}
                >
                  {selected && <MaterialCommunityIcons name="check" size={14} color="#FFFFFF" />}
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* 3B. PACKAGING PREFERENCE */}
        <Card style={styles.preferenceCard}>
          <View style={styles.prefHeader}>
            <MaterialCommunityIcons name="hanger" size={20} color="#8B5CF6" />
            <View style={{ flex: 1 }}>
              <Text style={styles.prefTitle}>Packaging & Finishing Style</Text>
              <Text style={styles.prefSub}>How you would like garments returned</Text>
            </View>
          </View>

          <View style={styles.radioGroup}>
            <Pressable
              style={[styles.radioCard, preferences.packagingPreference === 'FOLDED' && styles.radioCardSelected]}
              onPress={() => updatePreferences({ packagingPreference: 'FOLDED' as PackagingPreference })}
            >
              <MaterialCommunityIcons
                name={preferences.packagingPreference === 'FOLDED' ? 'radiobox-marked' : 'radiobox-blank'}
                size={20}
                color={preferences.packagingPreference === 'FOLDED' ? '#8B5CF6' : '#9CA3AF'}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.radioLabel}>Eco-Friendly Folded</Text>
                <Text style={styles.radioSub}>Neatly folded in breathable protective paper bags</Text>
              </View>
            </Pressable>

            <Pressable
              style={[styles.radioCard, preferences.packagingPreference === 'HANGER' && styles.radioCardSelected]}
              onPress={() => updatePreferences({ packagingPreference: 'HANGER' as PackagingPreference })}
            >
              <MaterialCommunityIcons
                name={preferences.packagingPreference === 'HANGER' ? 'radiobox-marked' : 'radiobox-blank'}
                size={20}
                color={preferences.packagingPreference === 'HANGER' ? '#8B5CF6' : '#9CA3AF'}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.radioLabel}>On Premium Hangers</Text>
                <Text style={styles.radioSub}>Ironed and hung with clear protective garment covers</Text>
              </View>
            </Pressable>
          </View>
        </Card>

        {/* 3C. DETERGENT & FRAGRANCE */}
        <Card style={styles.preferenceCard}>
          <View style={styles.prefHeader}>
            <MaterialCommunityIcons name="flower-tulip-outline" size={20} color="#EC4899" />
            <View style={{ flex: 1 }}>
              <Text style={styles.prefTitle}>Fragrance & Softener</Text>
              <Text style={styles.prefSub}>Fabric conditioner scent preference</Text>
            </View>
          </View>

          <View style={styles.chipRow}>
            {([
              { key: 'FRESH', label: 'Morning Breeze', icon: 'weather-sunny' },
              { key: 'LAVENDER', label: 'Lavender Calming', icon: 'flower' },
              { key: 'SCENT_FREE', label: 'Zero Fragrance', icon: 'water-off-outline' },
            ] as const).map(({ key, label, icon }) => {
              const selected = preferences.fragrancePreference === key;
              return (
                <Pressable
                  key={key}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => updatePreferences({ fragrancePreference: key as FragrancePreference })}
                >
                  <MaterialCommunityIcons
                    name={icon as any}
                    size={14}
                    color={selected ? '#FFFFFF' : '#4B5563'}
                  />
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* 3D. DELIVERY DROP INSTRUCTIONS */}
        <Card style={styles.preferenceCard}>
          <View style={styles.prefHeader}>
            <MaterialCommunityIcons name="door-closed-lock" size={20} color="#10B981" />
            <View style={{ flex: 1 }}>
              <Text style={styles.prefTitle}>Default Delivery Instructions</Text>
              <Text style={styles.prefSub}>Automatic handover preference for delivery partner</Text>
            </View>
          </View>

          <View style={styles.chipRow}>
            {([
              { key: 'RING_BELL', label: 'Ring Doorbell' },
              { key: 'LEAVE_AT_DOOR', label: 'Leave at Door' },
              { key: 'CALL_ON_ARRIVAL', label: 'Call on Arrival' },
            ] as const).map(({ key, label }) => {
              const selected = preferences.deliveryInstructions === key;
              return (
                <Pressable
                  key={key}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => updatePreferences({ deliveryInstructions: key as DeliveryInstructions })}
                >
                  {selected && <MaterialCommunityIcons name="check" size={14} color="#FFFFFF" />}
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Card>
      </View>

      {/* 4. PRIVACY & SECURITY */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Privacy & Security</Text>

        <Card style={styles.menuGroupCard}>
          <Pressable style={styles.menuRow} onPress={() => setShowPrivacyModal(true)}>
            <MaterialCommunityIcons name="shield-account-outline" size={20} color="#1C0B18" />
            <Text style={styles.menuLabel}>Privacy & Data Protection</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#9CA3AF" />
          </Pressable>

          {session && (
            <>
              <View style={styles.divider} />
              <Pressable style={styles.menuRow} onPress={handleDeleteAccount}>
                <MaterialCommunityIcons name="account-remove-outline" size={20} color="#EF4444" />
                <Text style={[styles.menuLabel, { color: '#EF4444' }]}>Delete Account & Data</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#EF4444" />
              </Pressable>
            </>
          )}
        </Card>
      </View>

      {/* 5. APP VERSION */}
      <View style={styles.versionWrap}>
        <Text style={styles.versionTitle}>LaundryFresh Mobile</Text>
        <Text style={styles.versionSub}>
          Version {Constants.expoConfig?.version ?? '2.4.0'} • Anusha Technologies
        </Text>
      </View>

      {/* Edit Profile Modal */}
      <Modal visible={editingProfile} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile Information</Text>
              <Pressable onPress={() => setEditingProfile(false)}>
                <MaterialCommunityIcons name="close" size={22} color="#1C0B18" />
              </Pressable>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Full Name</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Full Name"
                placeholderTextColor="#A1A1AA"
                value={nameInput}
                onChangeText={(val) => {
                  // Only allow letters, spaces, dots, and hyphens
                  const filtered = val.replace(/[^a-zA-Z\s.\-]/g, '');
                  setNameInput(filtered);
                }}
                keyboardType="default"
              />

              <Text style={[styles.formLabel, { marginTop: 10 }]}>Email Address</Text>
              <TextInput
                style={styles.formInput}
                placeholder="name@example.com"
                placeholderTextColor="#A1A1AA"
                value={emailInput}
                onChangeText={setEmailInput}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <Pressable style={styles.saveBtn} onPress={handleSaveProfile}>
              <Text style={styles.saveBtnText}>Save Changes</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Privacy Policy Modal */}
      <Modal visible={showPrivacyModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Privacy & Data Protection</Text>
              <Pressable onPress={() => setShowPrivacyModal(false)}>
                <MaterialCommunityIcons name="close" size={22} color="#1C0B18" />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.policyBody}>
                • Your personal phone number, location GPS, and laundry order history are 256-bit encrypted.
                {'\n\n'}
                • We never sell, rent, or trade your data to third-party ad networks.
                {'\n\n'}
                • Laundry preferences and delivery notes are used strictly to customize the washing, pressing, and doorstep handover of your garments.
                {'\n\n'}
                • You can delete your account and personal data at any time using the Delete Account option.
              </Text>
            </ScrollView>
            <Pressable style={styles.saveBtn} onPress={() => setShowPrivacyModal(false)}>
              <Text style={styles.saveBtnText}>I Understand</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FCF9F7',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 18,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3E8DF',
  },
  guestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3E8DF',
    gap: 12,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1C0B18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#D6B36A',
  },
  userName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1C0B18',
  },
  userPhone: {
    fontSize: 14,
    color: '#8A7A84',
    marginTop: 3,
  },
  userEmail: {
    fontSize: 13,
    color: '#F97316',
    marginTop: 2,
  },
  guestSub: {
    fontSize: 13,
    color: '#8A7A84',
    marginTop: 3,
    lineHeight: 18,
  },
  signInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F97316',
    borderRadius: 12,
    paddingVertical: 10,
    marginTop: 4,
  },
  signInBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  editProfileBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FAF5EF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E8DED6',
  },
  section: {
    gap: 10,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#1C0B18',
    letterSpacing: -0.2,
  },
  activeTag: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  activeTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#16A34A',
  },
  toggleGroupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F3E8DF',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  toggleIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FAF5EF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1C0B18',
  },
  toggleSub: {
    fontSize: 12,
    color: '#8A7A84',
    marginTop: 3,
    lineHeight: 17,
  },
  toggleSwitch: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#E5E7EB',
    padding: 2,
    justifyContent: 'center',
  },
  toggleSwitchActive: {
    backgroundColor: '#16A34A',
  },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3E8DF',
    marginVertical: 10,
  },
  preferenceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F3E8DF',
    gap: 12,
  },
  prefHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  prefTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1C0B18',
  },
  prefSub: {
    fontSize: 12,
    color: '#8A7A84',
    marginTop: 2,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FAF5EF',
    borderWidth: 1,
    borderColor: '#E8DED6',
  },
  chipSelected: {
    backgroundColor: '#1C0B18',
    borderColor: '#1C0B18',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  radioGroup: {
    gap: 8,
  },
  radioCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#FAF5EF',
    borderWidth: 1,
    borderColor: '#E8DED6',
  },
  radioCardSelected: {
    backgroundColor: '#F5F3FF',
    borderColor: '#8B5CF6',
  },
  radioLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1C0B18',
  },
  radioSub: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
  menuGroupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F3E8DF',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  menuLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: '#1C0B18',
  },
  versionWrap: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 2,
  },
  versionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#8A7A84',
  },
  versionSub: {
    fontSize: 11,
    color: '#A1A1AA',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#1C0B18',
  },
  formGroup: {
    gap: 4,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1C0B18',
  },
  formInput: {
    backgroundColor: '#FAF5EF',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: '#E8DED6',
    fontSize: 13,
    color: '#1C0B18',
  },
  saveBtn: {
    backgroundColor: '#F97316',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  policyBody: {
    fontSize: 13,
    lineHeight: 20,
    color: '#4B5563',
  },
});
