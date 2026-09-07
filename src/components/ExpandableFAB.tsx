import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface FABAction {
  icon: string;
  label: string;
  onPress: () => void;
  color?: string;
}

interface ExpandableFABProps {
  mainIcon: string;
  mainAction: () => void;
  badge?: number;
  actions: FABAction[];
}

export function ExpandableFAB({ mainIcon, mainAction, badge, actions }: ExpandableFABProps) {
  const [expanded, setExpanded] = useState(false);
  const animation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (expanded) {
      Animated.spring(animation, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }).start();
    } else {
      animation.setValue(0);
    }
  }, [expanded]);

  return (
    <>
      {/* Modal renders on native window root so Android never clips touch events */}
      <Modal
        transparent
        visible={expanded}
        animationType="fade"
        onRequestClose={() => setExpanded(false)}
        statusBarTranslucent
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setExpanded(false)}>
          <View style={styles.modalActionsContainer} pointerEvents="box-none">
            {actions.map((action, index) => {
              const translateY = animation.interpolate({
                inputRange: [0, 1],
                outputRange: [15 * (index + 1), 0],
              });

              return (
                <Animated.View
                  key={index}
                  style={[
                    styles.actionRowWrap,
                    {
                      transform: [{ translateY }],
                      opacity: animation,
                    },
                  ]}
                >
                  <Pressable
                    style={({ pressed }) => [
                      styles.actionRow,
                      pressed && { opacity: 0.8, transform: [{ scale: 0.96 }] },
                    ]}
                    onPress={() => {
                      setExpanded(false);
                      action.onPress();
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 20, right: 20 }}
                  >
                    <View style={[styles.actionButtonInner, { backgroundColor: action.color || '#6366F1' }]}>
                      <MaterialCommunityIcons name={action.icon as any} size={22} color="#FFFFFF" />
                    </View>
                    <View style={styles.labelContainer}>
                      <Text style={styles.label}>{action.label}</Text>
                    </View>
                  </Pressable>
                </Animated.View>
              );
            })}

            {/* Close Button in Modal matching position */}
            <Pressable style={[styles.fab, styles.fabClose]} onPress={() => setExpanded(false)}>
              <MaterialCommunityIcons name="close" size={28} color="#FFFFFF" />
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Main Tab Bar FAB */}
      <View style={styles.container}>
        <Pressable
          style={styles.fab}
          onPress={() => setExpanded(true)}
          accessibilityLabel="Quick Actions Menu"
        >
          <MaterialCommunityIcons
            name={mainIcon as any}
            size={28}
            color="#FFFFFF"
          />
          {badge && badge > 0 ? (
            <View style={styles.fabBadge}>
              <Text style={styles.fabBadgeText}>{badge}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modalActionsContainer: {
    alignItems: 'center',
    marginBottom: Platform.OS === 'ios' ? 42 : 32,
    gap: 14,
  },
  actionRowWrap: {
    alignItems: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionButtonInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  labelContainer: {
    backgroundColor: 'rgba(17, 24, 39, 0.92)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  container: {
    position: 'absolute',
    top: -28,
    left: '50%',
    marginLeft: -30,
    zIndex: 10,
    alignItems: 'center',
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF7A00',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF7A00',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  fabClose: {
    marginTop: 6,
    backgroundColor: '#EA580C',
  },
  fabBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 12,
    minWidth: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  fabBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
});
