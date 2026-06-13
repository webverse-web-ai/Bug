import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { TYPOGRAPHY, SPACING, ROUNDED } from '@/constants';
import SectionShell from '@/components/layout/SectionShell';
import Loader from '@/components/ui/Loader';
import { getMyTeam } from '@/client/api';
import { useSWR } from '@/client/cache/swr';
import { ROLE_LABELS, ASSIGNABLE_ROLES, PERM_MODULES } from '@/client/permissions';

const CRUD = ['view', 'create', 'edit', 'delete'];

export const WORKSPACE_AGENT = { name: 'Team', role: 'Workspace', icon: 'account-group-outline', color: '#89CEFF' };
export const WORKSPACE_NAV = [
  { label: 'Team Members', icon: 'account-group-outline', href: '/bug/team' },
  { label: 'My Profile', icon: 'account-circle-outline', href: '/bug/profile' },
  { label: 'Dashboard', icon: 'view-dashboard-outline', href: '/bug/dashboard' },
];

const ROLE_COLORS = { admin: '#FFB86E', operations: '#34D399', accountant: '#A78BFA', member: '#89CEFF', custom: '#EC4899', manager: '#34D399' };
const permSummary = (p) => PERM_MODULES.map(m => {
  const x = p?.[m.key] || {};
  const level = x.create || x.edit || x.delete ? 'full' : x.view ? 'view' : 'none';
  return `${m.key === 'pulse' ? 'Pulse' : 'Tally'}: ${level}`;
}).join(' · ');

function TeamBody() {
  const { COLORS } = useTheme();
  const { user, manageMember } = useAuth();
  const s = getStyles(COLORS);
  const { data, loading, refresh, mutate } = useSWR('team', getMyTeam);
  const team = data?.team ?? user?.team ?? null;
  const [busyId, setBusyId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const act = async (userId, action, role, permissions) => {
    setBusyId(userId);
    try { const d = await manageMember(userId, action, role, permissions); if (d?.team) mutate({ team: d.team }); else refresh(); }
    finally { setBusyId(null); }
  };

  const togglePerm = (m, mod, action) => {
    const next = JSON.parse(JSON.stringify(m.permissions || { pulse: {}, tally: {} }));
    next[mod] = next[mod] || {};
    next[mod][action] = !next[mod][action];
    if (action !== 'view' && next[mod][action]) next[mod].view = true;
    if (action === 'view' && !next[mod][action]) { next[mod].create = false; next[mod].edit = false; next[mod].delete = false; }
    act(m.userId, 'permissions', undefined, next);
  };

  if (loading && !team) return <View style={s.center}><Loader label="Loading team…" /></View>;
  if (!team) return <View style={s.center}><Text style={s.muted}>No team found.</Text></View>;

  const isAdmin = team.isAdmin;
  const pending = team.members.filter(m => m.status === 'pending');
  const approved = team.members.filter(m => m.status === 'approved');

  const MemberRow = ({ m, isPending }) => {
    const editable = isAdmin && m.userId !== user.id && m.role !== 'admin';
    const expanded = expandedId === m.userId;
    const rc = ROLE_COLORS[m.role] || COLORS.primary;
    return (
      <View>
        <TouchableOpacity activeOpacity={editable && !isPending ? 0.7 : 1} onPress={() => editable && !isPending && setExpandedId(expanded ? null : m.userId)} style={s.memberRow}>
          <View style={[s.avatar, { backgroundColor: `${rc}1A` }]}>
            <Text style={[s.avatarText, { color: rc }]}>{(m.name || m.username || '?')[0]?.toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.memberName} numberOfLines={1}>{m.name || m.username || 'Member'}{m.userId === user.id ? ' (you)' : ''}</Text>
            <Text style={s.memberSub} numberOfLines={1}>
              <Text style={{ color: rc, fontWeight: '700' }}>{m.roleLabel || ROLE_LABELS[m.role] || m.role}</Text>
              {!isPending && ` · ${permSummary(m.permissions)}`}
            </Text>
          </View>
          {isPending ? (
            isAdmin ? (
              <View style={s.actions}>
                <TouchableOpacity style={[s.btn, s.btnApprove]} disabled={busyId === m.userId} onPress={() => act(m.userId, 'approve')}>
                  <MaterialCommunityIcons name="check" size={15} color="#04210f" /><Text style={s.btnApproveText}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.btnGhost} disabled={busyId === m.userId} onPress={() => act(m.userId, 'reject')}>
                  <MaterialCommunityIcons name="close" size={16} color={COLORS.error} />
                </TouchableOpacity>
              </View>
            ) : <View style={s.pendingTag}><Text style={s.pendingTagText}>Pending</Text></View>
          ) : editable ? (
            <MaterialCommunityIcons name={expanded ? 'chevron-up' : 'tune-variant'} size={20} color={COLORS.onSurfaceVariant} />
          ) : null}
        </TouchableOpacity>

        {editable && !isPending && expanded && (
          <View style={s.editor}>
            <Text style={s.editorLabel}>Role preset</Text>
            <View style={s.chipWrap}>
              {ASSIGNABLE_ROLES.map(r => {
                const on = m.role === r;
                return (
                  <TouchableOpacity key={r} style={[s.roleOpt, on && { backgroundColor: `${ROLE_COLORS[r]}22`, borderColor: ROLE_COLORS[r] }]} onPress={() => act(m.userId, 'role', r)}>
                    <Text style={[s.roleOptText, on && { color: ROLE_COLORS[r] }]}>{ROLE_LABELS[r]}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {PERM_MODULES.map(mod => (
              <View key={mod.key} style={s.permModule}>
                <View style={s.permModHead}><View style={[s.permDot, { backgroundColor: mod.color }]} /><Text style={s.permModName}>{mod.label}</Text></View>
                <View style={s.chipWrap}>
                  {CRUD.map(action => {
                    const on = !!m.permissions?.[mod.key]?.[action];
                    return (
                      <TouchableOpacity key={action} style={[s.crudChip, on && { backgroundColor: `${mod.color}22`, borderColor: mod.color }]} disabled={busyId === m.userId} onPress={() => togglePerm(m, mod.key, action)}>
                        <MaterialCommunityIcons name={on ? 'check' : 'minus'} size={12} color={on ? mod.color : COLORS.onSurfaceVariant} />
                        <Text style={[s.crudText, on && { color: mod.color }]}>{action}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}

            <TouchableOpacity style={s.removeBtn} disabled={busyId === m.userId} onPress={() => act(m.userId, 'remove')}>
              <MaterialCommunityIcons name="account-remove-outline" size={16} color={COLORS.error} />
              <Text style={s.removeText}>Remove from team</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
      <Animated.View entering={FadeInDown.duration(240)} style={s.banner}>
        <View style={s.bizIcon}><MaterialCommunityIcons name="office-building" size={22} color={COLORS.onPrimary} /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.bizName}>{team.businessName}</Text>
          <Text style={s.bizHandle}>@{team.businessUsername} · {team.memberCount} member{team.memberCount !== 1 ? 's' : ''}</Text>
        </View>
        {isAdmin && <View style={s.adminBadge}><MaterialCommunityIcons name="shield-crown-outline" size={13} color="#FFB86E" /><Text style={s.adminBadgeText}>ADMIN</Text></View>}
      </Animated.View>

      {!isAdmin && <Text style={s.note}>Only the team admin can approve members and change roles.</Text>}

      {isAdmin && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Join Requests {pending.length > 0 ? `(${pending.length})` : ''}</Text>
          {pending.length === 0 ? <Text style={s.muted}>No pending requests.</Text> : pending.map(m => <MemberRow key={m.userId} m={m} isPending />)}
        </View>
      )}

      <View style={s.card}>
        <Text style={s.cardTitle}>Members ({approved.length})</Text>
        {approved.map(m => <MemberRow key={m.userId} m={m} isPending={false} />)}
      </View>
      <View style={{ height: 90 }} />
    </ScrollView>
  );
}

export default function TeamScreen() {
  return <SectionShell agent={WORKSPACE_AGENT} navItems={WORKSPACE_NAV} title="Team"><TeamBody /></SectionShell>;
}

const getStyles = (COLORS) => StyleSheet.create({
  scroll: { padding: SPACING.lg, maxWidth: 760, width: '100%', alignSelf: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  muted: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurfaceVariant, fontStyle: 'italic' },
  note: { ...TYPOGRAPHY.bodySm, color: COLORS.onSurfaceVariant, marginBottom: SPACING.md },
  banner: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, backgroundColor: COLORS.surfaceContainerLow, borderWidth: 1, borderColor: COLORS.outlineVariant, borderRadius: ROUNDED.xl, padding: SPACING.md, marginBottom: SPACING.md },
  bizIcon: { width: 44, height: 44, borderRadius: ROUNDED.lg, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  bizName: { ...TYPOGRAPHY.labelLg, color: COLORS.onSurface, fontWeight: '800' },
  bizHandle: { ...TYPOGRAPHY.bodySm, color: COLORS.onSurfaceVariant, marginTop: 1 },
  adminBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FFB86E1A', borderColor: '#FFB86E55', borderWidth: 1, borderRadius: ROUNDED.full, paddingHorizontal: 8, paddingVertical: 3 },
  adminBadgeText: { ...TYPOGRAPHY.labelSm, fontSize: 9, fontWeight: '800', color: '#FFB86E', letterSpacing: 0.5 },
  card: { backgroundColor: COLORS.surfaceContainerLow, borderWidth: 1, borderColor: COLORS.outlineVariant, borderRadius: ROUNDED.xl, padding: SPACING.lg, marginBottom: SPACING.md },
  cardTitle: { ...TYPOGRAPHY.labelLg, color: COLORS.onSurface, fontWeight: '700', marginBottom: SPACING.sm },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: `${COLORS.outlineVariant}55` },
  avatar: { width: 38, height: 38, borderRadius: ROUNDED.full, justifyContent: 'center', alignItems: 'center' },
  avatarText: { ...TYPOGRAPHY.labelLg, fontWeight: '800' },
  memberName: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurface, fontWeight: '600' },
  memberSub: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant, marginTop: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 10, paddingVertical: 6, borderRadius: ROUNDED.full },
  btnApprove: { backgroundColor: '#34D399' },
  btnApproveText: { fontSize: 12, fontWeight: '800', color: '#04210f' },
  btnGhost: { padding: 6, borderRadius: ROUNDED.full, backgroundColor: COLORS.surfaceContainerHighest },
  roleChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: ROUNDED.full, backgroundColor: COLORS.surfaceContainerHighest, borderWidth: 1, borderColor: COLORS.outlineVariant },
  roleChipText: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant, fontWeight: '600' },
  editor: { backgroundColor: COLORS.surfaceContainerLowest, borderRadius: ROUNDED.lg, padding: SPACING.md, marginBottom: SPACING.sm, gap: SPACING.sm, borderWidth: 1, borderColor: `${COLORS.outlineVariant}80` },
  editorLabel: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: '700' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  roleOpt: { borderWidth: 1, borderColor: COLORS.outlineVariant, backgroundColor: COLORS.surfaceContainerHigh, paddingHorizontal: SPACING.md, paddingVertical: 7, borderRadius: ROUNDED.full },
  roleOptText: { ...TYPOGRAPHY.labelMd, color: COLORS.onSurfaceVariant, fontWeight: '600' },
  permModule: { gap: 6 },
  permModHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  permDot: { width: 8, height: 8, borderRadius: 4 },
  permModName: { ...TYPOGRAPHY.labelMd, color: COLORS.onSurface, fontWeight: '700' },
  crudChip: { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderColor: COLORS.outlineVariant, backgroundColor: COLORS.surfaceContainerHigh, paddingHorizontal: 9, paddingVertical: 5, borderRadius: ROUNDED.full },
  crudText: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant, fontWeight: '600', textTransform: 'capitalize' },
  removeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: `${COLORS.error}40`, borderRadius: ROUNDED.md, paddingVertical: 9, marginTop: 2 },
  removeText: { ...TYPOGRAPHY.labelMd, color: COLORS.error, fontWeight: '700' },
  pendingTag: { backgroundColor: '#FFB86E1A', borderRadius: ROUNDED.full, paddingHorizontal: 10, paddingVertical: 4 },
  pendingTagText: { ...TYPOGRAPHY.labelSm, fontSize: 10, color: '#FFB86E', fontWeight: '700' },
});
