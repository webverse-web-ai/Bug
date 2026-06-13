import connectToDatabase from '@/server/lib/db';
import VatEntry, { VAT_TYPES } from '@/server/models/VatEntry';
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

    if (!(await checkPermission(decoded, 'tally', 'edit'))) return Response.json({ error: "You don't have permission to edit VAT entries" }, { status: 403 });

    const entry = await VatEntry.findOne({ _id: id, user: workspaceId });
    if (!entry) return Response.json({ error: 'VAT entry not found' }, { status: 404 });

    const b = await request.json();
    const updates = {};
    if (b.type !== undefined && VAT_TYPES.includes(b.type)) updates.type = b.type;
    if (b.billNo !== undefined) updates.billNo = String(b.billNo).trim();
    if (b.partyName !== undefined) updates.partyName = String(b.partyName).trim();
    if (b.partyPan !== undefined) updates.partyPan = String(b.partyPan).trim();
    if (b.taxable !== undefined) updates.taxable = Math.max(0, Number(b.taxable) || 0);
    if (b.vatRate !== undefined) updates.vatRate = Math.max(0, Number(b.vatRate) || 0);
    if (b.description !== undefined) updates.description = String(b.description);
    if (b.date !== undefined) updates.date = b.date;

    if (Object.keys(updates).length === 0) return Response.json({ error: 'No valid fields to update' }, { status: 400 });
    await VatEntry.update(id, updates);
    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('VAT PUT Error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request, { id }) {
  try {
    await connectToDatabase();
    const decoded = authenticate(request);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const workspaceId = await getWorkspaceId(decoded);

    if (!(await checkPermission(decoded, 'tally', 'delete'))) return Response.json({ error: "You don't have permission to delete VAT entries" }, { status: 403 });

    const entry = await VatEntry.findOne({ _id: id, user: workspaceId });
    if (!entry) return Response.json({ error: 'VAT entry not found' }, { status: 404 });

    await VatEntry.findByIdAndDelete(id);
    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('VAT DELETE Error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
