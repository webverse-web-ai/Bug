import connectToDatabase from '@/server/lib/db';
import Order, { ORDER_STATUSES } from '@/server/models/Order';
import Party from '@/server/models/Party';
import { ensureCustomerParty, recordSale, bookIncome } from '@/server/lib/booking';
import { getWorkspaceId, checkPermission } from '@/server/lib/workspace';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

function authenticate(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
  } catch {
    return null;
  }
}

function serialize(o) {
  const dealAmount = Number(o.dealAmount) || Number(o.total) || 0;
  const amountPaid = Math.max(0, Number(o.amountPaid) || 0);
  const balanceDue = Math.max(0, dealAmount - amountPaid);
  const paymentStatus = amountPaid <= 0 ? 'unpaid' : (balanceDue <= 0.001 ? 'paid' : 'partial');
  return {
    id: o._id.toString(),
    orderNumber: o.orderNumber,
    customer: o.customer || { name: '', email: '', phone: '' },
    items: o.items || [],
    total: o.total || 0,
    dealAmount,
    amountPaid,
    balanceDue,
    paymentStatus,
    status: o.status,
    priority: o.priority,
    channel: o.channel || 'Direct Web',
    partyId: o.partyId || '',
    notes: o.notes || '',
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

const asDate = (v) => (v?.toDate ? v.toDate() : new Date(v));

// Build the KPI summary Pulse surfaces at the top of the OMS.
function buildStats(orders) {
  const byStatus = Object.fromEntries(ORDER_STATUSES.map(s => [s, 0]));
  let revenue = 0;
  let openValue = 0;
  const today = new Date().toISOString().slice(0, 10);
  let todayCount = 0;

  // 7-day vs prior-7-day windows for an honest trend %.
  const now = Date.now();
  const week = 7 * 24 * 3600 * 1000;
  let last7 = 0, prev7 = 0;
  let collected = 0, outstanding = 0;

  for (const o of orders) {
    byStatus[o.status] = (byStatus[o.status] || 0) + 1;
    if (o.status === 'delivered') revenue += Number(o.total) || 0;
    if (o.status !== 'cancelled' && o.status !== 'delivered') openValue += Number(o.total) || 0;
    const deal = Number(o.dealAmount) || Number(o.total) || 0;
    const paid = Math.max(0, Number(o.amountPaid) || 0);
    if (o.status !== 'cancelled') { collected += Math.min(paid, deal); outstanding += Math.max(0, deal - paid); }
    const created = asDate(o.createdAt);
    if (!Number.isNaN(created.getTime())) {
      if (created.toISOString().slice(0, 10) === today) todayCount += 1;
      const age = now - created.getTime();
      if (age <= week) last7 += 1;
      else if (age <= week * 2) prev7 += 1;
    }
  }

  // % change of orders this week vs last week (null when no prior baseline).
  const trend = prev7 === 0 ? (last7 > 0 ? 100 : 0) : Math.round(((last7 - prev7) / prev7) * 100);

  return {
    total: orders.length,
    byStatus,
    revenue,            // realized revenue (delivered)
    openValue,          // value still in the pipeline
    collected,          // cash actually received across orders
    outstanding,        // balance still owed across orders
    todayCount,
    last7,
    trend,              // orders trend % (this week vs last)
  };
}

// List the user's orders (+ stats), optionally filtered by status/search.
export async function GET(request) {
  try {
    await connectToDatabase();
    const decoded = authenticate(request);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const workspaceId = await getWorkspaceId(decoded);
    const all = await Order.find({ user: workspaceId });
    const stats = buildStats(all);

    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();

    let filtered = all;
    if (status && ORDER_STATUSES.includes(status)) {
      filtered = filtered.filter(o => o.status === status);
    }
    if (q) {
      filtered = filtered.filter(o =>
        (o.orderNumber || '').toLowerCase().includes(q) ||
        (o.customer?.name || '').toLowerCase().includes(q) ||
        (o.customer?.email || '').toLowerCase().includes(q)
      );
    }

    return Response.json({ orders: filtered.map(serialize), stats }, { status: 200 });
  } catch (error) {
    console.error('Orders GET Error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Create a new order. Total is derived from items when not supplied.
export async function POST(request) {
  try {
    await connectToDatabase();
    const decoded = authenticate(request);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await checkPermission(decoded, 'pulse', 'create'))) return Response.json({ error: "You don't have permission to create orders" }, { status: 403 });
    const workspaceId = await getWorkspaceId(decoded);

    const body = await request.json();
    const { customer, items, status, priority, channel, notes } = body;

    if (!customer?.name || !customer.name.trim()) {
      return Response.json({ error: 'Customer name is required' }, { status: 400 });
    }

    const cleanItems = (Array.isArray(items) ? items : [])
      .map(it => ({
        name: String(it.name || '').trim(),
        qty: Math.max(1, Number(it.qty) || 1),
        price: Math.max(0, Number(it.price) || 0),
      }))
      .filter(it => it.name);

    const derivedTotal = cleanItems.reduce((sum, it) => sum + it.qty * it.price, 0);
    const total = body.total !== undefined && body.total !== null ? Number(body.total) : derivedTotal;
    const dealAmount = body.dealAmount !== undefined && body.dealAmount !== null && Number(body.dealAmount) > 0
      ? Number(body.dealAmount) : total;
    const advancePaid = Math.max(0, Math.min(Number(body.advancePaid) || 0, dealAmount));

    const cust = {
      name: customer.name.trim(),
      email: (customer.email || '').trim(),
      phone: (customer.phone || '').trim(),
    };

    // Connect to Tally: use the explicitly-selected party when provided,
    // otherwise link/create one by customer name. Then post the sale + advance.
    let party = { id: '', name: cust.name };
    try {
      if (body.partyId) {
        const existing = await Party.findOne({ _id: body.partyId, user: workspaceId });
        party = existing ? { id: existing._id, name: existing.name } : await ensureCustomerParty(workspaceId, cust);
      } else {
        party = await ensureCustomerParty(workspaceId, cust);
      }
      await recordSale(workspaceId, party.id, dealAmount);
    } catch (e) { console.error('Order→Tally party/sale link failed:', e); }

    const orderNumber = await Order.nextOrderNumber(workspaceId);
    const order = await Order.create({
      user: workspaceId, orderNumber, customer: cust,
      items: cleanItems, total, dealAmount, amountPaid: advancePaid,
      status, priority, channel, partyId: party.id, notes: (notes || '').trim(),
    });

    if (advancePaid > 0) {
      try { await bookIncome(workspaceId, { amount: advancePaid, partyId: party.id, partyName: party.name, description: `Advance · ${orderNumber}` }); }
      catch (e) { console.error('Advance booking failed:', e); }
    }

    return Response.json({ order: serialize(order) }, { status: 201 });
  } catch (error) {
    console.error('Orders POST Error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
