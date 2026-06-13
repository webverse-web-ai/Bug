import connectToDatabase from '@/server/lib/db';
import Team, { permsForRole } from '@/server/models/Team';
import User from '@/server/models/User';
import jwt from 'jsonwebtoken';
import { serializeTeam } from '../team+api';
import { signToken } from '@/server/lib/token';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

function auth(request) {
  const h = request.headers.get('Authorization') || request.headers.get('authorization');
  if (!h || !h.startsWith('Bearer ')) return null;
  try { return jwt.verify(h.split(' ')[1], JWT_SECRET); } catch { return null; }
}

// Request to join a team by its business username — joins as a pending member
// until the team admin approves.
export async function POST(request) {
  try {
    await connectToDatabase();
    const decoded = auth(request);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { businessUsername } = await request.json();
    const handle = String(businessUsername || '').toLowerCase().trim();
    if (!handle) return Response.json({ error: 'Enter a business username' }, { status: 400 });

    const team = await Team.findByUsername(handle);
    if (!team) return Response.json({ error: 'No team found with that username' }, { status: 404 });

    const user = await User.findById(decoded.id);
    const members = team.members || [];
    const existing = members.find(m => m.userId === decoded.id);

    if (existing) {
      // Re-link the user to this team and return current status.
      await User.update(decoded.id, { teamId: team._id, teamStatus: existing.status, role: existing.role });
      return Response.json({ status: existing.status, team: serializeTeam(team, decoded.id), token: signToken(decoded.id, team._id) }, { status: 200 });
    }

    const member = {
      userId: decoded.id, name: user?.fullName || '', username: user?.username || '',
      role: 'member', status: 'pending', joinedAt: new Date(), permissions: permsForRole('member'),
    };
    await Team.update(team._id, { members: [...members, member] });
    await User.update(decoded.id, { teamId: team._id, teamStatus: 'pending', role: 'member' });

    const updated = await Team.findById(team._id);
    return Response.json({ status: 'pending', team: serializeTeam(updated, decoded.id), token: signToken(decoded.id, team._id) }, { status: 200 });
  } catch (e) {
    console.error('Team join Error:', e);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
