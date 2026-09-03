import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';

interface ShimmerSkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: ViewStyle | ViewStyle[];
}

export function ShimmerSkeleton({
  width = '100%',
  height = 20,
  borderRadius = 8,
  style,
}: ShimmerSkeletonProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.8,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();

    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width: width as any,
          height: height as any,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function BannerSkeleton() {
  return (
    <View style={styles.bannerWrap}>
      <ShimmerSkeleton height={160} borderRadius={20} />
    </View>
  );
}

export function CategoryPillsSkeleton() {
  return (
    <View style={styles.pillsRow}>
      {[85, 110, 95, 120].map((w, idx) => (
        <ShimmerSkeleton key={idx} width={w} height={36} borderRadius={18} />
      ))}
    </View>
  );
}

export function GarmentCardSkeleton() {
  return (
    <View style={styles.garmentCard}>
      <ShimmerSkeleton width={105} height={125} borderRadius={14} />
      <View style={styles.garmentCardDetails}>
        <ShimmerSkeleton width="70%" height={16} borderRadius={4} />
        <ShimmerSkeleton width="40%" height={12} borderRadius={4} style={{ marginTop: 6 }} />
        <ShimmerSkeleton width="90%" height={10} borderRadius={4} style={{ marginTop: 8 }} />
        <View style={styles.garmentCardBottom}>
          <ShimmerSkeleton width={60} height={18} borderRadius={4} />
          <ShimmerSkeleton width={70} height={32} borderRadius={10} />
        </View>
      </View>
    </View>
  );
}

export function OrderCardSkeleton() {
  return (
    <View style={styles.orderCard}>
      <View style={styles.orderCardTop}>
        <ShimmerSkeleton width={110} height={16} borderRadius={4} />
        <ShimmerSkeleton width={80} height={22} borderRadius={8} />
      </View>
      <ShimmerSkeleton width="100%" height={6} borderRadius={3} style={{ marginVertical: 12 }} />
      <ShimmerSkeleton width="60%" height={14} borderRadius={4} />
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#E8DED6',
  },
  bannerWrap: {
    paddingHorizontal: 16,
    marginVertical: 12,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginVertical: 10,
  },
  garmentCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: '#F3E8DF',
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  garmentCardDetails: {
    flex: 1,
    justifyContent: 'space-between',
  },
  garmentCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3E8DF',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  orderCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
