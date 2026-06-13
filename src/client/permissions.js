// Client-side permission checks, mirroring the server. The team's myPermissions
// comes from /api/auth/me. Admins and solo users (no team) can do everything.
export function can(user, module, action) {
  const t = user?.team;
  if (!t) return true;                 // no team yet → solo, full access to own data
  if (t.isAdmin || t.myRole === 'admin') return true;
  return !!t.myPermissions?.[module]?.[action];
}

export const canView = (user, module) => can(user, module, 'view');
export const canCreate = (user, module) => can(user, module, 'create');
export const canEdit = (user, module) => can(user, module, 'edit');
export const canDelete = (user, module) => can(user, module, 'delete');

export const ROLE_LABELS = {
  admin: 'Admin', operations: 'Operations Manager', accountant: 'Accountant',
  member: 'Member', custom: 'Custom', manager: 'Operations Manager',
};
export const ASSIGNABLE_ROLES = ['operations', 'accountant', 'member'];
export const PERM_MODULES = [
  { key: 'pulse', label: 'Pulse · Orders', color: '#34D399' },
  { key: 'tally', label: 'Tally · Accounts', color: '#FFB86E' },
];
