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

  // Auto-scroll every 7.5 seconds so customers can comfortably watch the 6-8s video loop
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
    }, 7500);

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
          const fallbackUri = 'https://anjanilaundry.s3.ap-south-2.amazonaws.com/banners/banner-bulk.jpg';
          const hasError = imageErrors[item.id];
          const imageUri = (!hasError && item.imageUrl)
            ? item.imageUrl
            : fallbackUri;

          const isVideo = (item.mediaType === 'VIDEO' && Boolean(item.videoUrl)) || Boolean(item.videoUrl) || item.imageUrl?.endsWith('.mp4');
          const videoSrc = item.videoUrl || (item.imageUrl?.endsWith('.mp4') ? item.imageUrl : '');

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
                {/* PURE BANNER IMAGE OR SEAMLESS AUTOPLAYING VIDEO */}
                <View style={[styles.card, { width: cardWidth }]}>
                  <Image
                    source={{ uri: imageUri }}
                    style={[styles.bannerImage, { width: cardWidth }]}
                    resizeMode="cover"
                    onError={() => {
                      setImageErrors((prev) => ({ ...prev, [item.id]: true }));
                    }}
                  />

                  {/* Guaranteed Silent Autoplaying HTML5 Video for Video Banners */}
                  {isVideo && Boolean(videoSrc) && (
                    <View style={[StyleSheet.absoluteFill, { borderRadius: 20, overflow: 'hidden' }]} pointerEvents="none">
                      <WebView
                        source={{
                          html: `
                            <!DOCTYPE html>
                            <html>
                            <head>
                              <meta charset="utf-8">
                              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                              <style>
                                * { margin: 0; padding: 0; box-sizing: border-box; }
                                html, body {
                                  width: 100%;
                                  height: 100%;
                                  background-color: #0F172A;
                                  overflow: hidden;
                                  user-select: none;
                                  -webkit-user-select: none;
                                }
                                video {
                                  width: 100%;
                                  height: 100%;
                                  object-fit: cover;
                                  display: block;
                                  background-color: #0F172A;
                                }
                              </style>
                            </head>
                            <body>
                              <video
                                id="autoPlayBannerVideo"
                                src="${videoSrc}"
                                autoplay
                                loop
                                muted
                                playsinline
                                webkit-playsinline
                                preload="auto"
                                poster="${imageUri}"
                              ></video>
                              <script>
                                (function() {
                                  var v = document.getElementById('autoPlayBannerVideo');
                                  if (!v) return;

                                  // Muted property is strictly required by mobile browsers for autoplay
                                  v.muted = true;
                                  v.defaultMuted = true;
                                  v.setAttribute('muted', '');
                                  v.setAttribute('playsinline', '');
                                  v.setAttribute('webkit-playsinline', '');

                                  function startAutoplay() {
                                    v.muted = true;
                                    var p = v.play();
                                    if (p !== undefined) {
                                      p.catch(function() {
                                        // Retry after brief interval if DOM ready state was transitioning
                                        setTimeout(startAutoplay, 200);
                                      });
                                    }
                                  }

                                  if (v.readyState >= 2) {
                                    startAutoplay();
                                  } else {
                                    v.addEventListener('canplay', startAutoplay, { once: true });
                                    v.addEventListener('loadeddata', startAutoplay, { once: true });
                                  }

                                  window.addEventListener('load', startAutoplay, { once: true });
                                  document.addEventListener('visibilitychange', function() {
                                    if (!document.hidden) startAutoplay();
                                  });

                                  startAutoplay();
                                })();
                              </script>
                            </body>
                            </html>
                          `,
                        }}
                        style={{ width: cardWidth, height: 168, backgroundColor: '#0F172A' }}
                        containerStyle={{ backgroundColor: '#0F172A' }}
                        originWhitelist={['*']}
                        allowsInlineMediaPlayback={true}
                        mediaPlaybackRequiresUserAction={false}
                        javaScriptEnabled={true}
                        domStorageEnabled={true}
                        scrollEnabled={false}
                        showsHorizontalScrollIndicator={false}
                        showsVerticalScrollIndicator={false}
                        androidLayerType="hardware"
                        androidHardwareAccelerationDisabled={false}
                        mixedContentMode="always"
                        cacheEnabled={true}
                        injectedJavaScript={`
                          (function() {
                            var v = document.getElementById('autoPlayBannerVideo') || document.querySelector('video');
                            if (v) {
                              v.muted = true;
                              v.defaultMuted = true;
                              v.play().catch(function() {});
                            }
                          })();
                          true;
                        `}
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

