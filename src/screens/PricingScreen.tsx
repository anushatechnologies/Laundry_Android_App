import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ActivityIndicator, Divider } from 'react-native-paper';
import { api } from '@/lib/api';
import { useTheme } from '@/context/ThemeContext';
import { AppButton, Card, EmptyState, SectionTitle } from '@/ui/components';
import { COLORS, money } from '@/ui/theme';
import type { BulkPricingFeed } from '@/types/domain';

export function PricingScreen({ onBook }: { onBook: () => void }) {
  const { isDark, colors } = useTheme();
  const [feed, setFeed] = useState<BulkPricingFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setFeed(await api.getBulkPricing());
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Pricing could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return <View style={[styles.centered, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={isDark ? '#F97316' : COLORS.plum} /><Text style={[styles.loadingText, { color: colors.textCaption }]}>Loading current package prices...</Text></View>;
  }

  if (error || !feed) {
    return <View style={[styles.errorRoot, { backgroundColor: colors.background }]}><EmptyState icon="cloud-alert-outline" title="Pricing unavailable" detail={error || 'Try again shortly.'} action={<AppButton title="Retry" compact icon="refresh" onPress={load} />} /></View>;
  }

  return (
    <ScrollView style={[styles.root, { backgroundColor: colors.background }]} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={[styles.subtitle, { color: colors.textCaption }]}>Clear package slabs for your bag. Your final total is confirmed after weighing and checkout.</Text>

      <Card style={[styles.noteCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.noteTitle, { color: colors.textHeading }]}>How weight pricing works</Text>
        <Text style={[styles.noteText, { color: colors.textBody }]}>Choose the service that fits your garments, then select a pickup. Exact weight, pincode fees, offers, tax, and express choices are confirmed securely at checkout.</Text>
      </Card>

      <View style={styles.services}>
        {feed.services.map((service) => (
          <Card key={service.serviceId} style={[styles.serviceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.serviceHeading}>
              <View style={[styles.iconBubble, { backgroundColor: isDark ? colors.section : COLORS.blush }]}><Text style={[styles.iconText, { color: isDark ? '#F97316' : COLORS.plum }]}>{service.icon || 'L'}</Text></View>
              <View style={styles.serviceCopy}><Text style={[styles.serviceName, { color: colors.textHeading }]}>{service.serviceName}</Text><Text style={[styles.serviceDetail, { color: colors.textCaption }]}>Mixed laundry · per KG packages</Text></View>
            </View>
            <Divider style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.tableHeader}><Text style={[styles.tableHeading, styles.weightCell, { color: colors.textCaption }]}>Weight</Text><Text style={[styles.tableHeading, { color: colors.textCaption }]}>Regular</Text><Text style={[styles.tableHeading, { color: colors.textCaption }]}>Express</Text></View>
            {service.pricing.map((slab, index) => (
              <View key={slab.id} style={[styles.slabRow, { borderBottomColor: colors.border }, index === service.pricing.length - 1 && styles.lastSlab]}>
                <Text style={[styles.slabWeight, styles.weightCell, { color: colors.textHeading }]}>{slab.weightKg} KG</Text>
                <View style={styles.priceCell}><Text style={[styles.slabPrice, { color: isDark ? '#F97316' : COLORS.plum }]}>{money(slab.regularPrice)}</Text><Text style={[styles.tat, { color: colors.textCaption }]}>{slab.regularTatHours}h</Text></View>
                <View style={styles.priceCell}><Text style={[styles.slabPrice, { color: isDark ? '#F97316' : COLORS.plum }]}>{money(slab.expressPrice)}</Text><Text style={[styles.tat, { color: colors.textCaption }]}>{slab.expressTatHours}h</Text></View>
              </View>
            ))}
          </Card>
        ))}
      </View>
      {!feed.services.length ? <EmptyState icon="scale-bathroom" title="No package prices today" detail="Please check back shortly for the latest laundry packages." /> : null}
      <SectionTitle title="Ready to schedule?" />
      <AppButton title="Build my laundry bag" icon="basket-plus" onPress={onBook} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.cream },
  errorRoot: { flex: 1, backgroundColor: COLORS.cream, padding: 16, justifyContent: 'center' },
  content: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 32, gap: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 11, backgroundColor: COLORS.cream },
  loadingText: { color: COLORS.muted, fontSize: 13 },
  title: { color: COLORS.plumDark, fontSize: 26, fontWeight: '900' },
  subtitle: { color: COLORS.muted, fontSize: 13, lineHeight: 19, marginTop: -9 },
  noteCard: { backgroundColor: COLORS.blush, borderColor: COLORS.line },
  noteTitle: { color: COLORS.plumDark, fontSize: 14, fontWeight: '900' },
  noteText: { color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  services: { gap: 12 },
  serviceCard: { padding: 16 },
  serviceHeading: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  iconBubble: { width: 43, height: 43, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.blush },
  iconText: { color: COLORS.plum, fontSize: 20, fontWeight: '900' },
  serviceCopy: { flex: 1 },
  serviceName: { color: COLORS.plumDark, fontSize: 15, fontWeight: '900' },
  serviceDetail: { color: COLORS.muted, fontSize: 10, marginTop: 3 },
  divider: { marginVertical: 14, backgroundColor: COLORS.line },
  tableHeader: { flexDirection: 'row', paddingBottom: 8 },
  tableHeading: { flex: 1, color: COLORS.muted, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', textAlign: 'right' },
  weightCell: { flex: 1.15, textAlign: 'left' },
  slabRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomColor: COLORS.line, borderBottomWidth: 1 },
  lastSlab: { borderBottomWidth: 0, paddingBottom: 0 },
  slabWeight: { color: COLORS.ink, fontSize: 13, fontWeight: '800' },
  priceCell: { flex: 1, alignItems: 'flex-end' },
  slabPrice: { color: COLORS.plum, fontSize: 14, fontWeight: '900' },
  tat: { color: COLORS.muted, fontSize: 10, marginTop: 2 },
});
