import connectToDatabase from '@/server/lib/db';
import Team, { memberPerms, ROLE_LABELS } from '@/server/models/Team';
import User from '@/server/models/User';
import { migrateUserDataToWorkspace } from '@/server/lib/workspace';
import { signToken } from '@/server/lib/token';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

function auth(request) {
  const h = request.headers.get('Authorization') || request.headers.get('authorization');
  if (!h || !h.startsWith('Bearer ')) return null;
  try { return jwt.verify(h.split(' ')[1], JWT_SECRET); } catch { return null; }
}

export function serializeTeam(team, userId) {
  const me = (team.members || []).find(m => m.userId === userId);
  return {
    id: team._id.toString(),
    businessName: team.businessName,
    businessUsername: team.businessUsername,
    isAdmin: team.adminUserId === userId,
    myRole: me?.role || null,
    myStatus: me?.status || null,
    myPermissions: memberPerms(me, team),
    memberCount: (team.members || []).filter(m => m.status === 'approved').length,
    pendingCount: (team.members || []).filter(m => m.status === 'pending').length,
    members: (team.members || []).map(m => ({
      userId: m.userId, name: m.name || '', username: m.username || '',
      role: m.role, roleLabel: ROLE_LABELS[m.role] || m.role, status: m.status, joinedAt: m.joinedAt,
      permissions: memberPerms(m, team),
    })),
  };
}

// Current user's team + membership.
export async function GET(request) {
  try {
    await connectToDatabase();
    const decoded = auth(request);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await User.findById(decoded.id);
    if (!user?.teamId) return Response.json({ team: null }, { status: 200 });
    const team = await Team.findById(user.teamId);
    if (!team) return Response.json({ team: null }, { status: 200 });

    return Response.json({ team: serializeTeam(team, decoded.id) }, { status: 200 });
  } catch (e) {
    console.error('Team GET Error:', e);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const validUsername = (u) => /^[a-z0-9_]{3,30}$/.test(String(u || '').toLowerCase());

// Create a team — the creator becomes the admin (single mandatory step).
export async function POST(request) {
  try {
    await connectToDatabase();
    const decoded = auth(request);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { businessUsername, businessName } = await request.json();
    const handle = String(businessUsername || '').toLowerCase().trim();
    if (!validUsername(handle)) return Response.json({ error: 'Business username must be 3–30 chars (letters, numbers, _)' }, { status: 400 });
    if (!businessName || !businessName.trim()) return Response.json({ error: 'Business name is required' }, { status: 400 });

    const exists = await Team.findByUsername(handle);
    if (exists) return Response.json({ error: 'That business username is taken' }, { status: 400 });

    const user = await User.findById(decoded.id);
    if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

    const member = {
      userId: decoded.id, name: user.fullName || '', username: user.username || '',
      role: 'admin', status: 'approved', joinedAt: new Date(),
    };
    const team = await Team.create({
      businessUsername: handle, businessName: businessName.trim(),
      adminUserId: decoded.id, members: [member],
    });
    await User.update(decoded.id, { teamId: team._id, teamStatus: 'approved', role: 'admin' });

    // Seed the workspace: re-key the founder's existing orders/tally/parties to the team.
    try { await migrateUserDataToWorkspace(decoded.id, team._id); } catch (e) { console.error('Workspace seed failed:', e); }

    // Re-issue the token with the new teamId so subsequent requests skip the lookup.
    const token = signToken(decoded.id, team._id);
    return Response.json({ team: serializeTeam(team, decoded.id), token }, { status: 201 });
  } catch (e) {
    console.error('Team POST Error:', e);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
