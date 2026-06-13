import React, { useEffect } from 'react';
import { TouchableOpacity, View, StyleSheet, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';

const TRACK_W = 54;
const TRACK_H = 28;
const KNOB = 22;
const PAD = 3;
const TRAVEL = TRACK_W - KNOB - PAD * 2;

// A polished sliding day/night switch — the knob glides with a spring and
// carries the active icon; the inactive icon stays faint on the track.
export default function ThemeToggle() {
  const { themeMode, toggleTheme, COLORS } = useTheme();
  const isDark = themeMode === 'dark';
  const x = useSharedValue(isDark ? TRAVEL : 0);

  useEffect(() => {
    x.value = withSpring(isDark ? TRAVEL : 0, { damping: 16, stiffness: 200, mass: 0.6 });
  }, [isDark]);

  const knobStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={toggleTheme}
      accessibilityRole="switch"
      accessibilityState={{ checked: isDark }}
      style={[styles.track, {
        backgroundColor: isDark ? COLORS.surfaceContainerHighest : COLORS.secondaryContainer,
        borderColor: COLORS.outlineVariant,
      }]}
    >
      {/* faint hint icons on the track */}
      <View style={styles.icons} pointerEvents="none">
        <MaterialCommunityIcons name="white-balance-sunny" size={13} color={isDark ? COLORS.onSurfaceVariant : 'transparent'} />
        <MaterialCommunityIcons name="moon-waning-crescent" size={12} color={isDark ? 'transparent' : COLORS.onSurfaceVariant} />
      </View>
      {/* sliding knob with the active icon */}
      <Animated.View style={[styles.knob, knobStyle, {
        backgroundColor: isDark ? COLORS.primary : COLORS.surface,
        shadowColor: '#000',
      }]}>
        <MaterialCommunityIcons
          name={isDark ? 'moon-waning-crescent' : 'white-balance-sunny'}
          size={13}
          color={isDark ? COLORS.onPrimary : COLORS.tertiary}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_W, height: TRACK_H, borderRadius: TRACK_H / 2,
    padding: PAD, borderWidth: 1, justifyContent: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  icons: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 7,
  },
  knob: {
    width: KNOB, height: KNOB, borderRadius: KNOB / 2,
    justifyContent: 'center', alignItems: 'center',
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.25, shadowRadius: 2, elevation: 2,
  },
});
