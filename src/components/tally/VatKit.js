import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Platform, Modal, KeyboardAvoidingView, ActivityIndicator, Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';
import { TYPOGRAPHY, SPACING, ROUNDED } from '@/constants';
import { getVat, createVatEntry, deleteVatEntry } from '@/client/api';
import { SkeletonKpis, SkeletonList, SkeletonCard } from '@/components/ui/Skeleton';
import { useSWR } from '@/client/cache/swr';
import { useAuth } from '@/contexts/AuthContext';
import { can } from '@/client/permissions';
import { npr, nprShort, nprPlain } from '@/client/currency';

export const VAT_RATE = 13; // Nepal standard VAT rate
export const glass = (COLORS) => ({ backgroundColor: COLORS.surfaceContainerLow, borderWidth: 1, borderColor: COLORS.outlineVariant, ...(Platform.OS === 'web' ? { backdropFilter: 'blur(12px)' } : {}) });

const dLabel = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }); };
const monthName = (key) => { const [y, m] = key.split('-'); return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }); };

export function useVatData() {
  const v = useSWR('vat', getVat);
  const reload = useCallback(() => v.refresh(), [v.refresh]);
  return {
    entries: v.data?.entries || [],
    summary: v.data?.summary || null,
    loading: v.loading,
    error: v.error?.message || '',
    reload,
  };
}

// ── PDF export (browser print-to-PDF on web) ────────────────────────────────
function buildVatHtml({ entries, summary, type, businessName }) {
  const title = type === 'sales' ? 'VAT Sales Register (बिक्री खाता)'
    : type === 'purchase' ? 'VAT Purchase Register (खरिद खाता)'
    : 'VAT Register';
  const rows = entries.map((e, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${dLabel(e.date)}</td>
      <td>${escapeHtml(e.billNo || '—')}</td>
      <td>${escapeHtml(e.partyName || '—')}</td>
      <td>${escapeHtml(e.partyPan || '—')}</td>
      <td class="r">${nprPlain(e.taxable)}</td>
      <td class="r">${e.vatRate}%</td>
      <td class="r">${nprPlain(e.vat)}</td>
      <td class="r">${nprPlain(e.total)}</td>
    </tr>`).join('');
  const tot = entries.reduce((a, e) => ({ taxable: a.taxable + e.taxable, vat: a.vat + e.vat, total: a.total + e.total }), { taxable: 0, vat: 0, total: 0 });
  const summaryBlock = summary ? `
    <div class="summary">
      <div><span>Output VAT (Sales)</span><b>${nprPlain(summary.outputVat)}</b></div>
      <div><span>Input VAT (Purchase)</span><b>${nprPlain(summary.inputVat)}</b></div>
      <div class="net"><span>${summary.netVat >= 0 ? 'Net VAT Payable' : 'VAT Credit Carried'}</span><b>${nprPlain(Math.abs(summary.netVat))}</b></div>
    </div>` : '';
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
  <style>
    * { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
    body { margin: 28px; color: #1a1a1a; }
    h1 { font-size: 18px; margin: 0 0 2px; }
    .biz { font-size: 13px; color: #555; margin: 0 0 2px; font-weight: 700; }
    .meta { font-size: 11px; color: #888; margin: 0 0 14px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border: 1px solid #ddd; padding: 5px 7px; text-align: left; }
    th { background: #f3f4f6; font-size: 10px; text-transform: uppercase; letter-spacing: .03em; }
    td.r, th.r { text-align: right; }
    tfoot td { font-weight: 800; background: #fafafa; }
    .summary { margin-top: 16px; display: flex; gap: 24px; font-size: 12px; }
    .summary div { border: 1px solid #ddd; border-radius: 8px; padding: 8px 14px; }
    .summary span { display: block; color: #777; font-size: 10px; text-transform: uppercase; }
    .summary b { font-size: 15px; }
    .summary .net b { color: #b45309; }
    .foot { margin-top: 22px; font-size: 10px; color: #aaa; }
    @media print { body { margin: 12px; } }
  </style></head><body>
    <p class="biz">${escapeHtml(businessName || 'Bug · Tally')}</p>
    <h1>${title}</h1>
    <p class="meta">Generated ${new Date().toLocaleString()} · ${entries.length} entries</p>
    <table>
      <thead><tr>
        <th>#</th><th>Date</th><th>Bill No</th><th>Party</th><th>PAN/VAT No</th>
        <th class="r">Taxable</th><th class="r">Rate</th><th class="r">VAT</th><th class="r">Total</th>
      </tr></thead>
      <tbody>${rows || '<tr><td colspan="9" style="text-align:center;color:#999">No entries</td></tr>'}</tbody>
      <tfoot><tr>
        <td colspan="5" class="r">TOTAL</td>
        <td class="r">${nprPlain(tot.taxable)}</td><td></td>
        <td class="r">${nprPlain(tot.vat)}</td><td class="r">${nprPlain(tot.total)}</td>
      </tr></tfoot>
    </table>
    ${summaryBlock}
    <p class="foot">Bug AI · VAT register export</p>
  </body></html>`;
}

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

export function exportVatPdf(payload) {
  if (Platform.OS !== 'web') {
    Alert.alert('Export on web', 'PDF download is available in the web app. Open Bug in a browser to save the VAT register as PDF.');
    return;
  }
  const html = buildVatHtml(payload);
  const w = window.open('', '_blank');
  if (!w) { Alert.alert('Popup blocked', 'Allow popups to download the PDF.'); return; }
  w.document.write(html); w.document.close(); w.focus();
  setTimeout(() => { try { w.print(); } catch {} }, 350);
}

// ── Summary KPI cards ───────────────────────────────────────────────────────
export function VatSummary({ summary, loading }) {
  const { COLORS } = useTheme(); const s = vts(COLORS);
  if (loading || !summary) return <SkeletonKpis count={4} />;
  const payable = summary.netVat >= 0;
  return (
    <View style={s.kpiRow}>
      <Kpi icon="arrow-up-bold-circle-outline" label="Output VAT · Sales" value={nprShort(summary.outputVat)} accent="#34D399" />
      <Kpi icon="arrow-down-bold-circle-outline" label="Input VAT · Purchase" value={nprShort(summary.inputVat)} accent="#FFB86E" />
      <Kpi icon={payable ? 'bank-outline' : 'wallet-plus-outline'} label={payable ? 'Net VAT Payable' : 'VAT Credit'} value={nprShort(Math.abs(summary.netVat))} accent={payable ? '#F87171' : '#89CEFF'} />
      <Kpi icon="receipt-text-outline" label="Total Entries" value={String(summary.totalCount)} accent="#A78BFA" />
    </View>
  );
}

function Kpi({ icon, label, value, accent }) {
  const { COLORS } = useTheme(); const s = vts(COLORS);
  return <View style={[s.kpi, { borderLeftColor: accent }]}><MaterialCommunityIcons name={icon} size={20} color={accent} /><Text style={s.kpiValue}>{value}</Text><Text style={s.kpiLabel}>{label}</Text></View>;
}

// ── Register (table + filters + export) ─────────────────────────────────────
export function VatRegister({ entries, summary, loading, onDelete, onExport }) {
  const { COLORS } = useTheme(); const s = vts(COLORS);
  const { user } = useAuth();
  const canDelete = can(user, 'tally', 'delete');
  const [typeF, setTypeF] = useState('all'); // all | sales | purchase
  const [search, setSearch] = useState('');

  if (loading) return <><SkeletonKpis count={4} /><SkeletonList rows={7} /></>;
  const q = search.trim().toLowerCase();
  const filtered = entries.filter(e =>
    (typeF === 'all' || e.type === typeF) &&
    (!q || (e.partyName || '').toLowerCase().includes(q) || (e.billNo || '').toLowerCase().includes(q) || (e.partyPan || '').toLowerCase().includes(q)));
  const tot = filtered.reduce((a, e) => ({ taxable: a.taxable + e.taxable, vat: a.vat + e.vat, total: a.total + e.total }), { taxable: 0, vat: 0, total: 0 });

  const accent = typeF === 'purchase' ? '#FFB86E' : typeF === 'sales' ? '#34D399' : COLORS.primary;

  return (
    <View style={s.card}>
      <View style={s.cardHeaderRow}>
        <Text style={s.cardTitle}>VAT Register</Text>
        <TouchableOpacity style={s.pdfBtn} onPress={() => onExport(typeF, filtered)} activeOpacity={0.85}>
          <MaterialCommunityIcons name="file-pdf-box" size={16} color="#fff" />
          <Text style={s.pdfBtnText}>Download PDF</Text>
        </TouchableOpacity>
      </View>
      <View style={s.searchRow}>
        <MaterialCommunityIcons name="magnify" size={16} color={COLORS.onSurfaceVariant} />
        <TextInput style={[s.searchInput, Platform.OS === 'web' && { outlineStyle: 'none' }]} placeholder="Search party, bill no or PAN…" placeholderTextColor={COLORS.onSurfaceVariant} value={search} onChangeText={setSearch} />
      </View>
      <View style={s.miniTabs}>{[['all', 'All'], ['sales', 'Sales'], ['purchase', 'Purchase']].map(([k, l]) => (
        <TouchableOpacity key={k} style={[s.miniTab, typeF === k && { backgroundColor: `${accent}1A` }]} onPress={() => setTypeF(k)}>
          <Text style={[s.miniTabText, typeF === k && { color: accent }]}>{l}</Text>
        </TouchableOpacity>
      ))}</View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ minWidth: 640 }}>
          <View style={[s.trow, s.thead]}>
            <Text style={[s.th, { width: 72 }]}>Date</Text>
            <Text style={[s.th, { width: 80 }]}>Bill No</Text>
            <Text style={[s.th, { flex: 1, minWidth: 120 }]}>Party</Text>
            <Text style={[s.th, { width: 96 }]}>PAN</Text>
            <Text style={[s.th, { width: 96, textAlign: 'right' }]}>Taxable</Text>
            <Text style={[s.th, { width: 88, textAlign: 'right' }]}>VAT</Text>
            <Text style={[s.th, { width: 96, textAlign: 'right' }]}>Total</Text>
            {canDelete && <View style={{ width: 28 }} />}
          </View>
          {filtered.length === 0 ? (
            <Text style={s.muted}>No {typeF === 'all' ? '' : typeF + ' '}entries yet — use the + button to record one.</Text>
          ) : filtered.map(e => (
            <Animated.View key={e.id} entering={FadeIn.duration(140)} style={s.trow}>
              <View style={{ width: 72 }}><View style={[s.typeDot, { backgroundColor: e.type === 'sales' ? '#34D399' : '#FFB86E' }]} /><Text style={s.cellSm}>{dLabel(e.date)}</Text></View>
              <Text style={[s.cell, { width: 80 }]} numberOfLines={1}>{e.billNo || '—'}</Text>
              <View style={{ flex: 1, minWidth: 120 }}><Text style={s.cell} numberOfLines={1}>{e.partyName || '—'}</Text>{e.description ? <Text style={s.cellSub} numberOfLines={1}>{e.description}</Text> : null}</View>
              <Text style={[s.cellSm, { width: 96 }]} numberOfLines={1}>{e.partyPan || '—'}</Text>
              <Text style={[s.cellNum, { width: 96 }]}>{nprPlain(e.taxable)}</Text>
              <Text style={[s.cellNum, { width: 88, color: e.type === 'sales' ? '#34D399' : '#FFB86E' }]}>{nprPlain(e.vat)}</Text>
              <Text style={[s.cellNum, { width: 96, fontWeight: '800' }]}>{nprPlain(e.total)}</Text>
              {canDelete && <TouchableOpacity onPress={() => onDelete(e.id)} hitSlop={6} style={{ width: 28, alignItems: 'flex-end' }}><MaterialCommunityIcons name="trash-can-outline" size={16} color={COLORS.error} /></TouchableOpacity>}
            </Animated.View>
          ))}
          {filtered.length > 0 && (
            <View style={[s.trow, s.tfoot]}>
              <Text style={[s.cell, { width: 152 + 96, fontWeight: '800' }]}>TOTAL · {filtered.length}</Text>
              <View style={{ flex: 1, minWidth: 120 }} />
              <Text style={[s.cellNum, { width: 96, fontWeight: '800' }]}>{nprPlain(tot.taxable)}</Text>
              <Text style={[s.cellNum, { width: 88, fontWeight: '800' }]}>{nprPlain(tot.vat)}</Text>
              <Text style={[s.cellNum, { width: 96, fontWeight: '800' }]}>{nprPlain(tot.total)}</Text>
              {canDelete && <View style={{ width: 28 }} />}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ── Analytics / tracer ──────────────────────────────────────────────────────
export function VatAnalytics({ summary, entries, loading }) {
  const { COLORS } = useTheme(); const s = vts(COLORS);
  if (loading || !summary) return <><SkeletonKpis count={4} /><SkeletonCard rows={6} /></>;
  const maxBar = Math.max(1, ...summary.trend.map(m => Math.max(m.output, m.input)));
  const payable = summary.netVat >= 0;

  // Top parties by VAT (output side — your biggest taxable customers).
  const byParty = {};
  for (const e of entries) { const k = e.partyName || '—'; const p = byParty[k] || { name: k, sales: 0, purchase: 0 }; p[e.type] += e.vat; byParty[k] = p; }
  const topParties = Object.values(byParty).map(p => ({ ...p, total: p.sales + p.purchase })).sort((a, b) => b.total - a.total).slice(0, 6);
  const maxParty = Math.max(1, ...topParties.map(p => p.total));

  return (
    <>
      <VatSummary summary={summary} loading={false} />

      <View style={[s.netBox, { backgroundColor: payable ? '#F8717115' : '#89CEFF15', borderColor: payable ? '#F8717155' : '#89CEFF55' }]}>
        <View style={{ flex: 1 }}>
          <Text style={s.netLabel}>{payable ? 'Net VAT Payable to IRD' : 'VAT Credit Carried Forward'}</Text>
          <Text style={s.netHint}>Output {npr(summary.outputVat)} − Input {npr(summary.inputVat)}</Text>
        </View>
        <Text style={[s.netVal, { color: payable ? '#F87171' : '#89CEFF' }]}>{npr(Math.abs(summary.netVat))}</Text>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Output vs Input VAT</Text>
        <Text style={s.cardHint}>Last 6 months · green = collected, orange = paid</Text>
        <View style={s.flowChart}>{summary.trend.map((m, i) => (
          <View key={i} style={s.flowCol}>
            <View style={s.flowBars}>
              <View style={[s.flowBar, { height: `${(m.output / maxBar) * 100}%`, backgroundColor: '#34D399' }]} />
              <View style={[s.flowBar, { height: `${(m.input / maxBar) * 100}%`, backgroundColor: '#FFB86E' }]} />
            </View>
            <Text style={s.flowLabel}>{m.label}</Text>
          </View>
        ))}</View>
        <View style={s.legendRow}>
          <View style={s.legend}><View style={[s.legendDot, { backgroundColor: '#34D399' }]} /><Text style={s.legendText}>Output (Sales)</Text></View>
          <View style={s.legend}><View style={[s.legendDot, { backgroundColor: '#FFB86E' }]} /><Text style={s.legendText}>Input (Purchase)</Text></View>
        </View>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Net VAT by Month</Text>
        <Text style={s.cardHint}>Payable (red) or credit (blue) each month</Text>
        {summary.trend.map((m) => {
          const pay = m.net >= 0;
          return (
            <View key={m.key} style={s.netRow}>
              <Text style={s.netRowLabel}>{monthName(m.key)}</Text>
              <Text style={[s.netRowVal, { color: pay ? '#F87171' : '#89CEFF' }]}>{pay ? '' : '+'}{npr(Math.abs(m.net))}{pay ? ' due' : ' credit'}</Text>
            </View>
          );
        })}
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Top Parties by VAT</Text>
        {topParties.length === 0 ? <Text style={s.muted}>No entries yet.</Text> : topParties.map((p, i) => (
          <View key={p.name} style={s.expRow}>
            <View style={s.expHead}><Text style={s.expName} numberOfLines={1}>{p.name}</Text><Text style={s.expAmt}>{npr(p.total)}</Text></View>
            <View style={s.barTrack}><View style={[s.barFill, { width: `${(p.total / maxParty) * 100}%`, backgroundColor: p.sales >= p.purchase ? '#34D399' : '#FFB86E' }]} /></View>
          </View>
        ))}
      </View>
    </>
  );
}

// ── VAT Calculator ──────────────────────────────────────────────────────────
export function VatCalculator() {
  const { COLORS } = useTheme(); const s = vts(COLORS);
  const [amount, setAmount] = useState('');
  const [rate, setRate] = useState(String(VAT_RATE));
  const [mode, setMode] = useState('add'); // add = exclusive · extract = inclusive

  const r = Math.max(0, Number(rate) || 0);
  const amt = Math.max(0, Number(amount) || 0);
  const { taxable, vat, total } = useMemo(() => {
    if (mode === 'extract') { const tx = amt / (1 + r / 100); return { taxable: tx, vat: amt - tx, total: amt }; }
    const v = (amt * r) / 100; return { taxable: amt, vat: v, total: amt + v };
  }, [amt, r, mode]);

  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>VAT Calculator</Text>
      <Text style={s.cardHint}>Nepal standard rate is 13%. Add VAT to a net amount, or extract VAT from a gross amount.</Text>

      <View style={s.typeToggle}>
        <TouchableOpacity style={[s.typeBtn, mode === 'add' && { backgroundColor: '#34D39922', borderColor: '#34D399' }]} onPress={() => setMode('add')}>
          <MaterialCommunityIcons name="plus" size={15} color={mode === 'add' ? '#34D399' : COLORS.onSurfaceVariant} /><Text style={[s.typeText, mode === 'add' && { color: '#34D399' }]}>Add VAT (exclusive)</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.typeBtn, mode === 'extract' && { backgroundColor: '#FFB86E22', borderColor: '#FFB86E' }]} onPress={() => setMode('extract')}>
          <MaterialCommunityIcons name="call-split" size={15} color={mode === 'extract' ? '#FFB86E' : COLORS.onSurfaceVariant} /><Text style={[s.typeText, mode === 'extract' && { color: '#FFB86E' }]}>Extract VAT (inclusive)</Text>
        </TouchableOpacity>
      </View>

      <View style={s.row2}>
        <View style={{ flex: 2 }}>
          <Text style={s.fieldLabel}>{mode === 'extract' ? 'Gross amount (incl. VAT)' : 'Net amount (excl. VAT)'}</Text>
          <TextInput style={[s.input, Platform.OS === 'web' && { outlineStyle: 'none' }]} placeholder="0.00" placeholderTextColor={COLORS.onSurfaceVariant} value={amount} onChangeText={t => setAmount(t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.fieldLabel}>Rate %</Text>
          <TextInput style={[s.input, Platform.OS === 'web' && { outlineStyle: 'none' }]} placeholder="13" placeholderTextColor={COLORS.onSurfaceVariant} value={rate} onChangeText={t => setRate(t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" />
        </View>
      </View>

      <View style={s.resultBox}>
        <Result label="Taxable amount" value={npr(taxable)} />
        <Result label={`VAT @ ${r}%`} value={npr(vat)} accent="#FFB86E" />
        <View style={s.plDivider} />
        <Result label="Total" value={npr(total)} bold accent="#34D399" />
      </View>
    </View>
  );
}

function Result({ label, value, bold, accent }) {
  const { COLORS } = useTheme(); const s = vts(COLORS);
  return (
    <View style={s.resRow}>
      <Text style={[s.resLabel, bold && { fontWeight: '800', color: COLORS.onSurface }]}>{label}</Text>
      <Text style={[s.resVal, bold && { fontSize: 22 }, accent ? { color: accent } : null]}>{value}</Text>
    </View>
  );
}

// ── Record modal + FAB ──────────────────────────────────────────────────────
const emptyEntry = () => ({ type: 'sales', billNo: '', partyName: '', partyPan: '', amount: '', vatRate: String(VAT_RATE), description: '', date: new Date().toISOString().slice(0, 10) });

export function VatEntryModal({ visible, type, onClose, onSaved }) {
  const { COLORS } = useTheme(); const s = vts(COLORS);
  const [form, setForm] = useState(emptyEntry());
  const [mode, setMode] = useState('total'); // 'total' = enter invoice total (extract VAT) · 'taxable' = enter net (add VAT)
  const [saving, setSaving] = useState(false); const [err, setErr] = useState('');
  useEffect(() => { if (visible) { setForm({ ...emptyEntry(), type: type || 'sales' }); setMode('total'); setErr(''); } }, [visible, type]);

  const isSales = form.type === 'sales';
  const r = Math.max(0, Number(form.vatRate) || 0);
  const amt = Math.max(0, Number(form.amount) || 0);
  // 'total' → the figure typed is VAT-inclusive, so back out the 13%.
  // 'taxable' → the figure typed is net, so add VAT on top.
  const { taxable, vat, total } = mode === 'total'
    ? (() => { const tx = amt / (1 + r / 100); return { taxable: tx, vat: amt - tx, total: amt }; })()
    : { taxable: amt, vat: (amt * r) / 100, total: amt + (amt * r) / 100 };

  const submit = async () => {
    if (!amt || amt <= 0) { setErr('Enter an amount greater than 0.'); return; }
    setSaving(true); setErr('');
    try {
      await createVatEntry({
        type: form.type, billNo: form.billNo, partyName: form.partyName, partyPan: form.partyPan,
        description: form.description, date: form.date, taxable, vatRate: r,
      });
      onClose(); onSaved?.();
    } catch (e) { setErr(e.message); } finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalCard}>
        <View style={s.modalHead}><Text style={s.modalTitle}>{isSales ? 'VAT Sales Entry' : 'VAT Purchase Entry'}</Text><TouchableOpacity onPress={onClose} hitSlop={8}><MaterialCommunityIcons name="close" size={22} color={COLORS.onSurfaceVariant} /></TouchableOpacity></View>
        <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={s.typeToggle}>
            <TouchableOpacity style={[s.typeBtn, isSales && { backgroundColor: '#34D39922', borderColor: '#34D399' }]} onPress={() => setForm(f => ({ ...f, type: 'sales' }))}><MaterialCommunityIcons name="arrow-up" size={15} color={isSales ? '#34D399' : COLORS.onSurfaceVariant} /><Text style={[s.typeText, isSales && { color: '#34D399' }]}>Sales (Output)</Text></TouchableOpacity>
            <TouchableOpacity style={[s.typeBtn, !isSales && { backgroundColor: '#FFB86E22', borderColor: '#FFB86E' }]} onPress={() => setForm(f => ({ ...f, type: 'purchase' }))}><MaterialCommunityIcons name="arrow-down" size={15} color={!isSales ? '#FFB86E' : COLORS.onSurfaceVariant} /><Text style={[s.typeText, !isSales && { color: '#FFB86E' }]}>Purchase (Input)</Text></TouchableOpacity>
          </View>

          <View style={s.row2}>
            <View style={{ flex: 1 }}><Text style={s.fieldLabel}>Bill / Invoice No</Text><TextInput style={[s.input, Platform.OS === 'web' && { outlineStyle: 'none' }]} placeholder="e.g. 001" placeholderTextColor={COLORS.onSurfaceVariant} value={form.billNo} onChangeText={t => setForm(f => ({ ...f, billNo: t }))} /></View>
            <View style={{ flex: 1 }}><Text style={s.fieldLabel}>Date</Text><TextInput style={[s.input, Platform.OS === 'web' && { outlineStyle: 'none' }]} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.onSurfaceVariant} value={form.date} onChangeText={t => setForm(f => ({ ...f, date: t }))} /></View>
          </View>

          <Text style={s.fieldLabel}>{isSales ? 'Customer name' : 'Supplier name'}</Text>
          <TextInput style={[s.input, Platform.OS === 'web' && { outlineStyle: 'none' }]} placeholder="Party name" placeholderTextColor={COLORS.onSurfaceVariant} value={form.partyName} onChangeText={t => setForm(f => ({ ...f, partyName: t }))} />

          <Text style={s.fieldLabel}>Party PAN / VAT No</Text>
          <TextInput style={[s.input, Platform.OS === 'web' && { outlineStyle: 'none' }]} placeholder="9-digit PAN (optional)" placeholderTextColor={COLORS.onSurfaceVariant} value={form.partyPan} onChangeText={t => setForm(f => ({ ...f, partyPan: t.replace(/[^0-9]/g, '') }))} keyboardType="number-pad" maxLength={9} />

          <Text style={s.fieldLabel}>Amount type</Text>
          <View style={s.modeRow}>
            <TouchableOpacity style={[s.modeChip, mode === 'total' && { backgroundColor: `${COLORS.primary}1A`, borderColor: COLORS.primary }]} onPress={() => setMode('total')}>
              <Text style={[s.modeChipText, mode === 'total' && { color: COLORS.primary }]}>Invoice total (incl. VAT)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.modeChip, mode === 'taxable' && { backgroundColor: `${COLORS.primary}1A`, borderColor: COLORS.primary }]} onPress={() => setMode('taxable')}>
              <Text style={[s.modeChipText, mode === 'taxable' && { color: COLORS.primary }]}>Taxable (excl. VAT)</Text>
            </TouchableOpacity>
          </View>

          <View style={s.row2}>
            <View style={{ flex: 2 }}><Text style={s.fieldLabel}>{mode === 'total' ? 'Invoice total amount' : 'Taxable amount'}</Text><TextInput style={[s.input, Platform.OS === 'web' && { outlineStyle: 'none' }]} placeholder="0.00" placeholderTextColor={COLORS.onSurfaceVariant} value={String(form.amount)} onChangeText={t => setForm(f => ({ ...f, amount: t.replace(/[^0-9.]/g, '') }))} keyboardType="decimal-pad" /></View>
            <View style={{ flex: 1 }}><Text style={s.fieldLabel}>VAT %</Text><TextInput style={[s.input, Platform.OS === 'web' && { outlineStyle: 'none' }]} placeholder="13" placeholderTextColor={COLORS.onSurfaceVariant} value={String(form.vatRate)} onChangeText={t => setForm(f => ({ ...f, vatRate: t.replace(/[^0-9.]/g, '') }))} keyboardType="decimal-pad" /></View>
          </View>

          <View style={s.previewBox}>
            <View style={s.resRow}><Text style={s.resLabel}>Taxable amount</Text><Text style={s.resVal}>{npr(taxable)}</Text></View>
            <View style={s.resRow}><Text style={s.resLabel}>VAT @ {r}%</Text><Text style={[s.resVal, { color: isSales ? '#34D399' : '#FFB86E' }]}>{npr(vat)}</Text></View>
            <View style={s.plDivider} />
            <View style={s.resRow}><Text style={[s.resLabel, { fontWeight: '800', color: COLORS.onSurface }]}>Invoice total</Text><Text style={[s.resVal, { fontWeight: '800' }]}>{npr(total)}</Text></View>
          </View>

          <Text style={s.fieldLabel}>Note (optional)</Text>
          <TextInput style={[s.input, Platform.OS === 'web' && { outlineStyle: 'none' }]} placeholder="Description" placeholderTextColor={COLORS.onSurfaceVariant} value={form.description} onChangeText={t => setForm(f => ({ ...f, description: t }))} />
          {err ? <Text style={s.formError}>{err}</Text> : null}
        </ScrollView>
        <TouchableOpacity style={[s.submitBtn, saving && { opacity: 0.6 }]} onPress={submit} disabled={saving}>{saving ? <ActivityIndicator size="small" color={COLORS.onPrimary} /> : <Text style={s.submitText}>Save Entry</Text>}</TouchableOpacity>
      </KeyboardAvoidingView></View>
    </Modal>
  );
}

export function VatFab({ onSaved }) {
  const { COLORS } = useTheme(); const s = vts(COLORS);
  const { user } = useAuth();
  const canCreate = can(user, 'tally', 'create');
  const [modal, setModal] = useState(null); // 'sales' | 'purchase' | null
  return (
    <>
      <View style={s.fabCol}>
        {canCreate && <TouchableOpacity style={[s.fabMini, { backgroundColor: '#34D399' }]} onPress={() => setModal('sales')} activeOpacity={0.85}><MaterialCommunityIcons name="arrow-up" size={16} color="#04210f" /><Text style={[s.fabMiniText, { color: '#04210f' }]}>Sales</Text></TouchableOpacity>}
        {canCreate && <TouchableOpacity style={[s.fabMini, { backgroundColor: '#FFB86E' }]} onPress={() => setModal('purchase')} activeOpacity={0.85}><MaterialCommunityIcons name="arrow-down" size={16} color="#3a2400" /><Text style={[s.fabMiniText, { color: '#3a2400' }]}>Purchase</Text></TouchableOpacity>}
      </View>
      <VatEntryModal visible={!!modal} type={modal} onClose={() => setModal(null)} onSaved={onSaved} />
    </>
  );
}

export { deleteVatEntry };

const vts = (COLORS) => StyleSheet.create({
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  kpi: { flexGrow: 1, flexBasis: 150, minWidth: 140, ...glass(COLORS), borderLeftWidth: 4, borderRadius: ROUNDED.lg, padding: SPACING.md, gap: 4 },
  kpiValue: { fontSize: 22, fontWeight: '800', color: COLORS.onSurface, marginTop: 2 },
  kpiLabel: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.4 },
  card: { ...glass(COLORS), borderRadius: ROUNDED.xl, padding: SPACING.lg, marginBottom: SPACING.md },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  cardTitle: { ...TYPOGRAPHY.labelLg, color: COLORS.onSurface, fontWeight: '700' },
  cardHint: { ...TYPOGRAPHY.bodySm, color: COLORS.onSurfaceVariant, marginTop: 1, marginBottom: SPACING.md },
  muted: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurfaceVariant, fontStyle: 'italic', marginVertical: SPACING.md, textAlign: 'center' },
  pdfBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#C0392B', paddingHorizontal: SPACING.md, paddingVertical: 7, borderRadius: ROUNDED.full },
  pdfBtnText: { ...TYPOGRAPHY.labelSm, color: '#fff', fontWeight: '700' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.surfaceContainerLowest, borderWidth: 1, borderColor: COLORS.outlineVariant, borderRadius: ROUNDED.md, paddingHorizontal: SPACING.sm, marginBottom: SPACING.sm },
  searchInput: { ...TYPOGRAPHY.bodySm, color: COLORS.onSurface, flex: 1, paddingVertical: 8 },
  miniTabs: { flexDirection: 'row', gap: 6, marginBottom: SPACING.sm },
  miniTab: { paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: ROUNDED.full, backgroundColor: COLORS.surfaceContainerHighest },
  miniTabText: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant, fontWeight: '600' },
  trow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: `${COLORS.outlineVariant}55`, gap: SPACING.xs },
  thead: { borderBottomColor: COLORS.outlineVariant },
  tfoot: { borderBottomWidth: 0, borderTopWidth: 2, borderTopColor: COLORS.outlineVariant, marginTop: 2 },
  th: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.3, fontWeight: '700', fontSize: 10 },
  typeDot: { width: 6, height: 6, borderRadius: 3, marginBottom: 3 },
  cell: { ...TYPOGRAPHY.bodySm, color: COLORS.onSurface },
  cellSub: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant, fontSize: 10 },
  cellSm: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant },
  cellNum: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurface, textAlign: 'right', fontVariant: ['tabular-nums'] },
  expRow: { marginBottom: SPACING.md },
  expHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5, gap: SPACING.sm },
  expName: { ...TYPOGRAPHY.bodySm, color: COLORS.onSurface, fontWeight: '600', flex: 1 },
  expAmt: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant },
  barTrack: { height: 8, borderRadius: ROUNDED.full, backgroundColor: COLORS.surfaceContainerHighest, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: ROUNDED.full },
  flowChart: { flexDirection: 'row', alignItems: 'flex-end', height: 140, gap: SPACING.sm, marginTop: SPACING.sm },
  flowCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: 4 },
  flowBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: '85%' },
  flowBar: { width: 9, borderRadius: 3, minHeight: 2 },
  flowLabel: { ...TYPOGRAPHY.labelSm, fontSize: 10, color: COLORS.onSurfaceVariant },
  legendRow: { flexDirection: 'row', gap: SPACING.lg, marginTop: SPACING.sm, justifyContent: 'center' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant },
  netBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: ROUNDED.lg, padding: SPACING.md, marginBottom: SPACING.md, gap: SPACING.sm },
  netLabel: { ...TYPOGRAPHY.labelLg, color: COLORS.onSurface, fontWeight: '800' },
  netHint: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant, marginTop: 2 },
  netVal: { fontSize: 22, fontWeight: '800' },
  netRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: `${COLORS.outlineVariant}44` },
  netRowLabel: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurfaceVariant },
  netRowVal: { ...TYPOGRAPHY.labelMd, fontWeight: '700' },
  plDivider: { height: 1, backgroundColor: COLORS.outlineVariant, marginVertical: 6 },
  typeToggle: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderColor: COLORS.outlineVariant, backgroundColor: COLORS.surfaceContainerLowest, paddingVertical: 10, borderRadius: ROUNDED.md },
  typeText: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant, fontWeight: '700' },
  fieldLabel: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6, marginTop: SPACING.sm },
  input: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurface, backgroundColor: COLORS.surfaceContainerLowest, borderWidth: 1, borderColor: COLORS.outlineVariant, borderRadius: ROUNDED.md, paddingHorizontal: SPACING.md, paddingVertical: 10, marginBottom: SPACING.xs },
  row2: { flexDirection: 'row', gap: SPACING.sm },
  modeRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.xs },
  modeChip: { flex: 1, alignItems: 'center', borderWidth: 1, borderColor: COLORS.outlineVariant, backgroundColor: COLORS.surfaceContainerLowest, paddingVertical: 9, borderRadius: ROUNDED.md },
  modeChipText: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant, fontWeight: '700' },
  resultBox: { ...glass(COLORS), borderRadius: ROUNDED.lg, padding: SPACING.md, marginTop: SPACING.md },
  previewBox: { backgroundColor: COLORS.surfaceContainerLowest, borderRadius: ROUNDED.md, padding: SPACING.md, marginTop: SPACING.sm },
  resRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  resLabel: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurfaceVariant },
  resVal: { ...TYPOGRAPHY.labelLg, color: COLORS.onSurface, fontWeight: '700' },
  formError: { ...TYPOGRAPHY.bodySm, color: COLORS.error, marginTop: SPACING.sm },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: COLORS.primary, paddingVertical: 13, borderRadius: ROUNDED.lg, marginTop: SPACING.md },
  submitText: { ...TYPOGRAPHY.labelLg, color: COLORS.onPrimary, fontWeight: '800' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
  modalCard: { width: '100%', maxWidth: 480, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.outlineVariant, borderRadius: ROUNDED.xl, padding: SPACING.lg },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  modalTitle: { ...TYPOGRAPHY.headlineMd, color: COLORS.onSurface, fontWeight: '800' },
  fabCol: { position: 'absolute', right: SPACING.lg, bottom: SPACING.lg, alignItems: 'flex-end', gap: SPACING.sm },
  fabMini: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, height: 42, borderRadius: 21, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
  fabMiniText: { fontSize: 13, fontWeight: '800' },
});
