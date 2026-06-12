import connectToDatabase from '@/server/lib/db';
import Order, { ORDER_STATUSES } from '@/server/models/Order';
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
  return {
    id: o._id.toString(),
    orderNumber: o.orderNumber,
    customer: o.customer || { name: '', email: '', phone: '' },
    items: o.items || [],
    total: o.total || 0,
    status: o.status,
    priority: o.priority,
    channel: o.channel || 'Direct Web',
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

  for (const o of orders) {
    byStatus[o.status] = (byStatus[o.status] || 0) + 1;
    if (o.status === 'delivered') revenue += Number(o.total) || 0;
    if (o.status !== 'cancelled' && o.status !== 'delivered') openValue += Number(o.total) || 0;
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

    const all = await Order.find({ user: decoded.id });
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

    const orderNumber = await Order.nextOrderNumber(decoded.id);
    const order = await Order.create({
      user: decoded.id,
      orderNumber,
      customer: {
        name: customer.name.trim(),
        email: (customer.email || '').trim(),
        phone: (customer.phone || '').trim(),
      },
      items: cleanItems,
      total,
      status,
      priority,
      channel,
      notes: (notes || '').trim(),
    });

    return Response.json({ order: serialize(order) }, { status: 201 });
  } catch (error) {
    console.error('Orders POST Error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
