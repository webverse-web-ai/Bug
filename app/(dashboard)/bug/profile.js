import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { TYPOGRAPHY, SPACING, ROUNDED } from '@/constants';
import SectionShell from '@/components/layout/SectionShell';
import { WORKSPACE_AGENT, WORKSPACE_NAV } from './team';

const ROLE_COLORS = { admin: '#FFB86E', manager: '#A78BFA', member: '#89CEFF' };

function ProfileBody() {
  const { COLORS } = useTheme();
  const { user, updateProfile, logout } = useAuth();
  const s = getStyles(COLORS);
  const [name, setName] = useState(user?.fullName || '');
  const [username, setUsername] = useState(user?.username || '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const aiConnected = user?.hasGeminiToken || user?.hasOpenRouterKey;

  const save = async () => {
    setSaving(true); setErr(''); setMsg('');
    try {
      await updateProfile({ fullName: name.trim(), username: username.trim().toLowerCase() });
      setMsg('Profile updated.');
    } catch (e) { setErr(e.message); } finally { setSaving(false); }
  };

  return (
    <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
      <Animated.View entering={FadeInDown.duration(240)} style={s.hero}>
        <View style={s.avatar}><Text style={s.avatarText}>{(user?.fullName || user?.username || '?')[0]?.toUpperCase()}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={s.heroName}>{user?.fullName || 'Your name'}</Text>
          <Text style={s.heroSub}>{user?.email}</Text>
        </View>
      </Animated.View>

      {/* Account */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Account</Text>
        <Text style={s.fieldLabel}>Full name</Text>
        <TextInput style={[s.input, Platform.OS === 'web' && { outlineStyle: 'none' }]} value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={COLORS.onSurfaceVariant} />
        <Text style={s.fieldLabel}>Username</Text>
        <TextInput style={[s.input, Platform.OS === 'web' && { outlineStyle: 'none' }]} value={username} onChangeText={(t) => setUsername(t.replace(/[^a-zA-Z0-9_]/g, ''))} autoCapitalize="none" placeholder="username" placeholderTextColor={COLORS.onSurfaceVariant} />
        {err ? <Text style={s.err}>{err}</Text> : null}
        {msg ? <Text style={s.ok}>{msg}</Text> : null}
        <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
          <Text style={s.saveText}>{saving ? 'Saving…' : 'Save changes'}</Text>
        </TouchableOpacity>
      </View>

      {/* Workspace */}
      {user?.team && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Workspace</Text>
          <View style={s.kv}><Text style={s.kvKey}>Business</Text><Text style={s.kvVal}>{user.team.businessName}</Text></View>
          <View style={s.kv}><Text style={s.kvKey}>Handle</Text><Text style={s.kvVal}>@{user.team.businessUsername}</Text></View>
          <View style={s.kv}><Text style={s.kvKey}>Your role</Text><Text style={[s.kvVal, { color: ROLE_COLORS[user.team.myRole], textTransform: 'capitalize' }]}>{user.team.myRole}</Text></View>
          <TouchableOpacity style={s.linkRow} onPress={() => router.push('/bug/team')}>
            <MaterialCommunityIcons name="account-group-outline" size={18} color={COLORS.primary} />
            <Text style={s.linkText}>Manage team</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* AI */}
      <View style={s.card}>
        <Text style={s.cardTitle}>AI Connection</Text>
        <View style={s.kv}><Text style={s.kvKey}>Google Gemini</Text><Text style={[s.kvVal, { color: user?.hasGeminiToken ? '#34D399' : COLORS.onSurfaceVariant }]}>{user?.hasGeminiToken ? 'Connected' : 'Not connected'}</Text></View>
        <View style={s.kv}><Text style={s.kvKey}>OpenRouter</Text><Text style={[s.kvVal, { color: user?.hasOpenRouterKey ? '#34D399' : COLORS.onSurfaceVariant }]}>{user?.hasOpenRouterKey ? 'Connected' : 'Not connected'}</Text></View>
        {!aiConnected && (
          <TouchableOpacity style={s.linkRow} onPress={() => router.push('/setup')}>
            <MaterialCommunityIcons name="creation" size={18} color={COLORS.primary} />
            <Text style={s.linkText}>Connect AI to power up Bug</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity style={s.logout} onPress={logout}>
        <MaterialCommunityIcons name="logout" size={18} color={COLORS.error} />
        <Text style={s.logoutText}>Log out</Text>
      </TouchableOpacity>
      <View style={{ height: 90 }} />
    </ScrollView>
  );
}

export default function ProfileScreen() {
  return <SectionShell agent={{ ...WORKSPACE_AGENT, name: 'Profile', role: 'Account' }} navItems={WORKSPACE_NAV} title="My Profile"><ProfileBody /></SectionShell>;
}

const getStyles = (COLORS) => StyleSheet.create({
  scroll: { padding: SPACING.lg, maxWidth: 640, width: '100%', alignSelf: 'center' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.md },
  avatar: { width: 56, height: 56, borderRadius: ROUNDED.full, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { ...TYPOGRAPHY.headlineMd, color: COLORS.onPrimary, fontWeight: '800' },
  heroName: { ...TYPOGRAPHY.headlineMd, fontSize: 20, color: COLORS.onSurface, fontWeight: '800' },
  heroSub: { ...TYPOGRAPHY.bodySm, color: COLORS.onSurfaceVariant },
  card: { backgroundColor: COLORS.surfaceContainerLow, borderWidth: 1, borderColor: COLORS.outlineVariant, borderRadius: ROUNDED.xl, padding: SPACING.lg, marginBottom: SPACING.md },
  cardTitle: { ...TYPOGRAPHY.labelLg, color: COLORS.onSurface, fontWeight: '700', marginBottom: SPACING.sm },
  fieldLabel: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6, marginTop: SPACING.xs },
  input: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurface, backgroundColor: COLORS.surfaceContainerLowest, borderWidth: 1, borderColor: COLORS.outlineVariant, borderRadius: ROUNDED.md, paddingHorizontal: SPACING.md, paddingVertical: 10, marginBottom: SPACING.xs },
  err: { ...TYPOGRAPHY.bodySm, color: COLORS.error, marginTop: 4 },
  ok: { ...TYPOGRAPHY.bodySm, color: '#34D399', marginTop: 4 },
  saveBtn: { backgroundColor: COLORS.primary, paddingVertical: 12, borderRadius: ROUNDED.lg, alignItems: 'center', marginTop: SPACING.md },
  saveText: { ...TYPOGRAPHY.labelLg, color: COLORS.onPrimary, fontWeight: '800' },
  kv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7 },
  kvKey: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurfaceVariant },
  kvVal: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurface, fontWeight: '700' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.sm, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: `${COLORS.outlineVariant}80` },
  linkText: { ...TYPOGRAPHY.labelMd, color: COLORS.primary, fontWeight: '600' },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: SPACING.md, borderWidth: 1, borderColor: `${COLORS.error}40`, borderRadius: ROUNDED.lg },
  logoutText: { ...TYPOGRAPHY.labelMd, color: COLORS.error, fontWeight: '700' },
});
