import connectToDatabase from '@/server/lib/db';
import Order, { ORDER_STATUSES, ORDER_PRIORITIES, ORDER_CHANNELS } from '@/server/models/Order';
import { bookIncome } from '@/server/lib/booking';
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
  return {
    id: o._id.toString(),
    orderNumber: o.orderNumber,
    customer: o.customer || { name: '', email: '', phone: '' },
    items: o.items || [],
    total: o.total || 0,
    dealAmount, amountPaid, balanceDue,
    paymentStatus: amountPaid <= 0 ? 'unpaid' : (balanceDue <= 0.001 ? 'paid' : 'partial'),
    status: o.status,
    priority: o.priority,
    channel: o.channel || 'Direct Web',
    partyId: o.partyId || '',
    notes: o.notes || '',
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

// Update an order — full edit or a quick status/priority change.
export async function PUT(request, { id }) {
  try {
    await connectToDatabase();
    const decoded = authenticate(request);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await checkPermission(decoded, 'pulse', 'edit'))) return Response.json({ error: "You don't have permission to edit orders" }, { status: 403 });
    const workspaceId = await getWorkspaceId(decoded);

    const order = await Order.findOne({ _id: id, user: workspaceId });
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });

    const body = await request.json();
    const updates = {};

    if (body.status !== undefined) {
      if (!ORDER_STATUSES.includes(body.status)) {
        return Response.json({ error: 'Invalid status' }, { status: 400 });
      }
      updates.status = body.status;
    }
    if (body.priority !== undefined) {
      if (!ORDER_PRIORITIES.includes(body.priority)) {
        return Response.json({ error: 'Invalid priority' }, { status: 400 });
      }
      updates.priority = body.priority;
    }
    if (body.channel !== undefined) {
      updates.channel = ORDER_CHANNELS.includes(body.channel) ? body.channel : 'Direct Web';
    }
    if (body.customer !== undefined) {
      updates.customer = {
        name: String(body.customer.name || '').trim(),
        email: String(body.customer.email || '').trim(),
        phone: String(body.customer.phone || '').trim(),
      };
      if (!updates.customer.name) {
        return Response.json({ error: 'Customer name is required' }, { status: 400 });
      }
    }
    if (body.items !== undefined) {
      const cleanItems = (Array.isArray(body.items) ? body.items : [])
        .map(it => ({
          name: String(it.name || '').trim(),
          qty: Math.max(1, Number(it.qty) || 1),
          price: Math.max(0, Number(it.price) || 0),
        }))
        .filter(it => it.name);
      updates.items = cleanItems;
      // Recompute total from items unless an explicit total is also provided.
      if (body.total === undefined) {
        updates.total = cleanItems.reduce((sum, it) => sum + it.qty * it.price, 0);
      }
    }
    if (body.total !== undefined) updates.total = Number(body.total) || 0;
    if (body.dealAmount !== undefined) updates.dealAmount = Math.max(0, Number(body.dealAmount) || 0);
    if (body.notes !== undefined) updates.notes = String(body.notes || '').trim();

    // Record a payment: increase amountPaid and post the cash to Tally as income.
    const payment = Number(body.recordPayment) || 0;
    if (payment > 0) {
      const deal = updates.dealAmount ?? (Number(order.dealAmount) || Number(order.total) || 0);
      const newPaid = Math.min((Number(order.amountPaid) || 0) + payment, deal);
      updates.amountPaid = newPaid;
      try {
        await bookIncome(workspaceId, { amount: payment, partyId: order.partyId, partyName: order.customer?.name, description: `Payment · ${order.orderNumber}` });
      } catch (e) { console.error('Payment booking failed:', e); }
    } else if (body.amountPaid !== undefined) {
      updates.amountPaid = Math.max(0, Number(body.amountPaid) || 0);
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    await Order.update(id, updates);
    return Response.json({ order: serialize({ ...order, ...updates }) }, { status: 200 });
  } catch (error) {
    console.error('Order PUT Error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Delete an order.
export async function DELETE(request, { id }) {
  try {
    await connectToDatabase();
    const decoded = authenticate(request);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await checkPermission(decoded, 'pulse', 'delete'))) return Response.json({ error: "You don't have permission to delete orders" }, { status: 403 });
    const workspaceId = await getWorkspaceId(decoded);

    const order = await Order.findOne({ _id: id, user: workspaceId });
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });

    await Order.findByIdAndDelete(id);
    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Order DELETE Error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
