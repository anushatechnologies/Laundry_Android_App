import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Card } from '@/ui/components';
import { COLORS } from '@/ui/theme';

interface GiftCardTheme {
  id: string;
  title: string;
  subtitle: string;
  bg: string;
  icon: string;
  iconColor: string;
}

const GIFT_THEMES: GiftCardTheme[] = [
  {
    id: 't-wedding',
    title: 'Bridal & Wedding Spa',
    subtitle: 'Specialized Silk & Sherwani Dry Clean Pass',
    bg: '#1C0B18',
    icon: 'crown-outline',
    iconColor: '#D6B36A',
  },
  {
    id: 't-festive',
    title: 'Diwali & Festive Sparkle',
    subtitle: 'Brighten their festive wardrobe with 5-star care',
    bg: '#78350F',
    icon: 'creation',
    iconColor: '#F59E0B',
  },
  {
    id: 't-birthday',
    title: 'Birthday & Milestone Gift',
    subtitle: 'Complimentary premium steam press & fabric spa',
    bg: '#881337',
    icon: 'gift-outline',
    iconColor: '#F43F5E',
  },
  {
    id: 't-house',
    title: 'Housewarming & Linen Spa',
    subtitle: 'Curtains, drapes & blanket deep extraction',
    bg: '#134E4A',
    icon: 'home-heart',
    iconColor: '#2DD4BF',
  },
];

const CARD_AMOUNTS = [500, 1000, 2500, 5000];

export function GiftCardsScreen() {
  const [selectedTheme, setSelectedTheme] = useState<GiftCardTheme>(GIFT_THEMES[0] || GIFT_THEMES[0]!);
  const [selectedAmount, setSelectedAmount] = useState(1000);
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [giftNote, setGiftNote] = useState('');
  const [voucherCode, setVoucherCode] = useState('');

  const handleBuyCard = () => {
    if (!recipientName.trim() || recipientPhone.length < 10) {
      Alert.alert('Details Required', 'Please enter recipient name and a valid 10-digit phone number.');
      return;
    }
    Alert.alert(
      'Gift Card Sent! 🎁',
      `₹${selectedAmount} "${selectedTheme.title}" voucher has been generated and sent via WhatsApp/SMS to ${recipientName} (+91 ${recipientPhone}).`
    );
    setRecipientName('');
    setRecipientPhone('');
    setGiftNote('');
  };

  const handleRedeemVoucher = () => {
    const clean = voucherCode.trim().toUpperCase();
    if (!clean) {
      Alert.alert('Required', 'Please enter your gift card code.');
      return;
    }
    Alert.alert(
      'Voucher Redeemed! 🎉',
      `Voucher "${clean}" verified! ₹${selectedAmount} has been credited to your LaundryFresh Wallet balance.`
    );
    setVoucherCode('');
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* 1. VOUCHER REDEEM BOX */}
      <Card style={styles.redeemCard}>
        <Text style={styles.redeemTitle}>Have a Gift Card Voucher?</Text>
        <Text style={styles.redeemSubtitle}>Redeem your code for instant wallet balance</Text>

        <View style={styles.redeemInputRow}>
          <TextInput
            style={styles.redeemInput}
            placeholder="Enter voucher code (e.g. GIFT1000)"
            placeholderTextColor="#A1A1AA"
            value={voucherCode}
            onChangeText={setVoucherCode}
            autoCapitalize="characters"
          />
          <Pressable style={styles.redeemBtn} onPress={handleRedeemVoucher}>
            <Text style={styles.redeemBtnText}>Redeem</Text>
          </Pressable>
        </View>
      </Card>

      {/* 2. THEME CARD PREVIEW */}
      <View style={[styles.previewCard, { backgroundColor: selectedTheme.bg }]}>
        <View style={styles.previewTop}>
          <View style={styles.previewTag}>
            <Text style={styles.previewTagText}>DIGITAL GIFT CARD</Text>
          </View>
          <MaterialCommunityIcons name={selectedTheme.icon as any} size={28} color={selectedTheme.iconColor} />
        </View>

        <Text style={styles.previewTitle}>{selectedTheme.title}</Text>
        <Text style={styles.previewSub}>{selectedTheme.subtitle}</Text>

        <View style={styles.previewBottom}>
          <Text style={styles.previewAmount}>₹{selectedAmount}</Text>
          <Text style={styles.previewBrand}>LAUNDRYFRESH LUXURY CARE</Text>
        </View>
      </View>

      {/* 3. SELECT THEME PILLS */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. Choose Card Occasion Theme</Text>

        <View style={styles.themeGrid}>
          {GIFT_THEMES.map((theme) => {
            const isSelected = selectedTheme.id === theme.id;
            return (
              <Pressable
                key={theme.id}
                style={[styles.themePill, isSelected && styles.themePillActive]}
                onPress={() => setSelectedTheme(theme)}
              >
                <MaterialCommunityIcons
                  name={theme.icon as any}
                  size={18}
                  color={isSelected ? '#F97316' : '#1C0B18'}
                />
                <Text style={[styles.themePillText, isSelected && styles.themePillTextActive]}>
                  {theme.title}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* 4. SELECT AMOUNT */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2. Choose Gift Value</Text>

        <View style={styles.amountsRow}>
          {CARD_AMOUNTS.map((amt) => {
            const isSelected = selectedAmount === amt;
            return (
              <Pressable
                key={amt}
                style={[styles.amountTile, isSelected && styles.amountTileActive]}
                onPress={() => setSelectedAmount(amt)}
              >
                <Text style={[styles.amountTileText, isSelected && styles.amountTileTextActive]}>
                  ₹{amt}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* 5. RECIPIENT DETAILS */}
      <Card style={styles.formCard}>
        <Text style={styles.sectionTitle}>3. Recipient Details</Text>

        <View style={styles.formGroup}>
          <Text style={styles.formLabel}>Recipient Full Name *</Text>
          <TextInput
            style={styles.formInput}
            placeholder="e.g. Sravanthi Reddy"
            placeholderTextColor="#A1A1AA"
            value={recipientName}
            onChangeText={setRecipientName}
          />

          <Text style={[styles.formLabel, { marginTop: 10 }]}>Recipient Mobile Number (for WhatsApp Delivery) *</Text>
          <TextInput
            style={styles.formInput}
            placeholder="e.g. 9876543210"
            placeholderTextColor="#A1A1AA"
            keyboardType="phone-pad"
            value={recipientPhone}
            onChangeText={setRecipientPhone}
          />

          <Text style={[styles.formLabel, { marginTop: 10 }]}>Custom Gift Message (Optional)</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Wishing you a wonderful wedding celebration! Enjoy fresh garment care on us."
            placeholderTextColor="#A1A1AA"
            value={giftNote}
            onChangeText={setGiftNote}
            multiline
          />
        </View>

        <Pressable style={styles.buyCardBtn} onPress={handleBuyCard}>
          <MaterialCommunityIcons name="gift-open-outline" size={18} color="#FFFFFF" />
          <Text style={styles.buyCardBtnText}>Purchase & Send Card • ₹{selectedAmount}</Text>
        </Pressable>
      </Card>
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
    gap: 16,
  },
  redeemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3E8DF',
    gap: 10,
  },
  redeemTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#1C0B18',
  },
  redeemSubtitle: {
    fontSize: 13,
    color: '#8A7A84',
    marginTop: -2,
  },
  redeemInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  redeemInput: {
    flex: 1,
    backgroundColor: '#FAF5EF',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: '#E8DED6',
    fontSize: 13,
    fontWeight: '700',
    color: '#1C0B18',
  },
  redeemBtn: {
    backgroundColor: '#1C0B18',
    borderRadius: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  redeemBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  previewCard: {
    borderRadius: 22,
    padding: 20,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  previewTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  previewTagText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  previewTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 10,
  },
  previewSub: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 16,
  },
  previewBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
  },
  previewAmount: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  previewBrand: {
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.6)',
    letterSpacing: 0.8,
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
  themeGrid: {
    gap: 8,
  },
  themePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F3E8DF',
    gap: 10,
  },
  themePillActive: {
    borderColor: '#F97316',
    borderWidth: 1.5,
    backgroundColor: '#FFFDF9',
  },
  themePillText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1C0B18',
  },
  themePillTextActive: {
    color: '#F97316',
    fontWeight: '900',
  },
  amountsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  amountTile: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#F3E8DF',
    alignItems: 'center',
  },
  amountTileActive: {
    backgroundColor: '#1C0B18',
    borderColor: '#1C0B18',
  },
  amountTileText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1C0B18',
  },
  amountTileTextActive: {
    color: '#FFFFFF',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3E8DF',
    gap: 12,
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
    height: 42,
    borderWidth: 1,
    borderColor: '#E8DED6',
    fontSize: 13,
    color: '#1C0B18',
  },
  notesInput: {
    backgroundColor: '#FAF5EF',
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: '#1C0B18',
    minHeight: 60,
    borderWidth: 1,
    borderColor: '#E8DED6',
    textAlignVertical: 'top',
  },
  buyCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F97316',
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
    marginTop: 6,
  },
  buyCardBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
  },
});
