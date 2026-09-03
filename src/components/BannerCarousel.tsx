import React, { useState, useEffect, useRef } from 'react';
import {
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Banner } from '@/types/domain';

interface BannerCarouselProps {
  banners: Banner[];
  onSelectBanner: (banner: Banner) => void;
  showHomeHero?: boolean;
}

const FALLBACK_GRADIENTS = [
  '#0F172A',
  '#1E3A8A',
  '#065F46',
  '#581C87',
];

const HOME_HERO_IMAGE = require('../../assets/home-hero-laundry-v1.png');

const HOME_HERO_BANNER: Banner = {
  id: 'local-home-hero',
  title: 'Laundry made effortless',
  subtitle: 'Premium doorstep pickup, care and delivery',
  badgeText: 'LAUNDRYFRESH CARE',
  imageUrl: '',
  actionType: 'BOOK',
  actionTarget: '',
  displayOrder: 0,
  isActive: true,
  createdAt: '2026-09-02 00:00:00',
  updatedAt: '2026-09-02 00:00:00',
};

export function BannerCarousel({ banners, onSelectBanner, showHomeHero = false }: BannerCarouselProps) {
  const { width: windowWidth } = useWindowDimensions();
  const screenWidth = windowWidth > 0 ? windowWidth : 360;
  const cardWidth = Math.max(280, screenWidth - 32);

  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  
  // Use real backend banners if present, otherwise fallback to local hero banner
  const activeBanners = (
    banners && banners.length > 0
      ? (showHomeHero ? [HOME_HERO_BANNER, ...banners] : banners)
      : [HOME_HERO_BANNER]
  ).filter((b) => b.isActive);

  // Auto-scroll every 4.5 seconds
  useEffect(() => {
    if (activeBanners.length <= 1) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % activeBanners.length;
        try {
          flatListRef.current?.scrollToIndex({
            index: next,
            animated: true,
          });
        } catch {
          // ignore layout race
        }
        return next;
      });
    }, 4500);

    return () => clearInterval(interval);
  }, [activeBanners.length]);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = event.nativeEvent.contentOffset.x;
    const index = Math.round(offset / (cardWidth + 12));
    if (index >= 0 && index < activeBanners.length && index !== activeIndex) {
      setActiveIndex(index);
    }
  };

  if (activeBanners.length === 0) return null;

  return (
    <View style={styles.root}>
      <FlatList
        ref={flatListRef}
        data={activeBanners}
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        snapToInterval={cardWidth + 12}
        snapToAlignment="start"
        decelerationRate="fast"
        contentContainerStyle={styles.listContent}
        keyExtractor={(item) => item.id}
        getItemLayout={(_, index) => ({
          length: cardWidth + 12,
          offset: (cardWidth + 12) * index,
          index,
        })}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
          }, 100);
        }}
        renderItem={({ item, index }) => {
          const bgFallback = FALLBACK_GRADIENTS[index % FALLBACK_GRADIENTS.length];
          const isLast = index === activeBanners.length - 1;
          const imageSource = item.imageUrl
            ? { uri: item.imageUrl }
            : item.id === HOME_HERO_BANNER.id
              ? HOME_HERO_IMAGE
              : undefined;

          return (
            <Pressable
              style={({ pressed }) => [
                styles.cardWrapper,
                { width: cardWidth, marginRight: isLast ? 0 : 12 },
                pressed && styles.cardPressed,
              ]}
              onPress={() => onSelectBanner(item)}
            >
              {/* PURE BANNER IMAGE ONLY — NO SCRIM, NO BADGES, NO OVERLAY TEXT */}
              <View style={[styles.card, { width: cardWidth, backgroundColor: bgFallback }]}>
                {imageSource ? (
                  <Image
                    source={imageSource}
                    style={[styles.bannerImage, { width: cardWidth }]}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.fallbackContent, { width: cardWidth }]}>
                    <Text style={styles.fallbackTitle}>{item.title}</Text>
                    {item.subtitle ? (
                      <Text style={styles.fallbackSubtitle}>{item.subtitle}</Text>
                    ) : null}
                  </View>
                )}
              </View>
            </Pressable>
          );
        }}
      />

      {/* Subtle Pagination Indicator Dots */}
      {activeBanners.length > 1 && (
        <View style={styles.pagination}>
          {activeBanners.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === activeIndex ? styles.activeDot : styles.inactiveDot,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginVertical: 10,
  },
  listContent: {
    paddingHorizontal: 16,
  },
  cardWrapper: {
    height: 175,
  },
  cardPressed: {
    opacity: 0.95,
    transform: [{ scale: 0.99 }],
  },
  card: {
    height: 175,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  fallbackContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  fallbackTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  fallbackSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  dot: {
    height: 4.5,
    borderRadius: 2.25,
  },
  activeDot: {
    width: 18,
    backgroundColor: '#FF7A00',
  },
  inactiveDot: {
    width: 6,
    backgroundColor: '#CBD5E1',
  },
});
