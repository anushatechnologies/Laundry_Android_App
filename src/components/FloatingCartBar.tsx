import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import { money } from '@/ui/theme';
import { getGarmentImageUrl } from '@/lib/garment-photos';

interface FloatingCartBarProps {
  onViewCart: () => void;
  bottomOffset?: number;
  visible?: boolean;
}

export const FloatingCartBar = React.memo(function FloatingCartBar({
  onViewCart,
  bottomOffset = 80,
  visible = true,
}: FloatingCartBarProps) {
  const { cart, cartSummary } = useApp();
  const itemCount = cartSummary.itemCount;
  const isCartActive = visible && itemCount > 0;

  // Animation values
  const translateY = useRef(new Animated.Value(90)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.94)).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  const countPulse = useRef(new Animated.Value(1)).current;

  // Track if bar should be mounted in DOM
  const [shouldRender, setShouldRender] = useState(isCartActive);
  const prevCountRef = useRef(itemCount);

  useEffect(() => {
    if (isCartActive) {
      setShouldRender(true);
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          friction: 8,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 7,
          tension: 60,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 90,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.94,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished && !isCartActive) {
          setShouldRender(false);
        }
      });
    }
  }, [isCartActive, translateY, opacity, scale]);

  // Pulse count when itemCount changes while active
  useEffect(() => {
    if (isCartActive && itemCount !== prevCountRef.current) {
      Animated.sequence([
        Animated.timing(countPulse, {
          toValue: 1.15,
          duration: 90,
          useNativeDriver: true,
        }),
        Animated.spring(countPulse, {
          toValue: 1,
          friction: 4,
          tension: 100,
          useNativeDriver: true,
        }),
      ]).start();
    }
    prevCountRef.current = itemCount;
  }, [itemCount, isCartActive, countPulse]);

  const handlePressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.97,
      friction: 6,
      tension: 120,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      friction: 6,
      tension: 120,
      useNativeDriver: true,
    }).start();
  };

  if (!shouldRender && !isCartActive) return null;

  // Resolve 1 to 3 distinct product images from cart
  const distinctItems = cart.slice(0, 3);
  const extraCount = Math.max(0, cart.length - 3);

  const finalTotal = cartSummary.itemTotal || 0;

  return (
    <Animated.View
      pointerEvents={isCartActive ? 'auto' : 'none'}
      style={[
        styles.container,
        { bottom: bottomOffset },
        {
          opacity,
          transform: [
            { translateY },
            { scale },
            { scale: pressScale },
          ],
        },
      ]}
    >
      <Pressable
        style={styles.pillBar}
        onPress={onViewCart}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={`View Cart, ${itemCount} items, total ${money(finalTotal)}`}
      >
        {/* Left: Overlapping Thumbnails Stack */}
        <View style={styles.leftStack}>
          {distinctItems.map((item, index) => {
            const rawClothId = item.clothId || (typeof item.id === 'string' ? item.id.split('-')[0] : 'cloth-shirt') || 'cloth-shirt';
            const imageUrl = getGarmentImageUrl(rawClothId, item.imageUrl, item.categoryName, item.serviceName);

            return (
              <View
                key={item.id || index}
                style={[
                  styles.thumbWrapper,
                  index > 0 && { marginLeft: -12 },
                  { zIndex: 10 - index },
                ]}
              >
                <Image
                  source={{ uri: imageUrl }}
                  style={styles.thumbImage}
                  resizeMode="cover"
                />
              </View>
            );
          })}

          {extraCount > 0 && (
            <View style={[styles.thumbWrapper, styles.extraBadgeWrap, { marginLeft: -12, zIndex: 6 }]}>
              <Text style={styles.extraBadgeText}>+{extraCount}</Text>
            </View>
          )}
        </View>

        {/* Center: Count & Total Price */}
        <View style={styles.centerInfo}>
          <Animated.View style={{ transform: [{ scale: countPulse }], flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.primaryText} numberOfLines={1}>
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
              <Text style={styles.dotSeparator}> • </Text>
              <Text style={styles.priceHighlight}>{money(finalTotal)}</Text>
            </Text>
          </Animated.View>
          <Text style={styles.subText} numberOfLines={1}>
            Itemized laundry basket
          </Text>
        </View>

        {/* Right: View Cart Action Pill */}
        <View style={styles.actionPill}>
          <Text style={styles.actionPillText}>View Cart</Text>
          <MaterialCommunityIcons name="arrow-right" size={15} color="#FFFFFF" />
        </View>
      </Pressable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 9999,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  pillBar: {
    height: 62,
    backgroundColor: '#16A34A',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: '#22C55E',
    overflow: 'hidden',
  },
  leftStack: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 10,
  },
  thumbWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  extraBadgeWrap: {
    backgroundColor: '#064E3B',
    borderColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  extraBadgeText: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  centerInfo: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    paddingRight: 8,
  },
  primaryText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.1,
  },
  dotSeparator: {
    color: '#86EFAC',
    fontWeight: '900',
  },
  priceHighlight: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  subText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#DCFCE7',
    marginTop: 1,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  actionPillText: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});
