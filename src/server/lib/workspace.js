import { firestore } from './db';
import User from '../models/User';
import Team, { memberPerms } from '../models/Team';

// The "workspace" is the team — all business data (orders, accounting) is scoped
// to it so every approved member shares one set of data. Prefers the teamId baked
// into the JWT (no DB read); falls back to a lookup for older tokens, then to the
// user's own id when they have no team.
export async function getWorkspaceId(decoded) {
  if (decoded && typeof decoded === 'object') {
    if (decoded.teamId) return decoded.teamId;       // fast path — from the JWT
    const u = await User.findById(decoded.id);
    return (u && u.teamId) ? u.teamId : decoded.id;
  }
  // Back-compat: a bare userId string was passed.
  const u = await User.findById(decoded);
  return (u && u.teamId) ? u.teamId : decoded;
}

// Collections whose docs are scoped by the `user` field (used here as the
// workspace key). When a founder creates a team, re-key their existing personal
// business data onto the new team so the workspace starts with their data.
const WORKSPACE_COLLECTIONS = ['orders', 'transactions', 'parties'];

// True if the requesting user may perform `action` (view/create/edit/delete) on
// `module` ('pulse' | 'tally'). Admins and solo users (no team) always pass.
export async function checkPermission(decoded, module, action) {
  const teamId = (decoded && decoded.teamId) || (decoded && (await User.findById(decoded.id))?.teamId);
  if (!teamId) return true;
  const team = await Team.findById(teamId);
  if (!team) return false;
  if (team.adminUserId === decoded.id) return true;
  const m = (team.members || []).find(x => x.userId === decoded.id);
  if (!m || m.status !== 'approved') return false;
  return !!memberPerms(m, team)?.[module]?.[action];
}

export async function migrateUserDataToWorkspace(userId, teamId) {
  if (!userId || !teamId || userId === teamId) return;
  for (const c of WORKSPACE_COLLECTIONS) {
    try {
      const snap = await firestore.collection(c).where('user', '==', userId).get();
      if (snap.empty) continue;
      const batch = firestore.batch();
      snap.docs.forEach(d => batch.update(d.ref, { user: teamId }));
      await batch.commit();
    } catch (e) {
      console.error(`Workspace migration failed for ${c}:`, e);
    }
  }
}
