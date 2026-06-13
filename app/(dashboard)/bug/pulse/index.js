import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';
import { TYPOGRAPHY, SPACING, ROUNDED } from '@/constants';
import SectionShell from '@/components/layout/SectionShell';
import { SkeletonKpis, SkeletonBlock } from '@/components/ui/Skeleton';
import {
  PULSE_AGENT, PULSE_NAV, usePulseData, KpiCard, money, moneyFull, glass, STATUS_META, PIPELINE,
} from '@/components/pulse/PulseKit';

function Overview() {
  const { COLORS } = useTheme();
  const s = getStyles(COLORS);
  const { orders, stats, loading } = usePulseData();
  const trendUp = (stats.trend || 0) >= 0;
  const pending = stats.byStatus?.pending || 0;

  return (
    <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
      <Animated.View entering={FadeInDown.duration(220)} style={s.hero}>
        <View style={s.heroIcon}><MaterialCommunityIcons name="pulse" size={24} color={PULSE_AGENT.color} /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.heroTitle}>Operations Overview</Text>
          <Text style={s.heroSub}>{pending > 0 ? `${pending} awaiting fulfillment` : 'Pipeline clear'} · reporting to Bug</Text>
        </View>
        <TouchableOpacity style={s.cta} onPress={() => router.push('/bug/pulse/orders')}>
          <Text style={s.ctaText}>Manage</Text>
          <MaterialCommunityIcons name="arrow-right" size={16} color={COLORS.onPrimary} />
        </TouchableOpacity>
      </Animated.View>

      {loading ? <SkeletonKpis count={3} /> : (
        <View style={s.kpiRow}>
          <KpiCard icon="cart-variant" label="Total Orders" value={String(stats.total || 0)} accent="#89CEFF" footer={`${trendUp ? '+' : ''}${stats.trend || 0}% vs last week`} footerColor={trendUp ? '#34D399' : '#F87171'} />
          <KpiCard icon="progress-clock" label="Pending" value={String(pending)} accent="#FFB86E" footer={pending > 0 ? 'needs fulfillment' : 'all clear'} footerColor="#FFB86E" />
          <KpiCard icon="cash-multiple" label="Revenue" value={money(stats.revenue)} accent="#10B981" footer={`${money(stats.openValue)} in pipeline`} footerColor="#10B981" />
        </View>
      )}

      {/* Pipeline summary */}
      <View style={s.card}>
        <View style={s.cardHead}>
          <Text style={s.cardTitle}>Pipeline Snapshot</Text>
          <TouchableOpacity onPress={() => router.push('/bug/pulse/fulfillment')}><Text style={s.link}>Open board →</Text></TouchableOpacity>
        </View>
        {PIPELINE.map(st => {
          const m = STATUS_META[st];
          const count = stats.byStatus?.[st] || 0;
          const pct = stats.total ? (count / stats.total) * 100 : 0;
          return (
            <View key={st} style={s.pipeRow}>
              <View style={[s.pipeDot, { backgroundColor: m.color }]} />
              <Text style={s.pipeLabel}>{m.label}</Text>
              <View style={s.pipeTrack}><View style={[s.pipeFill, { width: `${pct}%`, backgroundColor: m.color }]} /></View>
              <Text style={s.pipeCount}>{count}</Text>
            </View>
          );
        })}
      </View>

      {/* Recent orders */}
      <View style={s.card}>
        <View style={s.cardHead}>
          <Text style={s.cardTitle}>Recent Orders</Text>
          <TouchableOpacity onPress={() => router.push('/bug/pulse/orders')}><Text style={s.link}>All orders →</Text></TouchableOpacity>
        </View>
        {loading ? Array.from({ length: 5 }).map((_, i) => (
          <View key={i} style={s.orderRow}>
            <SkeletonBlock w={56} h={16} r={4} />
            <View style={{ flex: 1 }}><SkeletonBlock w={'48%'} h={12} /></View>
            <SkeletonBlock w={56} h={12} />
          </View>
        )) : orders.length === 0 ? <Text style={s.muted}>No orders yet.</Text> : orders.slice(0, 6).map(o => {
          const m = STATUS_META[o.status] || STATUS_META.pending;
          return (
            <TouchableOpacity key={o.id} style={s.orderRow} onPress={() => router.push('/bug/pulse/orders')}>
              <View style={[s.orderTag, { backgroundColor: `${m.color}1A`, borderColor: `${m.color}33` }]}><Text style={[s.orderTagText, { color: m.color }]}>{o.orderNumber}</Text></View>
              <View style={{ flex: 1 }}><Text style={s.orderName} numberOfLines={1}>{o.customer?.name}</Text></View>
              <Text style={s.orderAmt}>{moneyFull(o.total)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={{ height: 90 }} />
    </ScrollView>
  );
}

export default function PulseOverviewScreen() {
  return <SectionShell agent={PULSE_AGENT} navItems={PULSE_NAV} requirePermission="pulse" title="Pulse · Overview"><Overview /></SectionShell>;
}

const getStyles = (COLORS) => StyleSheet.create({
  scroll: { padding: SPACING.lg, maxWidth: 900, width: '100%', alignSelf: 'center' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, ...glass(COLORS), borderRadius: ROUNDED.xl, padding: SPACING.md, marginBottom: SPACING.lg },
  heroIcon: { width: 46, height: 46, borderRadius: ROUNDED.lg, backgroundColor: `${PULSE_AGENT.color}1A`, borderWidth: 1, borderColor: `${PULSE_AGENT.color}55`, justifyContent: 'center', alignItems: 'center' },
  heroTitle: { ...TYPOGRAPHY.labelLg, color: COLORS.onSurface, fontWeight: '800' },
  heroSub: { ...TYPOGRAPHY.bodySm, color: COLORS.onSurfaceVariant, marginTop: 1 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.primary, paddingHorizontal: SPACING.md, paddingVertical: 9, borderRadius: ROUNDED.full },
  ctaText: { ...TYPOGRAPHY.labelMd, color: COLORS.onPrimary, fontWeight: '700' },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, marginBottom: SPACING.lg },
  card: { ...glass(COLORS), borderRadius: ROUNDED.xl, padding: SPACING.lg, marginBottom: SPACING.md },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  cardTitle: { ...TYPOGRAPHY.labelLg, color: COLORS.onSurface, fontWeight: '700' },
  link: { ...TYPOGRAPHY.labelMd, color: COLORS.primary, fontWeight: '600' },
  muted: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurfaceVariant, fontStyle: 'italic' },
  pipeRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  pipeDot: { width: 8, height: 8, borderRadius: 4 },
  pipeLabel: { ...TYPOGRAPHY.bodySm, color: COLORS.onSurface, width: 84 },
  pipeTrack: { flex: 1, height: 8, borderRadius: ROUNDED.full, backgroundColor: COLORS.surfaceContainerHighest, overflow: 'hidden' },
  pipeFill: { height: '100%', borderRadius: ROUNDED.full },
  pipeCount: { ...TYPOGRAPHY.labelMd, color: COLORS.onSurfaceVariant, fontWeight: '700', width: 28, textAlign: 'right' },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: `${COLORS.outlineVariant}55` },
  orderTag: { borderWidth: 1, borderRadius: ROUNDED.default, paddingHorizontal: 6, paddingVertical: 2 },
  orderTagText: { ...TYPOGRAPHY.labelSm, fontSize: 10, fontWeight: '700', fontFamily: Platform.OS === 'web' ? 'monospace' : undefined },
  orderName: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurface, fontWeight: '600' },
  orderAmt: { ...TYPOGRAPHY.labelMd, color: COLORS.onSurface, fontWeight: '800' },
});
