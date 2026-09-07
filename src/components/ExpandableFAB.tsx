import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
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
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(animation, {
        toValue: expanded ? 1 : 0,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(rotation, {
        toValue: expanded ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [expanded]);

  const toggleExpand = () => {
    // Just toggle expand/collapse - no navigation
    setExpanded(!expanded);
  };

  const rotateInterpolate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '135deg'], // Rotate to X
  });

  const scaleInterpolate = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.1],
  });

  return (
    <>
      {/* Backdrop to close menu */}
      {expanded && (
        <Pressable
          style={styles.backdrop}
          onPress={() => setExpanded(false)}
        />
      )}

      <View style={styles.container} pointerEvents="box-none">
        {/* Expanded Action Buttons */}
        {actions.map((action, index) => {
          const translateY = animation.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -(70 + index * 65)],
          });

          const opacity = animation.interpolate({
            inputRange: [0, 0.4, 1],
            outputRange: [0, 0, 1],
          });

          const scale = animation.interpolate({
            inputRange: [0, 1],
            outputRange: [0.3, 1],
          });

          return (
            <Animated.View
              key={index}
              style={[
                styles.actionButton,
                {
                  transform: [{ translateY }, { scale }],
                  opacity,
                },
              ]}
              pointerEvents={expanded ? 'auto' : 'none'}
            >
              {/* Make entire row (icon + label) clickable */}
              <Pressable
                style={styles.actionRow}
                onPress={() => {
                  action.onPress();
                  setExpanded(false);
                }}
              >
                <View style={[styles.actionButtonInner, { backgroundColor: action.color || '#6366F1' }]}>
                  <MaterialCommunityIcons name={action.icon as any} size={24} color="#FFFFFF" />
                </View>
                <View style={styles.labelContainer}>
                  <Text style={styles.label}>{action.label}</Text>
                </View>
              </Pressable>
            </Animated.View>
          );
        })}

        {/* Main FAB */}
        <Animated.View style={{ transform: [{ scale: scaleInterpolate }] }}>
          <Pressable style={styles.fab} onPress={toggleExpand}>
            <Animated.View style={{ transform: [{ rotate: rotateInterpolate }] }}>
              <MaterialCommunityIcons
                name={expanded ? 'close' : (mainIcon as any)}
                size={28}
                color="#FFFFFF"
              />
            </Animated.View>
            {badge && badge > 0 && !expanded ? (
              <View style={styles.fabBadge}>
                <Text style={styles.fabBadgeText}>{badge}</Text>
              </View>
            ) : null}
          </Pressable>
        </Animated.View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: -1000,
    left: -1000,
    right: -1000,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    zIndex: 9,
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
  actionButton: {
    position: 'absolute',
    top: 0,
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
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    whiteSpace: 'nowrap',
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
