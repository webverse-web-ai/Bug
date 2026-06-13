import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Platform, Modal, KeyboardAvoidingView, ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';
import { TYPOGRAPHY, SPACING, ROUNDED } from '@/constants';
import Loader from '@/components/ui/Loader';
import { SkeletonBlock, SkeletonBoard } from '@/components/ui/Skeleton';
import { useSWR } from '@/client/cache/swr';
import { useAuth } from '@/contexts/AuthContext';
import { can } from '@/client/permissions';
import { npr, nprShort } from '@/client/currency';
import { getOrders, createOrder, updateOrder, deleteOrder, getParties } from '@/client/api';

// Section identity + sub-pages for the Pulse hamburger menu.
export const PULSE_AGENT = { name: 'Pulse', role: 'Operations', icon: 'pulse', color: '#34D399' };
export const PULSE_NAV = [
  { label: 'Overview', icon: 'view-dashboard-outline', href: '/bug/pulse' },
  { label: 'Order Management', icon: 'package-variant-closed', href: '/bug/pulse/orders' },
  { label: 'Fulfillment', icon: 'truck-fast-outline', href: '/bug/pulse/fulfillment' },
  { label: 'Analytics', icon: 'chart-box-outline', href: '/bug/pulse/analytics' },
];

export const STATUS_META = {
  pending:    { label: 'Pending',    color: '#FFB86E', icon: 'clock-outline' },
  processing: { label: 'Processing', color: '#89CEFF', icon: 'progress-wrench' },
  shipped:    { label: 'Shipped',    color: '#34D399', icon: 'truck-fast-outline' },
  delivered:  { label: 'Delivered',  color: '#10B981', icon: 'check-circle-outline' },
  cancelled:  { label: 'Cancelled',  color: '#F87171', icon: 'close-circle-outline' },
};
export const STATUS_ORDER = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
export const PIPELINE = ['pending', 'processing', 'shipped', 'delivered'];
export const PRIORITY_META = { low: { label: 'Low', color: '#94A3B8' }, normal: { label: 'Normal', color: '#89CEFF' }, high: { label: 'High', color: '#F87171' } };
export const CHANNELS = ['Direct Web', 'Mobile App', 'API Integration', 'Phone', 'In-Store'];

export const money = nprShort;
export const moneyFull = npr;
export const dateLabel = (v) => { const d = v?.toDate ? v.toDate() : new Date(v); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); };
export const nextStatus = (s) => { const i = PIPELINE.indexOf(s); return i >= 0 && i < PIPELINE.length - 1 ? PIPELINE[i + 1] : null; };
export const glass = (COLORS) => ({ backgroundColor: COLORS.surfaceContainerLow, borderWidth: 1, borderColor: COLORS.outlineVariant, ...(Platform.OS === 'web' ? { backdropFilter: 'blur(12px)' } : {}) });

// Orders + KPI stats via the cache (instant on revisit, refreshes in background).
// Fetches the full set once; pages filter client-side for snappy tabs/search.
export function usePulseData() {
  const { data, loading, error, refresh, mutate } = useSWR('orders', () => getOrders());
  const orders = data?.orders || [];
  const stats = data?.stats || { total: 0, byStatus: {}, revenue: 0, openValue: 0, todayCount: 0, trend: 0 };
  const setOrders = useCallback((updater) => mutate((prev) => ({
    ...(prev || {}),
    orders: typeof updater === 'function' ? updater(prev?.orders || []) : updater,
  })), [mutate]);
  return { orders, stats, loading, error: error?.message || '', reload: refresh, setOrders };
}

export const PAYMENT_META = {
  paid: { label: 'Paid', color: '#10B981', icon: 'check-circle' },
  partial: { label: 'Partial', color: '#FFB86E', icon: 'circle-half-full' },
  unpaid: { label: 'Unpaid', color: '#F87171', icon: 'circle-outline' },
};

export function StatusPill({ status }) {
  const { COLORS } = useTheme(); const s = ks(COLORS);
  const m = STATUS_META[status] || STATUS_META.pending;
  return (
    <View style={[s.pill, { backgroundColor: `${m.color}1A`, borderColor: `${m.color}40` }]}>
      <View style={[s.pillDot, { backgroundColor: m.color }]} />
      <Text style={[s.pillText, { color: m.color }]}>{m.label}</Text>
    </View>
  );
}

export function PaymentBadge({ status }) {
  const { COLORS } = useTheme(); const s = ks(COLORS);
  const m = PAYMENT_META[status] || PAYMENT_META.unpaid;
  return (
    <View style={[s.pill, { backgroundColor: `${m.color}1A`, borderColor: `${m.color}40` }]}>
      <MaterialCommunityIcons name={m.icon} size={11} color={m.color} />
      <Text style={[s.pillText, { color: m.color }]}>{m.label}</Text>
    </View>
  );
}

export function KpiCard({ icon, label, value, accent, footer, footerColor }) {
  const { COLORS } = useTheme(); const s = ks(COLORS);
  return (
    <View style={[s.kpiCard, { borderLeftColor: accent }]}>
      <MaterialCommunityIcons name={icon} size={86} color={accent} style={s.kpiGhost} />
      <Text style={s.kpiLabel}>{label}</Text>
      <Text style={s.kpiValue}>{value}</Text>
      {footer ? <Text style={[s.kpiFooter, { color: footerColor || COLORS.onSurfaceVariant }]}>{footer}</Text> : null}
    </View>
  );
}

// Kanban fulfillment board. onAdvance(order), onEdit(order).
export function FulfillmentBoard({ orders, onAdvance, onEdit, loading }) {
  const { COLORS } = useTheme(); const s = ks(COLORS);
  const { user } = useAuth();
  const canEdit = can(user, 'pulse', 'edit');
  if (loading) return <SkeletonBoard cols={4} cards={3} />;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.kanbanRow}>
      {PIPELINE.map(st => {
        const m = STATUS_META[st];
        const col = orders.filter(o => o.status === st);
        return (
          <View key={st} style={s.kanbanCol}>
            <View style={s.kanbanHead}>
              <View style={[s.kanbanDot, { backgroundColor: m.color }]} />
              <Text style={s.kanbanLabel}>{m.label}</Text>
              <Text style={s.kanbanCount}>{col.length}</Text>
            </View>
            {col.length === 0 ? (
              <View style={s.kanbanEmpty}><Text style={s.kanbanEmptyText}>No orders</Text></View>
            ) : col.slice(0, 20).map((o, idx) => {
              const ns = nextStatus(o.status);
              const payColor = o.paymentStatus === 'paid' ? '#10B981' : o.paymentStatus === 'partial' ? '#FFB86E' : '#F87171';
              return (
                <Animated.View key={o.id} entering={FadeInDown.duration(220).delay(Math.min(idx, 8) * 30)}>
                  <TouchableOpacity style={[s.kanbanCard, { borderLeftColor: m.color }]} activeOpacity={0.85} onPress={() => onEdit?.(o)}>
                    <View style={s.kanbanCardTop}>
                      <View style={[s.orderTag, { backgroundColor: `${m.color}1A`, borderColor: `${m.color}33` }]}><Text style={[s.orderTagText, { color: m.color }]}>{o.orderNumber}</Text></View>
                      {o.priority === 'high' && <MaterialCommunityIcons name="star" size={13} color="#FFB86E" />}
                    </View>
                    <Text style={s.kanbanCardName} numberOfLines={1}>{o.customer?.name}</Text>
                    <Text style={s.kanbanCardItem} numberOfLines={1}>{o.items?.[0]?.name || 'No items'}{o.items?.length > 1 ? ` +${o.items.length - 1}` : ''}</Text>
                    <View style={s.kanbanCardFoot}>
                      <View>
                        <Text style={s.kanbanCardTotal}>{moneyFull(o.dealAmount)}</Text>
                        <Text style={[s.kanbanCardPay, { color: payColor }]}>{o.paymentStatus === 'paid' ? 'Paid' : `${moneyFull(o.balanceDue)} due`}</Text>
                      </View>
                      {ns && canEdit && <TouchableOpacity onPress={() => onAdvance?.(o)} hitSlop={6}><MaterialCommunityIcons name="arrow-right-circle" size={20} color={STATUS_META[ns].color} /></TouchableOpacity>}
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>
        );
      })}
    </ScrollView>
  );
}

// Orders data table with filter tabs + search.
export function OrdersTable({ orders, stats, loading, filter, setFilter, search, setSearch, onEdit, onDelete }) {
  const { COLORS } = useTheme(); const s = ks(COLORS);
  const { user } = useAuth();
  const canEdit = can(user, 'pulse', 'edit');
  const canDelete = can(user, 'pulse', 'delete');
  const tabs = [{ key: 'all', label: 'All', count: stats.total }, ...STATUS_ORDER.map(x => ({ key: x, label: STATUS_META[x].label, count: stats.byStatus?.[x] || 0 }))];
  return (
    <View style={s.tableCard}>
      <View style={s.searchRow}>
        <MaterialCommunityIcons name="magnify" size={16} color={COLORS.onSurfaceVariant} />
        <TextInput style={[s.searchInput, Platform.OS === 'web' && { outlineStyle: 'none' }]} placeholder="Search orders…" placeholderTextColor={COLORS.onSurfaceVariant} value={search} onChangeText={setSearch} autoCapitalize="none" />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabsRow}>
        {tabs.map(t => (
          <TouchableOpacity key={t.key} style={[s.tab, filter === t.key && s.tabActive]} onPress={() => setFilter(t.key)}>
            <Text style={[s.tabText, filter === t.key && s.tabTextActive]}>{t.label}</Text>
            <Text style={[s.tabCount, filter === t.key && s.tabCountActive]}>{t.count}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {loading ? (
        <View style={{ paddingTop: SPACING.xs }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={i} style={s.trow}>
              <SkeletonBlock w={88} h={12} />
              <View style={{ flex: 1 }}><SkeletonBlock w={'55%'} h={12} /></View>
              <SkeletonBlock w={70} h={12} />
            </View>
          ))}
        </View>
      ) : orders.length === 0 ? (
        <View style={s.empty}><MaterialCommunityIcons name="package-variant" size={36} color={COLORS.onSurfaceVariant} /><Text style={s.emptyTitle}>No orders</Text></View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View style={[s.trow, s.thead]}>
              <Text style={[s.th, { width: 104 }]}>Order ID</Text><Text style={[s.th, { width: 180 }]}>Customer</Text>
              <Text style={[s.th, { width: 116 }]}>Status</Text><Text style={[s.th, { width: 110 }]}>Channel</Text>
              <Text style={[s.th, { width: 116, textAlign: 'right' }]}>Deal / Due</Text><Text style={[s.th, { width: 76, textAlign: 'right' }]}>Actions</Text>
            </View>
            {orders.map((o, i) => (
              <Animated.View key={o.id} entering={FadeIn.duration(160).delay(Math.min(i, 10) * 18)} style={s.trow}>
                <Text style={[s.tdOrder, { width: 104 }]} numberOfLines={1}>{o.orderNumber}</Text>
                <View style={{ width: 180 }}><Text style={s.tdName} numberOfLines={1}>{o.customer?.name}</Text>{!!o.customer?.email && <Text style={s.tdSub} numberOfLines={1}>{o.customer.email}</Text>}</View>
                <View style={{ width: 116 }}><StatusPill status={o.status} /></View>
                <Text style={[s.tdMuted, { width: 110 }]} numberOfLines={1}>{o.channel}</Text>
                <View style={{ width: 116, alignItems: 'flex-end' }}>
                  <Text style={s.tdAmount}>{moneyFull(o.dealAmount)}</Text>
                  <Text style={[s.tdPay, { color: o.paymentStatus === 'paid' ? '#10B981' : o.paymentStatus === 'partial' ? '#FFB86E' : '#F87171' }]} numberOfLines={1}>
                    {o.paymentStatus === 'paid' ? 'Paid' : `${moneyFull(o.balanceDue)} due`}
                  </Text>
                </View>
                <View style={[s.tdActions, { width: 76 }]}>
                  <TouchableOpacity onPress={() => onEdit?.(o)} hitSlop={6}><MaterialCommunityIcons name={canEdit ? 'pencil-outline' : 'eye-outline'} size={17} color={COLORS.onSurfaceVariant} /></TouchableOpacity>
                  {canDelete && <TouchableOpacity onPress={() => onDelete?.(o)} hitSlop={6}><MaterialCommunityIcons name="trash-can-outline" size={17} color={COLORS.error} /></TouchableOpacity>}
                </View>
              </Animated.View>
            ))}
          </View>
        </ScrollView>
      )}
      {!loading && orders.length > 0 && <Text style={s.tableFoot}>Showing {orders.length} of {stats.total} orders</Text>}
    </View>
  );
}

const emptyForm = () => ({ customer: { name: '', email: '', phone: '' }, partyId: '', items: [{ name: '', qty: '1', price: '' }], status: 'pending', priority: 'normal', channel: 'Direct Web', notes: '', dealAmount: '', advancePaid: '', recordPayment: '' });

// Create/Edit order modal — self-contained; calls onSaved() after success.
export function OrderFormModal({ visible, onClose, order, onSaved }) {
  const { COLORS } = useTheme(); const s = ks(COLORS);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const editing = !!order;

  // Existing Tally customers, so an order can be linked to a known party.
  const { data: partyData } = useSWR('parties', () => getParties().catch(() => []));
  const customers = (partyData || []).filter(p => p.type === 'customer');

  useEffect(() => {
    if (!visible) return;
    if (order) {
      setForm({
        customer: { name: order.customer?.name || '', email: order.customer?.email || '', phone: order.customer?.phone || '' },
        partyId: order.partyId || '',
        items: (order.items?.length ? order.items : [{ name: '', qty: 1, price: 0 }]).map(it => ({ name: it.name || '', qty: String(it.qty ?? 1), price: String(it.price ?? '') })),
        status: order.status, priority: order.priority, channel: order.channel || 'Direct Web', notes: order.notes || '',
        dealAmount: String(order.dealAmount ?? ''), advancePaid: '', recordPayment: '',
      });
    } else setForm(emptyForm());
    setErr('');
  }, [visible, order]);

  // Link an existing party → prefill contact + remember the id.
  const pickParty = (p) => setForm(f => ({ ...f, partyId: p.id, customer: { name: p.name, email: p.email || '', phone: p.phone || '' } }));
  const unlink = () => setForm(f => ({ ...f, partyId: '' }));

  const total = useMemo(() => form.items.reduce((a, it) => a + (Number(it.qty) || 0) * (Number(it.price) || 0), 0), [form.items]);
  const setItem = (i, k, v) => setForm(f => ({ ...f, items: f.items.map((it, idx) => idx === i ? { ...it, [k]: v } : it) }));

  const deal = Number(form.dealAmount) || total;
  const paidSoFar = editing ? (order.amountPaid || 0) : (Number(form.advancePaid) || 0);
  const pendingPay = editing ? (Number(form.recordPayment) || 0) : 0;
  const balance = Math.max(0, deal - paidSoFar - pendingPay);

  const submit = async () => {
    if (!form.customer.name.trim()) { setErr('Customer name is required.'); return; }
    setSaving(true); setErr('');
    const payload = {
      customer: form.customer,
      partyId: form.partyId,
      items: form.items.filter(it => it.name.trim()).map(it => ({ name: it.name.trim(), qty: Number(it.qty) || 1, price: Number(it.price) || 0 })),
      status: form.status, priority: form.priority, channel: form.channel, notes: form.notes,
      dealAmount: deal,
    };
    if (editing) { if (Number(form.recordPayment) > 0) payload.recordPayment = Number(form.recordPayment); }
    else payload.advancePaid = Number(form.advancePaid) || 0;
    try { if (editing) await updateOrder(order.id, payload); else await createOrder(payload); onClose(); onSaved?.(); }
    catch (e) { setErr(e.message); } finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalCard}>
          <View style={s.modalHead}><Text style={s.modalTitle}>{editing ? 'Edit Order' : 'New Order'}</Text><TouchableOpacity onPress={onClose} hitSlop={8}><MaterialCommunityIcons name="close" size={22} color={COLORS.onSurfaceVariant} /></TouchableOpacity></View>
          <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={s.fieldLabel}>Customer</Text>
            {customers.length > 0 && (
              <View style={s.partyPickRow}>
                <Text style={s.partyPickHint}>Link a party:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingRight: SPACING.sm }}>
                  {customers.map(p => { const on = form.partyId === p.id; return (
                    <TouchableOpacity key={p.id} style={[s.partyChip, on && { backgroundColor: `${COLORS.primary}22`, borderColor: COLORS.primary }]} onPress={() => on ? unlink() : pickParty(p)}>
                      {on && <MaterialCommunityIcons name="check" size={13} color={COLORS.primary} />}
                      <Text style={[s.partyChipText, on && { color: COLORS.primary }]} numberOfLines={1}>{p.name}</Text>
                    </TouchableOpacity>
                  ); })}
                </ScrollView>
              </View>
            )}
            <TextInput style={[s.input, Platform.OS === 'web' && { outlineStyle: 'none' }]} placeholder="Customer name *" placeholderTextColor={COLORS.onSurfaceVariant} value={form.customer.name} onChangeText={t => setForm(f => ({ ...f, partyId: '', customer: { ...f.customer, name: t } }))} />
            {form.partyId ? <Text style={s.linkedNote}>✓ Linked to existing party — accounting will post against them.</Text> : null}
            <View style={s.row2}>
              <TextInput style={[s.input, { flex: 1 }, Platform.OS === 'web' && { outlineStyle: 'none' }]} placeholder="Email" placeholderTextColor={COLORS.onSurfaceVariant} value={form.customer.email} onChangeText={t => setForm(f => ({ ...f, customer: { ...f.customer, email: t } }))} autoCapitalize="none" />
              <TextInput style={[s.input, { flex: 1 }, Platform.OS === 'web' && { outlineStyle: 'none' }]} placeholder="Phone" placeholderTextColor={COLORS.onSurfaceVariant} value={form.customer.phone} onChangeText={t => setForm(f => ({ ...f, customer: { ...f.customer, phone: t } }))} keyboardType="phone-pad" />
            </View>
            <View style={s.itemsHeader}><Text style={s.fieldLabel}>Items</Text><TouchableOpacity style={s.addItemBtn} onPress={() => setForm(f => ({ ...f, items: [...f.items, { name: '', qty: '1', price: '' }] }))}><MaterialCommunityIcons name="plus" size={14} color={COLORS.primary} /><Text style={s.addItemText}>Add item</Text></TouchableOpacity></View>
            {form.items.map((it, i) => (
              <View key={i} style={s.itemRow}>
                <TextInput style={[s.input, { flex: 1, marginBottom: 0 }, Platform.OS === 'web' && { outlineStyle: 'none' }]} placeholder="Item name" placeholderTextColor={COLORS.onSurfaceVariant} value={it.name} onChangeText={t => setItem(i, 'name', t)} />
                <TextInput style={[s.input, s.qtyInput, Platform.OS === 'web' && { outlineStyle: 'none' }]} placeholder="Qty" placeholderTextColor={COLORS.onSurfaceVariant} value={String(it.qty)} onChangeText={t => setItem(i, 'qty', t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" />
                <TextInput style={[s.input, s.priceInput, Platform.OS === 'web' && { outlineStyle: 'none' }]} placeholder="Price" placeholderTextColor={COLORS.onSurfaceVariant} value={String(it.price)} onChangeText={t => setItem(i, 'price', t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" />
                {form.items.length > 1 && <TouchableOpacity onPress={() => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }))} hitSlop={6}><MaterialCommunityIcons name="close-circle" size={18} color={COLORS.onSurfaceVariant} /></TouchableOpacity>}
              </View>
            ))}
            <View style={s.totalRow}><Text style={s.totalLabel}>Items Total</Text><Text style={s.totalValue}>{moneyFull(total)}</Text></View>

            {/* Payment */}
            <Text style={s.fieldLabel}>Total Deal Amount</Text>
            <TextInput style={[s.input, Platform.OS === 'web' && { outlineStyle: 'none' }]} placeholder={`Defaults to items total (${moneyFull(total)})`} placeholderTextColor={COLORS.onSurfaceVariant} value={String(form.dealAmount)} onChangeText={t => setForm(f => ({ ...f, dealAmount: t.replace(/[^0-9.]/g, '') }))} keyboardType="decimal-pad" />
            {editing ? (
              <>
                <View style={s.payInfoRow}><Text style={s.payInfoLabel}>Paid so far</Text><Text style={[s.payInfoVal, { color: '#10B981' }]}>{moneyFull(order.amountPaid || 0)}</Text></View>
                <Text style={s.fieldLabel}>Record a Payment</Text>
                <TextInput style={[s.input, Platform.OS === 'web' && { outlineStyle: 'none' }]} placeholder="Add amount received now" placeholderTextColor={COLORS.onSurfaceVariant} value={String(form.recordPayment)} onChangeText={t => setForm(f => ({ ...f, recordPayment: t.replace(/[^0-9.]/g, '') }))} keyboardType="decimal-pad" />
              </>
            ) : (
              <>
                <Text style={s.fieldLabel}>Advance Paid</Text>
                <TextInput style={[s.input, Platform.OS === 'web' && { outlineStyle: 'none' }]} placeholder="Amount received upfront (optional)" placeholderTextColor={COLORS.onSurfaceVariant} value={String(form.advancePaid)} onChangeText={t => setForm(f => ({ ...f, advancePaid: t.replace(/[^0-9.]/g, '') }))} keyboardType="decimal-pad" />
              </>
            )}
            <View style={[s.balancePill, { backgroundColor: balance <= 0 ? '#10B98115' : '#FFB86E15', borderColor: balance <= 0 ? '#10B98155' : '#FFB86E55' }]}>
              <Text style={s.balanceLabel}>{balance <= 0 ? 'Fully Paid' : 'Balance Due'}</Text>
              <Text style={[s.balanceVal, { color: balance <= 0 ? '#10B981' : '#FFB86E' }]}>{moneyFull(balance)}</Text>
            </View>

            <Text style={s.fieldLabel}>Status</Text>
            <View style={s.chipRow}>{STATUS_ORDER.map(x => { const m = STATUS_META[x]; const on = form.status === x; return <TouchableOpacity key={x} style={[s.chip, on && { backgroundColor: `${m.color}22`, borderColor: m.color }]} onPress={() => setForm(f => ({ ...f, status: x }))}><Text style={[s.chipText, on && { color: m.color }]}>{m.label}</Text></TouchableOpacity>; })}</View>
            <Text style={s.fieldLabel}>Channel</Text>
            <View style={s.chipRow}>{CHANNELS.map(c => { const on = form.channel === c; return <TouchableOpacity key={c} style={[s.chip, on && { backgroundColor: `${COLORS.primary}22`, borderColor: COLORS.primary }]} onPress={() => setForm(f => ({ ...f, channel: c }))}><Text style={[s.chipText, on && { color: COLORS.primary }]}>{c}</Text></TouchableOpacity>; })}</View>
            <Text style={s.fieldLabel}>Priority</Text>
            <View style={s.chipRow}>{Object.keys(PRIORITY_META).map(p => { const m = PRIORITY_META[p]; const on = form.priority === p; return <TouchableOpacity key={p} style={[s.chip, on && { backgroundColor: `${m.color}22`, borderColor: m.color }]} onPress={() => setForm(f => ({ ...f, priority: p }))}><Text style={[s.chipText, on && { color: m.color }]}>{m.label}</Text></TouchableOpacity>; })}</View>
            <Text style={s.fieldLabel}>Notes</Text>
            <TextInput style={[s.input, { height: 60, textAlignVertical: 'top' }, Platform.OS === 'web' && { outlineStyle: 'none' }]} placeholder="Internal notes (optional)" placeholderTextColor={COLORS.onSurfaceVariant} value={form.notes} onChangeText={t => setForm(f => ({ ...f, notes: t }))} multiline />
            {err ? <Text style={s.formError}>{err}</Text> : null}
          </ScrollView>
          <TouchableOpacity style={[s.submitBtn, saving && { opacity: 0.6 }]} onPress={submit} disabled={saving}>{saving ? <ActivityIndicator size="small" color={COLORS.onPrimary} /> : <Text style={s.submitText}>{editing ? 'Save Changes' : 'Create Order'}</Text>}</TouchableOpacity>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

export { deleteOrder, updateOrder };

const ks = (COLORS) => StyleSheet.create({
  center: { paddingVertical: SPACING.xl, alignItems: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: ROUNDED.full, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { ...TYPOGRAPHY.labelSm, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },

  kpiCard: { flexGrow: 1, flexBasis: 200, minWidth: 170, ...glass(COLORS), borderLeftWidth: 4, borderRadius: ROUNDED.xl, padding: SPACING.lg, overflow: 'hidden' },
  kpiGhost: { position: 'absolute', right: -14, top: -14, opacity: 0.06 },
  kpiLabel: { ...TYPOGRAPHY.labelMd, color: COLORS.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600' },
  kpiValue: { fontSize: 36, lineHeight: 42, fontWeight: '800', color: COLORS.onSurface, marginTop: SPACING.xs },
  kpiFooter: { ...TYPOGRAPHY.labelSm, fontWeight: '700', marginTop: SPACING.sm },

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
  kanbanCardPay: { ...TYPOGRAPHY.labelSm, fontSize: 10, fontWeight: '700', marginTop: 1 },

  tableCard: { ...glass(COLORS), borderRadius: ROUNDED.xl, padding: SPACING.md },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.surfaceContainerLowest, borderWidth: 1, borderColor: COLORS.outlineVariant, borderRadius: ROUNDED.md, paddingHorizontal: SPACING.sm, marginBottom: SPACING.sm },
  searchInput: { ...TYPOGRAPHY.bodySm, color: COLORS.onSurface, flex: 1, paddingVertical: 8 },
  tabsRow: { gap: 6, paddingVertical: 2, marginBottom: SPACING.sm },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.surfaceContainerHighest, paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: ROUNDED.full },
  tabActive: { backgroundColor: `${COLORS.primary}1A` },
  tabText: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant, fontWeight: '600' },
  tabTextActive: { color: COLORS.primary, fontWeight: '700' },
  tabCount: { ...TYPOGRAPHY.labelSm, fontSize: 10, color: COLORS.onSurfaceVariant, fontWeight: '700' },
  tabCountActive: { color: COLORS.primary },
  trow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: `${COLORS.outlineVariant}66`, gap: SPACING.sm },
  thead: { borderBottomColor: COLORS.outlineVariant },
  th: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: '700' },
  tdOrder: { ...TYPOGRAPHY.labelMd, color: COLORS.primary, fontWeight: '700', fontFamily: Platform.OS === 'web' ? 'monospace' : undefined },
  tdName: { ...TYPOGRAPHY.bodySm, color: COLORS.onSurface, fontWeight: '600' },
  tdSub: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant },
  tdMuted: { ...TYPOGRAPHY.bodySm, color: COLORS.onSurfaceVariant },
  tdAmount: { ...TYPOGRAPHY.labelMd, color: COLORS.onSurface, fontWeight: '700' },
  tdPay: { ...TYPOGRAPHY.labelSm, fontSize: 10, fontWeight: '700', marginTop: 1 },
  tdActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.md },
  tableFoot: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant, marginTop: SPACING.sm },
  empty: { alignItems: 'center', paddingVertical: SPACING.xl, gap: 6 },
  emptyTitle: { ...TYPOGRAPHY.labelLg, color: COLORS.onSurface, fontWeight: '700' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
  modalCard: { width: '100%', maxWidth: 480, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.outlineVariant, borderRadius: ROUNDED.xl, padding: SPACING.lg },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  modalTitle: { ...TYPOGRAPHY.headlineMd, color: COLORS.onSurface, fontWeight: '800' },
  fieldLabel: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6, marginTop: SPACING.sm },
  input: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurface, backgroundColor: COLORS.surfaceContainerLowest, borderWidth: 1, borderColor: COLORS.outlineVariant, borderRadius: ROUNDED.md, paddingHorizontal: SPACING.md, paddingVertical: 10, marginBottom: SPACING.sm },
  partyPickRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  partyPickHint: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant },
  partyChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: COLORS.outlineVariant, backgroundColor: COLORS.surfaceContainerLowest, paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: ROUNDED.full, maxWidth: 160 },
  partyChipText: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant, fontWeight: '600' },
  linkedNote: { ...TYPOGRAPHY.labelSm, color: '#10B981', marginTop: -SPACING.xs, marginBottom: SPACING.xs },
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
  payInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  payInfoLabel: { ...TYPOGRAPHY.bodySm, color: COLORS.onSurfaceVariant },
  payInfoVal: { ...TYPOGRAPHY.labelMd, fontWeight: '800' },
  balancePill: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderRadius: ROUNDED.md, paddingHorizontal: SPACING.md, paddingVertical: 10, marginTop: SPACING.sm, marginBottom: SPACING.xs },
  balanceLabel: { ...TYPOGRAPHY.labelMd, color: COLORS.onSurface, fontWeight: '700' },
  balanceVal: { ...TYPOGRAPHY.labelLg, fontWeight: '800' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: SPACING.xs },
  chip: { borderWidth: 1, borderColor: COLORS.outlineVariant, backgroundColor: COLORS.surfaceContainerLowest, paddingHorizontal: SPACING.md, paddingVertical: 7, borderRadius: ROUNDED.full },
  chipText: { ...TYPOGRAPHY.labelMd, color: COLORS.onSurfaceVariant, fontWeight: '600' },
  formError: { ...TYPOGRAPHY.bodySm, color: COLORS.error, marginTop: SPACING.sm },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: COLORS.primary, paddingVertical: 13, borderRadius: ROUNDED.lg, marginTop: SPACING.md },
  submitText: { ...TYPOGRAPHY.labelLg, color: COLORS.onPrimary, fontWeight: '800' },
});
