import connectToDatabase from '@/server/lib/db';
import Transaction, { CATEGORY_GROUPS } from '@/server/models/Transaction';
import Party from '@/server/models/Party';
import { getWorkspaceId, checkPermission } from '@/server/lib/workspace';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

function authenticate(request) {
  const h = request.headers.get('Authorization');
  if (!h || !h.startsWith('Bearer ')) return null;
  try { return jwt.verify(h.split(' ')[1], JWT_SECRET); } catch { return null; }
}

const asDate = (v) => (v?.toDate ? v.toDate() : new Date(v));
const groupOf = (cat) => CATEGORY_GROUPS[cat] || 'expense';

function serializeTxn(t) {
  return {
    id: t._id.toString(),
    type: t.type,
    amount: Number(t.amount) || 0,
    category: t.category,
    group: groupOf(t.category),
    account: t.account,
    method: t.method,
    partyId: t.partyId || '',
    partyName: t.partyName || '',
    partyType: t.partyType || '',
    description: t.description || '',
    date: asDate(t.date).toISOString(),
  };
}

// The accounting engine: derive every report from the raw transactions + parties.
function buildReports(txns, parties) {
  let totalIn = 0, totalOut = 0;
  const accounts = {};            // account -> balance (in - out)
  const incomeByCat = {};         // P&L income
  const expenseByCat = {};        // P&L expense
  let fixedAssets = 0;            // capex (group 'asset')
  let capitalIn = 0, drawings = 0, loans = 0;
  const ledgerCat = {};          // category -> { in, out, count }
  const partyPaid = {};          // partyId -> { in, out }
  const monthly = {};            // 'YYYY-MM' -> { in, out }

  for (const t of txns) {
    const amt = Number(t.amount) || 0;
    const g = groupOf(t.category);
    if (t.type === 'in') totalIn += amt; else totalOut += amt;
    accounts[t.account] = (accounts[t.account] || 0) + (t.type === 'in' ? amt : -amt);

    if (t.type === 'in') {
      if (g === 'income') incomeByCat[t.category] = (incomeByCat[t.category] || 0) + amt;
      if (t.category === 'Capital') capitalIn += amt;
      if (t.category === 'Loan') loans += amt;
    } else {
      if (g === 'expense') expenseByCat[t.category] = (expenseByCat[t.category] || 0) + amt;
      if (g === 'asset') fixedAssets += amt;
      if (t.category === 'Drawings') drawings += amt;
    }

    const lc = ledgerCat[t.category] || { category: t.category, in: 0, out: 0, count: 0, group: g };
    lc[t.type] += amt; lc.count += 1; ledgerCat[t.category] = lc;

    if (t.partyId) {
      const p = partyPaid[t.partyId] || { in: 0, out: 0 };
      p[t.type] += amt; partyPaid[t.partyId] = p;
    }

    const d = asDate(t.date);
    if (!Number.isNaN(d.getTime())) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const m = monthly[key] || { in: 0, out: 0 };
      m[t.type] += amt; monthly[key] = m;
    }
  }

  // Parties with live balances (opening adjusted by payments).
  const customers = [], suppliers = [];
  let totalReceivable = 0, totalPayable = 0;
  for (const p of parties) {
    const paid = partyPaid[p._id] || { in: 0, out: 0 };
    const id = p._id.toString();
    if (p.type === 'customer') {
      const balance = (Number(p.openingBalance) || 0) - paid.in; // they owe us
      totalReceivable += balance;
      customers.push({ id, name: p.name, email: p.email, phone: p.phone, panNo: p.panNo || '', address: p.address || '', openingBalance: p.openingBalance, balance });
    } else {
      const balance = (Number(p.openingBalance) || 0) - paid.out; // we owe them
      totalPayable += balance;
      suppliers.push({ id, name: p.name, email: p.email, phone: p.phone, panNo: p.panNo || '', address: p.address || '', openingBalance: p.openingBalance, balance });
    }
  }

  const totalIncome = Object.values(incomeByCat).reduce((a, b) => a + b, 0);
  const totalExpense = Object.values(expenseByCat).reduce((a, b) => a + b, 0);
  const netProfit = totalIncome - totalExpense;

  const expensesByCategory = Object.entries(expenseByCat)
    .map(([category, amount]) => ({ category, amount, pct: totalExpense ? Math.round((amount / totalExpense) * 100) : 0 }))
    .sort((a, b) => b.amount - a.amount);

  const cashBalance = accounts.Cash || 0;
  const bankBalance = accounts.Bank || 0;

  // Simplified balance sheet (balances exactly via an opening-balance equity line).
  const assets = [
    { label: 'Cash in Hand', amount: cashBalance },
    { label: 'Bank Balance', amount: bankBalance },
    { label: 'Accounts Receivable', amount: totalReceivable },
    { label: 'Fixed Assets', amount: fixedAssets },
  ];
  const totalAssets = assets.reduce((a, b) => a + b.amount, 0);
  const liabilities = [
    { label: 'Accounts Payable', amount: totalPayable },
    { label: 'Loans', amount: loans },
  ];
  const totalLiabilities = liabilities.reduce((a, b) => a + b.amount, 0);
  const openingEquity = totalReceivable - totalPayable;
  const equity = [
    { label: 'Capital', amount: capitalIn - drawings },
    { label: 'Retained Earnings', amount: netProfit },
    { label: 'Opening Balances', amount: openingEquity },
  ];
  const totalEquity = equity.reduce((a, b) => a + b.amount, 0);

  // Last 6 months in/out series for the cash-flow chart.
  const now = new Date();
  const cashflow = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const m = monthly[key] || { in: 0, out: 0 };
    cashflow.push({ label: d.toLocaleDateString(undefined, { month: 'short' }), in: m.in, out: m.out });
  }

  return {
    summary: {
      totalIn, totalOut, net: totalIn - totalOut,
      cashBalance, bankBalance, netProfit, txnCount: txns.length,
      totalReceivable, totalPayable,
    },
    pnl: {
      income: Object.entries(incomeByCat).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
      expenses: Object.entries(expenseByCat).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
      totalIncome, totalExpense, netProfit,
    },
    expensesByCategory,
    ledger: Object.values(ledgerCat)
      .map(l => ({ ...l, net: l.in - l.out }))
      .sort((a, b) => (b.in + b.out) - (a.in + a.out)),
    parties: { customers, suppliers, totalReceivable, totalPayable },
    balanceSheet: { assets, totalAssets, liabilities, totalLiabilities, equity, totalEquity },
    cashflow,
  };
}

export async function GET(request) {
  try {
    await connectToDatabase();
    const decoded = authenticate(request);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const workspaceId = await getWorkspaceId(decoded);

    const [txns, parties] = await Promise.all([
      Transaction.find({ user: workspaceId }),
      Party.find({ user: workspaceId }),
    ]);

    return Response.json({
      transactions: txns.map(serializeTxn),
      reports: buildReports(txns, parties),
    }, { status: 200 });
  } catch (error) {
    console.error('Tally GET Error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await connectToDatabase();
    const decoded = authenticate(request);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const workspaceId = await getWorkspaceId(decoded);

        if (!(await checkPermission(decoded, 'tally', 'create'))) return Response.json({ error: "You don't have permission to record transactions" }, { status: 403 });

    const b = await request.json();
    if (!b.amount || Number(b.amount) <= 0) {
      return Response.json({ error: 'Amount must be greater than 0' }, { status: 400 });
    }

    const txn = await Transaction.create({
      user: workspaceId,
      type: b.type, amount: b.amount, category: b.category, account: b.account, method: b.method,
      partyId: b.partyId, partyName: b.partyName, partyType: b.partyType,
      description: b.description, date: b.date,
    });

    return Response.json({ transaction: serializeTxn(txn) }, { status: 201 });
  } catch (error) {
    console.error('Tally POST Error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
