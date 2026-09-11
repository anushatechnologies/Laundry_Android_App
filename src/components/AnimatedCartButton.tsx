import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';

interface AnimatedCartButtonProps {
  quantity: number;
  onAdd: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
  maxQuantity?: number;
  unitLabel?: string;
  isDark?: boolean;
}

export const AnimatedCartButton = React.memo(function AnimatedCartButton({
  quantity,
  onAdd,
  onIncrement,
  onDecrement,
  maxQuantity = 50,
  unitLabel,
  isDark: isDarkProp,
}: AnimatedCartButtonProps) {
  // Always safely resolve dark mode from ThemeContext (supporting system theme as well),
  // with explicit prop override if passed
  let contextIsDark = false;
  try {
    const theme = useTheme();
    contextIsDark = theme.isDark;
  } catch {
    // Outside ThemeProvider fallback
  }
  const isDark = isDarkProp !== undefined ? isDarkProp : contextIsDark;

  const isSelected = quantity > 0;

  // Animation values
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const countScaleAnim = useRef(new Animated.Value(1)).current;
  const prevQtyRef = useRef(quantity);

  // Pulse when quantity changes while already selected
  useEffect(() => {
    if (quantity !== prevQtyRef.current && quantity > 0) {
      Animated.sequence([
        Animated.timing(countScaleAnim, {
          toValue: 1.25,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.spring(countScaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 100,
          useNativeDriver: true,
        }),
      ]).start();
    }
    prevQtyRef.current = quantity;
  }, [quantity, countScaleAnim]);

  const handleAddPress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.92,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 120,
        useNativeDriver: true,
      }),
    ]).start();

    onAdd();
  };

  const handleIncrementPress = () => {
    if (quantity >= maxQuantity) return;
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.94,
        duration: 70,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 120,
        useNativeDriver: true,
      }),
    ]).start();

    onIncrement();
  };

  const handleDecrementPress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.94,
        duration: 70,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 120,
        useNativeDriver: true,
      }),
    ]).start();

    onDecrement();
  };

  if (!isSelected) {
    return (
      <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, styles.outerWrapper]}>
        <Pressable
          onPress={handleAddPress}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Add to laundry bag"
          style={styles.pressableOuter}
        >
          <View style={[styles.btnBase, styles.addBtn, isDark ? styles.addBtnDark : styles.addBtnLight]}>
            <MaterialCommunityIcons
              name="plus"
              size={14}
              color="#FFFFFF"
              style={styles.plusIcon}
            />
            <Text
              style={[styles.addBtnText, isDark ? styles.addBtnTextDark : styles.addBtnTextLight]}
              numberOfLines={1}
            >
              ADD
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, styles.outerWrapper]}>
      <View style={[styles.btnBase, styles.stepperContainer, isDark ? styles.stepperContainerDark : styles.stepperContainerLight]}>
        <Pressable
          style={({ pressed }) => [
            styles.stepperBtn,
            pressed && styles.stepperBtnPressed,
          ]}
          onPress={handleDecrementPress}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Decrease quantity"
        >
          <MaterialCommunityIcons name="minus" size={14} color="#FFFFFF" />
        </Pressable>

        <Animated.View style={{ transform: [{ scale: countScaleAnim }], alignItems: 'center', justifyContent: 'center' }}>
          <Text style={styles.stepperQtyText} numberOfLines={1}>
            {quantity}
            {unitLabel ? <Text style={styles.unitText}>{unitLabel}</Text> : null}
          </Text>
        </Animated.View>

        <Pressable
          style={({ pressed }) => [
            styles.stepperBtn,
            pressed && styles.stepperBtnPressed,
          ]}
          onPress={handleIncrementPress}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Increase quantity"
        >
          <MaterialCommunityIcons name="plus" size={14} color="#FFFFFF" />
        </Pressable>
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  outerWrapper: {
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  pressableOuter: {
    flexShrink: 0,
  },
  btnBase: {
    height: 32,
    minWidth: 80,
    borderRadius: 16,
    overflow: 'hidden',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  addBtnLight: {
    backgroundColor: '#16A34A',
    borderWidth: 1.5,
    borderColor: '#15803D',
    shadowColor: '#15803D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  addBtnDark: {
    backgroundColor: '#059669',
    borderWidth: 1.5,
    borderColor: '#34D399',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  plusIcon: {
    marginRight: 4,
  },
  addBtnText: {
    fontSize: 12.5,
    fontWeight: '900',
    letterSpacing: 0.6,
    includeFontPadding: false,
  },
  addBtnTextLight: {
    color: '#FFFFFF',
  },
  addBtnTextDark: {
    color: '#FFFFFF',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 3,
  },
  stepperContainerLight: {
    backgroundColor: '#16A34A',
    borderWidth: 1.5,
    borderColor: '#15803D',
    shadowColor: '#15803D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  stepperContainerDark: {
    backgroundColor: '#059669',
    borderWidth: 1.5,
    borderColor: '#34D399',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  stepperBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  stepperBtnPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    transform: [{ scale: 0.92 }],
  },
  stepperQtyText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    paddingHorizontal: 4,
    minWidth: 18,
    textAlign: 'center',
    includeFontPadding: false,
  },
  unitText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#DCFCE7',
  },
});
