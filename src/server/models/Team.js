import { firestore } from '../lib/db';

// A team is a single shared workspace. Members are embedded on the team doc.
// status: approved | pending.
export const TEAM_ROLES = ['admin', 'operations', 'accountant', 'member', 'custom'];
export const ASSIGNABLE_ROLES = ['operations', 'accountant', 'member']; // admin can assign these
export const ROLE_LABELS = {
  admin: 'Admin', operations: 'Operations Manager', accountant: 'Accountant', member: 'Member', custom: 'Custom', manager: 'Operations Manager',
};

// Permission modules = the shared business areas. (Chat/Knowledge stay personal.)
export const PERM_MODULES = ['pulse', 'tally'];
const FULL = { view: true, create: true, edit: true, delete: true };
const VIEW = { view: true, create: false, edit: false, delete: false };
const NONE = { view: false, create: false, edit: false, delete: false };

// Each role maps to a default per-module CRUD permission set.
export const ROLE_PRESETS = {
  admin:      { pulse: { ...FULL }, tally: { ...FULL } },
  operations: { pulse: { ...FULL }, tally: { ...VIEW } },  // runs orders, reads accounts
  accountant: { pulse: { ...VIEW }, tally: { ...FULL } },  // runs accounts, reads orders
  member:     { pulse: { ...VIEW }, tally: { ...VIEW } },  // read-only
  manager:    { pulse: { ...FULL }, tally: { ...VIEW } },  // legacy alias
};

export function permsForRole(role) {
  const p = ROLE_PRESETS[role] || ROLE_PRESETS.member;
  return JSON.parse(JSON.stringify(p));
}

// Normalize an arbitrary permissions object to the canonical shape.
export function sanitizePerms(perms) {
  const out = {};
  for (const m of PERM_MODULES) {
    const src = perms?.[m] || {};
    out[m] = { view: !!src.view, create: !!src.create, edit: !!src.edit, delete: !!src.delete };
    // create/edit/delete imply view
    if (out[m].create || out[m].edit || out[m].delete) out[m].view = true;
  }
  return out;
}

// Effective permissions for a member (admins always full).
export function memberPerms(member, team) {
  if (!member) return { pulse: { ...NONE }, tally: { ...NONE } };
  if (member.role === 'admin' || (team && team.adminUserId === member.userId)) return { pulse: { ...FULL }, tally: { ...FULL } };
  return sanitizePerms(member.permissions || permsForRole(member.role));
}

const Team = {
  collection: firestore.collection('teams'),

  async findByUsername(businessUsername) {
    const snap = await this.collection
      .where('businessUsername', '==', String(businessUsername).toLowerCase())
      .limit(1).get();
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { _id: d.id, ...d.data() };
  },

  async findById(id) {
    if (!id) return null;
    const d = await this.collection.doc(id).get();
    if (!d.exists) return null;
    return { _id: d.id, ...d.data() };
  },

  async create(data) {
    const team = {
      businessUsername: String(data.businessUsername).toLowerCase().trim(),
      businessName: String(data.businessName).trim(),
      adminUserId: data.adminUserId,
      members: data.members || [], // [{ userId, name, username, role, status, joinedAt }]
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const ref = await this.collection.add(team);
    return { _id: ref.id, ...team };
  },

  async update(id, data) {
    data.updatedAt = new Date();
    await this.collection.doc(id).update(data);
  },
};

export default Team;
