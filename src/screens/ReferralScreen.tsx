import React, { useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import { Card } from '@/ui/components';
import { COLORS } from '@/ui/theme';

export function ReferralScreen() {
  const { session } = useApp();
  const [copied, setCopied] = useState(false);

  const referralCode = session?.user?.name
    ? `${session.user.name.split(' ')[0] || 'FRESH'}50`.toUpperCase()
    : 'FRESH50';

  const shareMessage = `Hey! Check out LaundryFresh for 5-star organic dry cleaning and laundry with 24H doorstep delivery. Use my invite code *${referralCode}* to get 50% OFF your first pickup! 🎉 Download here: https://laundryfresh.app/invite`;

  const copyToClipboard = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    Alert.alert('Code Copied! 📋', `Your referral code "${referralCode}" has been copied to your clipboard.`);
  };

  const shareViaWhatsApp = () => {
    void Linking.openURL(`whatsapp://send?text=${encodeURIComponent(shareMessage)}`);
  };

  const shareNative = async () => {
    try {
      await Share.share({
        message: shareMessage,
        title: 'Join LaundryFresh & Get 50% OFF',
      });
    } catch {
      // Ignore
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* 1. HERO REWARD CARD */}
      <View style={styles.heroCard}>
        <View style={styles.heroIconCircle}>
          <MaterialCommunityIcons name="gift-outline" size={40} color="#D6B36A" />
        </View>

        <Text style={styles.heroTitle}>Refer Friends, Earn ₹150 Cash</Text>
        <Text style={styles.heroSubtitle}>
          Give your friends 50% OFF their first order, and get ₹150 credited straight to your LaundryFresh Wallet.
        </Text>
      </View>

      {/* 2. REFERRAL CODE BOX */}
      <Card style={styles.codeCard}>
        <Text style={styles.codeLabel}>YOUR UNIQUE INVITE CODE</Text>
        <View style={styles.codeRow}>
          <Text style={styles.codeText}>{referralCode}</Text>
          <Pressable style={styles.copyBtn} onPress={copyToClipboard}>
            <MaterialCommunityIcons name={copied ? 'check' : 'content-copy'} size={18} color="#FFFFFF" />
            <Text style={styles.copyBtnText}>{copied ? 'Copied' : 'Copy'}</Text>
          </Pressable>
        </View>
      </Card>

      {/* 3. SHARING BUTTONS */}
      <View style={styles.shareRow}>
        <Pressable style={styles.whatsAppBtn} onPress={shareViaWhatsApp}>
          <MaterialCommunityIcons name="whatsapp" size={20} color="#FFFFFF" />
          <Text style={styles.whatsAppBtnText}>Share on WhatsApp</Text>
        </Pressable>

        <Pressable style={styles.moreShareBtn} onPress={shareNative}>
          <MaterialCommunityIcons name="share-variant-outline" size={20} color="#1C0B18" />
        </Pressable>
      </View>

      {/* 4. REFERRAL STATS */}
      <Card style={styles.statsCard}>
        <Text style={styles.statsSectionTitle}>Your Referral Earnings</Text>

        <View style={styles.statsRow}>
          <View style={styles.statCol}>
            <Text style={styles.statNumber}>4</Text>
            <Text style={styles.statLabel}>Friends Invited</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statCol}>
            <Text style={styles.statNumber}>3</Text>
            <Text style={styles.statLabel}>Orders Done</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statCol}>
            <Text style={[styles.statNumber, { color: '#16A34A' }]}>₹450</Text>
            <Text style={styles.statLabel}>Wallet Earned</Text>
          </View>
        </View>
      </Card>

      {/* 5. 3-STEP GUIDE */}
      <View style={styles.stepsSection}>
        <Text style={styles.stepsTitle}>How It Works</Text>

        <View style={styles.stepsStack}>
          <View style={styles.stepItem}>
            <View style={styles.stepNumBox}>
              <Text style={styles.stepNumText}>1</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepHeading}>Share Your Invite Link</Text>
              <Text style={styles.stepDesc}>Send your referral code to your friends, family, and society group.</Text>
            </View>
          </View>

          <View style={styles.stepItem}>
            <View style={styles.stepNumBox}>
              <Text style={styles.stepNumText}>2</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepHeading}>Friend Gets 50% OFF</Text>
              <Text style={styles.stepDesc}>They apply your coupon at checkout for flat 50% instant savings.</Text>
            </View>
          </View>

          <View style={styles.stepItem}>
            <View style={styles.stepNumBox}>
              <Text style={styles.stepNumText}>3</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepHeading}>You Get ₹150 In Wallet</Text>
              <Text style={styles.stepDesc}>₹150 cash is automatically credited when their laundry is delivered.</Text>
            </View>
          </View>
        </View>
      </View>
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
  heroCard: {
    backgroundColor: '#1C0B18',
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  heroIconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(214, 179, 106, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#D6B36A',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  codeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3E8DF',
    alignItems: 'center',
    gap: 8,
  },
  codeLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#8A7A84',
    letterSpacing: 0.8,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF5EF',
    borderRadius: 14,
    paddingLeft: 20,
    paddingRight: 6,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: '#E8DED6',
    borderStyle: 'dashed',
    gap: 16,
  },
  codeText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1C0B18',
    letterSpacing: 2.5,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F97316',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 6,
  },
  copyBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  shareRow: {
    flexDirection: 'row',
    gap: 10,
  },
  whatsAppBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16A34A',
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
  },
  whatsAppBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  moreShareBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F3E8DF',
  },
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3E8DF',
  },
  statsSectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1C0B18',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1C0B18',
  },
  statLabel: {
    fontSize: 13,
    color: '#8A7A84',
    marginTop: 3,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#F3E8DF',
  },
  stepsSection: {
    gap: 12,
  },
  stepsTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1C0B18',
  },
  stepsStack: {
    gap: 10,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3E8DF',
    gap: 12,
  },
  stepNumBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#F97316',
  },
  stepHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1C0B18',
  },
  stepDesc: {
    fontSize: 11,
    color: '#8A7A84',
    marginTop: 2,
    lineHeight: 15,
  },
});
