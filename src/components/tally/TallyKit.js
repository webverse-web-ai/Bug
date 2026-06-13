import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Platform, Modal, KeyboardAvoidingView, ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';
import { TYPOGRAPHY, SPACING, ROUNDED } from '@/constants';
import {
  getTally, createTransaction, deleteTransaction, getParties, createParty, updateParty, deleteParty,
} from '@/client/api';
import { SkeletonKpis, SkeletonCard, SkeletonList } from '@/components/ui/Skeleton';
import { useSWR } from '@/client/cache/swr';
import { useAuth } from '@/contexts/AuthContext';
import { can } from '@/client/permissions';
import { npr, nprShort } from '@/client/currency';

export const TALLY_AGENT = { name: 'Tally', role: 'Accounting', icon: 'calculator-variant', color: '#FFB86E' };
export const TALLY_NAV = [
  { label: 'Dashboard', icon: 'view-dashboard-outline', href: '/bug/tally' },
  { label: 'Daybook', icon: 'book-open-variant', href: '/bug/tally/daybook' },
  { label: 'Ledger', icon: 'notebook-outline', href: '/bug/tally/ledger' },
  { label: 'Profit & Loss', icon: 'chart-line', href: '/bug/tally/pnl' },
  { label: 'Balance Sheet', icon: 'scale-balance', href: '/bug/tally/balance-sheet' },
  { label: 'Parties', icon: 'account-group-outline', href: '/bug/tally/parties' },
  { label: 'VAT Register', icon: 'receipt-text-outline', href: '/bug/tally/vat' },
  { label: 'Sales VAT Bill', icon: 'file-document-edit-outline', href: '/bug/tally/vat-bill' },
  { label: 'VAT Analytics', icon: 'chart-box-outline', href: '/bug/tally/vat-analytics' },
  { label: 'VAT Calculator', icon: 'calculator', href: '/bug/tally/vat-calculator' },
];

export const IN_CATEGORIES = ['Sales', 'Service', 'Interest', 'Other Income', 'Capital', 'Loan'];
export const OUT_CATEGORIES = ['Purchase', 'Salaries', 'Rent', 'Utilities', 'Marketing', 'Infrastructure', 'Software', 'Equipment', 'Tax', 'Logistics', 'Other Expense', 'Drawings'];
export const ACCOUNTS = ['Cash', 'Bank'];
export const METHODS = ['Cash', 'Bank Transfer', 'UPI', 'Card', 'Cheque'];
const PALETTE = ['#89CEFF', '#FFB86E', '#34D399', '#A78BFA', '#F87171', '#38BDF8', '#FBBF24', '#B7C8E1'];

export const money = npr;
export const moneyShort = nprShort;
export const dayLabel = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); };
export const glass = (COLORS) => ({ backgroundColor: COLORS.surfaceContainerLow, borderWidth: 1, borderColor: COLORS.outlineVariant, ...(Platform.OS === 'web' ? { backdropFilter: 'blur(12px)' } : {}) });

export function useTallyData() {
  const t = useSWR('tally', getTally);
  const p = useSWR('parties', () => getParties().catch(() => []));
  const reload = useCallback(() => { t.refresh(); p.refresh(); }, [t.refresh, p.refresh]);
  return {
    data: t.data || { transactions: [], reports: null },
    parties: p.data || [],
    loading: t.loading,
    error: t.error?.message || '',
    reload,
    setData: t.mutate,
    setParties: p.mutate,
  };
}

function Kpi({ icon, label, value, accent }) {
  const { COLORS } = useTheme(); const s = kts(COLORS);
  return <View style={[s.kpi, { borderLeftColor: accent }]}><MaterialCommunityIcons name={icon} size={20} color={accent} /><Text style={s.kpiValue}>{value}</Text><Text style={s.kpiLabel}>{label}</Text></View>;
}

function TxnLine({ t, onDelete }) {
  const { COLORS } = useTheme(); const s = kts(COLORS);
  const isIn = t.type === 'in'; const color = isIn ? '#34D399' : '#F87171';
  return (
    <View style={s.txnLine}>
      <View style={[s.txnIcon, { backgroundColor: `${color}1A` }]}><MaterialCommunityIcons name={isIn ? 'arrow-down' : 'arrow-up'} size={16} color={color} /></View>
      <View style={{ flex: 1 }}>
        <Text style={s.txnCat} numberOfLines={1}>{t.category}{t.partyName ? ` · ${t.partyName}` : ''}</Text>
        <Text style={s.txnSub} numberOfLines={1}>{t.account} · {dayLabel(t.date)}{t.description ? ` · ${t.description}` : ''}</Text>
      </View>
      <Text style={[s.txnAmt, { color }]}>{isIn ? '+' : '-'}{money(t.amount)}</Text>
      {onDelete && <TouchableOpacity onPress={() => onDelete(t.id)} hitSlop={6} style={{ marginLeft: 8 }}><MaterialCommunityIcons name="trash-can-outline" size={16} color={COLORS.error} /></TouchableOpacity>}
    </View>
  );
}

export function TallyOverview({ data, loading }) {
  const { COLORS } = useTheme(); const s = kts(COLORS);
  const r = data?.reports;
  if (loading || !r) return <><SkeletonKpis count={4} /><SkeletonCard rows={6} /><SkeletonList rows={5} /></>;
  const maxFlow = Math.max(1, ...r.cashflow.map(m => Math.max(m.in, m.out)));
  const maxExp = Math.max(1, ...r.expensesByCategory.map(e => e.amount));
  return (
    <>
      <View style={s.kpiRow}>
        <Kpi icon="arrow-down-bold-circle-outline" label="Money In" value={moneyShort(r.summary.totalIn)} accent="#34D399" />
        <Kpi icon="arrow-up-bold-circle-outline" label="Money Out" value={moneyShort(r.summary.totalOut)} accent="#F87171" />
        <Kpi icon="wallet-outline" label="Net Cash" value={moneyShort(r.summary.net)} accent="#89CEFF" />
        <Kpi icon="chart-line" label="Net Profit" value={moneyShort(r.summary.netProfit)} accent={r.summary.netProfit >= 0 ? '#34D399' : '#F87171'} />
      </View>
      <View style={s.card}>
        <Text style={s.cardTitle}>Cash Flow Analysis</Text><Text style={s.cardHint}>Money in vs out · last 6 months</Text>
        <View style={s.flowChart}>{r.cashflow.map((m, i) => (
          <View key={i} style={s.flowCol}><View style={s.flowBars}><View style={[s.flowBar, { height: `${(m.in / maxFlow) * 100}%`, backgroundColor: '#34D399' }]} /><View style={[s.flowBar, { height: `${(m.out / maxFlow) * 100}%`, backgroundColor: '#F87171' }]} /></View><Text style={s.flowLabel}>{m.label}</Text></View>
        ))}</View>
        <View style={s.legendRow}><View style={s.legend}><View style={[s.legendDot, { backgroundColor: '#34D399' }]} /><Text style={s.legendText}>In</Text></View><View style={s.legend}><View style={[s.legendDot, { backgroundColor: '#F87171' }]} /><Text style={s.legendText}>Out</Text></View></View>
      </View>
      <View style={s.card}>
        <Text style={s.cardTitle}>Expense Breakdown</Text>
        {r.expensesByCategory.length === 0 ? <Text style={s.muted}>No expenses recorded yet.</Text> : r.expensesByCategory.slice(0, 8).map((e, i) => (
          <View key={e.category} style={s.expRow}><View style={s.expHead}><Text style={s.expName}>{e.category}</Text><Text style={s.expAmt}>{money(e.amount)} · {e.pct}%</Text></View><View style={s.barTrack}><View style={[s.barFill, { width: `${(e.amount / maxExp) * 100}%`, backgroundColor: PALETTE[i % PALETTE.length] }]} /></View></View>
        ))}
      </View>
      <View style={s.card}>
        <View style={s.cardHeaderRow}><Text style={s.cardTitle}>Recent Transactions</Text><TouchableOpacity onPress={() => router.push('/bug/tally/daybook')}><Text style={s.link}>Daybook →</Text></TouchableOpacity></View>
        {data.transactions.slice(0, 6).map(t => <TxnLine key={t.id} t={t} />)}
        {data.transactions.length === 0 && <Text style={s.muted}>No transactions yet — use the + buttons to record money in/out.</Text>}
      </View>
    </>
  );
}

export function Daybook({ transactions, onDelete, loading }) {
  const { COLORS } = useTheme(); const s = kts(COLORS);
  const { user } = useAuth();
  const del = can(user, 'tally', 'delete') ? onDelete : undefined;
  const [search, setSearch] = useState(''); const [typeF, setTypeF] = useState('all');
  if (loading) return <SkeletonList rows={7} />;
  const q = search.trim().toLowerCase();
  const filtered = transactions.filter(t => (typeF === 'all' || t.type === typeF) && (!q || t.category.toLowerCase().includes(q) || (t.partyName || '').toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q)));
  const groups = {}; for (const t of filtered) { const k = t.date.slice(0, 10); (groups[k] = groups[k] || []).push(t); }
  const keys = Object.keys(groups).sort((a, b) => b.localeCompare(a));
  return (
    <View style={s.card}>
      <View style={s.searchRow}><MaterialCommunityIcons name="magnify" size={16} color={COLORS.onSurfaceVariant} /><TextInput style={[s.searchInput, Platform.OS === 'web' && { outlineStyle: 'none' }]} placeholder="Search daybook…" placeholderTextColor={COLORS.onSurfaceVariant} value={search} onChangeText={setSearch} /></View>
      <View style={s.miniTabs}>{['all', 'in', 'out'].map(k => <TouchableOpacity key={k} style={[s.miniTab, typeF === k && s.miniTabActive]} onPress={() => setTypeF(k)}><Text style={[s.miniTabText, typeF === k && s.miniTabTextActive]}>{k === 'all' ? 'All' : k === 'in' ? 'Money In' : 'Money Out'}</Text></TouchableOpacity>)}</View>
      {keys.length === 0 ? <Text style={s.muted}>No entries.</Text> : keys.map(k => {
        const di = groups[k].filter(t => t.type === 'in').reduce((a, t) => a + t.amount, 0); const dout = groups[k].filter(t => t.type === 'out').reduce((a, t) => a + t.amount, 0);
        return (<Animated.View key={k} entering={FadeIn.duration(150)}><View style={s.dayHead}><Text style={s.dayHeadText}>{dayLabel(k + 'T00:00:00')}</Text><Text style={s.dayHeadNet}><Text style={{ color: '#34D399' }}>+{moneyShort(di)}</Text>  <Text style={{ color: '#F87171' }}>-{moneyShort(dout)}</Text></Text></View>{groups[k].map(t => <TxnLine key={t.id} t={t} onDelete={del} />)}</Animated.View>);
      })}
    </View>
  );
}

export function Ledger({ ledger, loading }) {
  const { COLORS } = useTheme(); const s = kts(COLORS);
  if (loading || !ledger) return <SkeletonCard rows={7} />;
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>Ledger by Account Head</Text><Text style={s.cardHint}>In / Out totals per category</Text>
      <View style={[s.trow, s.thead]}><Text style={[s.th, { flex: 1 }]}>Ledger</Text><Text style={[s.th, { width: 80, textAlign: 'right' }]}>In</Text><Text style={[s.th, { width: 80, textAlign: 'right' }]}>Out</Text><Text style={[s.th, { width: 84, textAlign: 'right' }]}>Net</Text></View>
      {ledger.length === 0 ? <Text style={s.muted}>No ledger entries.</Text> : ledger.map(l => (
        <View key={l.category} style={s.trow}><View style={{ flex: 1 }}><Text style={s.ledName}>{l.category}</Text><Text style={s.ledGroup}>{l.group} · {l.count} entr{l.count === 1 ? 'y' : 'ies'}</Text></View><Text style={[s.ledIn, { width: 80 }]}>{l.in ? moneyShort(l.in) : '—'}</Text><Text style={[s.ledOut, { width: 80 }]}>{l.out ? moneyShort(l.out) : '—'}</Text><Text style={[s.ledNet, { width: 84, color: l.net >= 0 ? '#34D399' : '#F87171' }]}>{moneyShort(l.net)}</Text></View>
      ))}
    </View>
  );
}

export function PnL({ pnl, loading }) {
  const { COLORS } = useTheme(); const s = kts(COLORS);
  if (loading || !pnl) return <SkeletonCard rows={8} />;
  const Row = ({ label, amount, bold }) => <View style={s.plRow}><Text style={[s.plLabel, bold && s.plBold]}>{label}</Text><Text style={[s.plAmt, bold && s.plBold]}>{money(amount)}</Text></View>;
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>Profit &amp; Loss</Text>
      <Text style={s.plSection}>INCOME</Text>
      {pnl.income.length === 0 ? <Text style={s.muted}>No income recorded.</Text> : pnl.income.map(i => <Row key={i.category} label={i.category} amount={i.amount} />)}
      <View style={s.plDivider} /><Row label="Total Income" amount={pnl.totalIncome} bold />
      <Text style={[s.plSection, { marginTop: SPACING.lg }]}>EXPENSES</Text>
      {pnl.expenses.length === 0 ? <Text style={s.muted}>No expenses recorded.</Text> : pnl.expenses.map(e => <Row key={e.category} label={e.category} amount={e.amount} />)}
      <View style={s.plDivider} /><Row label="Total Expenses" amount={pnl.totalExpense} bold />
      <View style={[s.netBox, { backgroundColor: pnl.netProfit >= 0 ? '#34D39915' : '#F8717115', borderColor: pnl.netProfit >= 0 ? '#34D39955' : '#F8717155' }]}><Text style={s.netLabel}>{pnl.netProfit >= 0 ? 'Net Profit' : 'Net Loss'}</Text><Text style={[s.netVal, { color: pnl.netProfit >= 0 ? '#34D399' : '#F87171' }]}>{money(Math.abs(pnl.netProfit))}</Text></View>
    </View>
  );
}

export function BalanceSheet({ bs, loading }) {
  const { COLORS } = useTheme(); const s = kts(COLORS);
  if (loading || !bs) return <><SkeletonCard rows={4} /><SkeletonCard rows={2} /><SkeletonCard rows={3} /></>;
  const Block = ({ title, rows, total, accent }) => (
    <View style={s.card}><View style={s.bsHead}><View style={[s.bsDot, { backgroundColor: accent }]} /><Text style={s.cardTitle}>{title}</Text></View>{rows.map(rr => <View key={rr.label} style={s.plRow}><Text style={s.plLabel}>{rr.label}</Text><Text style={s.plAmt}>{money(rr.amount)}</Text></View>)}<View style={s.plDivider} /><View style={s.plRow}><Text style={[s.plLabel, s.plBold]}>Total {title}</Text><Text style={[s.plAmt, s.plBold, { color: accent }]}>{money(total)}</Text></View></View>
  );
  const balanced = Math.abs(bs.totalAssets - (bs.totalLiabilities + bs.totalEquity)) < 0.01;
  return (
    <>
      <Block title="Assets" rows={bs.assets} total={bs.totalAssets} accent="#34D399" />
      <Block title="Liabilities" rows={bs.liabilities} total={bs.totalLiabilities} accent="#F87171" />
      <Block title="Equity" rows={bs.equity} total={bs.totalEquity} accent="#89CEFF" />
      <View style={[s.balanceCheck, { borderColor: balanced ? '#34D39955' : '#FFB86E55' }]}><MaterialCommunityIcons name={balanced ? 'check-circle-outline' : 'alert-circle-outline'} size={16} color={balanced ? '#34D399' : '#FFB86E'} /><Text style={s.balanceCheckText}>Assets {money(bs.totalAssets)} = Liabilities + Equity {money(bs.totalLiabilities + bs.totalEquity)}</Text></View>
    </>
  );
}

const emptyParty = () => ({ type: 'customer', name: '', email: '', phone: '', panNo: '', address: '', openingBalance: '' });

function PartyMeta({ icon, text }) {
  const { COLORS } = useTheme(); const s = kts(COLORS);
  return <View style={s.metaItem}><MaterialCommunityIcons name={icon} size={13} color={COLORS.onSurfaceVariant} /><Text style={s.metaText} numberOfLines={1}>{text}</Text></View>;
}

export function Parties({ reports, transactions = [], onChanged, loading }) {
  const { COLORS } = useTheme(); const s = kts(COLORS);
  const { user } = useAuth();
  const canCreate = can(user, 'tally', 'create');
  const canEdit = can(user, 'tally', 'edit');
  const canDelete = can(user, 'tally', 'delete');
  const [modal, setModal] = useState(false);
  const [editParty, setEditParty] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [search, setSearch] = useState('');
  const [show, setShow] = useState({ customer: true, supplier: true });
  // Toggle a group; never let both switch off (keep at least one visible).
  const toggle = (k) => setShow(prev => { const next = { ...prev, [k]: !prev[k] }; return (next.customer || next.supplier) ? next : prev; });
  if (loading || !reports) return <SkeletonList rows={6} />;
  const { customers, suppliers, totalReceivable, totalPayable } = reports.parties;
  const remove = async (id) => { try { await deleteParty(id); } finally { onChanged?.(); } };
  const openNew = () => { setEditParty(null); setModal(true); };
  const openEdit = (p, type) => { setEditParty({ ...p, type }); setModal(true); };
  const q = search.trim().toLowerCase();

  const PartyRow = ({ p, accent, type }) => {
    const open = expanded === p.id;
    const hist = open ? transactions.filter(t => t.partyId === p.id) : [];
    return (
      <View style={s.partyWrap}>
        <TouchableOpacity style={s.partyRow} activeOpacity={0.7} onPress={() => setExpanded(open ? null : p.id)}>
          <View style={[s.partyAvatar, { backgroundColor: `${accent}1A` }]}><Text style={[s.partyInitial, { color: accent }]}>{(p.name[0] || '?').toUpperCase()}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.partyName} numberOfLines={1}>{p.name}</Text>
            <Text style={s.partySub} numberOfLines={1}>{p.phone || p.email || (p.panNo ? `PAN ${p.panNo}` : '—')}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[s.partyBal, { color: p.balance > 0 ? accent : COLORS.onSurfaceVariant }]}>{money(p.balance)}</Text>
            <Text style={s.partyBalSub}>{type === 'customer' ? 'receivable' : 'payable'}</Text>
          </View>
          <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.onSurfaceVariant} style={{ marginLeft: 4 }} />
        </TouchableOpacity>
        {open && (
          <Animated.View entering={FadeIn.duration(140)} style={s.partyDetail}>
            {(p.email || p.phone || p.panNo || p.address) ? (
              <View style={s.metaGrid}>
                {p.phone ? <PartyMeta icon="phone-outline" text={p.phone} /> : null}
                {p.email ? <PartyMeta icon="email-outline" text={p.email} /> : null}
                {p.panNo ? <PartyMeta icon="card-account-details-outline" text={`PAN ${p.panNo}`} /> : null}
                {p.address ? <PartyMeta icon="map-marker-outline" text={p.address} /> : null}
              </View>
            ) : null}
            <Text style={s.histTitle}>Recent transactions</Text>
            {hist.length === 0 ? <Text style={s.muted}>No linked transactions yet.</Text> : hist.slice(0, 6).map(t => (
              <View key={t.id} style={s.histRow}>
                <Text style={s.histDate}>{dayLabel(t.date)}</Text>
                <Text style={s.histCat} numberOfLines={1}>{t.category}{t.description ? ` · ${t.description}` : ''}</Text>
                <Text style={[s.histAmt, { color: t.type === 'in' ? '#34D399' : '#F87171' }]}>{t.type === 'in' ? '+' : '-'}{moneyShort(t.amount)}</Text>
              </View>
            ))}
            <View style={s.detailActions}>
              {canEdit && <TouchableOpacity style={s.detailBtn} onPress={() => openEdit(p, type)}><MaterialCommunityIcons name="pencil-outline" size={15} color={COLORS.primary} /><Text style={[s.detailBtnText, { color: COLORS.primary }]}>Edit</Text></TouchableOpacity>}
              {canDelete && <TouchableOpacity style={s.detailBtn} onPress={() => remove(p.id)}><MaterialCommunityIcons name="trash-can-outline" size={15} color={COLORS.error} /><Text style={[s.detailBtnText, { color: COLORS.error }]}>Delete</Text></TouchableOpacity>}
            </View>
          </Animated.View>
        )}
      </View>
    );
  };

  const Group = ({ title, list, accent, type, totalLabel }) => {
    const fl = q ? list.filter(p => p.name.toLowerCase().includes(q) || (p.phone || '').includes(q) || (p.email || '').toLowerCase().includes(q) || (p.panNo || '').includes(q)) : list;
    return (
      <View style={s.card}>
        <View style={s.cardHeaderRow}><Text style={s.cardTitle}>{title} · {list.length}</Text><Text style={[s.partyTotal, { color: accent }]}>{totalLabel}</Text></View>
        {fl.length === 0 ? <Text style={s.muted}>{q ? 'No matches.' : `No ${title.toLowerCase()} yet.`}</Text> : fl.map(p => <PartyRow key={p.id} p={p} accent={accent} type={type} />)}
      </View>
    );
  };

  return (
    <>
      {canCreate && <TouchableOpacity style={s.addPartyBtn} onPress={openNew} activeOpacity={0.85}><MaterialCommunityIcons name="account-plus-outline" size={18} color={COLORS.onPrimary} /><Text style={s.addPartyText}>Add Customer / Supplier</Text></TouchableOpacity>}
      <View style={s.searchRow}><MaterialCommunityIcons name="magnify" size={16} color={COLORS.onSurfaceVariant} /><TextInput style={[s.searchInput, Platform.OS === 'web' && { outlineStyle: 'none' }]} placeholder="Search parties by name, phone or PAN…" placeholderTextColor={COLORS.onSurfaceVariant} value={search} onChangeText={setSearch} /></View>
      <View style={s.filterRow}>
        <TouchableOpacity style={[s.filterBtn, show.customer && { backgroundColor: '#34D39922', borderColor: '#34D399' }]} onPress={() => toggle('customer')}>
          <MaterialCommunityIcons name={show.customer ? 'check-circle' : 'account-group-outline'} size={15} color={show.customer ? '#34D399' : COLORS.onSurfaceVariant} />
          <Text style={[s.filterBtnText, show.customer && { color: '#34D399' }]}>Customers · {customers.length}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.filterBtn, show.supplier && { backgroundColor: '#FFB86E22', borderColor: '#FFB86E' }]} onPress={() => toggle('supplier')}>
          <MaterialCommunityIcons name={show.supplier ? 'check-circle' : 'truck-outline'} size={15} color={show.supplier ? '#FFB86E' : COLORS.onSurfaceVariant} />
          <Text style={[s.filterBtnText, show.supplier && { color: '#FFB86E' }]}>Suppliers · {suppliers.length}</Text>
        </TouchableOpacity>
      </View>
      {show.customer && <Group title="Customers" list={customers} accent="#34D399" type="customer" totalLabel={`${money(totalReceivable)} due`} />}
      {show.supplier && <Group title="Suppliers" list={suppliers} accent="#FFB86E" type="supplier" totalLabel={`${money(totalPayable)} owed`} />}
      <PartyModal visible={modal} party={editParty} onClose={() => { setModal(false); setEditParty(null); }} onSaved={onChanged} />
    </>
  );
}

function Chips({ options, value, onChange, accent }) {
  const { COLORS } = useTheme(); const s = kts(COLORS);
  return <View style={s.chipRow}>{options.map(o => { const on = value === o; const c = accent || COLORS.primary; return <TouchableOpacity key={o} style={[s.chip, on && { backgroundColor: `${c}22`, borderColor: c }]} onPress={() => onChange(o)}><Text style={[s.chipText, on && { color: c }]}>{o}</Text></TouchableOpacity>; })}</View>;
}

const emptyTxn = () => ({ type: 'in', amount: '', category: 'Sales', account: 'Cash', method: 'Cash', partyId: '', description: '', date: new Date().toISOString().slice(0, 10) });

export function TxnModal({ visible, onClose, type, parties = [], onSaved }) {
  const { COLORS } = useTheme(); const s = kts(COLORS);
  const [form, setForm] = useState(emptyTxn());
  const [saving, setSaving] = useState(false); const [err, setErr] = useState('');
  useEffect(() => { if (visible) { setForm({ ...emptyTxn(), type: type || 'in', category: (type || 'in') === 'in' ? 'Sales' : 'Other Expense' }); setErr(''); } }, [visible, type]);
  const isIn = form.type === 'in';
  const cats = isIn ? IN_CATEGORIES : OUT_CATEGORIES;
  const relevant = parties.filter(p => (isIn ? p.type === 'customer' : p.type === 'supplier'));
  const submit = async () => {
    if (!form.amount || Number(form.amount) <= 0) { setErr('Enter a valid amount.'); return; }
    setSaving(true); setErr('');
    const party = parties.find(p => p.id === form.partyId);
    try { await createTransaction({ ...form, amount: Number(form.amount), partyName: party?.name || '', partyType: party?.type || '' }); onClose(); onSaved?.(); }
    catch (e) { setErr(e.message); } finally { setSaving(false); }
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalCard}>
        <View style={s.modalHead}><Text style={s.modalTitle}>{isIn ? 'Money In' : 'Money Out'}</Text><TouchableOpacity onPress={onClose} hitSlop={8}><MaterialCommunityIcons name="close" size={22} color={COLORS.onSurfaceVariant} /></TouchableOpacity></View>
        <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={s.typeToggle}>
            <TouchableOpacity style={[s.typeBtn, isIn && { backgroundColor: '#34D39922', borderColor: '#34D399' }]} onPress={() => setForm(f => ({ ...f, type: 'in', category: 'Sales' }))}><MaterialCommunityIcons name="arrow-down" size={16} color={isIn ? '#34D399' : COLORS.onSurfaceVariant} /><Text style={[s.typeText, isIn && { color: '#34D399' }]}>Money In</Text></TouchableOpacity>
            <TouchableOpacity style={[s.typeBtn, !isIn && { backgroundColor: '#F8717122', borderColor: '#F87171' }]} onPress={() => setForm(f => ({ ...f, type: 'out', category: 'Other Expense' }))}><MaterialCommunityIcons name="arrow-up" size={16} color={!isIn ? '#F87171' : COLORS.onSurfaceVariant} /><Text style={[s.typeText, !isIn && { color: '#F87171' }]}>Money Out</Text></TouchableOpacity>
          </View>
          <Text style={s.fieldLabel}>Amount</Text>
          <TextInput style={[s.input, Platform.OS === 'web' && { outlineStyle: 'none' }]} placeholder="0.00" placeholderTextColor={COLORS.onSurfaceVariant} value={String(form.amount)} onChangeText={t => setForm(f => ({ ...f, amount: t.replace(/[^0-9.]/g, '') }))} keyboardType="decimal-pad" />
          <Text style={s.fieldLabel}>Category</Text><Chips options={cats} value={form.category} onChange={v => setForm(f => ({ ...f, category: v }))} accent={isIn ? '#34D399' : '#F87171'} />
          <Text style={s.fieldLabel}>Account</Text><Chips options={ACCOUNTS} value={form.account} onChange={v => setForm(f => ({ ...f, account: v }))} />
          <Text style={s.fieldLabel}>Method</Text><Chips options={METHODS} value={form.method} onChange={v => setForm(f => ({ ...f, method: v }))} />
          {relevant.length > 0 && (<><Text style={s.fieldLabel}>{isIn ? 'Customer' : 'Supplier'} (optional)</Text><Chips options={['None', ...relevant.map(p => p.name)]} value={parties.find(p => p.id === form.partyId)?.name || 'None'} onChange={name => setForm(f => ({ ...f, partyId: name === 'None' ? '' : (relevant.find(p => p.name === name)?.id || '') }))} /></>)}
          <Text style={s.fieldLabel}>Date</Text><TextInput style={[s.input, Platform.OS === 'web' && { outlineStyle: 'none' }]} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.onSurfaceVariant} value={form.date} onChangeText={t => setForm(f => ({ ...f, date: t }))} />
          <Text style={s.fieldLabel}>Note</Text><TextInput style={[s.input, Platform.OS === 'web' && { outlineStyle: 'none' }]} placeholder="Description (optional)" placeholderTextColor={COLORS.onSurfaceVariant} value={form.description} onChangeText={t => setForm(f => ({ ...f, description: t }))} />
          {err ? <Text style={s.formError}>{err}</Text> : null}
        </ScrollView>
        <TouchableOpacity style={[s.submitBtn, saving && { opacity: 0.6 }]} onPress={submit} disabled={saving}>{saving ? <ActivityIndicator size="small" color={COLORS.onPrimary} /> : <Text style={s.submitText}>Save Entry</Text>}</TouchableOpacity>
      </KeyboardAvoidingView></View>
    </Modal>
  );
}

export function PartyModal({ visible, party, onClose, onSaved }) {
  const { COLORS } = useTheme(); const s = kts(COLORS);
  const editing = !!party;
  const [form, setForm] = useState(emptyParty());
  const [saving, setSaving] = useState(false); const [err, setErr] = useState('');
  useEffect(() => {
    if (!visible) return;
    setForm(party
      ? { type: party.type || 'customer', name: party.name || '', email: party.email || '', phone: party.phone || '', panNo: party.panNo || '', address: party.address || '', openingBalance: String(party.openingBalance ?? '') }
      : emptyParty());
    setErr('');
  }, [visible, party]);
  const submit = async () => {
    if (!form.name.trim()) { setErr('Name is required.'); return; }
    setSaving(true); setErr('');
    const payload = { ...form, openingBalance: Number(form.openingBalance) || 0 };
    try {
      if (editing) await updateParty(party.id, payload); else await createParty(payload);
      onClose(); onSaved?.();
    } catch (e) { setErr(e.message); } finally { setSaving(false); }
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalCard}>
        <View style={s.modalHead}><Text style={s.modalTitle}>{editing ? 'Edit Party' : 'Add Party'}</Text><TouchableOpacity onPress={onClose} hitSlop={8}><MaterialCommunityIcons name="close" size={22} color={COLORS.onSurfaceVariant} /></TouchableOpacity></View>
        <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={s.fieldLabel}>Type</Text><Chips options={['customer', 'supplier']} value={form.type} onChange={v => setForm(f => ({ ...f, type: v }))} />
          <Text style={s.fieldLabel}>Name</Text><TextInput style={[s.input, Platform.OS === 'web' && { outlineStyle: 'none' }]} placeholder="Party name *" placeholderTextColor={COLORS.onSurfaceVariant} value={form.name} onChangeText={t => setForm(f => ({ ...f, name: t }))} />
          <View style={s.row2}><TextInput style={[s.input, { flex: 1 }, Platform.OS === 'web' && { outlineStyle: 'none' }]} placeholder="Email" placeholderTextColor={COLORS.onSurfaceVariant} value={form.email} onChangeText={t => setForm(f => ({ ...f, email: t }))} autoCapitalize="none" /><TextInput style={[s.input, { flex: 1 }, Platform.OS === 'web' && { outlineStyle: 'none' }]} placeholder="Phone" placeholderTextColor={COLORS.onSurfaceVariant} value={form.phone} onChangeText={t => setForm(f => ({ ...f, phone: t }))} keyboardType="phone-pad" /></View>
          <View style={s.row2}>
            <View style={{ flex: 1 }}><Text style={s.fieldLabel}>PAN / VAT No</Text><TextInput style={[s.input, Platform.OS === 'web' && { outlineStyle: 'none' }]} placeholder="9-digit (optional)" placeholderTextColor={COLORS.onSurfaceVariant} value={form.panNo} onChangeText={t => setForm(f => ({ ...f, panNo: t.replace(/[^0-9]/g, '') }))} keyboardType="number-pad" maxLength={9} /></View>
            <View style={{ flex: 1 }}><Text style={s.fieldLabel}>Address</Text><TextInput style={[s.input, Platform.OS === 'web' && { outlineStyle: 'none' }]} placeholder="optional" placeholderTextColor={COLORS.onSurfaceVariant} value={form.address} onChangeText={t => setForm(f => ({ ...f, address: t }))} /></View>
          </View>
          <Text style={s.fieldLabel}>Opening Balance ({form.type === 'customer' ? 'they owe you' : 'you owe them'})</Text><TextInput style={[s.input, Platform.OS === 'web' && { outlineStyle: 'none' }]} placeholder="0.00" placeholderTextColor={COLORS.onSurfaceVariant} value={String(form.openingBalance)} onChangeText={t => setForm(f => ({ ...f, openingBalance: t.replace(/[^0-9.]/g, '') }))} keyboardType="decimal-pad" />
          {err ? <Text style={s.formError}>{err}</Text> : null}
        </ScrollView>
        <TouchableOpacity style={[s.submitBtn, saving && { opacity: 0.6 }]} onPress={submit} disabled={saving}>{saving ? <ActivityIndicator size="small" color={COLORS.onPrimary} /> : <Text style={s.submitText}>{editing ? 'Save Changes' : 'Save Party'}</Text>}</TouchableOpacity>
      </KeyboardAvoidingView></View>
    </Modal>
  );
}

// Speed-dial: record money in/out + jump to Marshal/Bug chat.
export function TallyFab({ parties, onSaved }) {
  const { COLORS } = useTheme(); const s = kts(COLORS);
  const { user } = useAuth();
  const canCreate = can(user, 'tally', 'create');
  const [modal, setModal] = useState(null); // 'in' | 'out' | null
  return (
    <>
      <View style={s.fabCol}>
        {canCreate && <TouchableOpacity style={[s.fabMini, { backgroundColor: '#34D399' }]} onPress={() => setModal('in')} activeOpacity={0.85}><MaterialCommunityIcons name="arrow-down" size={18} color="#04210f" /><Text style={s.fabMiniText}>In</Text></TouchableOpacity>}
        {canCreate && <TouchableOpacity style={[s.fabMini, { backgroundColor: '#F87171' }]} onPress={() => setModal('out')} activeOpacity={0.85}><MaterialCommunityIcons name="arrow-up" size={18} color="#2a0a0a" /><Text style={s.fabMiniText}>Out</Text></TouchableOpacity>}
        <TouchableOpacity style={s.fab} onPress={() => router.push('/bug')} activeOpacity={0.85}><MaterialCommunityIcons name="robot-happy-outline" size={22} color={COLORS.onPrimary} /></TouchableOpacity>
      </View>
      <TxnModal visible={!!modal} type={modal} parties={parties} onClose={() => setModal(null)} onSaved={onSaved} />
    </>
  );
}

export { deleteTransaction };

const kts = (COLORS) => StyleSheet.create({
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  kpi: { flexGrow: 1, flexBasis: 150, minWidth: 140, ...glass(COLORS), borderLeftWidth: 4, borderRadius: ROUNDED.lg, padding: SPACING.md, gap: 4 },
  kpiValue: { fontSize: 24, fontWeight: '800', color: COLORS.onSurface, marginTop: 2 },
  kpiLabel: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.4 },
  card: { ...glass(COLORS), borderRadius: ROUNDED.xl, padding: SPACING.lg, marginBottom: SPACING.md },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { ...TYPOGRAPHY.labelLg, color: COLORS.onSurface, fontWeight: '700' },
  cardHint: { ...TYPOGRAPHY.bodySm, color: COLORS.onSurfaceVariant, marginTop: 1, marginBottom: SPACING.md },
  link: { ...TYPOGRAPHY.labelMd, color: COLORS.primary, fontWeight: '600' },
  muted: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurfaceVariant, fontStyle: 'italic', marginTop: SPACING.xs },
  flowChart: { flexDirection: 'row', alignItems: 'flex-end', height: 140, gap: SPACING.sm, marginTop: SPACING.sm },
  flowCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: 4 },
  flowBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: '85%' },
  flowBar: { width: 9, borderRadius: 3, minHeight: 2 },
  flowLabel: { ...TYPOGRAPHY.labelSm, fontSize: 10, color: COLORS.onSurfaceVariant },
  legendRow: { flexDirection: 'row', gap: SPACING.lg, marginTop: SPACING.sm, justifyContent: 'center' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant },
  expRow: { marginBottom: SPACING.md },
  expHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  expName: { ...TYPOGRAPHY.bodySm, color: COLORS.onSurface, fontWeight: '600' },
  expAmt: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant },
  barTrack: { height: 8, borderRadius: ROUNDED.full, backgroundColor: COLORS.surfaceContainerHighest, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: ROUNDED.full },
  txnLine: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: `${COLORS.outlineVariant}55` },
  txnIcon: { width: 32, height: 32, borderRadius: ROUNDED.md, justifyContent: 'center', alignItems: 'center' },
  txnCat: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurface, fontWeight: '600' },
  txnSub: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant, marginTop: 1 },
  txnAmt: { ...TYPOGRAPHY.labelMd, fontWeight: '800' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.surfaceContainerLowest, borderWidth: 1, borderColor: COLORS.outlineVariant, borderRadius: ROUNDED.md, paddingHorizontal: SPACING.sm, marginBottom: SPACING.sm },
  searchInput: { ...TYPOGRAPHY.bodySm, color: COLORS.onSurface, flex: 1, paddingVertical: 8 },
  miniTabs: { flexDirection: 'row', gap: 6, marginBottom: SPACING.sm },
  miniTab: { paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: ROUNDED.full, backgroundColor: COLORS.surfaceContainerHighest },
  miniTabActive: { backgroundColor: `${COLORS.primary}1A` },
  miniTabText: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant, fontWeight: '600' },
  miniTabTextActive: { color: COLORS.primary },
  dayHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.md, marginBottom: 2 },
  dayHeadText: { ...TYPOGRAPHY.labelMd, color: COLORS.onSurfaceVariant, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  dayHeadNet: { ...TYPOGRAPHY.labelSm, fontWeight: '700' },
  trow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: `${COLORS.outlineVariant}55`, gap: SPACING.sm },
  thead: { borderBottomColor: COLORS.outlineVariant },
  th: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: '700' },
  ledName: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurface, fontWeight: '600' },
  ledGroup: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant, textTransform: 'capitalize' },
  ledIn: { ...TYPOGRAPHY.labelMd, color: '#34D399', textAlign: 'right', fontWeight: '600' },
  ledOut: { ...TYPOGRAPHY.labelMd, color: '#F87171', textAlign: 'right', fontWeight: '600' },
  ledNet: { ...TYPOGRAPHY.labelMd, textAlign: 'right', fontWeight: '800' },
  plSection: { ...TYPOGRAPHY.labelSm, color: COLORS.primary, fontWeight: '800', letterSpacing: 0.6, marginBottom: SPACING.xs },
  plRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  plLabel: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurfaceVariant },
  plAmt: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurface, fontWeight: '600' },
  plBold: { color: COLORS.onSurface, fontWeight: '800' },
  plDivider: { height: 1, backgroundColor: COLORS.outlineVariant, marginVertical: 4 },
  netBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderRadius: ROUNDED.lg, padding: SPACING.md, marginTop: SPACING.lg },
  netLabel: { ...TYPOGRAPHY.labelLg, color: COLORS.onSurface, fontWeight: '800' },
  netVal: { fontSize: 22, fontWeight: '800' },
  bsHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  bsDot: { width: 10, height: 10, borderRadius: 5 },
  balanceCheck: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, borderWidth: 1, borderRadius: ROUNDED.lg, padding: SPACING.md, marginBottom: SPACING.md },
  balanceCheckText: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant, flex: 1 },
  addPartyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: COLORS.primary, paddingVertical: 11, borderRadius: ROUNDED.lg, marginBottom: SPACING.md },
  addPartyText: { ...TYPOGRAPHY.labelMd, color: COLORS.onPrimary, fontWeight: '700' },
  partyTotal: { ...TYPOGRAPHY.labelMd, fontWeight: '800' },
  filterRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  filterBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: COLORS.outlineVariant, backgroundColor: COLORS.surfaceContainerLowest, paddingVertical: 9, borderRadius: ROUNDED.md },
  filterBtnText: { ...TYPOGRAPHY.labelMd, color: COLORS.onSurfaceVariant, fontWeight: '700' },
  partyWrap: { borderBottomWidth: 1, borderBottomColor: `${COLORS.outlineVariant}55` },
  partyRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm },
  partyAvatar: { width: 36, height: 36, borderRadius: ROUNDED.md, justifyContent: 'center', alignItems: 'center' },
  partyInitial: { ...TYPOGRAPHY.labelLg, fontWeight: '800' },
  partyName: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurface, fontWeight: '600' },
  partySub: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant },
  partyBal: { ...TYPOGRAPHY.labelMd, fontWeight: '800' },
  partyBalSub: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.3 },
  partyDetail: { paddingLeft: 46, paddingBottom: SPACING.md, paddingTop: 2 },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.sm },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.surfaceContainerLowest, borderRadius: ROUNDED.full, paddingHorizontal: SPACING.sm, paddingVertical: 4, maxWidth: '100%' },
  metaText: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant },
  histTitle: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: '700', marginBottom: 4 },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 4 },
  histDate: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant, width: 96 },
  histCat: { ...TYPOGRAPHY.bodySm, color: COLORS.onSurface, flex: 1 },
  histAmt: { ...TYPOGRAPHY.labelSm, fontWeight: '700' },
  detailActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  detailBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: COLORS.outlineVariant, borderRadius: ROUNDED.full, paddingHorizontal: SPACING.md, paddingVertical: 6 },
  detailBtnText: { ...TYPOGRAPHY.labelSm, fontWeight: '700' },
  fabCol: { position: 'absolute', right: SPACING.lg, bottom: SPACING.lg, alignItems: 'center', gap: SPACING.sm },
  fabMini: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 12, height: 38, borderRadius: 19, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
  fabMiniText: { fontSize: 12, fontWeight: '800', color: '#04210f' },
  fab: { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
  modalCard: { width: '100%', maxWidth: 460, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.outlineVariant, borderRadius: ROUNDED.xl, padding: SPACING.lg },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  modalTitle: { ...TYPOGRAPHY.headlineMd, color: COLORS.onSurface, fontWeight: '800' },
  typeToggle: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderColor: COLORS.outlineVariant, backgroundColor: COLORS.surfaceContainerLowest, paddingVertical: 10, borderRadius: ROUNDED.md },
  typeText: { ...TYPOGRAPHY.labelMd, color: COLORS.onSurfaceVariant, fontWeight: '700' },
  fieldLabel: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6, marginTop: SPACING.sm },
  input: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurface, backgroundColor: COLORS.surfaceContainerLowest, borderWidth: 1, borderColor: COLORS.outlineVariant, borderRadius: ROUNDED.md, paddingHorizontal: SPACING.md, paddingVertical: 10, marginBottom: SPACING.xs },
  row2: { flexDirection: 'row', gap: SPACING.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: SPACING.xs },
  chip: { borderWidth: 1, borderColor: COLORS.outlineVariant, backgroundColor: COLORS.surfaceContainerLowest, paddingHorizontal: SPACING.md, paddingVertical: 7, borderRadius: ROUNDED.full },
  chipText: { ...TYPOGRAPHY.labelMd, color: COLORS.onSurfaceVariant, fontWeight: '600', textTransform: 'capitalize' },
  formError: { ...TYPOGRAPHY.bodySm, color: COLORS.error, marginTop: SPACING.sm },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: COLORS.primary, paddingVertical: 13, borderRadius: ROUNDED.lg, marginTop: SPACING.md },
  submitText: { ...TYPOGRAPHY.labelLg, color: COLORS.onPrimary, fontWeight: '800' },
});
