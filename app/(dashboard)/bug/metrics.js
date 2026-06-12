import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';
import { TYPOGRAPHY, SPACING, ROUNDED } from '@/constants';
import DashboardShell from '@/components/layout/DashboardShell';
import { getFreeModels, getSelectedModels, saveSelectedModels, getUsage } from '@/client/api';
import { isBugId } from '@/server/lib/bugModel';

const MAX_MODELS = 5;

function Bar({ pct, color, styles }) {
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${Math.min(Math.max(pct, 0), 100)}%`, backgroundColor: color }]} />
    </View>
  );
}

const money = (v) => (v === null || v === undefined ? null : `$${Number(v).toFixed(Number(v) < 1 ? 4 : 2)}`);

function MetricsBody() {
  const { COLORS } = useTheme();
  const styles = getStyles(COLORS);

  const [allModels, setAllModels] = useState([]);
  const [selected, setSelected] = useState([]);
  const [usage, setUsage] = useState({ counts: {}, totalToday: 0, resetAt: null, openrouter: null });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [limitMsg, setLimitMsg] = useState('');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    loadAll();
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [models, sel, use] = await Promise.all([
        getFreeModels().catch(() => []),
        getSelectedModels().catch(() => []),
        getUsage().catch(() => ({ counts: {}, totalToday: 0, resetAt: null, openrouter: null })),
      ]);
      setAllModels(models);
      setSelected(sel);
      setUsage(use);
      setError('');
    } catch (e) {
      setError(e.message || 'Failed to load metrics');
    } finally {
      setLoading(false);
    }
  };

  const selectedIds = useMemo(() => new Set(selected.map((m) => m.id)), [selected]);
  // Bug is always present and doesn't count toward the 5-model pick limit.
  const userPicks = useMemo(() => selected.filter((m) => !isBugId(m.id)), [selected]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? allModels.filter((m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q))
      : allModels;
    return list.slice(0, 60);
  }, [allModels, search]);

  const persist = async (next) => {
    setSelected(next);
    setSaving(true);
    try {
      await saveSelectedModels(next);
    } catch (e) {
      setError(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const toggleModel = (model) => {
    if (isBugId(model.id)) return; // Bug is locked — it can't be removed.
    setLimitMsg('');
    if (selectedIds.has(model.id)) {
      persist(selected.filter((m) => m.id !== model.id)); // deselect always allowed
    } else if (userPicks.length < MAX_MODELS) {
      persist([...selected, { id: model.id, name: model.name }]);
    } else {
      setLimitMsg('You can pick up to 5 models — remove one to add another.');
      setTimeout(() => setLimitMsg(''), 2600);
    }
  };

  // Reset countdown
  const resetMs = usage.resetAt ? new Date(usage.resetAt).getTime() - now : 0;
  const resetH = Math.max(0, Math.floor(resetMs / 3600000));
  const resetM = Math.max(0, Math.floor((resetMs % 3600000) / 60000));

  const or = usage.openrouter;
  const maxCount = Math.max(1, ...selected.map((m) => usage.counts?.[m.id] || 0));

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Text style={styles.pageTitle}>System Metrics</Text>
      <Text style={styles.pageSubtitle}>Pick your chat models and monitor live usage.</Text>

      {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

      {/* Active models */}
      <Animated.View entering={FadeInDown.duration(260)} style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>Active Chat Models</Text>
          <Text style={styles.counter}>{userPicks.length}/{MAX_MODELS}{saving ? ' · saving…' : ''}</Text>
        </View>
        <Text style={styles.cardHint}>Bug is always on and auto-picks the best model. Add up to 5 more — these appear in the chat picker.</Text>
        <View style={styles.chipWrap}>
          {selected.map((m) => {
            const locked = isBugId(m.id) || m.locked;
            return (
              <View key={m.id} style={[styles.chip, locked && styles.chipLocked]}>
                {locked && <MaterialCommunityIcons name="bug" size={13} color={COLORS.primary} />}
                <Text style={styles.chipText} numberOfLines={1}>{m.name}</Text>
                {locked ? (
                  <MaterialCommunityIcons name="lock" size={12} color={COLORS.primary} />
                ) : (
                  <TouchableOpacity onPress={() => toggleModel(m)} hitSlop={6}>
                    <MaterialCommunityIcons name="close" size={14} color={COLORS.primary} />
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      </Animated.View>

      {/* Search + add models */}
      <Animated.View entering={FadeInDown.duration(300)} style={styles.card}>
        <Text style={styles.cardTitle}>All Free OpenRouter Models</Text>
        <View style={styles.searchRow}>
          <MaterialCommunityIcons name="magnify" size={18} color={COLORS.onSurfaceVariant} />
          <TextInput
            style={[styles.searchInput, Platform.OS === 'web' && { outlineStyle: 'none' }]}
            placeholder="Search models…"
            placeholderTextColor={COLORS.onSurfaceVariant}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={6}>
              <MaterialCommunityIcons name="close-circle" size={18} color={COLORS.onSurfaceVariant} />
            </TouchableOpacity>
          ) : null}
        </View>

        {limitMsg ? <Text style={styles.limitMsg}>{limitMsg}</Text> : null}

        {filtered.length === 0 ? (
          <Text style={styles.muted}>No models match “{search}”.</Text>
        ) : (
          filtered.map((m) => {
            const active = selectedIds.has(m.id);
            return (
              <TouchableOpacity
                key={m.id}
                style={[styles.modelRow, active && styles.modelRowActive]}
                onPress={() => toggleModel(m)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.modelName} numberOfLines={1}>{m.name}</Text>
                  <Text style={styles.modelId} numberOfLines={1}>{m.id}</Text>
                </View>
                <MaterialCommunityIcons
                  name={active ? 'check-circle' : 'plus-circle-outline'}
                  size={22}
                  color={active ? COLORS.primary : COLORS.onSurfaceVariant}
                />
              </TouchableOpacity>
            );
          })
        )}
      </Animated.View>

      {/* OpenRouter live account usage */}
      <Animated.View entering={FadeInDown.duration(330)} style={styles.card}>
        <Text style={styles.cardTitle}>OpenRouter Account (live)</Text>
        {!or ? (
          <Text style={styles.muted}>Connect an OpenRouter key in Setup to see live usage and limits.</Text>
        ) : or.error ? (
          <Text style={styles.muted}>Couldn’t load live data: {or.error}</Text>
        ) : (
          <>
            <View style={styles.kvRow}>
              <Text style={styles.kvKey}>Tier</Text>
              <View style={[styles.tierBadge, !or.isFreeTier && styles.tierBadgePaid]}>
                <Text style={[styles.tierText, !or.isFreeTier && styles.tierTextPaid]}>{or.isFreeTier ? 'Free' : 'Paid'}</Text>
              </View>
            </View>
            <View style={styles.kvRow}><Text style={styles.kvKey}>Credits used</Text><Text style={styles.kvVal}>{money(or.usage) ?? '—'}</Text></View>
            <View style={styles.kvRow}><Text style={styles.kvKey}>Credit limit</Text><Text style={styles.kvVal}>{or.limit === null ? 'Unlimited' : money(or.limit)}</Text></View>
            <View style={styles.kvRow}><Text style={styles.kvKey}>Remaining</Text><Text style={styles.kvVal}>{or.limitRemaining === null ? '—' : money(or.limitRemaining)}</Text></View>
            <View style={styles.kvRow}><Text style={styles.kvKey}>Rate limit</Text><Text style={styles.kvVal}>{or.rateLimit ? `${or.rateLimit.requests} req / ${or.rateLimit.interval}` : '—'}</Text></View>
            {or.limit !== null && or.usage !== null && (
              <View style={{ marginTop: SPACING.sm }}>
                <Bar pct={(or.usage / or.limit) * 100} color={COLORS.primary} styles={styles} />
              </View>
            )}
          </>
        )}
      </Animated.View>

      {/* Per-model request volume (self-tracked) */}
      <Animated.View entering={FadeInDown.duration(360)} style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>Requests Today by Model</Text>
          <View style={styles.resetPill}>
            <MaterialCommunityIcons name="clock-outline" size={13} color={COLORS.onSurfaceVariant} />
            <Text style={styles.resetText}>Resets in {resetH}h {resetM}m</Text>
          </View>
        </View>
        <Text style={styles.cardHint}>{usage.totalToday || 0} requests today · bars show relative volume per model.</Text>

        {selected.length === 0 ? (
          <Text style={styles.muted}>Select models to track their usage.</Text>
        ) : (
          selected.map((m) => {
            const used = usage.counts?.[m.id] || 0;
            return (
              <View key={m.id} style={styles.usageRow}>
                <View style={styles.usageHeader}>
                  <Text style={styles.usageName} numberOfLines={1}>{m.name}</Text>
                  <Text style={styles.usageCount}>{used}</Text>
                </View>
                <Bar pct={(used / maxCount) * 100} color={COLORS.primary} styles={styles} />
              </View>
            );
          })
        )}
      </Animated.View>
    </ScrollView>
  );
}

export default function SystemMetricsScreen() {
  return (
    <DashboardShell title="System Metrics">
      <MetricsBody />
    </DashboardShell>
  );
}

const getStyles = (COLORS) => StyleSheet.create({
  scroll: { padding: SPACING.lg, maxWidth: 760, width: '100%', alignSelf: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: SPACING.xl * 2 },
  pageTitle: { ...TYPOGRAPHY.headlineMd, color: COLORS.onSurface, fontWeight: '800' },
  pageSubtitle: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurfaceVariant, marginTop: 2, marginBottom: SPACING.lg },
  errorBanner: { ...TYPOGRAPHY.bodySm, color: COLORS.error, marginBottom: SPACING.md },

  card: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderWidth: 1, borderColor: COLORS.outlineVariant,
    borderRadius: ROUNDED.xl, padding: SPACING.lg, marginBottom: SPACING.lg,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { ...TYPOGRAPHY.labelLg, color: COLORS.onSurface, fontWeight: '700' },
  cardHint: { ...TYPOGRAPHY.bodySm, color: COLORS.onSurfaceVariant, marginTop: 2, marginBottom: SPACING.md },
  counter: { ...TYPOGRAPHY.labelMd, color: COLORS.primary, fontWeight: '700' },
  muted: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurfaceVariant, fontStyle: 'italic', marginTop: SPACING.xs },
  limitMsg: { ...TYPOGRAPHY.labelMd, color: '#F59E0B', marginBottom: SPACING.sm },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.xs },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: `${COLORS.primary}1A`, borderWidth: 1, borderColor: `${COLORS.primary}40`,
    paddingHorizontal: SPACING.md, paddingVertical: 7, borderRadius: ROUNDED.full, maxWidth: 220,
  },
  chipLocked: { backgroundColor: `${COLORS.primary}26`, borderColor: `${COLORS.primary}66` },
  chipText: { ...TYPOGRAPHY.labelMd, color: COLORS.primary, fontWeight: '600', flexShrink: 1 },

  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1, borderColor: COLORS.outlineVariant, borderRadius: ROUNDED.default,
    paddingHorizontal: SPACING.md, marginBottom: SPACING.md,
  },
  searchInput: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurface, flex: 1, paddingVertical: 10 },

  modelRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.sm,
    borderRadius: ROUNDED.md, borderWidth: 1, borderColor: 'transparent',
  },
  modelRowActive: { backgroundColor: `${COLORS.primary}12`, borderColor: `${COLORS.primary}33` },
  modelName: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurface, fontWeight: '600' },
  modelId: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined },

  kvRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  kvKey: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurfaceVariant },
  kvVal: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurface, fontWeight: '700' },
  tierBadge: { backgroundColor: COLORS.surfaceContainerHighest, paddingHorizontal: 10, paddingVertical: 3, borderRadius: ROUNDED.full },
  tierBadgePaid: { backgroundColor: `${COLORS.primary}1A` },
  tierText: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant, fontWeight: '700' },
  tierTextPaid: { color: COLORS.primary },

  resetPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.surfaceContainerHighest, paddingHorizontal: SPACING.sm, paddingVertical: 4,
    borderRadius: ROUNDED.full,
  },
  resetText: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant },

  usageRow: { marginTop: SPACING.md },
  usageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  usageName: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurface, fontWeight: '600', flex: 1 },
  usageCount: { ...TYPOGRAPHY.labelMd, color: COLORS.onSurfaceVariant, fontWeight: '700' },
  barTrack: { height: 8, borderRadius: ROUNDED.full, backgroundColor: COLORS.surfaceContainerHighest, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: ROUNDED.full },
});
