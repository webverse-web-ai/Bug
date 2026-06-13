import connectToDatabase from '@/server/lib/db';
import Team, { ASSIGNABLE_ROLES, permsForRole, sanitizePerms } from '@/server/models/Team';
import User from '@/server/models/User';
import jwt from 'jsonwebtoken';
import { serializeTeam } from '../team+api';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

function auth(request) {
  const h = request.headers.get('Authorization') || request.headers.get('authorization');
  if (!h || !h.startsWith('Bearer ')) return null;
  try { return jwt.verify(h.split(' ')[1], JWT_SECRET); } catch { return null; }
}

// Admin-only: approve / reject / change role / remove a member.
export async function PUT(request) {
  try {
    await connectToDatabase();
    const decoded = auth(request);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const requester = await User.findById(decoded.id);
    const team = await Team.findById(requester?.teamId);
    if (!team) return Response.json({ error: 'No team' }, { status: 404 });
    if (team.adminUserId !== decoded.id) return Response.json({ error: 'Only the team admin can manage members' }, { status: 403 });

    const body = await request.json();
    const { userId, action, role } = body;
    if (userId === team.adminUserId) return Response.json({ error: "You can't modify the team owner" }, { status: 400 });

    let members = team.members || [];
    const idx = members.findIndex(m => m.userId === userId);
    if (idx === -1) return Response.json({ error: 'Member not found' }, { status: 404 });

    if (action === 'approve') {
      members[idx] = { ...members[idx], status: 'approved' };
      await User.update(userId, { teamStatus: 'approved' });
    } else if (action === 'reject' || action === 'remove') {
      members = members.filter(m => m.userId !== userId);
      await User.update(userId, { teamId: null, teamStatus: action === 'reject' ? 'rejected' : 'removed', role: null });
    } else if (action === 'role') {
      // Assigning a role applies that role's default CRUD permission preset.
      if (!ASSIGNABLE_ROLES.includes(role)) return Response.json({ error: 'Invalid role' }, { status: 400 });
      members[idx] = { ...members[idx], role, permissions: permsForRole(role) };
      await User.update(userId, { role });
    } else if (action === 'permissions') {
      // Fine-grained CRUD override → becomes a "custom" role.
      const permissions = sanitizePerms(body.permissions);
      members[idx] = { ...members[idx], role: 'custom', permissions };
      await User.update(userId, { role: 'custom' });
    } else {
      return Response.json({ error: 'Unknown action' }, { status: 400 });
    }

    await Team.update(team._id, { members });
    const updated = await Team.findById(team._id);
    return Response.json({ team: serializeTeam(updated, decoded.id) }, { status: 200 });
  } catch (e) {
    console.error('Team member Error:', e);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
