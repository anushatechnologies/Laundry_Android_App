import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast, type ToastType } from '@/context/ToastContext';

interface TypeConfig {
  icon: string;
  iconColor: string;
  bgColor: string;
  badgeBg: string;
}

const TYPE_CONFIGS: Record<ToastType, TypeConfig> = {
  cart: {
    icon: 'basket',
    iconColor: '#10B981',
    bgColor: '#0F172A',
    badgeBg: 'rgba(16, 185, 129, 0.2)',
  },
  wishlist: {
    icon: 'heart',
    iconColor: '#F43F5E',
    bgColor: '#0F172A',
    badgeBg: 'rgba(244, 63, 94, 0.2)',
  },
  success: {
    icon: 'check-circle',
    iconColor: '#10B981',
    bgColor: '#0F172A',
    badgeBg: 'rgba(16, 185, 129, 0.2)',
  },
  error: {
    icon: 'alert-circle',
    iconColor: '#EF4444',
    bgColor: '#0F172A',
    badgeBg: 'rgba(239, 68, 68, 0.2)',
  },
  warning: {
    icon: 'alert',
    iconColor: '#F59E0B',
    bgColor: '#0F172A',
    badgeBg: 'rgba(245, 158, 11, 0.2)',
  },
  info: {
    icon: 'information',
    iconColor: '#38BDF8',
    bgColor: '#0F172A',
    badgeBg: 'rgba(56, 189, 248, 0.2)',
  },
};

export function ZeptoToast() {
  const { activeToast, hideToast } = useToast();
  const insets = useSafeAreaInsets();

  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;

  // Swipe-to-dismiss gesture
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 4,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy < 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -20 || gestureState.vy < -0.5) {
          Animated.parallel([
            Animated.timing(translateY, {
              toValue: -120,
              duration: 160,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 160,
              useNativeDriver: true,
            }),
          ]).start(() => hideToast());
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            friction: 7,
            tension: 90,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (activeToast) {
      translateY.setValue(-80);
      opacity.setValue(0);
      scale.setValue(0.92);

      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          friction: 7,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 6,
          tension: 90,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -80,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [activeToast?.id]);

  if (!activeToast) return null;

  const type = activeToast.type || 'info';
  const config = TYPE_CONFIGS[type] || TYPE_CONFIGS.info;
  const iconName = activeToast.icon || config.icon;

  const topOffset = insets.top + (Platform.OS === 'ios' ? 8 : 14);

  return (
    <View
      pointerEvents="box-none"
      style={[styles.container, { top: topOffset }]}
    >
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.pill,
          {
            opacity,
            transform: [{ translateY }, { scale }],
          },
        ]}
      >
        {/* Leading Media / Icon */}
        {activeToast.thumbnail ? (
          <Image
            source={{ uri: activeToast.thumbnail }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.iconWrap, { backgroundColor: config.badgeBg }]}>
            <MaterialCommunityIcons
              name={iconName as any}
              size={18}
              color={config.iconColor}
            />
          </View>
        )}

        {/* Text Content */}
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {activeToast.title}
          </Text>
          {Boolean(activeToast.subtitle || activeToast.message) && (
            <Text style={styles.message} numberOfLines={1}>
              {activeToast.subtitle || activeToast.message}
            </Text>
          )}
        </View>

        {/* Action Button (e.g. View Bag →) */}
        {activeToast.actionLabel && activeToast.onAction ? (
          <Pressable
            style={styles.actionButton}
            onPress={() => {
              hideToast();
              activeToast.onAction?.();
            }}
            hitSlop={6}
          >
            <Text style={styles.actionText}>{activeToast.actionLabel}</Text>
            <MaterialCommunityIcons name="arrow-right" size={13} color="#FFFFFF" />
          </Pressable>
        ) : (
          <Pressable
            style={styles.dismissBtn}
            onPress={hideToast}
            hitSlop={8}
          >
            <MaterialCommunityIcons name="close" size={14} color="#64748B" />
          </Pressable>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 99999,
    elevation: 999,
    paddingHorizontal: 16,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A', // Deep obsidian black-slate like Zepto
    borderRadius: 24,
    paddingVertical: 8,
    paddingHorizontal: 12,
    maxWidth: 440,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 10,
    gap: 10,
  },
  thumbnail: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#1E293B',
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  message: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 1,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    gap: 4,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  actionText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  dismissBtn: {
    padding: 4,
    borderRadius: 12,
  },
});
