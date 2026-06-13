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

const serialize = (p) => ({
  id: p._id.toString(),
  name: p.name,
  type: p.type,
  email: p.email || '',
  phone: p.phone || '',
  panNo: p.panNo || '',
  address: p.address || '',
  openingBalance: Number(p.openingBalance) || 0,
});

export async function GET(request) {
  try {
    await connectToDatabase();
    const decoded = authenticate(request);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const workspaceId = await getWorkspaceId(decoded);
    const parties = await Party.find({ user: workspaceId });
    return Response.json({ parties: parties.map(serialize) }, { status: 200 });
  } catch (error) {
    console.error('Parties GET Error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await connectToDatabase();
    const decoded = authenticate(request);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const workspaceId = await getWorkspaceId(decoded);

        if (!(await checkPermission(decoded, 'tally', 'create'))) return Response.json({ error: "You don't have permission to manage parties" }, { status: 403 });

    const b = await request.json();
    if (!b.name || !b.name.trim()) return Response.json({ error: 'Name is required' }, { status: 400 });
    if (!PARTY_TYPES.includes(b.type)) return Response.json({ error: 'Type must be customer or supplier' }, { status: 400 });

    const party = await Party.create({
      user: workspaceId, name: b.name, type: b.type, email: b.email, phone: b.phone,
      panNo: b.panNo, address: b.address, openingBalance: b.openingBalance,
    });
    return Response.json({ party: serialize(party) }, { status: 201 });
  } catch (error) {
    console.error('Parties POST Error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
