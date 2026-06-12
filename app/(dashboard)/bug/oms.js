import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';
import { TYPOGRAPHY, SPACING, ROUNDED } from '@/constants';
import DashboardShell from '@/components/layout/DashboardShell';
import { getOrders, createOrder, updateOrder, deleteOrder } from '@/client/api';

// Status identity mirrors the Stitch Pulse OMS palette.
const STATUS_META = {
  pending:    { label: 'Pending',    color: '#FFB86E', icon: 'clock-outline' },
  processing: { label: 'Processing', color: '#89CEFF', icon: 'progress-wrench' },
  shipped:    { label: 'Shipped',    color: '#34D399', icon: 'truck-fast-outline' },
  delivered:  { label: 'Delivered',  color: '#10B981', icon: 'check-circle-outline' },
  cancelled:  { label: 'Cancelled',  color: '#F87171', icon: 'close-circle-outline' },
};
const STATUS_ORDER = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
const PIPELINE = ['pending', 'processing', 'shipped', 'delivered']; // Kanban columns
const PRIORITY_META = {
  low:    { label: 'Low',    color: '#94A3B8' },
  normal: { label: 'Normal', color: '#89CEFF' },
  high:   { label: 'High',   color: '#F87171' },
};
const CHANNELS = ['Direct Web', 'Mobile App', 'API Integration', 'Phone', 'In-Store'];

const money = (v) => {
  const n = Number(v) || 0;
  if (n >= 1000) return `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `$${n.toFixed(2)}`;
};
const moneyFull = (v) => `$${(Number(v) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateLabel = (v) => {
  const d = v?.toDate ? v.toDate() : new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};
const nextStatus = (s) => {
  const i = PIPELINE.indexOf(s);
  return i >= 0 && i < PIPELINE.length - 1 ? PIPELINE[i + 1] : null;
};

const emptyForm = () => ({
  customer: { name: '', email: '', phone: '' },
  items: [{ name: '', qty: '1', price: '' }],
  status: 'pending',
  priority: 'normal',
  channel: 'Direct Web',
  notes: '',
});

function StatusPill({ status, styles }) {
  const m = STATUS_META[status] || STATUS_META.pending;
  return (
    <View style={[styles.pill, { backgroundColor: `${m.color}1A`, borderColor: `${m.color}40` }]}>
      <View style={[styles.pillDot, { backgroundColor: m.color }]} />
      <Text style={[styles.pillText, { color: m.color }]}>{m.label}</Text>
    </View>
  );
}

// KPI bento card: accent left border, big number, giant faded corner icon, trend.
function KpiCard({ icon, label, value, accent, footer, footerColor, styles, COLORS }) {
  return (
    <View style={[styles.kpiCard, { borderLeftColor: accent }]}>
      <MaterialCommunityIcons name={icon} size={86} color={accent} style={styles.kpiGhost} />
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={[styles.kpiValue, accent !== COLORS.onSurface && label === 'Pending' && { color: accent }]}>{value}</Text>
      {footer ? <Text style={[styles.kpiFooter, { color: footerColor || COLORS.onSurfaceVariant }]}>{footer}</Text> : null}
    </View>
  );
}

function OmsBody() {
  const { COLORS } = useTheme();
  const styles = getStyles(COLORS);

  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({ total: 0, byStatus: {}, revenue: 0, openValue: 0, todayCount: 0, last7: 0, trend: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async (status = filter, q = search) => {
    try {
      setLoading(true);
      const data = await getOrders({ status: status === 'all' ? undefined : status, q });
      setOrders(data.orders || []);
      setStats(data.stats || {});
      setError('');
    } catch (e) {
      setError(e.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => { load('all', ''); }, []); // initial
  useEffect(() => {
    const t = setTimeout(() => load(filter, search), 220);
    return () => clearTimeout(t);
  }, [filter, search]); // eslint-disable-line react-hooks/exhaustive-deps

  // All orders (unfiltered) drive the Kanban board; the table uses the filtered set.
  const [allOrders, setAllOrders] = useState([]);
  useEffect(() => { getOrders().then(d => setAllOrders(d.orders || [])).catch(() => {}); }, [orders]);

  const formTotal = useMemo(
    () => form.items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0),
    [form.items]
  );

  const openCreate = () => { setEditingId(null); setForm(emptyForm()); setFormError(''); setModalOpen(true); };
  const openEdit = (o) => {
    setEditingId(o.id);
    setForm({
      customer: { name: o.customer?.name || '', email: o.customer?.email || '', phone: o.customer?.phone || '' },
      items: (o.items?.length ? o.items : [{ name: '', qty: 1, price: 0 }]).map(it => ({
        name: it.name || '', qty: String(it.qty ?? 1), price: String(it.price ?? ''),
      })),
      status: o.status, priority: o.priority, channel: o.channel || 'Direct Web', notes: o.notes || '',
    });
    setFormError(''); setModalOpen(true);
  };
  const setItem = (i, k, v) => setForm(f => ({ ...f, items: f.items.map((it, idx) => idx === i ? { ...it, [k]: v } : it) }));
  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { name: '', qty: '1', price: '' }] }));
  const removeItem = (i) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));

  const submit = async () => {
    if (!form.customer.name.trim()) { setFormError('Customer name is required.'); return; }
    setSaving(true); setFormError('');
    const payload = {
      customer: form.customer,
      items: form.items.filter(it => it.name.trim()).map(it => ({ name: it.name.trim(), qty: Number(it.qty) || 1, price: Number(it.price) || 0 })),
      status: form.status, priority: form.priority, channel: form.channel, notes: form.notes,
    };
    try {
      if (editingId) await updateOrder(editingId, payload);
      else await createOrder(payload);
      setModalOpen(false);
      await load();
    } catch (e) { setFormError(e.message || 'Failed to save order'); }
    finally { setSaving(false); }
  };

  const advance = async (o) => {
    const ns = nextStatus(o.status);
    if (!ns) return;
    setAllOrders(prev => prev.map(x => x.id === o.id ? { ...x, status: ns } : x));
    try { await updateOrder(o.id, { status: ns }); await load(); } catch { await load(); }
  };
  const remove = async (o) => {
    setOrders(prev => prev.filter(x => x.id !== o.id));
    try { await deleteOrder(o.id); await load(); } catch { await load(); }
  };

  const tabs = [
    { key: 'all', label: 'All', count: stats.total },
    ...STATUS_ORDER.map(s => ({ key: s, label: STATUS_META[s].label, count: stats.byStatus?.[s] || 0 })),
  ];
  const trendUp = (stats.trend || 0) >= 0;
  const pendingCount = stats.byStatus?.pending || 0;

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      {/* Pulse agent identity */}
      <Animated.View entering={FadeInDown.duration(240)} style={styles.agentBanner}>
        <View style={styles.agentAvatar}>
          <MaterialCommunityIcons name="pulse" size={22} color={COLORS.onPrimary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.agentName}>Pulse OMS · Operational Manager</Text>
          <Text style={styles.agentSub}>
            {pendingCount > 0 ? `${pendingCount} order${pendingCount > 1 ? 's' : ''} awaiting fulfillment · reporting to Bug` : 'Pipeline clear · reporting to Bug'}
          </Text>
        </View>
        <TouchableOpacity style={styles.newBtn} onPress={openCreate} activeOpacity={0.85}>
          <MaterialCommunityIcons name="plus" size={18} color={COLORS.onPrimary} />
          <Text style={styles.newBtnText}>New Order</Text>
        </TouchableOpacity>
      </Animated.View>

      {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

      {/* KPI bento cards */}
      <View style={styles.kpiRow}>
        <KpiCard
          icon="cart-variant" label="Total Orders" value={String(stats.total || 0)} accent="#89CEFF"
          footer={`${trendUp ? '+' : ''}${stats.trend || 0}% vs last week`} footerColor={trendUp ? '#34D399' : '#F87171'}
          styles={styles} COLORS={COLORS}
        />
        <KpiCard
          icon="progress-clock" label="Pending" value={String(pendingCount)} accent="#FFB86E"
          footer={pendingCount > 0 ? 'needs fulfillment' : 'all clear'} footerColor="#FFB86E"
          styles={styles} COLORS={COLORS}
        />
        <KpiCard
          icon="cash-multiple" label="Revenue" value={money(stats.revenue)} accent="#10B981"
          footer={`${money(stats.openValue)} in pipeline`} footerColor="#10B981"
          styles={styles} COLORS={COLORS}
        />
      </View>

      {/* Fulfillment Pipeline (Kanban) */}
      <View style={styles.sectionHead}>
        <MaterialCommunityIcons name="view-column-outline" size={20} color={COLORS.primary} />
        <Text style={styles.sectionTitle}>Fulfillment Pipeline</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kanbanRow}>
        {PIPELINE.map(st => {
          const m = STATUS_META[st];
          const col = allOrders.filter(o => o.status === st);
          return (
            <View key={st} style={styles.kanbanCol}>
              <View style={styles.kanbanHead}>
                <View style={[styles.kanbanDot, { backgroundColor: m.color }]} />
                <Text style={styles.kanbanLabel}>{m.label}</Text>
                <Text style={styles.kanbanCount}>{col.length}</Text>
              </View>
              {col.length === 0 ? (
                <View style={styles.kanbanEmpty}><Text style={styles.kanbanEmptyText}>No orders</Text></View>
              ) : col.slice(0, 12).map(o => {
                const ns = nextStatus(o.status);
                return (
                  <TouchableOpacity key={o.id} style={[styles.kanbanCard, { borderLeftColor: m.color }]} activeOpacity={0.85} onPress={() => openEdit(o)}>
                    <View style={styles.kanbanCardTop}>
                      <View style={[styles.orderTag, { backgroundColor: `${m.color}1A`, borderColor: `${m.color}33` }]}>
                        <Text style={[styles.orderTagText, { color: m.color }]}>{o.orderNumber}</Text>
                      </View>
                      {o.priority === 'high' && <MaterialCommunityIcons name="star" size={13} color="#FFB86E" />}
                    </View>
                    <Text style={styles.kanbanCardName} numberOfLines={1}>{o.customer?.name}</Text>
                    <Text style={styles.kanbanCardItem} numberOfLines={1}>
                      {o.items?.[0]?.name || 'No items'}{o.items?.length > 1 ? ` +${o.items.length - 1}` : ''}
                    </Text>
                    <View style={styles.kanbanCardFoot}>
                      <Text style={styles.kanbanCardTotal}>{moneyFull(o.total)}</Text>
                      {ns && (
                        <TouchableOpacity style={styles.advanceBtn} onPress={() => advance(o)} hitSlop={6}>
                          <MaterialCommunityIcons name="arrow-right-circle" size={20} color={STATUS_META[ns].color} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}
      </ScrollView>

      {/* Recent Transaction Logs */}
      <View style={styles.tableCard}>
        <View style={styles.tableHeader}>
          <Text style={styles.sectionTitle}>Recent Transaction Logs</Text>
          <View style={styles.searchRow}>
            <MaterialCommunityIcons name="magnify" size={16} color={COLORS.onSurfaceVariant} />
            <TextInput
              style={[styles.searchInput, Platform.OS === 'web' && { outlineStyle: 'none' }]}
              placeholder="Search orders…"
              placeholderTextColor={COLORS.onSurfaceVariant}
              value={search} onChangeText={setSearch} autoCapitalize="none"
            />
            {search ? <TouchableOpacity onPress={() => setSearch('')} hitSlop={6}><MaterialCommunityIcons name="close-circle" size={16} color={COLORS.onSurfaceVariant} /></TouchableOpacity> : null}
          </View>
        </View>

        {/* Filter tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
          {tabs.map(t => {
            const active = filter === t.key;
            return (
              <TouchableOpacity key={t.key} style={[styles.tab, active && styles.tabActive]} onPress={() => setFilter(t.key)} activeOpacity={0.8}>
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
                <Text style={[styles.tabCount, active && styles.tabCountActive]}>{t.count}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
        ) : orders.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="package-variant" size={38} color={COLORS.onSurfaceVariant} />
            <Text style={styles.emptyTitle}>No orders {filter !== 'all' ? `in ${STATUS_META[filter]?.label}` : 'yet'}</Text>
            <Text style={styles.emptySub}>Tap “New Order” to let Pulse start tracking.</Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              {/* Table header row */}
              <View style={[styles.trow, styles.theadRow]}>
                <Text style={[styles.th, { width: 104 }]}>Order ID</Text>
                <Text style={[styles.th, { width: 190 }]}>Customer</Text>
                <Text style={[styles.th, { width: 120 }]}>Status</Text>
                <Text style={[styles.th, { width: 120 }]}>Channel</Text>
                <Text style={[styles.th, { width: 96, textAlign: 'right' }]}>Amount</Text>
                <Text style={[styles.th, { width: 84, textAlign: 'right' }]}>Actions</Text>
              </View>
              {orders.map((o, idx) => (
                <Animated.View key={o.id} entering={FadeIn.duration(180).delay(Math.min(idx, 10) * 20)} style={styles.trow}>
                  <Text style={[styles.tdOrder, { width: 104 }]} numberOfLines={1}>{o.orderNumber}</Text>
                  <View style={{ width: 190 }}>
                    <Text style={styles.tdName} numberOfLines={1}>{o.customer?.name}</Text>
                    {!!o.customer?.email && <Text style={styles.tdSub} numberOfLines={1}>{o.customer.email}</Text>}
                  </View>
                  <View style={{ width: 120 }}><StatusPill status={o.status} styles={styles} /></View>
                  <Text style={[styles.tdMuted, { width: 120 }]} numberOfLines={1}>{o.channel}</Text>
                  <Text style={[styles.tdAmount, { width: 96, textAlign: 'right' }]}>{moneyFull(o.total)}</Text>
                  <View style={[styles.tdActions, { width: 84 }]}>
                    <TouchableOpacity onPress={() => openEdit(o)} hitSlop={6}><MaterialCommunityIcons name="eye-outline" size={18} color={COLORS.onSurfaceVariant} /></TouchableOpacity>
                    <TouchableOpacity onPress={() => remove(o)} hitSlop={6}><MaterialCommunityIcons name="trash-can-outline" size={17} color={COLORS.error} /></TouchableOpacity>
                  </View>
                </Animated.View>
              ))}
            </View>
          </ScrollView>
        )}
        {!loading && orders.length > 0 && (
          <Text style={styles.tableFoot}>Showing {orders.length} of {stats.total} orders</Text>
        )}
      </View>

      <View style={{ height: 80 }} />

      {/* Floating Marshal assistant (routes to Bug chat) */}
      <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={() => router.push('/bug')}>
        <MaterialCommunityIcons name="robot-happy-outline" size={24} color={COLORS.onPrimary} />
        {pendingCount > 0 && (
          <View style={styles.fabBadge}><Text style={styles.fabBadgeText}>{pendingCount > 9 ? '9+' : pendingCount}</Text></View>
        )}
      </TouchableOpacity>

      <OrderForm
        visible={modalOpen} onClose={() => setModalOpen(false)}
        form={form} setForm={setForm} setItem={setItem} addItem={addItem} removeItem={removeItem}
        formTotal={formTotal} onSubmit={submit} saving={saving} editing={!!editingId} formError={formError}
        styles={styles} COLORS={COLORS}
      />
    </ScrollView>
  );
}

function OrderForm({ visible, onClose, form, setForm, setItem, addItem, removeItem, formTotal, onSubmit, saving, editing, formError, styles, COLORS }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editing ? 'Edit Order' : 'New Order'}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}><MaterialCommunityIcons name="close" size={22} color={COLORS.onSurfaceVariant} /></TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ maxHeight: 460 }}>
            <Text style={styles.fieldLabel}>Customer</Text>
            <TextInput style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' }]} placeholder="Customer name *" placeholderTextColor={COLORS.onSurfaceVariant}
              value={form.customer.name} onChangeText={(t) => setForm(f => ({ ...f, customer: { ...f.customer, name: t } }))} />
            <View style={styles.row2}>
              <TextInput style={[styles.input, { flex: 1 }, Platform.OS === 'web' && { outlineStyle: 'none' }]} placeholder="Email" placeholderTextColor={COLORS.onSurfaceVariant}
                value={form.customer.email} onChangeText={(t) => setForm(f => ({ ...f, customer: { ...f.customer, email: t } }))} autoCapitalize="none" keyboardType="email-address" />
              <TextInput style={[styles.input, { flex: 1 }, Platform.OS === 'web' && { outlineStyle: 'none' }]} placeholder="Phone" placeholderTextColor={COLORS.onSurfaceVariant}
                value={form.customer.phone} onChangeText={(t) => setForm(f => ({ ...f, customer: { ...f.customer, phone: t } }))} keyboardType="phone-pad" />
            </View>

            <View style={styles.itemsHeader}>
              <Text style={styles.fieldLabel}>Items</Text>
              <TouchableOpacity style={styles.addItemBtn} onPress={addItem}><MaterialCommunityIcons name="plus" size={14} color={COLORS.primary} /><Text style={styles.addItemText}>Add item</Text></TouchableOpacity>
            </View>
            {form.items.map((it, i) => (
              <View key={i} style={styles.itemRow}>
                <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }, Platform.OS === 'web' && { outlineStyle: 'none' }]} placeholder="Item name" placeholderTextColor={COLORS.onSurfaceVariant} value={it.name} onChangeText={(t) => setItem(i, 'name', t)} />
                <TextInput style={[styles.input, styles.qtyInput, Platform.OS === 'web' && { outlineStyle: 'none' }]} placeholder="Qty" placeholderTextColor={COLORS.onSurfaceVariant} value={String(it.qty)} onChangeText={(t) => setItem(i, 'qty', t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" />
                <TextInput style={[styles.input, styles.priceInput, Platform.OS === 'web' && { outlineStyle: 'none' }]} placeholder="Price" placeholderTextColor={COLORS.onSurfaceVariant} value={String(it.price)} onChangeText={(t) => setItem(i, 'price', t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" />
                {form.items.length > 1 && <TouchableOpacity onPress={() => removeItem(i)} hitSlop={6}><MaterialCommunityIcons name="close-circle" size={18} color={COLORS.onSurfaceVariant} /></TouchableOpacity>}
              </View>
            ))}
            <View style={styles.totalRow}><Text style={styles.totalLabel}>Total</Text><Text style={styles.totalValue}>{moneyFull(formTotal)}</Text></View>

            <Text style={styles.fieldLabel}>Status</Text>
            <View style={styles.chipRow}>
              {STATUS_ORDER.map(s => {
                const m = STATUS_META[s]; const on = form.status === s;
                return <TouchableOpacity key={s} style={[styles.choiceChip, on && { backgroundColor: `${m.color}22`, borderColor: m.color }]} onPress={() => setForm(f => ({ ...f, status: s }))}><Text style={[styles.choiceText, on && { color: m.color }]}>{m.label}</Text></TouchableOpacity>;
              })}
            </View>

            <Text style={styles.fieldLabel}>Channel</Text>
            <View style={styles.chipRow}>
              {CHANNELS.map(c => {
                const on = form.channel === c;
                return <TouchableOpacity key={c} style={[styles.choiceChip, on && { backgroundColor: `${COLORS.primary}22`, borderColor: COLORS.primary }]} onPress={() => setForm(f => ({ ...f, channel: c }))}><Text style={[styles.choiceText, on && { color: COLORS.primary }]}>{c}</Text></TouchableOpacity>;
              })}
            </View>

            <Text style={styles.fieldLabel}>Priority</Text>
            <View style={styles.chipRow}>
              {Object.keys(PRIORITY_META).map(p => {
                const m = PRIORITY_META[p]; const on = form.priority === p;
                return <TouchableOpacity key={p} style={[styles.choiceChip, on && { backgroundColor: `${m.color}22`, borderColor: m.color }]} onPress={() => setForm(f => ({ ...f, priority: p }))}><Text style={[styles.choiceText, on && { color: m.color }]}>{m.label}</Text></TouchableOpacity>;
              })}
            </View>

            <Text style={styles.fieldLabel}>Notes</Text>
            <TextInput style={[styles.input, { height: 64, textAlignVertical: 'top' }, Platform.OS === 'web' && { outlineStyle: 'none' }]} placeholder="Internal notes (optional)" placeholderTextColor={COLORS.onSurfaceVariant} value={form.notes} onChangeText={(t) => setForm(f => ({ ...f, notes: t }))} multiline />
            {formError ? <Text style={styles.formError}>{formError}</Text> : null}
          </ScrollView>
          <TouchableOpacity style={[styles.submitBtn, saving && { opacity: 0.6 }]} onPress={onSubmit} disabled={saving}>
            {saving ? <ActivityIndicator size="small" color={COLORS.onPrimary} /> : <><MaterialCommunityIcons name={editing ? 'content-save-outline' : 'plus'} size={18} color={COLORS.onPrimary} /><Text style={styles.submitText}>{editing ? 'Save Changes' : 'Create Order'}</Text></>}
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

export default function PulseOmsScreen() {
  return (
    <DashboardShell title="Pulse · OMS">
      <OmsBody />
    </DashboardShell>
  );
}

const glass = (COLORS) => ({
  backgroundColor: COLORS.surfaceContainerLow,
  borderWidth: 1,
  borderColor: COLORS.outlineVariant,
  ...(Platform.OS === 'web' ? { backdropFilter: 'blur(12px)' } : {}),
});

const getStyles = (COLORS) => StyleSheet.create({
  scroll: { padding: SPACING.lg, maxWidth: 980, width: '100%', alignSelf: 'center' },
  center: { paddingVertical: SPACING.xl * 1.5, alignItems: 'center' },
  errorBanner: { ...TYPOGRAPHY.bodySm, color: COLORS.error, marginBottom: SPACING.md },

  agentBanner: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, ...glass(COLORS), borderRadius: ROUNDED.xl, padding: SPACING.md, marginBottom: SPACING.lg },
  agentAvatar: { width: 44, height: 44, borderRadius: ROUNDED.lg, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  agentName: { ...TYPOGRAPHY.labelLg, color: COLORS.onSurface, fontWeight: '800' },
  agentSub: { ...TYPOGRAPHY.bodySm, color: COLORS.onSurfaceVariant, marginTop: 1 },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.primary, paddingHorizontal: SPACING.md, paddingVertical: 9, borderRadius: ROUNDED.full },
  newBtnText: { ...TYPOGRAPHY.labelMd, color: COLORS.onPrimary, fontWeight: '700' },

  // KPI bento
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, marginBottom: SPACING.lg },
  kpiCard: { flexGrow: 1, flexBasis: 200, minWidth: 180, ...glass(COLORS), borderLeftWidth: 4, borderRadius: ROUNDED.xl, padding: SPACING.lg, overflow: 'hidden' },
  kpiGhost: { position: 'absolute', right: -14, top: -14, opacity: 0.06 },
  kpiLabel: { ...TYPOGRAPHY.labelMd, color: COLORS.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600' },
  kpiValue: { fontSize: 38, lineHeight: 44, fontWeight: '800', color: COLORS.onSurface, marginTop: SPACING.xs },
  kpiFooter: { ...TYPOGRAPHY.labelSm, fontWeight: '700', marginTop: SPACING.sm },

  // Section headers
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md, marginTop: SPACING.xs },
  sectionTitle: { ...TYPOGRAPHY.headlineMd, fontSize: 18, color: COLORS.onSurface, fontWeight: '800' },

  // Kanban
  kanbanRow: { gap: SPACING.md, paddingBottom: SPACING.sm },
  kanbanCol: { width: 240 },
  kanbanHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: 2, marginBottom: SPACING.sm },
  kanbanDot: { width: 8, height: 8, borderRadius: 4 },
  kanbanLabel: { ...TYPOGRAPHY.labelMd, color: COLORS.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '700', flex: 1 },
  kanbanCount: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant, fontWeight: '700' },
  kanbanEmpty: { ...glass(COLORS), borderStyle: 'dashed', borderRadius: ROUNDED.lg, padding: SPACING.md, alignItems: 'center' },
  kanbanEmptyText: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant },
  kanbanCard: { ...glass(COLORS), borderLeftWidth: 3, borderRadius: ROUNDED.lg, padding: SPACING.md, marginBottom: SPACING.sm },
  kanbanCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  orderTag: { borderWidth: 1, borderRadius: ROUNDED.default, paddingHorizontal: 6, paddingVertical: 2 },
  orderTagText: { ...TYPOGRAPHY.labelSm, fontSize: 10, fontWeight: '700', fontFamily: Platform.OS === 'web' ? 'monospace' : undefined },
  kanbanCardName: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurface, fontWeight: '600' },
  kanbanCardItem: { ...TYPOGRAPHY.bodySm, color: COLORS.onSurfaceVariant, marginTop: 1 },
  kanbanCardFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.sm },
  kanbanCardTotal: { ...TYPOGRAPHY.labelMd, color: COLORS.onSurface, fontWeight: '800' },
  advanceBtn: {},

  // Table
  tableCard: { ...glass(COLORS), borderRadius: ROUNDED.xl, padding: SPACING.md, marginTop: SPACING.lg },
  tableHeader: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.surfaceContainerLowest, borderWidth: 1, borderColor: COLORS.outlineVariant, borderRadius: ROUNDED.md, paddingHorizontal: SPACING.sm, minWidth: 200, flex: 1 },
  searchInput: { ...TYPOGRAPHY.bodySm, color: COLORS.onSurface, flex: 1, paddingVertical: 8 },
  tabsRow: { gap: 6, paddingVertical: 2, marginBottom: SPACING.sm },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.surfaceContainerHighest, paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: ROUNDED.full },
  tabActive: { backgroundColor: `${COLORS.primary}1A` },
  tabText: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant, fontWeight: '600' },
  tabTextActive: { color: COLORS.primary, fontWeight: '700' },
  tabCount: { ...TYPOGRAPHY.labelSm, fontSize: 10, color: COLORS.onSurfaceVariant, fontWeight: '700' },
  tabCountActive: { color: COLORS.primary },

  trow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: `${COLORS.outlineVariant}66`, gap: SPACING.sm },
  theadRow: { borderBottomWidth: 1, borderBottomColor: COLORS.outlineVariant },
  th: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: '700' },
  tdOrder: { ...TYPOGRAPHY.labelMd, color: COLORS.primary, fontWeight: '700', fontFamily: Platform.OS === 'web' ? 'monospace' : undefined },
  tdName: { ...TYPOGRAPHY.bodySm, color: COLORS.onSurface, fontWeight: '600' },
  tdSub: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant },
  tdMuted: { ...TYPOGRAPHY.bodySm, color: COLORS.onSurfaceVariant },
  tdAmount: { ...TYPOGRAPHY.labelMd, color: COLORS.onSurface, fontWeight: '700' },
  tdActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.md },
  tableFoot: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant, marginTop: SPACING.sm },

  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: ROUNDED.full, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { ...TYPOGRAPHY.labelSm, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },

  emptyState: { alignItems: 'center', paddingVertical: SPACING.xl, gap: 6 },
  emptyTitle: { ...TYPOGRAPHY.labelLg, color: COLORS.onSurface, fontWeight: '700' },
  emptySub: { ...TYPOGRAPHY.bodySm, color: COLORS.onSurfaceVariant },

  // FAB
  fab: { position: 'absolute', right: SPACING.lg, bottom: SPACING.lg, width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  fabBadge: { position: 'absolute', top: -2, right: -2, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#FFB86E', borderWidth: 2, borderColor: COLORS.background, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  fabBadgeText: { fontSize: 10, fontWeight: '800', color: '#2C1600' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
  modalCard: { width: '100%', maxWidth: 480, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.outlineVariant, borderRadius: ROUNDED.xl, padding: SPACING.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  modalTitle: { ...TYPOGRAPHY.headlineMd, color: COLORS.onSurface, fontWeight: '800' },
  fieldLabel: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6, marginTop: SPACING.sm },
  input: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurface, backgroundColor: COLORS.surfaceContainerLowest, borderWidth: 1, borderColor: COLORS.outlineVariant, borderRadius: ROUNDED.md, paddingHorizontal: SPACING.md, paddingVertical: 10, marginBottom: SPACING.sm },
  row2: { flexDirection: 'row', gap: SPACING.sm },
  itemsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addItemBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  addItemText: { ...TYPOGRAPHY.labelMd, color: COLORS.primary, fontWeight: '600' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginBottom: SPACING.sm },
  qtyInput: { width: 54, marginBottom: 0, textAlign: 'center' },
  priceInput: { width: 76, marginBottom: 0, textAlign: 'center' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.xs },
  totalLabel: { ...TYPOGRAPHY.labelMd, color: COLORS.onSurfaceVariant, fontWeight: '700' },
  totalValue: { ...TYPOGRAPHY.labelLg, color: COLORS.primary, fontWeight: '800' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: SPACING.xs },
  choiceChip: { borderWidth: 1, borderColor: COLORS.outlineVariant, backgroundColor: COLORS.surfaceContainerLowest, paddingHorizontal: SPACING.md, paddingVertical: 7, borderRadius: ROUNDED.full },
  choiceText: { ...TYPOGRAPHY.labelMd, color: COLORS.onSurfaceVariant, fontWeight: '600' },
  formError: { ...TYPOGRAPHY.bodySm, color: COLORS.error, marginTop: SPACING.sm },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: COLORS.primary, paddingVertical: 13, borderRadius: ROUNDED.lg, marginTop: SPACING.md },
  submitText: { ...TYPOGRAPHY.labelLg, color: COLORS.onPrimary, fontWeight: '800' },
});
