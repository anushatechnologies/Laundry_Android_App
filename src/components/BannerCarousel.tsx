import React, { useState, useEffect, useRef } from 'react';
import {
  Dimensions,
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
import { WebView } from 'react-native-webview';
import { Banner } from '@/types/domain';

interface BannerCarouselProps {
  banners: Banner[];
  onSelectBanner: (banner: Banner) => void;
  showHomeHero?: boolean;
}

export function BannerCarousel({ banners, onSelectBanner }: BannerCarouselProps) {
  const { width: windowWidth } = useWindowDimensions();
  const screenWidth = windowWidth > 0 ? windowWidth : Dimensions.get('window').width || 360;
  // Increased banner width for maximum visibility while retaining clean edge clearance
  const cardWidth = Math.max(280, screenWidth - 24);

  const [activeIndex, setActiveIndex] = useState(0);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const flatListRef = useRef<FlatList>(null);

  const activeBanners = banners && banners.length > 0 ? banners.filter((b) => b.isActive) : [];

  // Auto-scroll every 5.5 seconds for video/image viewing comfort
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
    }, 5500);

    return () => clearInterval(interval);
  }, [activeBanners.length]);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = event.nativeEvent.contentOffset.x;
    const index = Math.round(offset / screenWidth);
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
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        snapToInterval={screenWidth}
        snapToAlignment="center"
        decelerationRate="fast"
        contentContainerStyle={styles.listContent}
        keyExtractor={(item) => item.id}
        getItemLayout={(_, index) => ({
          length: screenWidth,
          offset: screenWidth * index,
          index,
        })}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
          }, 100);
        }}
        renderItem={({ item }) => {
          const fallbackUri = 'https://images.unsplash.com/photo-1545173168-9f1947eebb7f?auto=format&fit=crop&w=1200&q=80';
          const hasError = imageErrors[item.id];
          const imageUri = (!hasError && item.imageUrl)
            ? item.imageUrl
            : fallbackUri;

          const isVideo = item.mediaType === 'VIDEO' && Boolean(item.videoUrl);

          return (
            <View style={[styles.slideContainer, { width: screenWidth }]}>
              <Pressable
                style={({ pressed }) => [
                  styles.cardWrapper,
                  { width: cardWidth },
                  pressed && styles.cardPressed,
                ]}
                onPress={() => onSelectBanner(item)}
                accessibilityRole="button"
                accessibilityLabel={`Promotion: ${item.title}`}
              >
                {/* PURE BANNER IMAGE OR SEAMLESS VIDEO - ZERO CLUTTER */}
                <View style={[styles.card, { width: cardWidth }]}>
                  <Image
                    source={{ uri: imageUri }}
                    style={[styles.bannerImage, { width: cardWidth }]}
                    resizeMode="cover"
                    onError={() => {
                      setImageErrors((prev) => ({ ...prev, [item.id]: true }));
                    }}
                  />

                  {/* Looping Silent HTML5 Video for Video Banners */}
                  {isVideo && (
                    <View style={[StyleSheet.absoluteFill, { borderRadius: 20, overflow: 'hidden' }]} pointerEvents="none">
                      <WebView
                        source={{
                          html: `
                            <!DOCTYPE html>
                            <html>
                            <head>
                              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                              <style>
                                * { margin: 0; padding: 0; box-sizing: border-box; }
                                html, body { width: 100%; height: 100%; background: #0F172A; overflow: hidden; }
                                video { width: 100%; height: 100%; object-fit: cover; display: block; }
                              </style>
                            </head>
                            <body>
                              <video
                                src="${item.videoUrl}"
                                autoplay
                                loop
                                muted
                                playsinline
                                webkit-playsinline
                                poster="${imageUri}"
                              ></video>
                            </body>
                            </html>
                          `,
                        }}
                        style={{ width: cardWidth, height: 168, backgroundColor: 'transparent' }}
                        allowsInlineMediaPlayback
                        mediaPlaybackRequiresUserAction={false}
                        javaScriptEnabled
                        domStorageEnabled
                        scrollEnabled={false}
                        showsHorizontalScrollIndicator={false}
                        showsVerticalScrollIndicator={false}
                        androidLayerType="hardware"
                      />
                    </View>
                  )}

                  {/* Sleek Video Badge */}
                  {isVideo && (
                    <View style={styles.videoBadge}>
                      <Text style={styles.videoBadgeText}>▶ VIDEO</Text>
                    </View>
                  )}
                </View>
              </Pressable>
            </View>
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
    paddingHorizontal: 0,
  },
  slideContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardWrapper: {
    height: 168,
  },
  cardPressed: {
    opacity: 0.95,
    transform: [{ scale: 0.99 }],
  },
  card: {
    height: 168,
    borderRadius: 20,
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
    height: 168,
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
  videoBadge: {
    position: 'absolute',
    top: 10,
    left: 12,
    backgroundColor: 'rgba(126, 34, 206, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  videoBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
});

