// Nepali Rupee formatting, used across Pulse, Tally and the VAT register.
// Uses South-Asian (lakh / crore) digit grouping — e.g. Rs 12,34,567.00.
const RS = 'Rs '; // non-breaking space so the prefix never wraps away from the number

export const npr = (v) =>
  RS + (Number(v) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Compact form for KPIs / chart labels: lakh (L) and crore (Cr) — Nepali convention.
export const nprShort = (v) => {
  const n = Number(v) || 0, a = Math.abs(n), sg = n < 0 ? '-' : '';
  if (a >= 1e7) return `${sg}${RS}${(a / 1e7).toFixed(a >= 1e8 ? 0 : 2)}Cr`;
  if (a >= 1e5) return `${sg}${RS}${(a / 1e5).toFixed(a >= 1e6 ? 0 : 2)}L`;
  if (a >= 1e3) return `${sg}${RS}${(a / 1e3).toFixed(a >= 1e4 ? 0 : 1)}k`;
  return `${sg}${RS}${a.toFixed(0)}`;
};

// Plain "Rs 12,34,567.00" without the nbsp — for PDF/HTML export and plain text.
export const nprPlain = (v) =>
  'Rs ' + (Number(v) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
