import connectToDatabase from '@/server/lib/db';
import User from '@/server/models/User';
import Team from '@/server/models/Team';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';
const validUsername = (u) => /^[a-z0-9_]{3,30}$/.test(String(u || '').toLowerCase());

function auth(request) {
  const h = request.headers.get('Authorization') || request.headers.get('authorization');
  if (!h || !h.startsWith('Bearer ')) return null;
  try { return jwt.verify(h.split(' ')[1], JWT_SECRET); } catch { return null; }
}

// Update the current user's profile (name + personal username).
export async function PUT(request) {
  try {
    await connectToDatabase();
    const decoded = auth(request);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { fullName, username } = await request.json();
    const updates = {};

    if (username !== undefined) {
      const handle = String(username).toLowerCase().trim();
      if (!validUsername(handle)) return Response.json({ error: 'Username must be 3–30 chars (letters, numbers, _)' }, { status: 400 });
      const existing = await User.findOne({ username: handle });
      if (existing && existing._id !== decoded.id) return Response.json({ error: 'That username is taken' }, { status: 400 });
      updates.username = handle;
    }
    if (fullName !== undefined) {
      if (!String(fullName).trim()) return Response.json({ error: 'Name cannot be empty' }, { status: 400 });
      updates.fullName = String(fullName).trim();
    }
    if (Object.keys(updates).length === 0) return Response.json({ error: 'Nothing to update' }, { status: 400 });

    await User.update(decoded.id, updates);

    // Keep the team member snapshot in sync.
    const user = await User.findById(decoded.id);
    if (user?.teamId) {
      const team = await Team.findById(user.teamId);
      if (team) {
        const members = (team.members || []).map(m => m.userId === decoded.id
          ? { ...m, name: updates.fullName ?? m.name, username: updates.username ?? m.username } : m);
        await Team.update(team._id, { members });
      }
    }

    return Response.json({ success: true, fullName: user.fullName, username: user.username }, { status: 200 });
  } catch (e) {
    console.error('Profile PUT Error:', e);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
