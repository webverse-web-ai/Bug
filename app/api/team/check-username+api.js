import connectToDatabase from '@/server/lib/db';
import Team from '@/server/models/Team';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';
const validUsername = (u) => /^[a-z0-9_]{3,30}$/.test(String(u || '').toLowerCase());

export async function GET(request) {
  try {
    await connectToDatabase();
    const h = request.headers.get('Authorization') || request.headers.get('authorization');
    if (!h || !h.startsWith('Bearer ')) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    try { jwt.verify(h.split(' ')[1], JWT_SECRET); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }

    const url = new URL(request.url);
    const username = (url.searchParams.get('username') || '').toLowerCase().trim();
    if (!validUsername(username)) return Response.json({ available: false, valid: false }, { status: 200 });

    const team = await Team.findByUsername(username);
    return Response.json({ available: !team, valid: true, exists: !!team }, { status: 200 });
  } catch (e) {
    console.error('Team check-username Error:', e);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
