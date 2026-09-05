import Constants from 'expo-constants';
import React, { useState, useEffect } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import { Card, SectionTitle } from '@/ui/components';
import { COLORS } from '@/ui/theme';
import { api } from '@/lib/api';
import { PolicyData } from '@/types/domain';

interface ProfileScreenProps {
  onViewAddresses: () => void;
  onViewOffers: () => void;
  onViewOrders: () => void;
  onViewWishlist?: () => void;
  onSignIn?: () => void;
  onViewHelp?: () => void;
  onViewReferral?: () => void;
  onViewWallet?: () => void;
  onViewSettings?: () => void;
  onViewStats?: () => void;
  onViewLiveChat?: () => void;
  onViewSubscriptions?: () => void;
}

export function ProfileScreen({
  onViewAddresses,
  onViewOffers,
  onViewOrders,
  onViewWishlist,
  onSignIn,
  onViewHelp,
  onViewReferral,
  onViewWallet,
  onViewSettings,
  onViewStats,
  onViewLiveChat,
  onViewSubscriptions,
}: ProfileScreenProps) {
  const { session, addresses, orders, wishlist, signOut, updateUserProfile } = useApp();

  // Edit Profile Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState(session?.user.name || '');
  const [editEmail, setEditEmail] = useState(session?.user.email || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Policies Modal State
  const [activePolicyModal, setActivePolicyModal] = useState<'REFUND' | 'TERMS' | 'PRIVACY' | null>(null);
  const [policyData, setPolicyData] = useState<PolicyData | null>(null);

  useEffect(() => {
    if (session?.user) {
      setEditName(session.user.name || '');
      setEditEmail(session.user.email || '');
    }
  }, [session]);

  useEffect(() => {
    void (async () => {
      try {
        const data = await api.getPolicies();
        if (data) setPolicyData(data);
      } catch {
        // Fallback
      }
    })();
  }, []);

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert('Required', 'Please enter your name.');
      return;
    }

    setSavingProfile(true);
    try {
      await updateUserProfile(editName.trim(), editEmail.trim());
      setIsEditModalOpen(false);
      Alert.alert('Profile Updated', 'Your personal details have been saved successfully.');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const openWhatsApp = async () => {
    const phone = policyData?.support.whatsapp || '+919121999999';
    const cleanNumber = phone.replace(/\D/g, '');
    const url = `whatsapp://send?phone=${cleanNumber}&text=${encodeURIComponent('Hello LaundryFresh Support, I need assistance with my laundry order.')}`;
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      await Linking.openURL(`https://wa.me/${cleanNumber}`);
    }
  };

  const callSupport = async () => {
    const phone = policyData?.support.phone || '+919121999999';
    await Linking.openURL(`tel:${phone}`);
  };

  const logOut = () => {
    Alert.alert(
      'Sign out?',
      'Your session will be cleared from this phone. Your orders remain securely stored in the cloud.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: () => {
            void signOut();
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* 1. PROFILE HERO CARD */}
      {session ? (
        <View style={styles.profileHeaderCard}>
          <View style={styles.profileTopRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarLetter}>
                {session.user.name?.slice(0, 1).toUpperCase() || 'L'}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.name}>{session.user.name || 'Valued Customer'}</Text>
              <Text style={styles.phone}>
                {session.user.phone ? `+91 ${session.user.phone}` : '+91 8522918866'}
              </Text>
              {session.user.email ? (
                <Text style={styles.email}>{session.user.email}</Text>
              ) : (
                <Text style={styles.noEmail}>Add email for instant invoices</Text>
              )}
            </View>
          </View>

          {/* Edit Profile Button */}
          <Pressable
            style={styles.editProfileBtn}
            onPress={() => {
              setEditName(session.user.name || '');
              setEditEmail(session.user.email || '');
              setIsEditModalOpen(true);
            }}
          >
            <MaterialCommunityIcons name="pencil-outline" size={14} color="#F97316" />
            <Text style={styles.editProfileBtnText}>Edit Profile</Text>
          </Pressable>
        </View>
      ) : (
        /* GUEST PROFILE CARD */
        <View style={styles.guestHeaderCard}>
          <View style={styles.guestTopRow}>
            <View style={styles.guestAvatar}>
              <MaterialCommunityIcons name="account-outline" size={32} color="#D6B36A" />
            </View>
            <View style={styles.guestInfo}>
              <Text style={styles.guestTitle}>Welcome, Guest</Text>
              <Text style={styles.guestSubtitle}>
                Sign in to save addresses, track live laundry milestones & get 50% off.
              </Text>
            </View>
          </View>

          <Pressable
            style={styles.guestSignInBtn}
            onPress={onSignIn}
            accessibilityLabel="Sign in or create an account"
          >
            <MaterialCommunityIcons name="login" size={16} color="#FFFFFF" />
            <Text style={styles.guestSignInBtnText}>Sign In / Create Account</Text>
            <MaterialCommunityIcons name="arrow-right" size={16} color="#FFFFFF" />
          </Pressable>
        </View>
      )}

      {/* 2. STATS ROW */}
      <View style={styles.statRow}>
        <Pressable
          style={styles.statCard}
          onPress={session ? onViewOrders : onSignIn}
        >
          <Text style={styles.statNumber}>{session ? orders.length : 0}</Text>
          <Text style={styles.statLabel}>Orders Placed</Text>
        </Pressable>
        <Pressable
          style={styles.statCard}
          onPress={session ? onViewAddresses : onSignIn}
        >
          <Text style={styles.statNumber}>{session ? addresses.length : 0}</Text>
          <Text style={styles.statLabel}>Saved Addresses</Text>
        </Pressable>
      </View>

      {/* 3. ACCOUNT & SERVICES OPTIONS */}
      <SectionTitle title="Account & Services" />
      <Card style={styles.menuCard}>
        <Pressable
          style={styles.menuRow}
          onPress={onViewOrders}
        >
          <View style={[styles.menuIconBox, { backgroundColor: '#EFF6FF' }]}>
            <MaterialCommunityIcons name="shopping-outline" size={20} color="#3B82F6" />
          </View>
          <View style={styles.menuText}>
            <Text style={styles.menuTitle}>My Orders</Text>
            <Text style={styles.menuSubtitle}>
              {session ? 'View active orders & live progress' : 'Sign in to track orders & invoices'}
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#8A7A84" />
        </Pressable>

        <View style={styles.menuDivider} />

        <Pressable
          style={styles.menuRow}
          onPress={session ? onViewAddresses : onSignIn}
        >
          <View style={[styles.menuIconBox, { backgroundColor: '#FFF7ED' }]}>
            <MaterialCommunityIcons name="map-marker-outline" size={20} color="#F97316" />
          </View>
          <View style={styles.menuText}>
            <Text style={styles.menuTitle}>Saved Addresses</Text>
            <Text style={styles.menuSubtitle}>
              {session ? `${addresses.length} pickup addresses saved` : 'Save Home, Office & Other addresses'}
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#8A7A84" />
        </Pressable>

        <View style={styles.menuDivider} />

        <Pressable style={styles.menuRow} onPress={onViewOffers}>
          <View style={[styles.menuIconBox, { backgroundColor: '#F3E8FF' }]}>
            <MaterialCommunityIcons name="tag-outline" size={20} color="#9333EA" />
          </View>
          <View style={styles.menuText}>
            <Text style={styles.menuTitle}>Offers & Coupons</Text>
            <Text style={styles.menuSubtitle}>Exclusive discount codes & deals</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#8A7A84" />
        </Pressable>

        <View style={styles.menuDivider} />

        <Pressable style={styles.menuRow} onPress={onViewSubscriptions}>
          <View style={[styles.menuIconBox, { backgroundColor: '#FEF9E7' }]}>
            <MaterialCommunityIcons name="crown-outline" size={20} color="#F59E0B" />
          </View>
          <View style={styles.menuText}>
            <Text style={styles.menuTitle}>My Subscriptions</Text>
            <Text style={styles.menuSubtitle}>Purchased plans, balance and validity</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#8A7A84" />
        </Pressable>

        <View style={styles.menuDivider} />

        <Pressable style={styles.menuRow} onPress={onViewWishlist}>
          <View style={[styles.menuIconBox, { backgroundColor: '#FEF2F2' }]}>
            <MaterialCommunityIcons name="heart-outline" size={20} color="#EF4444" />
          </View>
          <View style={styles.menuText}>
            <Text style={styles.menuTitle}>My Saved Wishlist</Text>
            <Text style={styles.menuSubtitle}>
              {wishlist.length ? `${wishlist.length} item${wishlist.length === 1 ? '' : 's'} saved` : 'Save favorite garments & services'}
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#8A7A84" />
        </Pressable>

        <View style={styles.menuDivider} />

        <Pressable style={styles.menuRow} onPress={session ? onViewReferral : onSignIn}>
          <View style={[styles.menuIconBox, { backgroundColor: '#FFFBEB' }]}>
            <MaterialCommunityIcons name="gift-outline" size={20} color="#F59E0B" />
          </View>
          <View style={styles.menuText}>
            <Text style={styles.menuTitle}>Refer & Earn</Text>
            <Text style={styles.menuSubtitle}>Give 50% OFF to friends, get ₹150 off next order</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#8A7A84" />
        </Pressable>

        <View style={styles.menuDivider} />

        <Pressable style={styles.menuRow} onPress={onViewSettings}>
          <View style={[styles.menuIconBox, { backgroundColor: '#F3F4F6' }]}>
            <MaterialCommunityIcons name="cog-outline" size={20} color="#4B5563" />
          </View>
          <View style={styles.menuText}>
            <Text style={styles.menuTitle}>Settings & Preferences</Text>
            <Text style={styles.menuSubtitle}>Notifications, privacy & account settings</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#8A7A84" />
        </Pressable>

        <View style={styles.menuDivider} />

        <Pressable style={styles.menuRow} onPress={onViewLiveChat}>
          <View style={[styles.menuIconBox, { backgroundColor: '#EFF6FF' }]}>
            <MaterialCommunityIcons name="chat-processing-outline" size={20} color="#2563EB" />
          </View>
          <View style={styles.menuText}>
            <Text style={styles.menuTitle}>Live Concierge Chat Support</Text>
            <Text style={styles.menuSubtitle}>Chat with a Master Garment Specialist</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#8A7A84" />
        </Pressable>
      </Card>

      {/* 4. HELP & SUPPORT */}
      <SectionTitle title="Help & Support" />
      <Card style={styles.menuCard}>
        <Pressable style={styles.menuRow} onPress={openWhatsApp}>
          <View style={[styles.menuIconBox, { backgroundColor: '#DCFCE7' }]}>
            <MaterialCommunityIcons name="whatsapp" size={20} color="#16A34A" />
          </View>
          <View style={styles.menuText}>
            <Text style={styles.menuTitle}>Chat on WhatsApp</Text>
            <Text style={styles.menuSubtitle}>Instant resolution: 7:00 AM – 10:00 PM</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#8A7A84" />
        </Pressable>

        <View style={styles.menuDivider} />

        <Pressable style={styles.menuRow} onPress={callSupport}>
          <View style={[styles.menuIconBox, { backgroundColor: '#F1F5F9' }]}>
            <MaterialCommunityIcons name="phone-outline" size={20} color="#475569" />
          </View>
          <View style={styles.menuText}>
            <Text style={styles.menuTitle}>Call Customer Care</Text>
            <Text style={styles.menuSubtitle}>+91 8522918866</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#8A7A84" />
        </Pressable>
      </Card>

      {/* 6. POLICIES & LEGAL */}
      <SectionTitle title="Policies & Security" />
      <Card style={styles.menuCard}>
        <Pressable style={styles.menuRow} onPress={() => setActivePolicyModal('REFUND')}>
          <View style={[styles.menuIconBox, { backgroundColor: '#FEF2F2' }]}>
            <MaterialCommunityIcons name="shield-refresh-outline" size={20} color="#EF4444" />
          </View>
          <View style={styles.menuText}>
            <Text style={styles.menuTitle}>Refund & Damage Protection Policy</Text>
            <Text style={styles.menuSubtitle}>100% Free Re-wash & Compensation Guarantee</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#8A7A84" />
        </Pressable>

        <View style={styles.menuDivider} />

        <Pressable style={styles.menuRow} onPress={() => setActivePolicyModal('TERMS')}>
          <View style={[styles.menuIconBox, { backgroundColor: '#F8FAFC' }]}>
            <MaterialCommunityIcons name="file-document-outline" size={20} color="#64748B" />
          </View>
          <View style={styles.menuText}>
            <Text style={styles.menuTitle}>Terms & Conditions</Text>
            <Text style={styles.menuSubtitle}>Pickup rules & slot service standards</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#8A7A84" />
        </Pressable>

        <View style={styles.menuDivider} />

        <Pressable style={styles.menuRow} onPress={() => setActivePolicyModal('PRIVACY')}>
          <View style={[styles.menuIconBox, { backgroundColor: '#F0FDF4' }]}>
            <MaterialCommunityIcons name="lock-check-outline" size={20} color="#16A34A" />
          </View>
          <View style={styles.menuText}>
            <Text style={styles.menuTitle}>Privacy Policy</Text>
            <Text style={styles.menuSubtitle}>256-bit encrypted data protection</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#8A7A84" />
        </Pressable>
      </Card>

      {/* 7. SIGN OUT BUTTON (Only when logged in) */}
      {session && (
        <Pressable style={styles.signOutBtn} onPress={logOut}>
          <MaterialCommunityIcons name="logout" size={18} color="#EF4444" />
          <Text style={styles.signOutText}>Sign Out from Device</Text>
        </Pressable>
      )}

      {/* APP VERSION */}
      <Text style={styles.versionText}>
        LaundryFresh v{Constants.expoConfig?.version ?? '2.4.0'} • Anusha Bazaar Technologies
      </Text>

      {/* --- MODAL 1: EDIT PROFILE (Name & Email) --- */}
      <Modal visible={isEditModalOpen} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Profile Details</Text>
                <Pressable onPress={() => setIsEditModalOpen(false)}>
                  <MaterialCommunityIcons name="close" size={22} color="#1C0B18" />
                </Pressable>
              </View>

              <ScrollView
                style={styles.modalBody}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.inputLabel}>Full Name *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter your full name"
                  value={editName}
                  onChangeText={setEditName}
                />

                <Text style={[styles.inputLabel, { marginTop: 14 }]}>Email Address</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. yourname@gmail.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={editEmail}
                  onChangeText={setEditEmail}
                />

                <Text style={[styles.inputLabel, { marginTop: 14 }]}>Phone Number (Locked)</Text>
                <TextInput
                  style={[styles.textInput, styles.disabledInput]}
                  value={session?.user.phone ? `+91 ${session.user.phone}` : '+91 8522918866'}
                  editable={false}
                />
              </ScrollView>

              <View style={styles.modalFooter}>
                <Pressable
                  style={styles.cancelBtn}
                  onPress={() => setIsEditModalOpen(false)}
                  disabled={savingProfile}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={styles.saveBtn}
                  onPress={handleSaveProfile}
                  disabled={savingProfile}
                >
                  <Text style={styles.saveBtnText}>
                    {savingProfile ? 'Saving...' : 'Save Profile'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* --- MODAL 2: POLICIES VIEWER --- */}
      <Modal visible={activePolicyModal !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {activePolicyModal === 'REFUND' && 'Refund & Guarantee Policy'}
                {activePolicyModal === 'TERMS' && 'Terms & Conditions'}
                {activePolicyModal === 'PRIVACY' && 'Privacy & Data Protection'}
              </Text>
              <Pressable onPress={() => setActivePolicyModal(null)}>
                <MaterialCommunityIcons name="close" size={22} color="#1C0B18" />
              </Pressable>
            </View>

            <ScrollView style={styles.policyScroll} showsVerticalScrollIndicator={false}>
              {activePolicyModal === 'REFUND' && (
                <View style={styles.policyContent}>
                  <Text style={styles.policyHeader}>Refund & Damage Protection Policy</Text>
                  <Text style={styles.policyLastUpdated}>Last Updated: August 31, 2026</Text>

                  <Text style={styles.policySectionTitle}>1. Quality Guarantee</Text>
                  <Text style={styles.policyText}>
                    At LaundryFresh, we are committed to delivering exceptional laundry services. If you're not 100% satisfied with our service, we offer the following guarantees:
                  </Text>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#16A34A" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Free Re-wash Guarantee:</Text> If you are not satisfied with the washing, pressing, or dry cleaning of any garment, notify us within 24 hours of delivery. We will re-clean the garment at no additional charge.
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#16A34A" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Zero Color Bleed Assurance:</Text> All delicate fabrics, silks, and woolens undergo colorfastness testing. If color bleeding occurs during our process, we will compensate you.
                    </Text>
                  </View>

                  <Text style={styles.policySectionTitle}>2. Damage Compensation</Text>
                  <Text style={styles.policyText}>
                    In the rare event of damage to your garment during our processing:
                  </Text>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#16A34A" />
                    <Text style={styles.policyPointText}>
                      Compensation up to <Text style={styles.boldText}>10x the service cost</Text> of the damaged item will be credited to your LaundryFresh Wallet within 48 hours.
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#16A34A" />
                    <Text style={styles.policyPointText}>
                      Maximum compensation per garment is ₹5,000 unless proof of higher value is provided (purchase receipt required).
                    </Text>
                  </View>

                  <Text style={styles.policySectionTitle}>3. Refund Policy</Text>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#16A34A" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Order Cancellation:</Text> Full refund if cancelled before pickup. No refund after pickup has been completed.
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#16A34A" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Service Issues:</Text> Partial or full refund if we fail to deliver within committed timeframe (excluding force majeure events).
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#16A34A" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Refund Processing:</Text> Online payments refunded to original payment method within 5-7 business days. Wallet credits within 24 hours.
                    </Text>
                  </View>

                  <Text style={styles.policySectionTitle}>4. Lost Garment Policy</Text>
                  <Text style={styles.policyText}>
                    If a garment is lost during processing or delivery, we will compensate you at fair market value (maximum ₹5,000 per item without receipt, actual value with purchase receipt).
                  </Text>

                  <Text style={styles.policySectionTitle}>5. Exclusions</Text>
                  <Text style={styles.policyText}>
                    Our guarantee does not cover:
                  </Text>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="alert-circle" size={16} color="#F97316" />
                    <Text style={styles.policyPointText}>
                      Pre-existing damage, stains, or defects not reported at pickup
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="alert-circle" size={16} color="#F97316" />
                    <Text style={styles.policyPointText}>
                      Damage due to natural wear and tear or poor garment quality
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="alert-circle" size={16} color="#F97316" />
                    <Text style={styles.policyPointText}>
                      Items with "dry clean only" tags washed against our advice
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="alert-circle" size={16} color="#F97316" />
                    <Text style={styles.policyPointText}>
                      Ornamental buttons, sequins, or embellishments (noted during inspection)
                    </Text>
                  </View>

                  <Text style={styles.policySectionTitle}>6. Claim Process</Text>
                  <Text style={styles.policyText}>
                    To file a claim:
                  </Text>

                  <Text style={styles.policyText}>
                    1. Contact us within 24 hours of delivery via app chat or phone{'\n'}
                    2. Provide order number and photo evidence{'\n'}
                    3. Our quality team will review within 12 hours{'\n'}
                    4. Approved claims processed within 48 hours
                  </Text>

                  <Text style={styles.policySectionTitle}>7. Contact Support</Text>
                  <Text style={styles.policyText}>
                    For refund or damage claims, contact:{'\n'}
                    📞 Customer Care: 1800-XXX-XXXX{'\n'}
                    📧 Email: support@laundryfresh.com{'\n'}
                    💬 Live Chat: Available in app (9 AM - 9 PM)
                  </Text>
                </View>
              )}

              {activePolicyModal === 'TERMS' && (
                <View style={styles.policyContent}>
                  <Text style={styles.policyHeader}>Terms & Conditions</Text>
                  <Text style={styles.policyLastUpdated}>Last Updated: August 31, 2026</Text>

                  <Text style={styles.policySectionTitle}>1. Service Agreement</Text>
                  <Text style={styles.policyText}>
                    By using LaundryFresh services, you agree to these terms and conditions. These terms constitute a legally binding agreement between you and LaundryFresh.
                  </Text>

                  <Text style={styles.policySectionTitle}>2. Service Scope</Text>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#3B82F6" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Wash & Fold:</Text> Regular washing, drying, and folding of everyday garments. Turnaround: 24-36 hours.
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#3B82F6" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Wash & Iron:</Text> Washing followed by professional pressing. Turnaround: 24-36 hours.
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#3B82F6" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Dry Cleaning:</Text> Chemical-free dry cleaning for delicate garments. Turnaround: 48-72 hours.
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#3B82F6" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Express Service:</Text> Expedited service with 12-hour turnaround (additional charges apply).
                    </Text>
                  </View>

                  <Text style={styles.policySectionTitle}>3. Booking & Pickup</Text>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#3B82F6" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Doorstep Pickup:</Text> Ensure garments are kept ready at the selected time slot. Pickup window is ±30 minutes from scheduled time.
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#3B82F6" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Weight Verification:</Text> For bulk laundry orders, garments are weighed using calibrated digital scales in your presence. You will receive a weight receipt.
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#3B82F6" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Inspection:</Text> Our executive will inspect garments for stains, damage, or special care instructions. Any concerns will be noted.
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#3B82F6" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Missed Pickup:</Text> If you miss the pickup slot, please reschedule within the app. No-show charges may apply after 3 consecutive misses.
                    </Text>
                  </View>

                  <Text style={styles.policySectionTitle}>4. Pricing & Payment</Text>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#3B82F6" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Transparent Pricing:</Text> All prices are displayed upfront in the app. No hidden charges except for special stain removal (with prior approval).
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#3B82F6" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Payment Methods:</Text> We accept online payment (UPI, Cards, Wallets) via Razorpay and Cash on Delivery (COD).
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#3B82F6" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Payment Timing:</Text> Payment is due at delivery for COD orders. Online payments are processed after pickup confirmation.
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#3B82F6" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>GST:</Text> All prices are inclusive of 18% GST. GST invoice will be provided via email within 24 hours.
                    </Text>
                  </View>

                  <Text style={styles.policySectionTitle}>5. Delivery</Text>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#3B82F6" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Timely Delivery:</Text> We commit to deliver within the promised timeframe. Delays due to weather, festivals, or force majeure events may occur.
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#3B82F6" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Delivery Notification:</Text> You will receive SMS and app notifications 30 minutes before delivery.
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#3B82F6" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Quality Check:</Text> Please inspect your garments upon delivery. Report any issues immediately before our executive leaves.
                    </Text>
                  </View>

                  <Text style={styles.policySectionTitle}>6. Customer Responsibilities</Text>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="alert-circle" size={16} color="#F97316" />
                    <Text style={styles.policyPointText}>
                      Empty all pockets before handing over garments. LaundryFresh is not responsible for items left in pockets.
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="alert-circle" size={16} color="#F97316" />
                    <Text style={styles.policyPointText}>
                      Inform us of any special care requirements, stains, or fabric sensitivities at pickup.
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="alert-circle" size={16} color="#F97316" />
                    <Text style={styles.policyPointText}>
                      Do not send items that are heavily soiled with chemicals, paint, or hazardous substances.
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="alert-circle" size={16} color="#F97316" />
                    <Text style={styles.policyPointText}>
                      Provide accurate contact information and delivery address to avoid delays.
                    </Text>
                  </View>

                  <Text style={styles.policySectionTitle}>7. Cancellation Policy</Text>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#3B82F6" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Before Pickup:</Text> Free cancellation up to 1 hour before scheduled pickup slot.
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#3B82F6" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>After Pickup:</Text> Orders cannot be cancelled once garments are picked up and processing has begun.
                    </Text>
                  </View>

                  <Text style={styles.policySectionTitle}>8. Liability Limitations</Text>
                  <Text style={styles.policyText}>
                    LaundryFresh's liability for any damage, loss, or delay is limited to 10x the service charge or ₹5,000 per garment, whichever is lower (unless proof of higher value is provided).
                  </Text>

                  <Text style={styles.policyText}>
                    We are not liable for shrinkage, color fading, or damage due to poor garment quality, pre-existing damage, or manufacturer defects.
                  </Text>

                  <Text style={styles.policySectionTitle}>9. Subscription Terms</Text>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#3B82F6" />
                    <Text style={styles.policyPointText}>
                      Subscription plans are valid for 30 days from purchase date and are non-refundable.
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#3B82F6" />
                    <Text style={styles.policyPointText}>
                      Unused subscription credits do not roll over to the next month and cannot be transferred.
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#3B82F6" />
                    <Text style={styles.policyPointText}>
                      Auto-renewal can be disabled from account settings at any time before renewal date.
                    </Text>
                  </View>

                  <Text style={styles.policySectionTitle}>10. Governing Law</Text>
                  <Text style={styles.policyText}>
                    These terms are governed by the laws of India. Any disputes will be subject to the exclusive jurisdiction of courts in [Your City], India.
                  </Text>

                  <Text style={styles.policySectionTitle}>11. Changes to Terms</Text>
                  <Text style={styles.policyText}>
                    We reserve the right to modify these terms at any time. Changes will be notified via app or email. Continued use of our services constitutes acceptance of updated terms.
                  </Text>

                  <Text style={styles.policySectionTitle}>12. Contact Information</Text>
                  <Text style={styles.policyText}>
                    For questions about these terms:{'\n'}
                    📞 Customer Care: 1800-XXX-XXXX{'\n'}
                    📧 Email: legal@laundryfresh.com{'\n'}
                    🏢 Address: [Your Business Address]
                  </Text>
                </View>
              )}

              {activePolicyModal === 'PRIVACY' && (
                <View style={styles.policyContent}>
                  <Text style={styles.policyHeader}>Privacy Policy & Data Protection</Text>
                  <Text style={styles.policyLastUpdated}>Last Updated: August 31, 2026</Text>

                  <Text style={styles.policySectionTitle}>1. Introduction</Text>
                  <Text style={styles.policyText}>
                    LaundryFresh ("we", "us", "our") is committed to protecting your privacy and personal data. This Privacy Policy explains how we collect, use, store, and protect your information when you use our mobile application and services.
                  </Text>

                  <Text style={styles.policyText}>
                    By using LaundryFresh, you consent to the data practices described in this policy. If you do not agree, please discontinue use of our services.
                  </Text>

                  <Text style={styles.policySectionTitle}>2. Information We Collect</Text>

                  <Text style={styles.policySubsectionTitle}>2.1 Personal Information</Text>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#16A34A" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Account Details:</Text> Name, phone number, email address when you register
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#16A34A" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Address Information:</Text> Delivery and pickup addresses, including GPS coordinates for accurate navigation
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#16A34A" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Payment Information:</Text> Payment method details, transaction history (payment card details are stored securely by our payment partner Razorpay, not by us)
                    </Text>
                  </View>

                  <Text style={styles.policySubsectionTitle}>2.2 Service Usage Data</Text>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#16A34A" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Order Details:</Text> Garment types, service preferences, special instructions
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#16A34A" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Photos:</Text> Garment photos you upload for special care instructions or damage claims
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#16A34A" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Communication:</Text> Chat messages, support tickets, feedback, and ratings
                    </Text>
                  </View>

                  <Text style={styles.policySubsectionTitle}>2.3 Technical Information</Text>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#16A34A" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Device Information:</Text> Device type, operating system, app version, device ID
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#16A34A" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Location Data:</Text> GPS coordinates for pickup/delivery tracking and service availability
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#16A34A" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Usage Analytics:</Text> App interactions, feature usage, crash reports for improving user experience
                    </Text>
                  </View>

                  <Text style={styles.policySectionTitle}>3. How We Use Your Information</Text>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#16A34A" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Service Delivery:</Text> To process your laundry orders, coordinate pickups and deliveries, and provide customer support
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#16A34A" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Communication:</Text> To send order updates, delivery notifications, promotional offers, and service announcements via SMS, push notifications, and email
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#16A34A" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Payment Processing:</Text> To process payments, issue invoices, and manage your wallet balance
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#16A34A" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Service Improvement:</Text> To analyze usage patterns, improve our app, and develop new features
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#16A34A" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Fraud Prevention:</Text> To detect and prevent fraudulent activities, security breaches, and policy violations
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#16A34A" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Legal Compliance:</Text> To comply with legal obligations, respond to lawful requests, and enforce our terms
                    </Text>
                  </View>

                  <Text style={styles.policySectionTitle}>4. Data Sharing & Disclosure</Text>

                  <Text style={styles.policySubsectionTitle}>4.1 We DO Share With:</Text>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#16A34A" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Service Partners:</Text> Delivery personnel (name, phone, address for pickup/delivery only)
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#16A34A" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Payment Processors:</Text> Razorpay (RBI-compliant payment gateway) for secure payment processing
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#16A34A" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Cloud Services:</Text> AWS/Firebase for secure data storage and app functionality
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#16A34A" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>SMS/Email Providers:</Text> For sending order notifications and updates
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#16A34A" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Legal Authorities:</Text> When required by law or to protect rights, safety, and property
                    </Text>
                  </View>

                  <Text style={styles.policySubsectionTitle}>4.2 We DO NOT Share With:</Text>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="shield-check" size={16} color="#16A34A" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Third-Party Advertisers:</Text> We never sell or rent your personal data to advertisers or marketing companies
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="shield-check" size={16} color="#16A34A" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Data Brokers:</Text> We do not share your information with data aggregators or brokers
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="shield-check" size={16} color="#16A34A" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Social Media:</Text> We do not share your data with social media platforms without your explicit consent
                    </Text>
                  </View>

                  <Text style={styles.policySectionTitle}>5. Data Security</Text>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="shield-lock" size={16} color="#16A34A" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>256-bit Encryption:</Text> All personal data is encrypted in transit (HTTPS/TLS) and at rest (AES-256)
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="shield-lock" size={16} color="#16A34A" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Secure Payment:</Text> Payment information is tokenized and processed through RBI-compliant Razorpay gateway (PCI DSS Level 1 certified)
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="shield-lock" size={16} color="#16A34A" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Access Control:</Text> Only authorized personnel have access to customer data on a need-to-know basis
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="shield-lock" size={16} color="#16A34A" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Regular Audits:</Text> We conduct regular security audits and vulnerability assessments
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="shield-lock" size={16} color="#16A34A" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Secure Infrastructure:</Text> Data hosted on AWS India servers with 99.9% uptime SLA and automatic backups
                    </Text>
                  </View>

                  <Text style={styles.policySectionTitle}>6. Your Rights & Choices</Text>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#16A34A" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Access Your Data:</Text> View and download your personal information from account settings
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#16A34A" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Update Information:</Text> Edit your profile, addresses, and preferences anytime
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#16A34A" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Delete Account:</Text> Request account deletion from settings (some data retained for legal/accounting purposes for 7 years)
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#16A34A" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Opt-out Marketing:</Text> Unsubscribe from promotional emails and disable push notifications in settings
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#16A34A" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Location Control:</Text> Disable location services in device settings (may affect service quality)
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#16A34A" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Data Portability:</Text> Request a copy of your data in machine-readable format (CSV/JSON)
                    </Text>
                  </View>

                  <Text style={styles.policySectionTitle}>7. Data Retention</Text>
                  <Text style={styles.policyText}>
                    We retain your personal data only as long as necessary to provide services and comply with legal obligations:
                  </Text>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="clock-outline" size={16} color="#3B82F6" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Active Accounts:</Text> Data retained while account is active
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="clock-outline" size={16} color="#3B82F6" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Order History:</Text> 7 years (for tax and legal compliance)
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="clock-outline" size={16} color="#3B82F6" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Deleted Accounts:</Text> Personal data anonymized within 30 days (except legal records)
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="clock-outline" size={16} color="#3B82F6" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Photos:</Text> Deleted within 90 days after order completion
                    </Text>
                  </View>

                  <Text style={styles.policySectionTitle}>8. Cookies & Tracking</Text>
                  <Text style={styles.policyText}>
                    We use minimal tracking technologies:
                  </Text>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#16A34A" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Analytics:</Text> Firebase Analytics to understand app usage (anonymized data)
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#16A34A" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Crash Reporting:</Text> To identify and fix technical issues
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#16A34A" />
                    <Text style={styles.policyPointText}>
                      <Text style={styles.boldText}>Session Management:</Text> To keep you logged in securely
                    </Text>
                  </View>

                  <Text style={styles.policyText}>
                    We do NOT use third-party advertising cookies or cross-site trackers.
                  </Text>

                  <Text style={styles.policySectionTitle}>9. Children's Privacy</Text>
                  <Text style={styles.policyText}>
                    LaundryFresh is not intended for users under 18 years of age. We do not knowingly collect data from children. If you believe we have collected information from a minor, contact us immediately for deletion.
                  </Text>

                  <Text style={styles.policySectionTitle}>10. Changes to Privacy Policy</Text>
                  <Text style={styles.policyText}>
                    We may update this policy periodically. Material changes will be notified via email or app notification 30 days in advance. Last updated date is shown at the top of this policy.
                  </Text>

                  <Text style={styles.policySectionTitle}>11. Compliance</Text>
                  <Text style={styles.policyText}>
                    This policy complies with:
                  </Text>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#16A34A" />
                    <Text style={styles.policyPointText}>
                      Information Technology Act, 2000 (India)
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#16A34A" />
                    <Text style={styles.policyPointText}>
                      Digital Personal Data Protection Act, 2023 (India)
                    </Text>
                  </View>

                  <View style={styles.policyPoint}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#16A34A" />
                    <Text style={styles.policyPointText}>
                      RBI Payment Guidelines for digital payments
                    </Text>
                  </View>

                  <Text style={styles.policySectionTitle}>12. Contact Us</Text>
                  <Text style={styles.policyText}>
                    For privacy-related questions, concerns, or data requests:{'\n\n'}
                    📧 Privacy Officer: privacy@laundryfresh.com{'\n'}
                    📞 Customer Care: 1800-XXX-XXXX{'\n'}
                    🏢 Registered Office:{'\n'}
                    LaundryFresh Private Limited{'\n'}
                    [Your Business Address]{'\n'}
                    [City, State - Pincode]{'\n'}
                    India{'\n\n'}
                    We aim to respond to all privacy inquiries within 72 hours.
                  </Text>

                  <Text style={styles.policyFooterNote}>
                    By using LaundryFresh, you acknowledge that you have read, understood, and agree to this Privacy Policy.
                  </Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable
                style={styles.saveBtn}
                onPress={() => setActivePolicyModal(null)}
              >
                <Text style={styles.saveBtnText}>I Understand</Text>
              </Pressable>
            </View>
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
  },
  profileHeaderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#F3E8DF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 16,
  },
  guestHeaderCard: {
    backgroundColor: '#1C0B18',
    borderRadius: 22,
    padding: 18,
    shadowColor: '#1C0B18',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 16,
  },
  guestTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  guestAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: '#D6B36A',
  },
  guestInfo: {
    flex: 1,
  },
  guestTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  guestSubtitle: {
    fontSize: 12,
    color: '#D6B36A',
    lineHeight: 16,
    marginTop: 3,
  },
  guestSignInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F97316',
    borderRadius: 14,
    paddingVertical: 12,
    gap: 8,
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  guestSignInBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#1C0B18',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarLetter: {
    color: '#D6B36A',
    fontSize: 24,
    fontWeight: '900',
  },
  profileInfo: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1C0B18',
  },
  phone: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F97316',
    marginTop: 2,
  },
  email: {
    fontSize: 12,
    color: '#8A7A84',
    marginTop: 1,
  },
  noEmail: {
    fontSize: 11,
    color: '#A1A1AA',
    fontStyle: 'italic',
    marginTop: 1,
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    borderRadius: 12,
    paddingVertical: 8,
    marginTop: 14,
    gap: 6,
  },
  editProfileBtnText: {
    color: '#F97316',
    fontSize: 12,
    fontWeight: '800',
  },
  statRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F3E8DF',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1C0B18',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8A7A84',
    marginTop: 2,
  },
  menuCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#F3E8DF',
    marginBottom: 16,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  menuIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuText: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1C0B18',
  },
  menuSubtitle: {
    fontSize: 11,
    color: '#8A7A84',
    marginTop: 1,
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#F7F2EE',
    marginLeft: 64,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 14,
    paddingVertical: 12,
    gap: 8,
    marginTop: 8,
    marginBottom: 16,
  },
  signOutText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '800',
  },
  versionText: {
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '600',
    color: '#A1A1AA',
    marginTop: 4,
    marginBottom: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3E8DF',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1C0B18',
  },
  modalBody: {
    paddingVertical: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1C0B18',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#FCF9F7',
    borderWidth: 1,
    borderColor: '#E5DCD5',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#1C0B18',
  },
  disabledInput: {
    backgroundColor: '#F3F4F6',
    color: '#9CA3AF',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F3E8DF',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5DCD5',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8A7A84',
  },
  saveBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F97316',
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  policyScroll: {
    maxHeight: 320,
    marginVertical: 12,
  },
  policyContent: {
    paddingVertical: 6,
  },
  policyHeader: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1C0B18',
    marginBottom: 8,
  },
  policyLastUpdated: {
    fontSize: 11,
    color: '#9CA3AF',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  policySectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C0B18',
    marginTop: 20,
    marginBottom: 10,
  },
  policySubsectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4A3B45',
    marginTop: 12,
    marginBottom: 8,
  },
  policyText: {
    fontSize: 12,
    color: '#4A3B45',
    lineHeight: 20,
    marginBottom: 12,
  },
  policyPoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 12,
  },
  policyPointText: {
    flex: 1,
    fontSize: 12,
    color: '#4A3B45',
    lineHeight: 19,
  },
  boldText: {
    fontWeight: '700',
    color: '#1C0B18',
  },
  policyFooterNote: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
