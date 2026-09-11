import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ActivityIndicator, Badge, Divider } from 'react-native-paper';
import { useApp } from '@/context/AppContext';
import { useToast } from '@/context/ToastContext';
import { useTheme } from '@/context/ThemeContext';
import { api } from '@/lib/api';
import { AppButton, AppInput, Card, EmptyState, SectionTitle } from '@/ui/components';
import { COLORS, money, shortDate } from '@/ui/theme';
import type { Coupon } from '@/types/domain';

export function OffersScreen({ onUseCoupon }: { onUseCoupon: (code: string) => void }) {
  const { cartSummary, orders } = useApp();
  const { toast } = useToast();
  const { colors, isDark } = useTheme();
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
        toast.info(`${normalized} Applied!`, {
          subtitle: 'Add laundry to bag to enjoy your discount.',
        });
        setMessage(`${normalized} is ready. Add laundry to your bag, then review it at checkout.`);
        onUseCoupon(normalized);
        return;
      }
      const result = await api.applyCoupon(normalized, cartSummary.itemTotal, orders.length === 0);
      if (!result.isValid) {
        toast.error(result.message || 'Invalid coupon code');
        setMessage(result.message);
        return;
      }
      toast.success(`Coupon ${normalized} Applied! 🎉`, {
        subtitle: `You save an estimated ${money(result.discount)}!`,
      });
      setMessage(`${result.message} You save an estimated ${money(result.discount)} before final checkout.`);
      onUseCoupon(normalized);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'This code could not be applied.';
      toast.error(errMsg);
      setMessage(errMsg);
    } finally {
      setProcessingCode(null);
    }
  };

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
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
      {cartSummary.itemCount ? (
        <View style={[styles.bagBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.bagBarText, { color: colors.textHeading }]}>Applying to your bag:</Text>
          <Badge style={[styles.bagBadge, { backgroundColor: colors.primary }]}>{money(cartSummary.itemTotal)}</Badge>
        </View>
      ) : null}

      <Card style={[styles.manualCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.manualTitle, { color: colors.textHeading }]}>Have a promo code?</Text>
        <Text style={[styles.manualDetail, { color: colors.textCaption }]}>We check it against your current bag before sending you to secure checkout.</Text>
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

      {message ? (
        <Card style={[styles.messageCard, { backgroundColor: colors.section, borderColor: colors.border }]}>
          <Text style={[styles.message, { color: colors.primary }]}>{message}</Text>
        </Card>
      ) : null}

      <SectionTitle title="Available coupons" action={<AppButton title="Refresh" compact variant="outline" icon="refresh" onPress={load} loading={loading} />} />
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textCaption }]}>Checking current offers...</Text>
        </View>
      ) : null}
      {!loading && coupons.length ? (
        <View style={styles.couponStack}>
          {coupons.map((coupon) => (
            <Card key={coupon.id} style={[styles.couponCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.couponTop}>
                <View style={[styles.codeBox, { backgroundColor: colors.primary }]}>
                  <Text style={styles.code}>{coupon.code}</Text>
                </View>
                {coupon.firstOrderOnly ? (
                  <Badge style={[styles.firstOrderBadge, { backgroundColor: colors.section, color: colors.primaryLight }]}>First order</Badge>
                ) : null}
              </View>
              <Text style={[styles.couponTitle, { color: colors.textHeading }]}>{coupon.title}</Text>
              <Text style={[styles.couponDetail, { color: colors.textBody }]}>{coupon.description}</Text>
              <Divider style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.couponBottom}>
                <Text style={[styles.validity, { color: colors.textCaption }]}>Min. {money(coupon.minOrderValue)} · Valid through {shortDate(coupon.expiryDate)}</Text>
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
  root: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 32, gap: 16 },
  bagBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, borderWidth: 1 },
  bagBarText: { fontSize: 13, fontWeight: '700' },
  headerCopy: { flex: 1 },
  title: { fontSize: 26, fontWeight: '900' },
  subtitle: { fontSize: 14, lineHeight: 20, marginTop: 4 },
  bagBadge: { color: '#FFFFFF', fontWeight: '800' },
  manualCard: { padding: 18, borderRadius: 20, borderWidth: 1 },
  manualTitle: { fontSize: 18, fontWeight: '900' },
  manualDetail: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  manualRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 13 },
  manualInput: { flex: 1 },
  messageCard: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1 },
  message: { fontSize: 12, fontWeight: '700', lineHeight: 18 },
  loading: { minHeight: 120, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { fontSize: 12 },
  couponStack: { gap: 12 },
  couponCard: { padding: 18, borderRadius: 20, borderWidth: 1 },
  couponTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  codeBox: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  code: { color: '#FFFFFF', fontSize: 14, letterSpacing: 1.5, fontWeight: '900' },
  firstOrderBadge: { fontSize: 12, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 2 },
  couponTitle: { fontSize: 19, fontWeight: '900', marginTop: 12 },
  couponDetail: { fontSize: 14, lineHeight: 20, marginTop: 4 },
  divider: { marginVertical: 14 },
  couponBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  validity: { flex: 1, fontSize: 12, lineHeight: 17 },
});
