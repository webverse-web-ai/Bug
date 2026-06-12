import connectToDatabase from '@/server/lib/db';
import Order, { ORDER_STATUSES, ORDER_PRIORITIES, ORDER_CHANNELS } from '@/server/models/Order';
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

// Update an order — full edit or a quick status/priority change.
export async function PUT(request, { id }) {
  try {
    await connectToDatabase();
    const decoded = authenticate(request);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const order = await Order.findOne({ _id: id, user: decoded.id });
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
    if (body.notes !== undefined) updates.notes = String(body.notes || '').trim();

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

    const order = await Order.findOne({ _id: id, user: decoded.id });
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });

    await Order.findByIdAndDelete(id);
    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Order DELETE Error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
