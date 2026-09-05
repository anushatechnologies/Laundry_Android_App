import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ActivityIndicator, Badge, Divider } from 'react-native-paper';
import { useApp } from '@/context/AppContext';
import { api } from '@/lib/api';
import { AppButton, AppInput, Card, EmptyState, SectionTitle } from '@/ui/components';
import { COLORS, money, shortDate } from '@/ui/theme';
import type { Coupon } from '@/types/domain';

export function OffersScreen({ onUseCoupon }: { onUseCoupon: (code: string) => void }) {
  const { cartSummary, orders } = useApp();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingCode, setProcessingCode] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await api.getCoupons();
      setCoupons(next.filter((coupon) => coupon.isActive));
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Offers could not be loaded right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const next = await api.getCoupons();
      setCoupons(next.filter((coupon) => coupon.isActive));
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Offers could not be loaded right now.');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const availableForCart = useMemo(() => cartSummary.itemTotal > 0, [cartSummary.itemTotal]);

  const useCoupon = async (code: string) => {
    const normalized = code.trim().toUpperCase();
    if (!normalized) return;
    setProcessingCode(normalized);
    setMessage(null);
    try {
      if (!availableForCart) {
        setMessage(`${normalized} is ready. Add laundry to your bag, then review it at checkout.`);
        onUseCoupon(normalized);
        return;
      }
      const result = await api.applyCoupon(normalized, cartSummary.itemTotal, orders.length === 0);
      if (!result.isValid) {
        setMessage(result.message);
        return;
      }
      setMessage(`${result.message} You save an estimated ${money(result.discount)} before final checkout.`);
      onUseCoupon(normalized);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'This code could not be applied.');
    } finally {
      setProcessingCode(null);
    }
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          colors={['#2563EB', '#F97316']}
          tintColor="#2563EB"
        />
      }
    >
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Offers for you</Text>
          <Text style={styles.subtitle}>Savings and eligibility for your current laundry bag.</Text>
        </View>
        {cartSummary.itemCount ? <Badge style={styles.bagBadge}>{money(cartSummary.itemTotal)}</Badge> : null}
      </View>

      <Card style={styles.manualCard}>
        <Text style={styles.manualTitle}>Have a promo code?</Text>
        <Text style={styles.manualDetail}>We check it against your current bag before sending you to secure checkout.</Text>
        <View style={styles.manualRow}>
          <AppInput
            label="Promo code"
            value={manualCode}
            onChangeText={(value) => setManualCode(value.toUpperCase().replace(/\s/g, ''))}
            autoCapitalize="characters"
            containerStyle={styles.manualInput}
          />
          <AppButton title="Apply" compact icon="tag" loading={processingCode === manualCode.trim().toUpperCase()} disabled={!manualCode.trim()} onPress={() => useCoupon(manualCode)} />
        </View>
      </Card>

      {message ? <Card style={styles.messageCard}><Text style={styles.message}>{message}</Text></Card> : null}

      <SectionTitle title="Available coupons" action={<AppButton title="Refresh" compact variant="outline" icon="refresh" onPress={load} loading={loading} />} />
      {loading ? <View style={styles.loading}><ActivityIndicator color={COLORS.plum} /><Text style={styles.loadingText}>Checking current offers...</Text></View> : null}
      {!loading && coupons.length ? (
        <View style={styles.couponStack}>
          {coupons.map((coupon) => (
            <Card key={coupon.id} style={styles.couponCard}>
              <View style={styles.couponTop}>
                <View style={styles.codeBox}><Text style={styles.code}>{coupon.code}</Text></View>
                {coupon.firstOrderOnly ? <Badge style={styles.firstOrderBadge}>First order</Badge> : null}
              </View>
              <Text style={styles.couponTitle}>{coupon.title}</Text>
              <Text style={styles.couponDetail}>{coupon.description}</Text>
              <Divider style={styles.divider} />
              <View style={styles.couponBottom}>
                <Text style={styles.validity}>Min. {money(coupon.minOrderValue)} · Valid through {shortDate(coupon.expiryDate)}</Text>
                <AppButton
                  title={availableForCart ? 'Use offer' : 'Save offer'}
                  compact
                  icon="tag"
                  loading={processingCode === coupon.code}
                  onPress={() => useCoupon(coupon.code)}
                />
              </View>
            </Card>
          ))}
        </View>
      ) : null}
      {!loading && !coupons.length ? <EmptyState icon="tag-outline" title="No offers at the moment" detail="New LaundryFresh savings will appear here as soon as they are active." action={<AppButton title="Refresh offers" compact onPress={load} />} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.cream },
  content: { padding: 16, paddingBottom: 32, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  headerCopy: { flex: 1 },
  title: { color: COLORS.plumDark, fontSize: 26, fontWeight: '900' },
  subtitle: { color: COLORS.muted, fontSize: 14, lineHeight: 20, marginTop: 4 },
  bagBadge: { backgroundColor: COLORS.plum, color: COLORS.white, fontWeight: '800' },
  manualCard: { backgroundColor: COLORS.blush, borderColor: COLORS.line, padding: 18, borderRadius: 20 },
  manualTitle: { color: COLORS.plumDark, fontSize: 18, fontWeight: '900' },
  manualDetail: { color: COLORS.muted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  manualRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 13 },
  manualInput: { flex: 1 },
  messageCard: { backgroundColor: COLORS.blush, borderColor: COLORS.line, paddingVertical: 12 },
  message: { color: COLORS.plum, fontSize: 12, fontWeight: '700', lineHeight: 18 },
  loading: { minHeight: 120, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: COLORS.muted, fontSize: 12 },
  couponStack: { gap: 12 },
  couponCard: { padding: 18, borderRadius: 20 },
  couponTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  codeBox: { borderRadius: 10, backgroundColor: COLORS.plum, paddingHorizontal: 14, paddingVertical: 7 },
  code: { color: COLORS.white, fontSize: 14, letterSpacing: 1.5, fontWeight: '900' },
  firstOrderBadge: { backgroundColor: COLORS.blush, color: COLORS.plum, fontSize: 12, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 2 },
  couponTitle: { color: COLORS.plumDark, fontSize: 19, fontWeight: '900', marginTop: 12 },
  couponDetail: { color: '#4A3B45', fontSize: 14, lineHeight: 20, marginTop: 4 },
  divider: { marginVertical: 14, backgroundColor: COLORS.line },
  couponBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  validity: { flex: 1, color: COLORS.muted, fontSize: 12, lineHeight: 17 },
});
