import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import { api } from '@/lib/api';
import { Card } from '@/ui/components';
import type { ReferralSummary } from '@/types/domain';

export function ReferralScreen({ onUseReward, onSignIn }: { onUseReward: (code: string) => void; onSignIn: () => void }) {
  const { session } = useApp();
  const customerId = session?.user.id;
  const [data, setData] = useState<ReferralSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const requestId = useRef(0);
  const load = useCallback(async () => {
    const id = ++requestId.current;
    if (!customerId) { setData(null); setLoading(false); return; }
    setLoading(true);
    setError('');
    try { const summary = await api.getReferrals(); if (id === requestId.current) setData(summary); }
    catch (err) { if (id === requestId.current) setError(err instanceof Error ? err.message : 'Unable to load referrals.'); }
    finally { if (id === requestId.current) setLoading(false); }
  }, [customerId]);
  useEffect(() => {
    setData(null);
    void load();
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void load(); });
    return () => { requestId.current++; listener.remove(); };
  }, [load]);
  const apply = async () => {
    if (saving || !inviteCode.trim()) return;
    const id = requestId.current;
    setSaving(true);
    try {
      const summary = await api.applyReferral(inviteCode.trim().toUpperCase());
      if (id !== requestId.current) return;
      setData(summary);
      setInviteCode('');
      Alert.alert('Invite saved', 'Your reward will appear after your qualifying first order is paid and delivered.');
    } catch (err) { Alert.alert('Invite not applied', err instanceof Error ? err.message : 'Please try again.'); }
    finally { setSaving(false); }
  };
  const share = async () => {
    if (!data?.code || !data.settings?.enabled) return;
    const terms = data.settings;
    const message = `Join me on LaundryFresh. Enter invite code ${data.code} in Profile > Refer & Earn before your first order. ` +
      (terms.friendReward > 0 ? `Earn an INR ${terms.friendReward} reward coupon after your first order of at least INR ${terms.minimumFirstOrder} is paid and delivered. ` : '') +
      `Rewards are laundry discounts, not cash. ${terms.shareUrl || ''}`;
    try { await Share.share({ message, title: 'LaundryFresh invitation' }); }
    catch { Alert.alert('Unable to share', 'Please try sharing again.'); }
  };
  const amount = (value: number) => `INR ${value.toFixed(2)}`;
  return <ScrollView style={styles.root} contentContainerStyle={styles.content}
    refreshControl={<RefreshControl refreshing={loading && !!customerId} onRefresh={() => void load()} />}>
    <View style={styles.heroCard}>
      <MaterialCommunityIcons name="gift-outline" size={40} color="#D6B36A" />
      <Text style={styles.heroTitle}>Refer & Earn</Text>
      <Text style={styles.heroSubtitle}>Invite friends. Track real rewards. Save on your next laundry order.</Text>
    </View>
    {!customerId ? <Pressable onPress={onSignIn} style={styles.copyBtn}><Text style={styles.copyBtnText}>Sign in to view referrals</Text></Pressable> : <>
      {loading && !data && <ActivityIndicator color="#F97316" />}
      {!!error && <Card style={styles.statsCard}><Text accessibilityRole="alert">{error}</Text><Pressable onPress={() => void load()}><Text style={styles.stepHeading}>Retry</Text></Pressable></Card>}
      {data && <>
        {!data.settings?.enabled && <Card style={styles.statsCard}><Text>The referral program is currently unavailable for new invites. Existing rewards and referral history are shown below.</Text></Card>}
        {data.settings?.enabled && data.code && <Card style={styles.codeCard}>
          <Text style={styles.codeLabel}>YOUR PERSONAL INVITE CODE</Text>
          <Text selectable style={[styles.codeText, { fontSize: 18 }]}>{data.code}</Text>
          <Text style={styles.stepDesc}>Long-press the code to copy, or share your invitation.</Text>
          <Pressable onPress={() => void share()} style={styles.copyBtn}><Text style={styles.copyBtnText}>Share invitation</Text></Pressable>
          <Text style={styles.stepDesc}>You earn {amount(data.settings.referrerReward)}; your friend earns {amount(data.settings.friendReward)} after their first order of at least {amount(data.settings.minimumFirstOrder)} is paid and delivered.</Text>
          <Text style={styles.stepDesc}>Single-use reward coupons. Minimum item subtotal {amount(data.settings.minimumRedemptionOrder)}. Valid for {data.settings.rewardValidityDays} days after issue. No cash withdrawal or combining coupons.</Text>
        </Card>}
        {data.canApply && <Card style={styles.statsCard}>
          <Text style={styles.statsSectionTitle}>Have a friend's invite code?</Text>
          <Text style={styles.stepDesc}>Apply it before placing your first order. One code per account.</Text>
          <TextInput value={inviteCode} onChangeText={setInviteCode} autoCapitalize="characters" autoCorrect={false} maxLength={24}
            placeholder="Enter invite code" accessibilityLabel="Friend's invite code" style={{ padding: 14, borderWidth: 1, borderColor: '#E8DED6', borderRadius: 12, marginVertical: 12 }} />
          <Pressable disabled={saving || !inviteCode.trim()} onPress={() => void apply()} style={styles.copyBtn}><Text style={styles.copyBtnText}>{saving ? 'Saving...' : 'Apply invite code'}</Text></Pressable>
        </Card>}
        {data.applied && <Card style={styles.statsCard}>
          <Text style={styles.statsSectionTitle}>Your applied invitation</Text>
          <Text selectable>{data.applied.code} | {data.applied.status}</Text>
          <Text style={styles.stepDesc}>{data.applied.reason || `First paid and delivered order must be at least ${amount(data.applied.terms.minimumFirstOrder)}. Your reward: ${amount(data.applied.terms.friendReward)}.`}</Text>
        </Card>}
        <Card style={styles.statsCard}>
          <Text style={styles.statsSectionTitle}>Your referral activity</Text>
          <Text>Invites accepted: {data.stats.invited}</Text>
          <Text>Qualified referrals: {data.stats.qualified}</Text>
          <Text>Available reward coupons: {amount(data.stats.available)}</Text>
        </Card>
        <Text style={styles.stepsTitle}>Your reward coupons</Text>
        {data.rewards.length === 0 && <Text style={styles.stepDesc}>No rewards earned yet. Qualifying rewards will appear here automatically.</Text>}
        {data.rewards.map(reward => <Card key={reward.id} style={styles.statsCard}>
          <Text style={styles.statsSectionTitle}>{amount(reward.amount)} off laundry</Text>
          <Text>{reward.status}</Text>
          <Text selectable style={styles.stepHeading}>{reward.code}</Text>
          <Text style={styles.stepDesc}>Minimum item subtotal: {amount(reward.minimumOrder)}. Expires {new Date(reward.expiresAt).toLocaleDateString()}.</Text>
          {!!reward.usedOrderId && <Text style={styles.stepDesc}>Order: {reward.usedOrderId}</Text>}
          {reward.status === 'AVAILABLE' && <Pressable style={[styles.copyBtn, { marginTop: 12 }]} onPress={() => onUseReward(reward.code)}><Text style={styles.copyBtnText}>Use reward at checkout</Text></Pressable>}
        </Card>)}
        <Text style={styles.stepsTitle}>Invite history</Text>
        {data.history.length === 0 && <Text style={styles.stepDesc}>No friends have applied your code yet.</Text>}
        {data.history.map((item, index) => <Card key={item.id} style={styles.statsCard}>
          <Text style={styles.stepHeading}>Invitation {data.history.length - index} | {item.status}</Text>
          <Text style={styles.stepDesc}>{new Date(item.createdAt).toLocaleDateString()}{item.reason ? ` - ${item.reason}` : ''}</Text>
        </Card>)}
      </>}
    </>}
  </ScrollView>;
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
