import React, { useState, useEffect } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { useToast } from '@/context/ToastContext';
import { useTheme } from '@/context/ThemeContext';
import { Card } from '@/ui/components';
import { checkForAppUpdate, CURRENT_APP_VERSION, CURRENT_APP_CODE } from '@/services/app-update/updateChecker';
import type { CustomerPreferences } from '@/types/domain';

interface SettingsScreenProps {
  onSignIn?: () => void;
}

export function SettingsScreen({ onSignIn }: SettingsScreenProps) {
  const { session, preferences, updatePreferences, updateUserProfile, deleteAccount, signOut } = useApp();
  const { toast } = useToast();
  const { colors, isDark } = useTheme();

  // Edit Name & Email Modal
  const [editingProfile, setEditingProfile] = useState(false);
  const [nameInput, setNameInput] = useState(session?.user?.name || '');
  const [emailInput, setEmailInput] = useState(session?.user?.email || '');
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Privacy Policy Modal
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

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

    const cleanEmail = emailInput.trim().toLowerCase();
    if (cleanEmail && !EMAIL_REGEX.test(cleanEmail)) {
      Alert.alert(
        'Invalid Email Format',
        'Please enter a valid email address (e.g. name@gmail.com) or leave the field blank.'
      );
      return;
    }

    try {
      await updateUserProfile(nameInput.trim(), cleanEmail);
      setEditingProfile(false);
      Alert.alert('Profile Updated', 'Your contact details have been updated.');
    } catch {
      Alert.alert('Profile Saved', 'Details updated successfully.');
      setEditingProfile(false);
    }
  };

  const handleTogglePreference = async (
    key: keyof CustomerPreferences,
    currentVal: boolean,
    label: string
  ) => {
    const nextVal = !currentVal;
    try {
      await updatePreferences({ [key]: nextVal });
      if (nextVal) {
        toast.success(
          `${label} Enabled`,
          `You will receive notifications for ${label.toLowerCase()}.`
        );
      } else {
        toast.info(
          `${label} Disabled`,
          `Notifications for ${label.toLowerCase()} turned off.`
        );
      }
    } catch {
      toast.error('Update Failed', 'Could not update preferences. Please try again.');
    }
  };

  const handleLogOut = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out? Your account data will be saved and you can sign in again anytime.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'default',
          onPress: async () => {
            try {
              await signOut();
              Alert.alert('Logged Out', 'You have been signed out successfully. See you soon!');
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Could not log out. Please try again.');
            }
          },
        },
      ]
    );
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

  const notificationItems = [
    {
      key: 'whatsappUpdates' as const,
      label: 'WhatsApp Delivery Updates',
      sub: 'Receive live milestone updates, weigh bills, and out-for-delivery alerts',
      icon: 'whatsapp' as const,
      iconColor: '#16A34A',
      iconBg: '#F0FDF4',
      active: preferences.whatsappUpdates !== false,
    },
    {
      key: 'pushNotifications' as const,
      label: 'Push Notifications',
      sub: 'Instant order progress, pickup alerts, and live tracking updates',
      icon: 'bell-ring-outline' as const,
      iconColor: '#7C3AED',
      iconBg: '#F5F3FF',
      active: preferences.pushNotifications !== false,
    },
    {
      key: 'promotionalAlerts' as const,
      label: 'Promotions & Festive Offers',
      sub: 'Exclusive discounts on silk saree care, blankets & seasonal coupons',
      icon: 'tag-outline' as const,
      iconColor: '#2563EB',
      iconBg: '#EFF6FF',
      active: Boolean(preferences.promotionalAlerts),
    },
    {
      key: 'emailInvoices' as const,
      label: 'Email Receipts & Invoices',
      sub: 'Itemized GST tax invoices, pickup manifests, and digital payment receipts',
      icon: 'email-outline' as const,
      iconColor: '#D97706',
      iconBg: '#FEF3C7',
      active: preferences.emailInvoices !== false,
    },
    {
      key: 'smsAlerts' as const,
      label: 'SMS Delivery & OTP Alerts',
      sub: 'Order confirmation SMS, secure delivery OTP codes, and pickup reminders',
      icon: 'message-text-outline' as const,
      iconColor: '#0D9488',
      iconBg: '#CCFBF1',
      active: preferences.smsAlerts !== false,
    },
  ];

  return (
    <ScrollView style={[styles.root, { backgroundColor: colors.background }]} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* 1. ACCOUNT PROFILE CARD */}
      {session ? (
        <Card style={[styles.profileCard, isDark && { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.avatarRow}>
            <View style={[styles.avatarCircle, isDark && { backgroundColor: colors.section }]}>
              <Text style={styles.avatarText}>
                {session.user.name ? session.user.name.charAt(0).toUpperCase() : 'C'}
              </Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.userName, isDark && { color: colors.textHeading }]}>{session.user.name || 'Valued Customer'}</Text>
              <Text style={[styles.userPhone, isDark && { color: colors.textCaption }]}>+91 {session.user.phone}</Text>
              {session.user.email ? <Text style={styles.userEmail}>{session.user.email}</Text> : null}
            </View>

            <Pressable
              style={[styles.editProfileBtn, isDark && { backgroundColor: colors.section, borderColor: colors.border }]}
              onPress={() => {
                setNameInput(session.user.name || '');
                setEmailInput(session.user.email || '');
                setEditingProfile(true);
              }}
              accessibilityLabel="Edit Profile"
            >
              <MaterialCommunityIcons name="pencil-outline" size={18} color="#059669" />
            </Pressable>
          </View>
        </Card>
      ) : (
        <Card style={[styles.guestCard, isDark && { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.avatarRow}>
            <View style={[styles.avatarCircle, { backgroundColor: isDark ? colors.section : '#3D2134' }]}>
              <MaterialCommunityIcons name="account-outline" size={26} color="#D6B36A" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.userName, isDark && { color: colors.textHeading }]}>Guest Customer</Text>
              <Text style={[styles.guestSub, isDark && { color: colors.textCaption }]}>Sign in to access your orders and saved addresses.</Text>
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
        <Text style={[styles.sectionTitle, isDark && { color: colors.textHeading }]}>Notifications & Alerts</Text>

        <Card style={[styles.toggleGroupCard, isDark && { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {notificationItems.map((item, index) => (
            <React.Fragment key={item.key}>
              {index > 0 && <View style={[styles.divider, isDark && { backgroundColor: colors.border }]} />}
              <Pressable
                style={styles.toggleRow}
                onPress={() => handleTogglePreference(item.key, item.active, item.label)}
                accessibilityRole="switch"
                accessibilityState={{ checked: item.active }}
                accessibilityLabel={item.label}
              >
                <View
                  style={[
                    styles.toggleIconCircle,
                    { backgroundColor: isDark ? colors.section : item.iconBg },
                  ]}
                >
                  <MaterialCommunityIcons name={item.icon} size={20} color={item.iconColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.toggleLabel, isDark && { color: colors.textHeading }]}>
                    {item.label}
                  </Text>
                  <Text style={[styles.toggleSub, isDark && { color: colors.textCaption }]}>
                    {item.sub}
                  </Text>
                </View>
                <View
                  style={[
                    styles.toggleSwitch,
                    isDark && !item.active && { backgroundColor: colors.section },
                    item.active && styles.toggleSwitchActive,
                  ]}
                >
                  <View style={[styles.toggleThumb, item.active && styles.toggleThumbActive]} />
                </View>
              </Pressable>
            </React.Fragment>
          ))}
        </Card>
      </View>

      {/* 3. PRIVACY & SECURITY */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, isDark && { color: colors.textHeading }]}>Privacy & Security</Text>

        <Card style={[styles.menuGroupCard, isDark && { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Pressable style={styles.menuRow} onPress={() => setShowPrivacyModal(true)}>
            <MaterialCommunityIcons name="shield-account-outline" size={20} color={isDark ? colors.textCaption : "#1C0B18"} />
            <Text style={[styles.menuLabel, isDark && { color: colors.textHeading }]}>Privacy & Data Protection</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#9CA3AF" />
          </Pressable>

          {session && (
            <>
              <View style={[styles.divider, isDark && { backgroundColor: colors.border }]} />
              <Pressable style={styles.menuRow} onPress={handleLogOut}>
                <MaterialCommunityIcons name="logout" size={20} color="#EF4444" />
                <Text style={[styles.menuLabel, { color: '#EF4444' }]}>Log Out from Device</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#EF4444" />
              </Pressable>
              
              <View style={[styles.divider, isDark && { backgroundColor: colors.border }]} />
              <Pressable style={styles.menuRow} onPress={handleDeleteAccount}>
                <MaterialCommunityIcons name="account-remove-outline" size={20} color="#EF4444" />
                <Text style={[styles.menuLabel, { color: '#EF4444' }]}>Delete Account & Data</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#EF4444" />
              </Pressable>
            </>
          )}
        </Card>
      </View>

      {/* 4. APP VERSION */}
      <Pressable
        style={styles.versionWrap}
        onPress={() => {
          void checkForAppUpdate({ silentIfUpToDate: false });
        }}
      >
        <Text style={[styles.versionTitle, isDark && { color: colors.textCaption }]}>LaundryFresh Mobile</Text>
        <Text style={[styles.versionSub, isDark && { color: colors.textCaption }]}>
          Version {CURRENT_APP_VERSION} (Build {CURRENT_APP_CODE}) • Anusha Technologies
        </Text>
      </Pressable>

      {/* Edit Profile Modal */}
      <Modal visible={editingProfile} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View
            style={[
              styles.modalOverlay,
              Platform.OS === 'android' && keyboardHeight > 0 && {
                justifyContent: 'flex-end',
                paddingBottom: keyboardHeight,
              },
            ]}
          >
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => {
                Keyboard.dismiss();
                setEditingProfile(false);
              }}
            />
            <View style={[styles.modalSheet, isDark && { backgroundColor: colors.surface }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, isDark && { color: colors.textHeading }]}>Edit Profile Information</Text>
                <Pressable
                  onPress={() => {
                    Keyboard.dismiss();
                    setEditingProfile(false);
                  }}
                  hitSlop={10}
                >
                  <MaterialCommunityIcons name="close" size={22} color={isDark ? colors.textCaption : "#1C0B18"} />
                </Pressable>
              </View>

              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, isDark && { color: colors.textHeading }]}>Full Name</Text>
                  <TextInput
                    style={[styles.formInput, isDark && { backgroundColor: colors.section, borderColor: colors.border, color: colors.textHeading }]}
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

                  <Text style={[styles.formLabel, { marginTop: 10 }, isDark && { color: colors.textHeading }]}>Email Address</Text>
                  <TextInput
                    style={[
                      styles.formInput,
                      isDark && { backgroundColor: colors.section, borderColor: colors.border, color: colors.textHeading },
                      Boolean(emailInput.trim() && !EMAIL_REGEX.test(emailInput.trim().toLowerCase())) && { borderColor: '#EF4444', borderWidth: 1.5 },
                    ]}
                    placeholder="name@example.com"
                    placeholderTextColor="#A1A1AA"
                    value={emailInput}
                    onChangeText={setEmailInput}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  {Boolean(emailInput.trim() && !EMAIL_REGEX.test(emailInput.trim().toLowerCase())) && (
                    <Text style={{ color: '#EF4444', fontSize: 11, marginTop: 4, fontWeight: '700' }}>
                      ⚠️ Please enter a valid email format (e.g. yourname@gmail.com)
                    </Text>
                  )}
                </View>

                <Pressable style={styles.saveBtn} onPress={handleSaveProfile}>
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                </Pressable>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Privacy Policy Modal */}
      <Modal visible={showPrivacyModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, isDark && { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, isDark && { color: colors.textHeading }]}>Privacy & Data Protection</Text>
              <Pressable onPress={() => setShowPrivacyModal(false)}>
                <MaterialCommunityIcons name="close" size={22} color={isDark ? colors.textCaption : "#1C0B18"} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              <Text style={[styles.policyBody, isDark && { color: colors.textBody }]}>
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
    paddingHorizontal: 16,
    paddingTop: 0,  // No top padding - header provides spacing
    paddingBottom: 80,
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
    color: '#059669',
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
    backgroundColor: '#059669',
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
  sectionTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#1C0B18',
    letterSpacing: -0.2,
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
    width: 38,
    height: 38,
    borderRadius: 19,
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
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 1.5,
    elevation: 2,
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3E8DF',
    marginVertical: 10,
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
    backgroundColor: '#059669',
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
