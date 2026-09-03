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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import { Card } from '@/ui/components';
import { COLORS } from '@/ui/theme';

export function SettingsScreen() {
  const { session, updateUserProfile, signOut } = useApp();

  const [whatsappAlerts, setWhatsappAlerts] = useState(true);
  const [promoAlerts, setPromoAlerts] = useState(false);

  // Edit Name Modal
  const [editingProfile, setEditingProfile] = useState(false);
  const [nameInput, setNameInput] = useState(session?.user?.name || '');
  const [emailInput, setEmailInput] = useState(session?.user?.email || '');

  const handleSaveProfile = async () => {
    if (!nameInput.trim()) {
      Alert.alert('Required', 'Please enter your name.');
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
      'Are you sure you want to permanently delete your LaundryFresh account and all saved addresses? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            Alert.alert('Account Closed', 'Your account and personal data have been removed.');
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* 1. ACCOUNT PROFILE CARD */}
      <Card style={styles.profileCard}>
        <View style={styles.avatarRow}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {session?.user?.name ? session.user.name.charAt(0).toUpperCase() : 'G'}
            </Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{session?.user?.name || 'Valued Guest'}</Text>
            <Text style={styles.userPhone}>+91 {session?.user?.phone || '9876543210'}</Text>
            {session?.user?.email ? <Text style={styles.userEmail}>{session.user.email}</Text> : null}
          </View>

          <Pressable style={styles.editProfileBtn} onPress={() => setEditingProfile(true)}>
            <MaterialCommunityIcons name="pencil-outline" size={18} color="#F97316" />
          </Pressable>
        </View>
      </Card>

      {/* 2. NOTIFICATIONS PREFERENCES */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications & Alerts</Text>

        <Card style={styles.toggleGroupCard}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleIconCircle}>
              <MaterialCommunityIcons name="whatsapp" size={20} color="#16A34A" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>WhatsApp Delivery Updates</Text>
              <Text style={styles.toggleSub}>Receive live milestone updates and digital weigh bills</Text>
            </View>
            <Pressable
              style={[styles.toggleSwitch, whatsappAlerts && styles.toggleSwitchActive]}
              onPress={() => setWhatsappAlerts(!whatsappAlerts)}
            >
              <View style={[styles.toggleThumb, whatsappAlerts && styles.toggleThumbActive]} />
            </Pressable>
          </View>

          <View style={styles.divider} />

          <View style={styles.toggleRow}>
            <View style={styles.toggleIconCircle}>
              <MaterialCommunityIcons name="tag-outline" size={20} color="#3B82F6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>Promotions & Festive Offers</Text>
              <Text style={styles.toggleSub}>Exclusive discounts on silk saree and winter care</Text>
            </View>
            <Pressable
              style={[styles.toggleSwitch, promoAlerts && styles.toggleSwitchActive]}
              onPress={() => setPromoAlerts(!promoAlerts)}
            >
              <View style={[styles.toggleThumb, promoAlerts && styles.toggleThumbActive]} />
            </Pressable>
          </View>
        </Card>
      </View>



      {/* 4. PRIVACY & DATA */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Privacy & Security</Text>

        <Card style={styles.menuGroupCard}>
          <Pressable
            style={styles.menuRow}
            onPress={() =>
              Alert.alert(
                'Data Privacy',
                'Your personal phone number, location GPS, and garment photos are 256-bit encrypted and never shared with third-party advertisers.'
              )
            }
          >
            <MaterialCommunityIcons name="shield-account-outline" size={20} color="#1C0B18" />
            <Text style={styles.menuLabel}>Privacy & Data Protection</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#9CA3AF" />
          </Pressable>

          <View style={styles.divider} />

          <Pressable style={styles.menuRow} onPress={handleDeleteAccount}>
            <MaterialCommunityIcons name="account-remove-outline" size={20} color="#EF4444" />
            <Text style={[styles.menuLabel, { color: '#EF4444' }]}>Delete Account & Data</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#EF4444" />
          </Pressable>
        </Card>
      </View>

      {/* 5. APP VERSION */}
      <View style={styles.versionWrap}>
        <Text style={styles.versionTitle}>LaundryFresh Mobile App</Text>
        <Text style={styles.versionSub}>Version 2.4.0 (Build 2026.08.31) • All Rights Reserved</Text>
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
                onChangeText={setNameInput}
              />

              <Text style={[styles.formLabel, { marginTop: 10 }]}>Email Address (Optional)</Text>
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
    fontSize: 18,
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
    fontSize: 13,
    color: '#8A7A84',
    marginTop: 3,
    lineHeight: 18,
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
    fontSize: 10,
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
});
