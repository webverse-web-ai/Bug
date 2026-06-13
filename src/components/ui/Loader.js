import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Reanimated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, Easing,
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';
import { TYPOGRAPHY, SPACING } from '@/constants';

/**
 * Branded loading animation: two counter-rotating arcs around a softly pulsing
 * core. Clean, smooth, theme-aware. Drop-in replacement for ActivityIndicator.
 *   <Loader />               – default
 *   <Loader label="…" />     – with caption
 *   <Loader size={28} />     – compact (inline)
 */
export default function Loader({ size = 46, label, style }) {
  const { COLORS } = useTheme();
  const spin = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    spin.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.linear }), -1, false);
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 650, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 650, easing: Easing.inOut(Easing.ease) })
      ),
      -1, true
    );
  }, []);

  const outer = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));
  const inner = useAnimatedStyle(() => ({ transform: [{ rotate: `${-spin.value * 360 * 1.7}deg` }] }));
  const core = useAnimatedStyle(() => ({
    transform: [{ scale: 0.7 + pulse.value * 0.55 }],
    opacity: 0.55 + pulse.value * 0.45,
  }));
  const halo = useAnimatedStyle(() => ({
    transform: [{ scale: 0.8 + pulse.value * 0.7 }],
    opacity: 0.18 * (1 - pulse.value),
  }));

  const innerSize = size - 14;
  const coreSize = Math.max(6, Math.round(size * 0.2));
  const bw = Math.max(2.5, size * 0.065);

  return (
    <View style={[styles.wrap, style]}>
      <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
        {/* soft halo */}
        <Reanimated.View style={[styles.fill, halo, { borderRadius: size / 2, backgroundColor: COLORS.primary }]} />
        {/* outer arc */}
        <Reanimated.View style={[styles.fill, outer, {
          width: size, height: size, borderRadius: size / 2, borderWidth: bw,
          borderColor: 'transparent', borderTopColor: COLORS.primary, borderRightColor: `${COLORS.primary}66`,
        }]} />
        {/* inner counter-arc */}
        <Reanimated.View style={[inner, {
          width: innerSize, height: innerSize, borderRadius: innerSize / 2, borderWidth: bw * 0.85,
          borderColor: 'transparent', borderBottomColor: COLORS.tertiary, borderLeftColor: `${COLORS.tertiary}55`,
        }]} />
        {/* pulsing core */}
        <Reanimated.View style={[styles.core, core, { width: coreSize, height: coreSize, borderRadius: coreSize / 2, backgroundColor: COLORS.primary }]} />
      </View>
      {label ? <Text style={[styles.label, { color: COLORS.onSurfaceVariant }]}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
  fill: { position: 'absolute' },
  core: { position: 'absolute' },
  label: { ...TYPOGRAPHY.labelMd, letterSpacing: 0.3 },
});
