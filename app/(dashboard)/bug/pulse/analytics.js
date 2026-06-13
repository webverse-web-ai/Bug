import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { TYPOGRAPHY, SPACING, ROUNDED } from '@/constants';
import SectionShell from '@/components/layout/SectionShell';
import { SkeletonKpis } from '@/components/ui/Skeleton';
import {
  PULSE_AGENT, PULSE_NAV, usePulseData, KpiCard, money, moneyFull, glass, STATUS_META, STATUS_ORDER,
} from '@/components/pulse/PulseKit';

function Analytics() {
  const { COLORS } = useTheme();
  const s = getStyles(COLORS);
  const { orders, stats, loading } = usePulseData();

  const channels = useMemo(() => {
    const m = {};
    for (const o of orders) m[o.channel || 'Direct Web'] = (m[o.channel || 'Direct Web'] || 0) + 1;
    return Object.entries(m).map(([k, v]) => ({ channel: k, count: v })).sort((a, b) => b.count - a.count);
  }, [orders]);

  const avgValue = orders.length ? orders.reduce((a, o) => a + (o.total || 0), 0) / orders.length : 0;
  const delivered = stats.byStatus?.delivered || 0;
  const fulfillRate = stats.total ? Math.round((delivered / stats.total) * 100) : 0;
  const maxStatus = Math.max(1, ...STATUS_ORDER.map(x => stats.byStatus?.[x] || 0));
  const maxChan = Math.max(1, ...channels.map(c => c.count));
  const PALETTE = ['#89CEFF', '#FFB86E', '#34D399', '#A78BFA', '#F87171'];

  return (
    <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
      <Text style={s.title}>Analytics</Text>
      <Text style={s.sub}>Order performance across statuses and channels.</Text>

      {loading ? <SkeletonKpis count={3} /> : (
        <View style={s.kpiRow}>
          <KpiCard icon="cash-multiple" label="Revenue" value={money(stats.revenue)} accent="#10B981" footer="delivered orders" footerColor="#10B981" />
          <KpiCard icon="cart-arrow-down" label="Avg Order" value={money(avgValue)} accent="#89CEFF" footer="per order" />
          <KpiCard icon="check-decagram-outline" label="Fulfill Rate" value={`${fulfillRate}%`} accent="#34D399" footer={`${delivered} delivered`} footerColor="#34D399" />
        </View>
      )}

      <View style={s.card}>
        <Text style={s.cardTitle}>Orders by Status</Text>
        {STATUS_ORDER.map((st, i) => {
          const m = STATUS_META[st]; const c = stats.byStatus?.[st] || 0;
          return (
            <View key={st} style={s.row}>
              <View style={s.rowHead}><Text style={s.rowName}>{m.label}</Text><Text style={s.rowVal}>{c}</Text></View>
              <View style={s.track}><View style={[s.fill, { width: `${(c / maxStatus) * 100}%`, backgroundColor: m.color }]} /></View>
            </View>
          );
        })}
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Orders by Channel</Text>
        {channels.length === 0 ? <Text style={s.muted}>No data yet.</Text> : channels.map((c, i) => (
          <View key={c.channel} style={s.row}>
            <View style={s.rowHead}><Text style={s.rowName}>{c.channel}</Text><Text style={s.rowVal}>{c.count}</Text></View>
            <View style={s.track}><View style={[s.fill, { width: `${(c.count / maxChan) * 100}%`, backgroundColor: PALETTE[i % PALETTE.length] }]} /></View>
          </View>
        ))}
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Pipeline Value</Text>
        <View style={s.bigRow}><Text style={s.bigLabel}>Realized Revenue</Text><Text style={[s.bigVal, { color: '#10B981' }]}>{moneyFull(stats.revenue)}</Text></View>
        <View style={s.bigRow}><Text style={s.bigLabel}>Open Pipeline</Text><Text style={[s.bigVal, { color: '#FFB86E' }]}>{moneyFull(stats.openValue)}</Text></View>
      </View>
      <View style={{ height: 90 }} />
    </ScrollView>
  );
}

export default function PulseAnalyticsScreen() {
  return <SectionShell agent={PULSE_AGENT} navItems={PULSE_NAV} requirePermission="pulse" title="Pulse · Analytics"><Analytics /></SectionShell>;
}

const getStyles = (COLORS) => StyleSheet.create({
  scroll: { padding: SPACING.lg, maxWidth: 900, width: '100%', alignSelf: 'center' },
  title: { ...TYPOGRAPHY.headlineMd, fontSize: 20, color: COLORS.onSurface, fontWeight: '800' },
  sub: { ...TYPOGRAPHY.bodySm, color: COLORS.onSurfaceVariant, marginTop: 2, marginBottom: SPACING.lg },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, marginBottom: SPACING.lg },
  card: { ...glass(COLORS), borderRadius: ROUNDED.xl, padding: SPACING.lg, marginBottom: SPACING.md },
  cardTitle: { ...TYPOGRAPHY.labelLg, color: COLORS.onSurface, fontWeight: '700', marginBottom: SPACING.md },
  row: { marginBottom: SPACING.sm },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  rowName: { ...TYPOGRAPHY.bodySm, color: COLORS.onSurface, fontWeight: '600' },
  rowVal: { ...TYPOGRAPHY.labelMd, color: COLORS.onSurfaceVariant, fontWeight: '700' },
  track: { height: 8, borderRadius: ROUNDED.full, backgroundColor: COLORS.surfaceContainerHighest, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: ROUNDED.full },
  muted: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurfaceVariant, fontStyle: 'italic' },
  bigRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.sm },
  bigLabel: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurfaceVariant },
  bigVal: { ...TYPOGRAPHY.headlineMd, fontSize: 20, fontWeight: '800' },
});
