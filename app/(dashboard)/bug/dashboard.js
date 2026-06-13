import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';
import { SkeletonKpis, SkeletonBlock } from '@/components/ui/Skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { TYPOGRAPHY, SPACING, ROUNDED } from '@/constants';
import SectionShell from '@/components/layout/SectionShell';
import { getOrders, getTally } from '@/client/api';
import { useSWR } from '@/client/cache/swr';

const BUG_AGENT = { name: 'Dashboard', role: 'Command Center', icon: 'hexagon-multiple-outline', color: '#89CEFF' };
const BUG_NAV = [
  { label: 'Dashboard', icon: 'view-dashboard-outline', href: '/bug/dashboard' },
  { label: 'Bug Chat', icon: 'robot-happy-outline', href: '/bug' },
  { label: 'Pulse · Orders', icon: 'pulse', href: '/bug/pulse' },
  { label: 'Tally · Accounts', icon: 'calculator-variant', href: '/bug/tally' },
  { label: 'Knowledge Base', icon: 'database', href: '/bug/knowledge' },
  { label: 'System Metrics', icon: 'chart-line', href: '/bug/metrics' },
  { label: 'Team', icon: 'account-group-outline', href: '/bug/team' },
  { label: 'My Profile', icon: 'account-circle-outline', href: '/bug/profile' },
];

const glass = (COLORS) => ({ backgroundColor: COLORS.surfaceContainerLow, borderWidth: 1, borderColor: COLORS.outlineVariant, ...(Platform.OS === 'web' ? { backdropFilter: 'blur(12px)' } : {}) });
const money = (v) => { const n = Number(v) || 0, a = Math.abs(n), sg = n < 0 ? '-' : ''; return a >= 1000 ? `${sg}$${(a / 1000).toFixed(a >= 10000 ? 0 : 1)}k` : `${sg}$${a.toFixed(0)}`; };
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };

function Dashboard() {
  const { COLORS } = useTheme();
  const { user } = useAuth();
  const s = getStyles(COLORS);
  const { data: ordersData, loading: oLoading } = useSWR('orders', () => getOrders());
  const { data: tallyData, loading: tLoading } = useSWR('tally', getTally);
  const orders = ordersData || { orders: [], stats: {} };
  const tally = tallyData || { transactions: [], reports: null };
  const loading = oLoading || tLoading;

  const oStats = orders.stats || {};
  const r = tally.reports;
  const name = user?.name?.split(' ')[0] || 'there';
  const openOrders = (oStats.byStatus?.pending || 0) + (oStats.byStatus?.processing || 0);

  // Merge recent orders + transactions into one activity feed.
  const activity = [
    ...orders.orders.slice(0, 8).map(o => ({ kind: 'order', id: o.id, title: o.customer?.name || 'Order', sub: `${o.orderNumber} · ${o.status}`, amount: o.dealAmount, t: new Date(o.createdAt).getTime(), pos: true })),
    ...tally.transactions.slice(0, 8).map(tx => ({ kind: 'txn', id: tx.id, title: tx.category, sub: `${tx.partyName || tx.account} · ${tx.type === 'in' ? 'received' : 'paid'}`, amount: tx.amount, t: new Date(tx.date).getTime(), pos: tx.type === 'in' })),
  ].sort((a, b) => b.t - a.t).slice(0, 7);

  const tiles = [
    { icon: 'wallet-outline', label: 'Net Cash', value: money(r?.summary?.net || 0), accent: '#89CEFF' },
    { icon: 'chart-line', label: 'Net Profit', value: money(r?.summary?.netProfit || 0), accent: (r?.summary?.netProfit || 0) >= 0 ? '#34D399' : '#F87171' },
    { icon: 'package-variant-closed', label: 'Open Orders', value: String(openOrders), accent: '#FFB86E' },
    { icon: 'cash-clock', label: 'Outstanding', value: money(oStats.outstanding || 0), accent: '#A78BFA' },
  ];

  const agents = [
    { name: 'Pulse', role: 'Orders', icon: 'pulse', color: '#34D399', href: '/bug/pulse', stat: `${oStats.total || 0} orders · ${oStats.byStatus?.pending || 0} pending` },
    { name: 'Tally', role: 'Accounts', icon: 'calculator-variant', color: '#FFB86E', href: '/bug/tally', stat: `${money(r?.summary?.totalIn || 0)} in · ${money(r?.summary?.totalOut || 0)} out` },
    { name: 'Bug', role: 'AI Chat', icon: 'robot-happy-outline', color: '#89CEFF', href: '/bug', stat: 'Ask anything · delegate work' },
  ];

  const actions = [
    { label: 'New Order', icon: 'plus-box-outline', color: '#34D399', href: '/bug/pulse/orders' },
    { label: 'Money In/Out', icon: 'swap-vertical', color: '#FFB86E', href: '/bug/tally/daybook' },
    { label: 'Ask Bug', icon: 'robot-happy-outline', color: '#89CEFF', href: '/bug' },
  ];

  return (
    <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
      {/* Greeting */}
      <Animated.View entering={FadeInDown.duration(260)}>
        <Text style={s.greeting}>{greeting()}, {name}.</Text>
        <Text style={s.greetSub}>{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} · here's your business at a glance.</Text>
      </Animated.View>

      {/* Quick actions */}
      <Animated.View entering={FadeInDown.duration(280).delay(60)} style={s.actionRow}>
        {actions.map(a => (
          <TouchableOpacity key={a.label} style={s.action} activeOpacity={0.85} onPress={() => router.push(a.href)}>
            <View style={[s.actionIcon, { backgroundColor: `${a.color}1A`, borderColor: `${a.color}55` }]}><MaterialCommunityIcons name={a.icon} size={20} color={a.color} /></View>
            <Text style={s.actionText}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </Animated.View>

      {/* KPI tiles */}
      {loading ? <SkeletonKpis count={4} /> : (
        <View style={s.tileRow}>
          {tiles.map((t, i) => (
            <Animated.View key={t.label} entering={FadeInDown.duration(300).delay(120 + i * 60)} style={[s.tile, { borderLeftColor: t.accent }]}>
              <MaterialCommunityIcons name={t.icon} size={72} color={t.accent} style={s.tileGhost} />
              <Text style={s.tileLabel}>{t.label}</Text>
              <Text style={s.tileValue}>{t.value}</Text>
            </Animated.View>
          ))}
        </View>
      )}

      {/* Agent cards */}
      <Text style={s.sectionTitle}>Your Agents</Text>
      <View style={s.agentRow}>
        {agents.map((a, i) => (
          <Animated.View key={a.name} entering={FadeInDown.duration(320).delay(360 + i * 70)} style={{ flexGrow: 1, flexBasis: 240, minWidth: 220 }}>
            <TouchableOpacity style={s.agentCard} activeOpacity={0.85} onPress={() => router.push(a.href)}>
              <View style={s.agentTop}>
                <View style={[s.agentIcon, { backgroundColor: `${a.color}1A`, borderColor: `${a.color}55` }]}><MaterialCommunityIcons name={a.icon} size={22} color={a.color} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.agentName}>{a.name}</Text>
                  <Text style={s.agentRole}>{a.role}</Text>
                </View>
                <MaterialCommunityIcons name="arrow-top-right" size={18} color={COLORS.onSurfaceVariant} />
              </View>
              <Text style={s.agentStat}>{a.stat}</Text>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>

      {/* Recent activity */}
      <Text style={s.sectionTitle}>Recent Activity</Text>
      <View style={s.card}>
        {loading ? Array.from({ length: 5 }).map((_, i) => (
          <View key={i} style={s.actRow}>
            <SkeletonBlock w={30} h={30} r={12} />
            <View style={{ flex: 1, gap: 6 }}><SkeletonBlock w={'55%'} h={12} /><SkeletonBlock w={'30%'} h={9} /></View>
            <SkeletonBlock w={50} h={12} />
          </View>
        )) : activity.length === 0 ? <Text style={s.muted}>Nothing yet — create an order or record a transaction.</Text> : activity.map((a, i) => (
          <Animated.View key={a.kind + a.id} entering={FadeIn.duration(220).delay(i * 40)} style={s.actRow}>
            <View style={[s.actIcon, { backgroundColor: a.kind === 'order' ? '#34D39915' : (a.pos ? '#34D39915' : '#F8717115') }]}>
              <MaterialCommunityIcons name={a.kind === 'order' ? 'package-variant' : (a.pos ? 'arrow-down' : 'arrow-up')} size={15} color={a.kind === 'order' ? '#34D399' : (a.pos ? '#34D399' : '#F87171')} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.actTitle} numberOfLines={1}>{a.title}</Text>
              <Text style={s.actSub} numberOfLines={1}>{a.sub}</Text>
            </View>
            <Text style={[s.actAmt, { color: a.kind === 'txn' && !a.pos ? '#F87171' : COLORS.onSurface }]}>{a.kind === 'txn' && !a.pos ? '-' : ''}{money(a.amount)}</Text>
          </Animated.View>
        ))}
      </View>
      <View style={{ height: 90 }} />
    </ScrollView>
  );
}

export default function MasterDashboardScreen() {
  return <SectionShell agent={BUG_AGENT} navItems={BUG_NAV} title="Bug · Dashboard"><Dashboard /></SectionShell>;
}

const getStyles = (COLORS) => StyleSheet.create({
  scroll: { padding: SPACING.lg, maxWidth: 960, width: '100%', alignSelf: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  greeting: { ...TYPOGRAPHY.headlineMd, fontSize: 26, color: COLORS.onSurface, fontWeight: '800' },
  greetSub: { ...TYPOGRAPHY.bodySm, color: COLORS.onSurfaceVariant, marginTop: 2, marginBottom: SPACING.lg },

  actionRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  action: { flex: 1, ...glass(COLORS), borderRadius: ROUNDED.lg, paddingVertical: SPACING.md, alignItems: 'center', gap: 6 },
  actionIcon: { width: 38, height: 38, borderRadius: ROUNDED.md, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  actionText: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurface, fontWeight: '600' },

  tileRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.lg },
  tile: { flexGrow: 1, flexBasis: 150, minWidth: 140, ...glass(COLORS), borderLeftWidth: 4, borderRadius: ROUNDED.xl, padding: SPACING.md, overflow: 'hidden' },
  tileGhost: { position: 'absolute', right: -12, top: -10, opacity: 0.06 },
  tileLabel: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.4 },
  tileValue: { fontSize: 28, fontWeight: '800', color: COLORS.onSurface, marginTop: 4 },

  sectionTitle: { ...TYPOGRAPHY.labelLg, color: COLORS.onSurface, fontWeight: '800', marginBottom: SPACING.sm, marginTop: SPACING.xs },
  agentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.lg },
  agentCard: { ...glass(COLORS), borderRadius: ROUNDED.xl, padding: SPACING.md, gap: SPACING.sm },
  agentTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  agentIcon: { width: 40, height: 40, borderRadius: ROUNDED.lg, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  agentName: { ...TYPOGRAPHY.labelLg, color: COLORS.onSurface, fontWeight: '800' },
  agentRole: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.4 },
  agentStat: { ...TYPOGRAPHY.bodySm, color: COLORS.onSurfaceVariant },

  card: { ...glass(COLORS), borderRadius: ROUNDED.xl, padding: SPACING.md },
  muted: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurfaceVariant, fontStyle: 'italic' },
  actRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: `${COLORS.outlineVariant}55` },
  actIcon: { width: 30, height: 30, borderRadius: ROUNDED.md, justifyContent: 'center', alignItems: 'center' },
  actTitle: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurface, fontWeight: '600' },
  actSub: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant, textTransform: 'capitalize' },
  actAmt: { ...TYPOGRAPHY.labelMd, fontWeight: '800' },
});
