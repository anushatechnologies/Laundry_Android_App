import { useEffect, useRef } from 'react';
import {
  Animated,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';

const LANDING_DELAY_MS = 2500;

interface WelcomeScreenProps {
  onContinue: () => void;
}

/** A deliberately quiet first-launch landing screen before location selection. */
export function WelcomeScreen({ onContinue }: WelcomeScreenProps) {
  const { isDark, colors } = useTheme();
  const { height } = useWindowDimensions();
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentScale = useRef(new Animated.Value(0.94)).current;
  const contentTranslateY = useRef(new Animated.Value(18)).current;
  const didContinue = useRef(false);

  useEffect(() => {
    const entrance = Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }),
      Animated.spring(contentScale, {
        toValue: 1,
        tension: 88,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.spring(contentTranslateY, {
        toValue: 0,
        tension: 84,
        friction: 10,
        useNativeDriver: true,
      }),
    ]);

    entrance.start();
    return () => entrance.stop();
  }, [contentOpacity, contentScale, contentTranslateY]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const exit = Animated.parallel([
        Animated.timing(contentOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(contentScale, {
          toValue: 0.98,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(contentTranslateY, {
          toValue: -Math.max(72, height * 0.12),
          duration: 300,
          useNativeDriver: true,
        }),
      ]);

      exit.start(({ finished }) => {
        if (finished && !didContinue.current) {
          didContinue.current = true;
          onContinue();
        }
      });
    }, LANDING_DELAY_MS);

    return () => clearTimeout(timer);
  }, [contentOpacity, contentScale, contentTranslateY, height, onContinue]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <View pointerEvents="none" style={[styles.orb, styles.orbTop, isDark && { backgroundColor: 'rgba(249, 115, 22, 0.08)' }]} />
      <View pointerEvents="none" style={[styles.orb, styles.orbBottom, isDark && { backgroundColor: 'rgba(16, 185, 129, 0.06)' }]} />

      <Animated.View
        style={[
          styles.brandStage,
          {
            opacity: contentOpacity,
            transform: [{ translateY: contentTranslateY }, { scale: contentScale }],
          },
        ]}
        accessibilityLabel="LaundryFresh"
      >
        <Text style={[styles.brandName, { color: colors.textHeading }]}>
          Laundry<Text style={styles.brandAccent}>Fresh</Text>
        </Text>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#FFF8F1',
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orbTop: {
    width: 300,
    height: 300,
    top: -190,
    right: -125,
    backgroundColor: '#FFE1BD',
  },
  orbBottom: {
    width: 240,
    height: 240,
    bottom: -155,
    left: -110,
    backgroundColor: '#F7E6F2',
  },
  brandStage: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  brandName: {
    color: '#2D124D',
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -1.7,
  },
  brandAccent: {
    color: '#F97316',
  },
});
