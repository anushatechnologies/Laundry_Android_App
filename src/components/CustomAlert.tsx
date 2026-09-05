import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View, Easing } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface CustomAlertProps {
  visible: boolean;
  title: string;
  message: string;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  iconColor?: string;
  buttons?: Array<{
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
  }>;
  onDismiss?: () => void;
}

export function CustomAlert({
  visible,
  title,
  message,
  icon = 'information-outline',
  iconColor = '#2563EB',
  buttons = [{ text: 'OK' }],
  onDismiss,
}: CustomAlertProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 100,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleButtonPress = (button: typeof buttons[0]) => {
    if (button.onPress) {
      button.onPress();
    }
    if (onDismiss) {
      onDismiss();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: fadeAnim,
            },
          ]}
        />
      </Pressable>

      <View style={styles.container} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.alertBox,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Icon */}
          <View style={[styles.iconContainer, { backgroundColor: `${iconColor}15` }]}>
            <MaterialCommunityIcons name={icon} size={32} color={iconColor} />
          </View>

          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Message */}
          <Text style={styles.message}>{message}</Text>

          {/* Buttons */}
          <View style={styles.buttonsContainer}>
            {buttons.map((button, index) => (
              <Pressable
                key={index}
                style={({ pressed }) => [
                  styles.button,
                  button.style === 'cancel' && styles.buttonCancel,
                  button.style === 'destructive' && styles.buttonDestructive,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => handleButtonPress(button)}
              >
                <Text
                  style={[
                    styles.buttonText,
                    button.style === 'cancel' && styles.buttonTextCancel,
                    button.style === 'destructive' && styles.buttonTextDestructive,
                  ]}
                >
                  {button.text}
                </Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  alertBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  button: {
    flex: 1,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonCancel: {
    backgroundColor: '#F1F5F9',
  },
  buttonDestructive: {
    backgroundColor: '#DC2626',
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  buttonTextCancel: {
    color: '#64748B',
  },
  buttonTextDestructive: {
    color: '#FFFFFF',
  },
});
