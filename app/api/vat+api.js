import connectToDatabase from '@/server/lib/db';
import VatEntry, { VAT_TYPES, VAT_DEFAULT_RATE } from '@/server/models/VatEntry';
import { getWorkspaceId, checkPermission } from '@/server/lib/workspace';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

function authenticate(request) {
  const h = request.headers.get('Authorization');
  if (!h || !h.startsWith('Bearer ')) return null;
  try { return jwt.verify(h.split(' ')[1], JWT_SECRET); } catch { return null; }
}

const asDate = (v) => (v?.toDate ? v.toDate() : new Date(v));

function serialize(e) {
  return {
    id: e._id.toString(),
    type: e.type,
    billNo: e.billNo || '',
    partyName: e.partyName || '',
    partyPan: e.partyPan || '',
    address: e.address || '',
    taxable: Number(e.taxable) || 0,
    vatRate: e.vatRate ?? VAT_DEFAULT_RATE,
    vat: Number(e.vat) || 0,
    total: Number(e.total) || 0,
    items: Array.isArray(e.items) ? e.items : [],
    source: e.source || 'manual',
    description: e.description || '',
    date: asDate(e.date).toISOString(),
  };
}

// Roll up the VAT register into the figures a Nepali VAT return needs.
function buildSummary(entries) {
  let salesTaxable = 0, outputVat = 0, salesCount = 0;
  let purchaseTaxable = 0, inputVat = 0, purchaseCount = 0;
  const monthly = {}; // 'YYYY-MM' -> { output, input }

  for (const e of entries) {
    const taxable = Number(e.taxable) || 0;
    const vat = Number(e.vat) || 0;
    if (e.type === 'sales') { salesTaxable += taxable; outputVat += vat; salesCount += 1; }
    else { purchaseTaxable += taxable; inputVat += vat; purchaseCount += 1; }

    const d = asDate(e.date);
    if (!Number.isNaN(d.getTime())) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const m = monthly[key] || { output: 0, input: 0 };
      if (e.type === 'sales') m.output += vat; else m.input += vat;
      monthly[key] = m;
    }
  }

  // Last 6 months output-vs-input series for the analytics chart.
  const now = new Date();
  const trend = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const m = monthly[key] || { output: 0, input: 0 };
    trend.push({ label: d.toLocaleDateString(undefined, { month: 'short' }), key, output: m.output, input: m.input, net: m.output - m.input });
  }

  const netVat = outputVat - inputVat; // > 0 payable to IRD · < 0 credit carried forward
  return {
    salesTaxable, outputVat, salesCount,
    purchaseTaxable, inputVat, purchaseCount,
    netVat, payable: Math.max(0, netVat), creditCarried: Math.max(0, -netVat),
    totalCount: entries.length,
    trend,
  };
}

export async function GET(request) {
  try {
    await connectToDatabase();
    const decoded = authenticate(request);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const workspaceId = await getWorkspaceId(decoded);

    const entries = await VatEntry.find({ user: workspaceId });
    return Response.json({
      entries: entries.map(serialize),
      summary: buildSummary(entries),
    }, { status: 200 });
  } catch (error) {
    console.error('VAT GET Error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await connectToDatabase();
    const decoded = authenticate(request);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const workspaceId = await getWorkspaceId(decoded);

    if (!(await checkPermission(decoded, 'tally', 'create'))) {
      return Response.json({ error: "You don't have permission to record VAT entries" }, { status: 403 });
    }

    const b = await request.json();
    if (!VAT_TYPES.includes(b.type)) return Response.json({ error: 'Type must be sales or purchase' }, { status: 400 });
    if (!b.taxable || Number(b.taxable) <= 0) return Response.json({ error: 'Taxable amount must be greater than 0' }, { status: 400 });

    const entry = await VatEntry.create({
      user: workspaceId,
      type: b.type, billNo: b.billNo, partyName: b.partyName, partyPan: b.partyPan, address: b.address,
      taxable: b.taxable, vatRate: b.vatRate, items: b.items, source: b.source,
      description: b.description, date: b.date,
    });
    return Response.json({ entry: serialize(entry) }, { status: 201 });
  } catch (error) {
    console.error('VAT POST Error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
