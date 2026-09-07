import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import { api } from '@/lib/api';
import type { ReferralFriend, ReferralSummary } from '@/types/domain';

interface ReferralScreenProps {
  onUseReward?: (code: string) => void;
  onSignIn?: () => void;
  onNavigateWallet?: () => void;
  onBack?: () => void;
}

export function ReferralScreen({ onUseReward, onSignIn, onNavigateWallet, onBack }: ReferralScreenProps) {
  const { session } = useApp();
  const customerId = session?.user.id;

  const [data, setData] = useState<ReferralSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [copied, setCopied] = useState(false);

  const requestId = useRef(0);

  const load = useCallback(async (isRefresh = false) => {
    const id = ++requestId.current;
    if (!customerId) {
      setData(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const summary = await api.getReferrals();
      if (id === requestId.current) {
        setData(summary);
      }
    } catch (err) {
      if (id === requestId.current) {
        setError(err instanceof Error ? err.message : 'Unable to load referral program details.');
      }
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [customerId]);

  useEffect(() => {
    void load();
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load();
    });
    return () => {
      requestId.current++;
      listener.remove();
    };
  }, [load]);

  const handleApplyCode = async () => {
    if (saving || !inviteCode.trim()) return;
    const id = requestId.current;
    setSaving(true);
    try {
      const summary = await api.applyReferral(inviteCode.trim().toUpperCase());
      if (id !== requestId.current) return;
      setData(summary);
      setInviteCode('');
      Alert.alert(
        'Code Applied! 🎉',
        'Referral code successfully applied. Your welcome bonus of ₹50 has been credited to your LaundryFresh Wallet!',
      );
    } catch (err) {
      Alert.alert('Could Not Apply Code', err instanceof Error ? err.message : 'Please check the code and try again.');
    } finally {
      setSaving(false);
    }
  };

  const getShareMessage = () => {
    if (data?.shareMessage) return data.shareMessage;
    const code = data?.code || 'LAUNDRY';
    const bonus = data?.friendBonus || 50;
    const downloadUrl = data?.shareUrl || 'https://laundryfresh.in/download';
    return (
      `Hey! Use my referral code *${code}* when signing up on LaundryFresh and get *₹${bonus} Welcome Cash* directly in your wallet! 🧺✨\n\n` +
      `Experience premium doorstep laundry, dry cleaning & shoe care.\n` +
      `Download now: ${downloadUrl}`
    );
  };

  const handleShareWhatsApp = async () => {
    const message = getShareMessage();
    const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;
    try {
      const canOpen = await Linking.canOpenURL(whatsappUrl);
      if (canOpen) {
        await Linking.openURL(whatsappUrl);
      } else {
        await Share.share({ message, title: 'LaundryFresh Referral' });
      }
    } catch {
      await Share.share({ message, title: 'LaundryFresh Referral' });
    }
  };

  const handleNativeShare = async () => {
    const message = getShareMessage();
    try {
      await Share.share({ message, title: 'Join LaundryFresh & Get ₹50' });
    } catch {
      // Ignored
    }
  };

  const handleCopyCode = async () => {
    if (!data?.code) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    // Open native share sheet so user can copy or send anywhere
    try {
      await Share.share({
        message: `My LaundryFresh referral code is: ${data.code}`,
        title: 'Copy Referral Code',
      });
    } catch {
      // Ignored
    }
  };

  if (!customerId) {
    return (
      <View style={styles.root}>
        {onBack && (
          <View style={styles.navBar}>
            <Pressable onPress={onBack} hitSlop={12} style={styles.backBtn}>
              <MaterialCommunityIcons name="arrow-left" size={24} color="#1C0B18" />
            </Pressable>
            <Text style={styles.navTitle}>Refer & Earn</Text>
            <View style={{ width: 24 }} />
          </View>
        )}
        <View style={styles.guestContainer}>
          <MaterialCommunityIcons name="gift-outline" size={72} color="#F97316" />
          <Text style={styles.guestTitle}>Refer Friends & Earn ₹100</Text>
          <Text style={styles.guestSubtitle}>
            Sign in to get your exclusive referral code. Earn ₹100 in your wallet for every friend who joins!
          </Text>
          {onSignIn && (
            <Pressable onPress={onSignIn} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Sign In / Register</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  const referralCode = data?.code || '';
  const invitedCount = data?.stats?.invited ?? 0;
  const totalEarned = data?.stats?.totalEarned ?? (invitedCount * 100);
  const friends: ReferralFriend[] = data?.friends ?? [];

  return (
    <View style={styles.root}>
      {/* Top Header */}
      <View style={styles.navBar}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={12} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#1C0B18" />
          </Pressable>
        ) : (
          <View style={{ width: 24 }} />
        )}
        <Text style={styles.navTitle}>Refer & Earn ₹100</Text>
        {onNavigateWallet ? (
          <Pressable onPress={onNavigateWallet} hitSlop={12} style={styles.walletHeaderBtn}>
            <MaterialCommunityIcons name="wallet-outline" size={20} color="#F97316" />
            <Text style={styles.walletHeaderBtnText}>Wallet</Text>
          </Pressable>
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            colors={['#F97316']}
          />
        }
      >
        {/* Hero Card */}
        <LinearGradient
          colors={['#1E1B4B', '#311042', '#1C0B18']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroIconCircle}>
            <MaterialCommunityIcons name="gift-open-outline" size={36} color="#F59E0B" />
          </View>
          <Text style={styles.heroTitle}>Refer Friends & Earn ₹100</Text>
          <Text style={styles.heroSubtitle}>
            When a friend signs up using your invite code, you get <Text style={styles.heroHighlight}>₹100 added to your Wallet</Text> and they get <Text style={styles.heroHighlight}>₹50 Welcome Cash</Text>!
          </Text>
          <View style={styles.heroBadgeRow}>
            <View style={styles.heroPill}>
              <MaterialCommunityIcons name="cash-check" size={14} color="#10B981" />
              <Text style={styles.heroPillText}>Instant Wallet Credit</Text>
            </View>
            <View style={styles.heroPill}>
              <MaterialCommunityIcons name="percent" size={14} color="#F59E0B" />
              <Text style={styles.heroPillText}>Use 100% on Orders</Text>
            </View>
          </View>
        </LinearGradient>

        {loading && !data && (
          <ActivityIndicator color="#F97316" style={{ marginVertical: 20 }} />
        )}

        {/* Code Sharing Card */}
        {referralCode ? (
          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>YOUR PERSONAL REFERRAL CODE</Text>
            <View style={styles.codeDashedBox}>
              <Text selectable style={styles.codeText}>
                {referralCode}
              </Text>
              <Pressable onPress={handleCopyCode} style={styles.copyIconBtn}>
                <MaterialCommunityIcons
                  name={copied ? 'check' : 'content-copy'}
                  size={20}
                  color={copied ? '#10B981' : '#F97316'}
                />
                <Text style={[styles.copyIconText, copied && { color: '#10B981' }]}>
                  {copied ? 'Copied' : 'Share'}
                </Text>
              </Pressable>
            </View>

            <Text style={styles.codeHint}>
              Tap Share or send directly via WhatsApp to your friends & family
            </Text>

            {/* Sharing Action Buttons */}
            <View style={styles.shareRow}>
              <Pressable style={styles.whatsAppBtn} onPress={handleShareWhatsApp}>
                <MaterialCommunityIcons name="whatsapp" size={22} color="#FFFFFF" />
                <Text style={styles.whatsAppBtnText}>Share on WhatsApp</Text>
              </Pressable>

              <Pressable style={styles.moreShareBtn} onPress={handleNativeShare}>
                <MaterialCommunityIcons name="share-variant" size={20} color="#374151" />
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Performance Statistics Grid */}
        <View style={styles.statsCard}>
          <Text style={styles.sectionTitle}>Your Referral Performance</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <View style={[styles.statIconWrap, { backgroundColor: '#EFF6FF' }]}>
                <MaterialCommunityIcons name="account-group" size={20} color="#2563EB" />
              </View>
              <Text style={styles.statValue}>{invitedCount}</Text>
              <Text style={styles.statLabel}>Friends Joined</Text>
            </View>

            <View style={styles.statBox}>
              <View style={[styles.statIconWrap, { backgroundColor: '#ECFDF5' }]}>
                <MaterialCommunityIcons name="wallet-giftcard" size={20} color="#059669" />
              </View>
              <Text style={[styles.statValue, { color: '#059669' }]}>₹{totalEarned}</Text>
              <Text style={styles.statLabel}>Wallet Earned</Text>
            </View>

            <View style={styles.statBox}>
              <View style={[styles.statIconWrap, { backgroundColor: '#FFF7ED' }]}>
                <MaterialCommunityIcons name="lightning-bolt" size={20} color="#EA580C" />
              </View>
              <Text style={[styles.statValue, { color: '#EA580C' }]}>₹100</Text>
              <Text style={styles.statLabel}>Per Referral</Text>
            </View>
          </View>

          {onNavigateWallet && (
            <Pressable style={styles.viewWalletRow} onPress={onNavigateWallet}>
              <MaterialCommunityIcons name="wallet-outline" size={18} color="#F97316" />
              <Text style={styles.viewWalletText}>View & Use Wallet Balance</Text>
              <MaterialCommunityIcons name="chevron-right" size={18} color="#F97316" />
            </Pressable>
          )}
        </View>

        {/* Registered Friends List */}
        <View style={styles.friendsCard}>
          <View style={styles.friendsHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MaterialCommunityIcons name="account-check-outline" size={22} color="#10B981" />
              <Text style={styles.sectionTitle}>Friends Registered</Text>
            </View>
            <View style={styles.friendsCountBadge}>
              <Text style={styles.friendsCountText}>{friends.length}</Text>
            </View>
          </View>

          {friends.length === 0 ? (
            <View style={styles.emptyFriendsContainer}>
              <MaterialCommunityIcons name="account-clock-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyFriendsTitle}>No friends registered yet</Text>
              <Text style={styles.emptyFriendsDesc}>
                Share your referral code now! As soon as a friend creates an account, you will see them here with ₹100 credited.
              </Text>
              <Pressable style={styles.inviteNowBtn} onPress={handleShareWhatsApp}>
                <MaterialCommunityIcons name="whatsapp" size={18} color="#FFFFFF" />
                <Text style={styles.inviteNowBtnText}>Invite on WhatsApp</Text>
              </Pressable>
            </View>
          ) : (
            friends.map((friend, index) => {
              const formattedDate = new Date(friend.createdAt).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              });

              return (
                <View key={friend.id || index} style={styles.friendRow}>
                  <View style={styles.friendAvatar}>
                    <MaterialCommunityIcons name="account" size={20} color="#4F46E5" />
                  </View>
                  <View style={styles.friendInfo}>
                    <Text style={styles.friendName}>
                      {friend.name && friend.name !== 'Customer' ? friend.name : friend.phoneMasked}
                    </Text>
                    {friend.name && friend.name !== 'Customer' && (
                      <Text style={styles.friendPhone}>{friend.phoneMasked}</Text>
                    )}
                    <Text style={styles.friendDate}>Joined on {formattedDate}</Text>
                  </View>
                  <View style={styles.rewardTag}>
                    <MaterialCommunityIcons name="check-circle" size={14} color="#10B981" />
                    <Text style={styles.rewardTagText}>+₹100 Added</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Apply Friend's Code (if user is eligible) */}
        {data?.canApply && (
          <View style={styles.applyCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <MaterialCommunityIcons name="ticket-percent-outline" size={20} color="#F97316" />
              <Text style={styles.sectionTitle}>Have a Friend's Invite Code?</Text>
            </View>
            <Text style={styles.applyDesc}>
              Enter their code to receive ₹50 Welcome Bonus instantly in your wallet!
            </Text>
            <View style={styles.applyInputRow}>
              <TextInput
                value={inviteCode}
                onChangeText={(val) => setInviteCode(val.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={16}
                placeholder="ENTER CODE"
                placeholderTextColor="#A3A3A3"
                style={styles.applyInput}
              />
              <Pressable
                disabled={saving || !inviteCode.trim()}
                onPress={handleApplyCode}
                style={[styles.applyBtn, (!inviteCode.trim() || saving) && styles.btnDisabled]}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.applyBtnText}>Apply</Text>
                )}
              </Pressable>
            </View>
          </View>
        )}

        {/* How It Works */}
        <View style={styles.howItWorksCard}>
          <Text style={styles.sectionTitle}>How It Works</Text>

          <View style={styles.stepRow}>
            <View style={styles.stepNumWrap}>
              <Text style={styles.stepNum}>1</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepHeading}>Share Your Code</Text>
              <Text style={styles.stepText}>
                Send your unique referral code via WhatsApp, SMS, or social media.
              </Text>
            </View>
          </View>

          <View style={styles.stepLine} />

          <View style={styles.stepRow}>
            <View style={styles.stepNumWrap}>
              <Text style={styles.stepNum}>2</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepHeading}>Friend Registers</Text>
              <Text style={styles.stepText}>
                When they create an account with your code, they get ₹50 free wallet cash.
              </Text>
            </View>
          </View>

          <View style={styles.stepLine} />

          <View style={styles.stepRow}>
            <View style={styles.stepNumWrap}>
              <Text style={styles.stepNum}>3</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepHeading}>You Get ₹100 Instantly</Text>
              <Text style={styles.stepText}>
                ₹100 is credited directly to your LaundryFresh Wallet to spend on any order!
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 48 : 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: {
    padding: 6,
    borderRadius: 8,
  },
  navTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  walletHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  walletHeaderBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F97316',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,  // Small top spacing for visual breathing room
    paddingBottom: 48,
    gap: 16,
  },
  heroCard: {
    borderRadius: 22,
    padding: 22,
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  heroIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 13,
    color: '#D1D5DB',
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 12,
  },
  heroHighlight: {
    color: '#F59E0B',
    fontWeight: '800',
  },
  heroBadgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    gap: 5,
  },
  heroPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  codeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    gap: 12,
  },
  codeLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 1,
  },
  codeDashedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF7ED',
    borderWidth: 2,
    borderColor: '#FDBA74',
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
    width: '100%',
  },
  codeText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#EA580C',
    letterSpacing: 3,
  },
  copyIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FED7AA',
    gap: 4,
  },
  copyIconText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#EA580C',
  },
  codeHint: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  shareRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 4,
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
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  whatsAppBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  moreShareBtn: {
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    gap: 4,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7280',
    textAlign: 'center',
  },
  viewWalletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF7ED',
    borderRadius: 12,
    paddingVertical: 10,
    gap: 6,
  },
  viewWalletText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F97316',
  },
  friendsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  friendsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  friendsCountBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  friendsCountText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#059669',
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  friendPhone: {
    fontSize: 12,
    color: '#6B7280',
  },
  friendDate: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  rewardTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  rewardTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
  },
  emptyFriendsContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptyFriendsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
  },
  emptyFriendsDesc: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  inviteNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16A34A',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
    marginTop: 8,
  },
  inviteNowBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  applyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  applyDesc: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 18,
    marginBottom: 12,
  },
  applyInputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  applyInput: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: '#111827',
  },
  applyBtn: {
    backgroundColor: '#F97316',
    borderRadius: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  howItWorksCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  stepNumWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFF7ED',
    borderWidth: 1.5,
    borderColor: '#FDBA74',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: {
    fontSize: 12,
    fontWeight: '900',
    color: '#EA580C',
  },
  stepContent: {
    flex: 1,
  },
  stepHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 2,
  },
  stepText: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 17,
  },
  stepLine: {
    width: 2,
    height: 18,
    backgroundColor: '#E5E7EB',
    marginLeft: 13,
    marginVertical: 4,
  },
  guestContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  guestTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },
  guestSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
  },
  primaryBtn: {
    backgroundColor: '#F97316',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
