import React, { useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { COLORS } from '@/ui/theme';

interface ShowcaseItem {
  id: string;
  title: string;
  category: string;
  beforeLabel: string;
  afterLabel: string;
  beforeProblem: string;
  afterResult: string;
  badge: string;
  icon: string;
  imageUrl: string;
}

const SHOWCASE_DATA: ShowcaseItem[] = [
  {
    id: 'silk-saree',
    title: 'Kanchipuram Silk Saree',
    category: 'Bridal & Royal Zari Spa',
    beforeLabel: 'Dull & Stained',
    afterLabel: 'Restored & Roll Polished',
    beforeProblem: 'Oxidized gold zari, dull sheen & wedding turmeric stains.',
    afterResult: 'Zero-bleed organic herbal spa, zari shine revival & smooth roll finish.',
    badge: '100% Zari Revival',
    icon: 'crown-outline',
    imageUrl: 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/garments/cloth-saree-silk.jpg',
  },
  {
    id: 'executive-suit',
    title: 'Executive 3-Piece Suit',
    category: 'Woolen & Blazer Care',
    beforeLabel: 'Crushed & Grimy',
    afterLabel: 'Crisp & 3D Shaped',
    beforeProblem: 'Crushed chest lapels, sweat odor & oil stains on collar.',
    afterResult: 'Enzyme stain extraction, anti-moth sanitization & 3D form steam pressing.',
    badge: 'Zero-Crease Shaping',
    icon: 'hanger',
    imageUrl: 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/garments/cloth-suit-3p.jpg',
  },
  {
    id: 'formal-shirt',
    title: 'White Cotton Shirt',
    category: 'Crisp Steam & Starch',
    beforeLabel: 'Yellowed Collar',
    afterLabel: 'Brightened & Starched',
    beforeProblem: 'Yellowed collar sweat rings and faded cotton weave.',
    afterResult: 'Oxygen fiber brightening, stain lift & crisp commercial starch press.',
    badge: 'Oxygen Whitening',
    icon: 'tshirt-crew-outline',
    imageUrl: 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/garments/cloth-shirt.jpg',
  },
];

export function BeforeAfterShowcase() {
  const { colors, isDark } = useTheme();
  const [selectedCaseIdx, setSelectedCaseIdx] = useState(0);
  const [viewState, setViewState] = useState<'BEFORE' | 'AFTER'>('AFTER');

  const currentCase: ShowcaseItem = SHOWCASE_DATA[selectedCaseIdx] || (SHOWCASE_DATA[0] as ShowcaseItem);

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View style={[styles.sparkleBox, isDark && { backgroundColor: colors.section, borderColor: colors.border, borderWidth: 1 }]}>
            <MaterialCommunityIcons name="creation" size={18} color="#D6B36A" />
          </View>
          <View>
            <Text style={[styles.title, { color: colors.textHeading }]}>The Fabric Spa Difference</Text>
            <Text style={[styles.subtitle, { color: colors.textCaption }]}>See real fabric restorations by our master cleaners</Text>
          </View>
        </View>
      </View>

      {/* Case Selector Tabs */}
      <View style={styles.tabsRow}>
        {SHOWCASE_DATA.map((item, idx) => {
          const isSelected = idx === selectedCaseIdx;
          return (
            <Pressable
              key={item.id}
              style={[
                styles.tabChip,
                { backgroundColor: colors.surface, borderColor: colors.border },
                isSelected && { backgroundColor: isDark ? colors.primary : '#1C0B18', borderColor: isDark ? colors.primary : '#1C0B18' },
              ]}
              onPress={() => setSelectedCaseIdx(idx)}
            >
              <MaterialCommunityIcons
                name={item.icon as any}
                size={14}
                color={isSelected ? '#FFFFFF' : colors.textHeading}
              />
              <Text style={[styles.tabChipText, { color: colors.textHeading }, isSelected && styles.tabChipTextActive]}>
                {item.title.split(' ')[0]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Showcase Card */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {/* Visual Image with Before / After Overlay */}
        <View style={styles.imageWrap}>
          <Image source={{ uri: currentCase.imageUrl }} style={styles.image} resizeMode="cover" />

          {/* Dim Overlay when looking at Before */}
          {viewState === 'BEFORE' && <View style={styles.beforeOverlay} />}

          {/* Badge Tag */}
          <View style={[styles.badgeWrap, isDark && { backgroundColor: colors.section }]}>
            <MaterialCommunityIcons name="check-decagram" size={12} color="#16A34A" />
            <Text style={styles.badgeText}>{currentCase.badge}</Text>
          </View>

          {/* Current State Pill */}
          <View
            style={[
              styles.statePill,
              viewState === 'BEFORE' ? styles.statePillBefore : styles.statePillAfter,
            ]}
          >
            <Text style={styles.statePillText}>
              {viewState === 'BEFORE' ? '🔴 BEFORE SPA' : '🟢 AFTER LAUNDRYFRESH'}
            </Text>
          </View>
        </View>

        {/* Interactive Toggle Switch */}
        <View style={[styles.toggleRow, { backgroundColor: colors.section }]}>
          <Pressable
            style={[
              styles.toggleBtn,
              { backgroundColor: colors.surface, borderColor: colors.border },
              viewState === 'BEFORE' && styles.toggleBtnActiveBefore,
            ]}
            onPress={() => setViewState('BEFORE')}
          >
            <MaterialCommunityIcons
              name="alert-circle-outline"
              size={14}
              color={viewState === 'BEFORE' ? '#FFFFFF' : '#EF4444'}
            />
            <Text
              style={[
                styles.toggleBtnText,
                { color: colors.textHeading },
                viewState === 'BEFORE' && styles.toggleBtnTextActive,
              ]}
            >
              Before Clean
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.toggleBtn,
              { backgroundColor: colors.surface, borderColor: colors.border },
              viewState === 'AFTER' && styles.toggleBtnActiveAfter,
            ]}
            onPress={() => setViewState('AFTER')}
          >
            <MaterialCommunityIcons
              name="creation"
              size={14}
              color={viewState === 'AFTER' ? '#FFFFFF' : '#16A34A'}
            />
            <Text
              style={[
                styles.toggleBtnText,
                { color: colors.textHeading },
                viewState === 'AFTER' && styles.toggleBtnTextActive,
              ]}
            >
              After Restoration
            </Text>
          </Pressable>
        </View>

        {/* Description Box */}
        <View style={styles.descriptionBox}>
          <Text style={[styles.caseTitle, { color: colors.textHeading }]}>{currentCase.title}</Text>
          <Text style={styles.caseCategory}>{currentCase.category}</Text>

          <View style={[styles.detailRow, { backgroundColor: colors.section }]}>
            <MaterialCommunityIcons
              name={viewState === 'BEFORE' ? 'close-circle' : 'check-circle'}
              size={16}
              color={viewState === 'BEFORE' ? '#EF4444' : '#16A34A'}
              style={{ marginTop: 2 }}
            />
            <Text style={[styles.detailText, { color: colors.textBody }]}>
              {viewState === 'BEFORE' ? currentCase.beforeProblem : currentCase.afterResult}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 14,
    paddingHorizontal: 16,
  },
  header: {
    marginBottom: 12,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sparkleBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#1C0B18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1C0B18',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    color: '#8A7A84',
    marginTop: 1,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  tabChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8DED6',
    gap: 4,
  },
  tabChipActive: {
    backgroundColor: '#1C0B18',
    borderColor: '#1C0B18',
  },
  tabChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1C0B18',
  },
  tabChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F3E8DF',
    shadowColor: '#1C0B18',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  imageWrap: {
    width: '100%',
    height: 175,
    backgroundColor: '#F3E8DF',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  beforeOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  badgeWrap: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#16A34A',
  },
  statePill: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statePillBefore: {
    backgroundColor: '#EF4444',
  },
  statePillAfter: {
    backgroundColor: '#16A34A',
  },
  statePillText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  toggleRow: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#FAF5EF',
    gap: 8,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8DED6',
    gap: 6,
  },
  toggleBtnActiveBefore: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  toggleBtnActiveAfter: {
    backgroundColor: '#16A34A',
    borderColor: '#16A34A',
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1C0B18',
  },
  toggleBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  descriptionBox: {
    padding: 14,
  },
  caseTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1C0B18',
  },
  caseCategory: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F97316',
    marginTop: 1,
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FAF5EF',
    padding: 10,
    borderRadius: 12,
  },
  detailText: {
    flex: 1,
    fontSize: 12,
    color: '#4A3B45',
    lineHeight: 17,
  },
});
