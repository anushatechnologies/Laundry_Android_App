import React, { useState, useEffect, useRef } from 'react';
import {
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Banner } from '@/types/domain';

interface BannerCarouselProps {
  banners: Banner[];
  onSelectBanner: (banner: Banner) => void;
  showHomeHero?: boolean;
}

export function BannerCarousel({ banners, onSelectBanner }: BannerCarouselProps) {
  const { width: windowWidth } = useWindowDimensions();
  const screenWidth = windowWidth > 0 ? windowWidth : 360;
  const cardWidth = Math.max(280, screenWidth - 32);

  const [activeIndex, setActiveIndex] = useState(0);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const flatListRef = useRef<FlatList>(null);

  const activeBanners = banners && banners.length > 0 ? banners.filter((b) => b.isActive) : [];

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
          const isLast = index === activeBanners.length - 1;
          const fallbackUri = 'https://images.unsplash.com/photo-1545173168-9f1947eebb7f?auto=format&fit=crop&w=1200&q=80';
          const hasError = imageErrors[item.id];
          const imageUri = (!hasError && item.imageUrl && !item.imageUrl.includes('laundry-storage-2026'))
            ? item.imageUrl
            : fallbackUri;

          return (
            <Pressable
              style={({ pressed }) => [
                styles.cardWrapper,
                { width: cardWidth, marginRight: isLast ? 0 : 12 },
                pressed && styles.cardPressed,
              ]}
              onPress={() => onSelectBanner(item)}
            >
              {/* PURE BANNER IMAGE ONLY - ZERO TEXT OVERLAYS OR FALLBACK CONTENT */}
              <View style={[styles.card, { width: cardWidth }]}>
                <Image
                  source={{ uri: imageUri }}
                  style={[styles.bannerImage, { width: cardWidth }]}
                  resizeMode="cover"
                  onError={() => {
                    setImageErrors((prev) => ({ ...prev, [item.id]: true }));
                  }}
                />
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
    height: 165,
  },
  cardPressed: {
    opacity: 0.95,
    transform: [{ scale: 0.99 }],
  },
  card: {
    height: 165,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bannerImage: {
    height: 165,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    gap: 5,
  },
  dot: {
    height: 5,
    borderRadius: 3,
  },
  activeDot: {
    width: 18,
    backgroundColor: '#FF6B0B',
  },
  inactiveDot: {
    width: 5,
    backgroundColor: '#CBD5E1',
  },
});
