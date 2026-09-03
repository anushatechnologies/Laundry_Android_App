import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { PromotionBanner } from './PromotionBanner';
import { api } from '@/lib/api';
import type { Coupon } from '@/types/domain';

interface PromotionsSectionProps {
  onPressPromotion: (couponCode?: string) => void;
}

const STATIC_FALLBACK_OFFERS: Coupon[] = [
  {
    id: 'promo-1',
    code: 'WELCOME100',
    title: 'Flat ₹100 Off First Order',
    description: 'Flat ₹100 discount on orders above ₹299',
    discountType: 'FLAT',
    discountValue: 100,
    minOrderValue: 299,
    firstOrderOnly: true,
    isActive: true,
    expiryDate: '2026-12-31',
    usageCount: 840,
  },
  {
    id: 'promo-2',
    code: 'SILKSPA',
    title: '25% Off Wedding Silk Spa',
    description: 'Zero colour-bleed polish for Sarees & Sherwanis',
    discountType: 'PERCENTAGE',
    discountValue: 25,
    minOrderValue: 499,
    firstOrderOnly: false,
    isActive: true,
    expiryDate: '2026-12-31',
    usageCount: 620,
  },
  {
    id: 'promo-3',
    code: 'BULK50',
    title: 'Wash & Fold @ ₹49/KG',
    description: 'Special weekend saver rate on bulk clothes',
    discountType: 'FLAT',
    discountValue: 50,
    minOrderValue: 399,
    firstOrderOnly: false,
    isActive: true,
    expiryDate: '2026-12-31',
    usageCount: 410,
  },
];

export function PromotionsSection({ onPressPromotion }: PromotionsSectionProps) {
  const { width: windowWidth } = useWindowDimensions();
  const screenWidth = windowWidth > 0 ? windowWidth : 360;
  // Uniform exact width for all offer cards
  const cardWidth = Math.max(280, Math.round(screenWidth * 0.82));
  const cardSpacing = 12;

  const [promotions, setPromotions] = useState<Coupon[]>(STATIC_FALLBACK_OFFERS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPromotions();
  }, []);

  const loadPromotions = async () => {
    try {
      const coupons = await api.getCoupons();
      if (coupons && Array.isArray(coupons) && coupons.length > 0) {
        const activeCoupons = coupons
          .filter((c) => c.isActive)
          .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
          .slice(0, 6);
        if (activeCoupons.length > 0) {
          setPromotions(activeCoupons);
        }
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  const getPromotionIcon = (coupon: Coupon): keyof typeof import('@expo/vector-icons').MaterialCommunityIcons.glyphMap => {
    const code = (coupon.code || '').toLowerCase();
    if (code.includes('buy') || code.includes('get') || code.includes('free')) return 'gift';
    if (code.includes('silk') || code.includes('spa')) return 'crown-outline';
    if (code.includes('wash') || code.includes('clean')) return 'washing-machine';
    if (code.includes('welcome') || code.includes('first')) return 'star';
    if (code.includes('weekend') || code.includes('flash')) return 'calendar-star';
    if (code.includes('express')) return 'truck-fast';
    return 'tag';
  };

  const getPromotionGradient = (index: number): [string, string, string] => {
    const gradients: [string, string, string][] = [
      ['#2563EB', '#1D4ED8', '#1E40AF'], // Royal Blue
      ['#059669', '#047857', '#065F46'], // Emerald Green
      ['#7C3AED', '#6D28D9', '#5B21B6'], // Luxury Violet
      ['#E11D48', '#BE123C', '#9F1239'], // Rose Crimson
      ['#D97706', '#B45309', '#92400E'], // Amber Gold
    ];
    return gradients[index % gradients.length] as [string, string, string];
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#2563EB" />
        <Text style={styles.loadingText}>Loading offers...</Text>
      </View>
    );
  }

  if (promotions.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Active Offers</Text>
          <Text style={styles.subtitle}>Limited time promotions & instant coupons</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        decelerationRate="fast"
        snapToInterval={cardWidth + cardSpacing}
        snapToAlignment="start"
      >
        {promotions.map((promo, index) => (
          <View
            key={promo.id || index}
            style={[
              styles.bannerContainer,
              {
                width: cardWidth,
                marginRight: index === promotions.length - 1 ? 0 : cardSpacing,
              },
            ]}
          >
            <PromotionBanner
              title={promo.title}
              subtitle={promo.description}
              icon={getPromotionIcon(promo)}
              gradientColors={getPromotionGradient(index)}
              couponCode={promo.code}
              onPress={() => onPressPromotion(promo.code)}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 10,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  title: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  bannerContainer: {
    height: 124,
    justifyContent: 'center',
  },
});
