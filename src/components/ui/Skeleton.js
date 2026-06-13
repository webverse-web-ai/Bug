import React, { useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import Reanimated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing } from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';
import { SPACING, ROUNDED } from '@/constants';

const glass = (COLORS) => ({ backgroundColor: COLORS.surfaceContainerLow, borderWidth: 1, borderColor: COLORS.outlineVariant, ...(Platform.OS === 'web' ? { backdropFilter: 'blur(12px)' } : {}) });

// One shimmering placeholder block.
export function SkeletonBlock({ w = '100%', h = 14, r = 6, style }) {
  const { COLORS } = useTheme();
  const v = useSharedValue(0.45);
  useEffect(() => {
    v.value = withRepeat(
      withSequence(
        withTiming(0.85, { duration: 750, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: 750, easing: Easing.inOut(Easing.ease) })
      ), -1, true
    );
  }, []);
  const sh = useAnimatedStyle(() => ({ opacity: v.value }));
  return <Reanimated.View style={[{ width: w, height: h, borderRadius: r, backgroundColor: COLORS.surfaceContainerHighest }, sh, style]} />;
}

// Row of KPI card placeholders.
export function SkeletonKpis({ count = 4 }) {
  const { COLORS } = useTheme();
  return (
    <View style={styles.kpiRow}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[glass(COLORS), styles.kpiCard]}>
          <SkeletonBlock w={30} h={30} r={8} />
          <SkeletonBlock w={'62%'} h={20} />
          <SkeletonBlock w={'40%'} h={9} />
        </View>
      ))}
    </View>
  );
}

// A card with a title and N body lines.
export function SkeletonCard({ rows = 4, title = true }) {
  const { COLORS } = useTheme();
  return (
    <View style={[glass(COLORS), styles.card]}>
      {title && <SkeletonBlock w={'45%'} h={16} style={{ marginBottom: SPACING.md }} />}
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={styles.lineRow}>
          <SkeletonBlock w={`${55 + (i % 3) * 12}%`} h={12} />
          <SkeletonBlock w={56} h={12} />
        </View>
      ))}
    </View>
  );
}

// A list of rows (avatar + two lines + trailing amount).
export function SkeletonList({ rows = 5, title = true }) {
  const { COLORS } = useTheme();
  return (
    <View style={[glass(COLORS), styles.card]}>
      {title && <SkeletonBlock w={'40%'} h={16} style={{ marginBottom: SPACING.md }} />}
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={styles.listRow}>
          <SkeletonBlock w={32} h={32} r={ROUNDED.md} />
          <View style={{ flex: 1, gap: 6 }}>
            <SkeletonBlock w={`${50 + (i % 4) * 10}%`} h={12} />
            <SkeletonBlock w={'35%'} h={9} />
          </View>
          <SkeletonBlock w={54} h={12} />
        </View>
      ))}
    </View>
  );
}

// Horizontal Kanban-style placeholder columns.
export function SkeletonBoard({ cols = 4, cards = 3 }) {
  const { COLORS } = useTheme();
  return (
    <View style={styles.board}>
      {Array.from({ length: cols }).map((_, c) => (
        <View key={c} style={styles.col}>
          <SkeletonBlock w={'70%'} h={12} style={{ marginBottom: SPACING.sm }} />
          {Array.from({ length: cards }).map((__, i) => (
            <View key={i} style={[glass(COLORS), styles.boardCard]}>
              <SkeletonBlock w={60} h={14} r={4} />
              <SkeletonBlock w={'80%'} h={12} />
              <SkeletonBlock w={'50%'} h={10} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  kpiCard: { flexGrow: 1, flexBasis: 150, minWidth: 140, borderRadius: ROUNDED.xl, padding: SPACING.md, gap: SPACING.sm },
  card: { borderRadius: ROUNDED.xl, padding: SPACING.lg, marginBottom: SPACING.md },
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm },
  board: { flexDirection: 'row', gap: SPACING.md },
  col: { width: 240 },
  boardCard: { borderRadius: ROUNDED.lg, padding: SPACING.md, marginBottom: SPACING.sm, gap: 8 },
});
