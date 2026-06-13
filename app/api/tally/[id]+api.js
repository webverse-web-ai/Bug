import connectToDatabase from '@/server/lib/db';
import Transaction, { TXN_TYPES, TXN_ACCOUNTS, TXN_METHODS } from '@/server/models/Transaction';
import { getWorkspaceId, checkPermission } from '@/server/lib/workspace';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

function authenticate(request) {
  const h = request.headers.get('Authorization');
  if (!h || !h.startsWith('Bearer ')) return null;
  try { return jwt.verify(h.split(' ')[1], JWT_SECRET); } catch { return null; }
}

export async function PUT(request, { id }) {
  try {
    await connectToDatabase();
    const decoded = authenticate(request);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const workspaceId = await getWorkspaceId(decoded);

        if (!(await checkPermission(decoded, 'tally', 'edit'))) return Response.json({ error: "You don't have permission to edit transactions" }, { status: 403 });
const txn = await Transaction.findOne({ _id: id, user: workspaceId });
    if (!txn) return Response.json({ error: 'Transaction not found' }, { status: 404 });

    const b = await request.json();
    const updates = {};
    if (b.type !== undefined && TXN_TYPES.includes(b.type)) updates.type = b.type;
    if (b.amount !== undefined) updates.amount = Math.max(0, Number(b.amount) || 0);
    if (b.category !== undefined) updates.category = String(b.category);
    if (b.account !== undefined && TXN_ACCOUNTS.includes(b.account)) updates.account = b.account;
    if (b.method !== undefined && TXN_METHODS.includes(b.method)) updates.method = b.method;
    if (b.partyId !== undefined) { updates.partyId = b.partyId; updates.partyName = b.partyName || ''; updates.partyType = b.partyType || ''; }
    if (b.description !== undefined) updates.description = String(b.description);
    if (b.date !== undefined) updates.date = b.date;

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: 'No valid fields to update' }, { status: 400 });
    }
    await Transaction.update(id, updates);
    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Tally PUT Error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request, { id }) {
  try {
    await connectToDatabase();
    const decoded = authenticate(request);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const workspaceId = await getWorkspaceId(decoded);

        if (!(await checkPermission(decoded, 'tally', 'delete'))) return Response.json({ error: "You don't have permission to delete transactions" }, { status: 403 });
const txn = await Transaction.findOne({ _id: id, user: workspaceId });
    if (!txn) return Response.json({ error: 'Transaction not found' }, { status: 404 });

    await Transaction.findByIdAndDelete(id);
    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Tally DELETE Error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
