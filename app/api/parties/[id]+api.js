import connectToDatabase from '@/server/lib/db';
import Party, { PARTY_TYPES } from '@/server/models/Party';
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

        if (!(await checkPermission(decoded, 'tally', 'edit'))) return Response.json({ error: "You don't have permission to edit parties" }, { status: 403 });
const party = await Party.findOne({ _id: id, user: workspaceId });
    if (!party) return Response.json({ error: 'Party not found' }, { status: 404 });

    const b = await request.json();
    const updates = {};
    if (b.name !== undefined) { if (!b.name.trim()) return Response.json({ error: 'Name required' }, { status: 400 }); updates.name = b.name.trim(); }
    if (b.type !== undefined && PARTY_TYPES.includes(b.type)) updates.type = b.type;
    if (b.email !== undefined) updates.email = String(b.email).trim();
    if (b.phone !== undefined) updates.phone = String(b.phone).trim();
    if (b.panNo !== undefined) updates.panNo = String(b.panNo).trim();
    if (b.address !== undefined) updates.address = String(b.address).trim();
    if (b.openingBalance !== undefined) updates.openingBalance = Number(b.openingBalance) || 0;

    await Party.update(id, updates);
    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Party PUT Error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request, { id }) {
  try {
    await connectToDatabase();
    const decoded = authenticate(request);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const workspaceId = await getWorkspaceId(decoded);

        if (!(await checkPermission(decoded, 'tally', 'delete'))) return Response.json({ error: "You don't have permission to delete parties" }, { status: 403 });
const party = await Party.findOne({ _id: id, user: workspaceId });
    if (!party) return Response.json({ error: 'Party not found' }, { status: 404 });

    await Party.findByIdAndDelete(id);
    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Party DELETE Error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
