import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Platform, ActivityIndicator, Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { TYPOGRAPHY, SPACING, ROUNDED } from '@/constants';
import { createVatEntry } from '@/client/api';
import { useAuth } from '@/contexts/AuthContext';
import { can } from '@/client/permissions';
import { npr, nprPlain } from '@/client/currency';

export const BILL_VAT_RATE = 13;
const glass = (COLORS) => ({ backgroundColor: COLORS.surfaceContainerLow, borderWidth: 1, borderColor: COLORS.outlineVariant, ...(Platform.OS === 'web' ? { backdropFilter: 'blur(12px)' } : {}) });
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ── Amount in words (Indian/Nepali numbering: lakh, crore) ──────────────────
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
function twoDigit(n) { return n < 20 ? ONES[n] : (TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '')); }
function threeDigit(n) { const h = Math.floor(n / 100), r = n % 100; return (h ? ONES[h] + ' Hundred' + (r ? ' ' : '') : '') + (r ? twoDigit(r) : ''); }
function intToWords(num) {
  num = Math.floor(num);
  if (num === 0) return 'Zero';
  let w = '';
  const crore = Math.floor(num / 1e7); num %= 1e7;
  const lakh = Math.floor(num / 1e5); num %= 1e5;
  const thousand = Math.floor(num / 1e3); num %= 1e3;
  if (crore) w += twoDigit(crore) + ' Crore ';
  if (lakh) w += twoDigit(lakh) + ' Lakh ';
  if (thousand) w += twoDigit(thousand) + ' Thousand ';
  if (num) w += threeDigit(num);
  return w.trim();
}
export function amountInWords(v) {
  const n = Math.max(0, Number(v) || 0);
  const rupees = Math.floor(n);
  const paisa = Math.round((n - rupees) * 100);
  let w = intToWords(rupees) + ' Rupee' + (rupees === 1 ? '' : 's');
  if (paisa) w += ' and ' + twoDigit(paisa) + ' Paisa';
  return w + ' Only';
}

// ── Tax invoice PDF (browser print-to-PDF) ──────────────────────────────────
function buildInvoiceHtml({ seller, customer, billNo, date, items, taxable, vatRate, vat, total }) {
  const rows = items.map((it, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(it.description || '—')}</td>
      <td class="r">${it.qty}</td>
      <td class="r">${nprPlain(it.rate)}</td>
      <td class="r">${nprPlain(it.amount)}</td>
    </tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Tax Invoice ${escapeHtml(billNo || '')}</title>
  <style>
    * { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; box-sizing: border-box; }
    body { margin: 0; color: #1a1a1a; }
    .sheet { max-width: 760px; margin: 24px auto; padding: 28px; border: 1px solid #e5e5e5; }
    .top { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1a1a1a; padding-bottom: 12px; }
    .biz { font-size: 20px; font-weight: 800; margin: 0; }
    .biz-sub { font-size: 11px; color: #666; margin: 2px 0 0; }
    .tag { text-align: right; }
    .tag h2 { margin: 0; font-size: 16px; letter-spacing: .08em; color: #b45309; }
    .tag p { margin: 2px 0 0; font-size: 11px; color: #555; }
    .parties { display: flex; justify-content: space-between; margin: 16px 0; gap: 24px; }
    .parties h3 { font-size: 10px; text-transform: uppercase; letter-spacing: .05em; color: #888; margin: 0 0 4px; }
    .parties .name { font-size: 13px; font-weight: 700; }
    .parties .line { font-size: 11px; color: #555; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 6px; }
    th, td { border: 1px solid #ddd; padding: 7px 9px; text-align: left; }
    th { background: #f3f4f6; font-size: 10px; text-transform: uppercase; letter-spacing: .03em; }
    td.r, th.r { text-align: right; }
    .totals { width: 280px; margin-left: auto; margin-top: 10px; font-size: 12px; }
    .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
    .totals .grand { border-top: 2px solid #1a1a1a; margin-top: 4px; padding-top: 8px; font-size: 15px; font-weight: 800; }
    .words { margin-top: 14px; font-size: 11px; }
    .words b { text-transform: capitalize; }
    .foot { margin-top: 34px; display: flex; justify-content: space-between; font-size: 11px; color: #777; }
    .sign { border-top: 1px solid #999; padding-top: 4px; width: 180px; text-align: center; }
    @media print { .sheet { border: none; margin: 0; } }
  </style></head><body>
    <div class="sheet">
      <div class="top">
        <div>
          <p class="biz">${escapeHtml(seller.name || 'Bug · Tally')}</p>
          ${seller.pan ? `<p class="biz-sub">PAN/VAT No: ${escapeHtml(seller.pan)}</p>` : ''}
        </div>
        <div class="tag"><h2>TAX INVOICE</h2><p>Invoice No: <b>${escapeHtml(billNo || '—')}</b></p><p>Date: ${escapeHtml(date)}</p></div>
      </div>
      <div class="parties">
        <div>
          <h3>Bill To</h3>
          <div class="name">${escapeHtml(customer.name || '—')}</div>
          ${customer.pan ? `<div class="line">PAN/VAT No: ${escapeHtml(customer.pan)}</div>` : ''}
          ${customer.address ? `<div class="line">${escapeHtml(customer.address)}</div>` : ''}
        </div>
      </div>
      <table>
        <thead><tr><th>#</th><th>Description</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5" style="text-align:center;color:#999">No items</td></tr>'}</tbody>
      </table>
      <div class="totals">
        <div><span>Taxable Amount</span><span>${nprPlain(taxable)}</span></div>
        <div><span>VAT @ ${vatRate}%</span><span>${nprPlain(vat)}</span></div>
        <div class="grand"><span>Grand Total</span><span>${nprPlain(total)}</span></div>
      </div>
      <p class="words">Amount in words: <b>${amountInWords(total)}</b></p>
      <div class="foot">
        <div>This is a computer-generated tax invoice.</div>
        <div class="sign">Authorised Signature</div>
      </div>
    </div>
  </body></html>`;
}

export function exportInvoicePdf(payload) {
  if (Platform.OS !== 'web') {
    Alert.alert('Export on web', 'PDF invoice download is available in the web app. Open Bug in a browser.');
    return;
  }
  const w = window.open('', '_blank');
  if (!w) { Alert.alert('Popup blocked', 'Allow popups to download the invoice PDF.'); return; }
  w.document.write(buildInvoiceHtml(payload)); w.document.close(); w.focus();
  setTimeout(() => { try { w.print(); } catch {} }, 350);
}

// ── Generator UI ────────────────────────────────────────────────────────────
const emptyItem = () => ({ description: '', qty: '1', rate: '' });

export function SalesBillGenerator({ onSaved }) {
  const { COLORS } = useTheme(); const s = bts(COLORS);
  const { user } = useAuth();
  const canCreate = can(user, 'tally', 'create');
  const businessName = user?.team?.businessName || '';

  const [sellerPan, setSellerPan] = useState('');
  const [customer, setCustomer] = useState({ name: '', pan: '', address: '' });
  const [billNo, setBillNo] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [vatRate, setVatRate] = useState(String(BILL_VAT_RATE));
  const [items, setItems] = useState([emptyItem()]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(''); const [ok, setOk] = useState('');

  const r = Math.max(0, Number(vatRate) || 0);
  const lines = useMemo(() => items.map(it => ({
    description: it.description,
    qty: Math.max(0, Number(it.qty) || 0),
    rate: Math.max(0, Number(it.rate) || 0),
    amount: round2((Number(it.qty) || 0) * (Number(it.rate) || 0)),
  })), [items]);
  const taxable = round2(lines.reduce((a, l) => a + l.amount, 0));
  const vat = round2((taxable * r) / 100);
  const total = round2(taxable + vat);

  const setItem = (i, key, val) => setItems(arr => arr.map((it, idx) => idx === i ? { ...it, [key]: val } : it));
  const addItem = () => setItems(arr => [...arr, emptyItem()]);
  const removeItem = (i) => setItems(arr => arr.length > 1 ? arr.filter((_, idx) => idx !== i) : arr);

  const reset = () => { setCustomer({ name: '', pan: '', address: '' }); setBillNo(''); setItems([emptyItem()]); setDate(new Date().toISOString().slice(0, 10)); };

  const generate = async () => {
    setErr(''); setOk('');
    if (!customer.name.trim()) { setErr('Customer name is required.'); return; }
    if (taxable <= 0) { setErr('Add at least one item with an amount.'); return; }
    setSaving(true);
    const payload = {
      seller: { name: businessName, pan: sellerPan.trim() },
      customer: { name: customer.name.trim(), pan: customer.pan.trim(), address: customer.address.trim() },
      billNo: billNo.trim(), date, items: lines, taxable, vatRate: r, vat, total,
    };
    try {
      // Save into the VAT register as a sales entry, then produce the PDF.
      await createVatEntry({
        type: 'sales', source: 'bill', billNo: billNo.trim(),
        partyName: customer.name.trim(), partyPan: customer.pan.trim(), address: customer.address.trim(),
        items: lines, taxable, vatRate: r, date,
        description: lines.map(l => l.description).filter(Boolean).slice(0, 3).join(', '),
      });
      exportInvoicePdf(payload);
      onSaved?.();
      setOk(`Invoice saved to VAT register · ${npr(total)}. PDF opened in a new tab.`);
      reset();
    } catch (e) { setErr(e.message); } finally { setSaving(false); }
  };

  const preview = () => exportInvoicePdf({
    seller: { name: businessName, pan: sellerPan.trim() },
    customer: { name: customer.name.trim() || '—', pan: customer.pan.trim(), address: customer.address.trim() },
    billNo: billNo.trim(), date, items: lines, taxable, vatRate: r, vat, total,
  });

  if (!canCreate) {
    return <View style={s.card}><Text style={s.muted}>You don't have permission to create sales bills.</Text></View>;
  }

  return (
    <>
      <View style={s.card}>
        <Text style={s.cardTitle}>Seller (you)</Text>
        <View style={s.row2}>
          <View style={{ flex: 2 }}><Text style={s.fieldLabel}>Business name</Text><View style={[s.input, s.readonly]}><Text style={s.readonlyText} numberOfLines={1}>{businessName || '—'}</Text></View></View>
          <View style={{ flex: 1 }}><Text style={s.fieldLabel}>Your PAN/VAT</Text><TextInput style={[s.input, s.inp]} placeholder="9-digit" placeholderTextColor={COLORS.onSurfaceVariant} value={sellerPan} onChangeText={t => setSellerPan(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" maxLength={9} /></View>
        </View>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Customer (Bill To)</Text>
        <Text style={s.fieldLabel}>Customer name *</Text>
        <TextInput style={[s.input, s.inp]} placeholder="Customer / company name" placeholderTextColor={COLORS.onSurfaceVariant} value={customer.name} onChangeText={t => setCustomer(c => ({ ...c, name: t }))} />
        <View style={s.row2}>
          <View style={{ flex: 1 }}><Text style={s.fieldLabel}>PAN/VAT No</Text><TextInput style={[s.input, s.inp]} placeholder="optional" placeholderTextColor={COLORS.onSurfaceVariant} value={customer.pan} onChangeText={t => setCustomer(c => ({ ...c, pan: t.replace(/[^0-9]/g, '') }))} keyboardType="number-pad" maxLength={9} /></View>
          <View style={{ flex: 1 }}><Text style={s.fieldLabel}>Address</Text><TextInput style={[s.input, s.inp]} placeholder="optional" placeholderTextColor={COLORS.onSurfaceVariant} value={customer.address} onChangeText={t => setCustomer(c => ({ ...c, address: t }))} /></View>
        </View>
        <View style={s.row2}>
          <View style={{ flex: 1 }}><Text style={s.fieldLabel}>Invoice No</Text><TextInput style={[s.input, s.inp]} placeholder="e.g. 001" placeholderTextColor={COLORS.onSurfaceVariant} value={billNo} onChangeText={setBillNo} /></View>
          <View style={{ flex: 1 }}><Text style={s.fieldLabel}>Date</Text><TextInput style={[s.input, s.inp]} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.onSurfaceVariant} value={date} onChangeText={setDate} /></View>
          <View style={{ width: 70 }}><Text style={s.fieldLabel}>VAT %</Text><TextInput style={[s.input, s.inp]} placeholder="13" placeholderTextColor={COLORS.onSurfaceVariant} value={vatRate} onChangeText={t => setVatRate(t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" /></View>
        </View>
      </View>

      <View style={s.card}>
        <View style={s.cardHeaderRow}><Text style={s.cardTitle}>Items</Text><TouchableOpacity style={s.addBtn} onPress={addItem}><MaterialCommunityIcons name="plus" size={15} color={COLORS.primary} /><Text style={s.addBtnText}>Add item</Text></TouchableOpacity></View>
        <View style={[s.itemHead]}>
          <Text style={[s.ih, { flex: 1 }]}>Description</Text>
          <Text style={[s.ih, { width: 44, textAlign: 'right' }]}>Qty</Text>
          <Text style={[s.ih, { width: 84, textAlign: 'right' }]}>Rate</Text>
          <Text style={[s.ih, { width: 92, textAlign: 'right' }]}>Amount</Text>
          <View style={{ width: 24 }} />
        </View>
        {items.map((it, i) => (
          <View key={i} style={s.itemRow}>
            <TextInput style={[s.itemInput, { flex: 1 }]} placeholder={`Item ${i + 1}`} placeholderTextColor={COLORS.onSurfaceVariant} value={it.description} onChangeText={t => setItem(i, 'description', t)} />
            <TextInput style={[s.itemInput, { width: 44, textAlign: 'right' }]} placeholder="1" placeholderTextColor={COLORS.onSurfaceVariant} value={it.qty} onChangeText={t => setItem(i, 'qty', t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" />
            <TextInput style={[s.itemInput, { width: 84, textAlign: 'right' }]} placeholder="0.00" placeholderTextColor={COLORS.onSurfaceVariant} value={it.rate} onChangeText={t => setItem(i, 'rate', t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" />
            <Text style={[s.itemAmt, { width: 92 }]}>{nprPlain(lines[i].amount)}</Text>
            <TouchableOpacity onPress={() => removeItem(i)} hitSlop={6} style={{ width: 24, alignItems: 'flex-end' }}><MaterialCommunityIcons name="close" size={16} color={COLORS.onSurfaceVariant} /></TouchableOpacity>
          </View>
        ))}

        <View style={s.totalsBox}>
          <View style={s.resRow}><Text style={s.resLabel}>Taxable amount</Text><Text style={s.resVal}>{npr(taxable)}</Text></View>
          <View style={s.resRow}><Text style={s.resLabel}>VAT @ {r}%</Text><Text style={[s.resVal, { color: '#34D399' }]}>{npr(vat)}</Text></View>
          <View style={s.plDivider} />
          <View style={s.resRow}><Text style={[s.resLabel, { fontWeight: '800', color: COLORS.onSurface }]}>Grand Total</Text><Text style={[s.resVal, { fontWeight: '800', fontSize: 20 }]}>{npr(total)}</Text></View>
          <Text style={s.words}>{amountInWords(total)}</Text>
        </View>

        {err ? <Text style={s.formError}>{err}</Text> : null}
        {ok ? <Text style={s.okText}>{ok}</Text> : null}

        <View style={s.actions}>
          <TouchableOpacity style={s.previewBtn} onPress={preview}><MaterialCommunityIcons name="eye-outline" size={17} color={COLORS.onSurface} /><Text style={s.previewBtnText}>Preview PDF</Text></TouchableOpacity>
          <TouchableOpacity style={[s.genBtn, saving && { opacity: 0.6 }]} onPress={generate} disabled={saving}>
            {saving ? <ActivityIndicator size="small" color={COLORS.onPrimary} /> : <><MaterialCommunityIcons name="content-save-check-outline" size={17} color={COLORS.onPrimary} /><Text style={s.genBtnText}>Generate & Save to Register</Text></>}
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

const bts = (COLORS) => StyleSheet.create({
  card: { ...glass(COLORS), borderRadius: ROUNDED.xl, padding: SPACING.lg, marginBottom: SPACING.md },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  cardTitle: { ...TYPOGRAPHY.labelLg, color: COLORS.onSurface, fontWeight: '700', marginBottom: SPACING.xs },
  muted: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurfaceVariant, fontStyle: 'italic', textAlign: 'center', paddingVertical: SPACING.md },
  fieldLabel: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6, marginTop: SPACING.sm },
  input: { backgroundColor: COLORS.surfaceContainerLowest, borderWidth: 1, borderColor: COLORS.outlineVariant, borderRadius: ROUNDED.md, paddingHorizontal: SPACING.md, paddingVertical: 10, marginBottom: SPACING.xs },
  inp: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurface, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) },
  readonly: { justifyContent: 'center', backgroundColor: COLORS.surfaceContainerHigh },
  readonlyText: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurfaceVariant, fontWeight: '600' },
  row2: { flexDirection: 'row', gap: SPACING.sm },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: SPACING.sm, paddingVertical: 6, borderRadius: ROUNDED.full, backgroundColor: `${COLORS.primary}1A` },
  addBtnText: { ...TYPOGRAPHY.labelSm, color: COLORS.primary, fontWeight: '700' },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: COLORS.outlineVariant },
  ih: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant, textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.3, fontWeight: '700' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingVertical: 5 },
  itemInput: { ...TYPOGRAPHY.bodySm, color: COLORS.onSurface, backgroundColor: COLORS.surfaceContainerLowest, borderWidth: 1, borderColor: COLORS.outlineVariant, borderRadius: ROUNDED.sm, paddingHorizontal: 8, paddingVertical: 7, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) },
  itemAmt: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurface, textAlign: 'right', fontWeight: '600', fontVariant: ['tabular-nums'] },
  totalsBox: { backgroundColor: COLORS.surfaceContainerLowest, borderRadius: ROUNDED.lg, padding: SPACING.md, marginTop: SPACING.md },
  resRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  resLabel: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurfaceVariant },
  resVal: { ...TYPOGRAPHY.labelLg, color: COLORS.onSurface, fontWeight: '700' },
  plDivider: { height: 1, backgroundColor: COLORS.outlineVariant, marginVertical: 6 },
  words: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant, marginTop: SPACING.xs, fontStyle: 'italic', textTransform: 'capitalize' },
  formError: { ...TYPOGRAPHY.bodySm, color: COLORS.error, marginTop: SPACING.sm },
  okText: { ...TYPOGRAPHY.bodySm, color: '#34D399', marginTop: SPACING.sm, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  previewBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13, paddingHorizontal: SPACING.md, borderRadius: ROUNDED.lg, borderWidth: 1, borderColor: COLORS.outlineVariant },
  previewBtnText: { ...TYPOGRAPHY.labelMd, color: COLORS.onSurface, fontWeight: '700' },
  genBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: COLORS.primary, paddingVertical: 13, borderRadius: ROUNDED.lg },
  genBtnText: { ...TYPOGRAPHY.labelLg, color: COLORS.onPrimary, fontWeight: '800' },
});
