import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';
import { CustomInput, CustomButton, SelectableCard } from '@/components/ui';
import Loader from '@/components/ui/Loader';
import { TYPOGRAPHY, SPACING, ROUNDED } from '@/constants';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { apiCheckUsername } from '@/client/api/authService';
import { checkTeamUsername } from '@/client/api/teamService';
import { oauthSupported } from '@/client/oauthSupport';

WebBrowser.maybeCompleteAuthSession();
const redirectUri = makeRedirectUri({ preferLocalhost: true });

function useDebounce(value, delay) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), delay); return () => clearTimeout(t); }, [value, delay]);
  return v;
}

export default function SetupScreen() {
  const { user, updateProfile, createTeam, joinTeam, refreshUser, saveGeminiToken, saveOpenRouterKey, logout } = useAuth();
  const { COLORS } = useTheme();
  const styles = getStyles(COLORS);

  const [forceCreate, setForceCreate] = useState(false);
  const [path, setPath] = useState('create'); // create | join
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Derive the onboarding stage from the live user.
  const stage = useMemo(() => {
    if (!user || !user.username) return 'username';
    if (!user.team) return 'team';
    if (user.team.myStatus === 'pending') return forceCreate ? 'team' : 'pending';
    return 'ai'; // approved
  }, [user, forceCreate]);

  // Already fully onboarded → straight to the dashboard.
  useEffect(() => {
    if (user?.username && user?.team?.myStatus === 'approved' && (user.hasGeminiToken || user.hasOpenRouterKey)) {
      // still allow them to sit on the AI step if they want; only auto-jump if AI connected
    }
  }, [user]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.logoRow}><MaterialCommunityIcons name="bug" size={26} color={COLORS.primary} /><Text style={styles.brand}>BUG</Text></View>
          <Text style={styles.title}>{stage === 'pending' ? 'Almost there' : 'Set up your workspace'}</Text>
          <Text style={styles.subtitle}>{stageSubtitle(stage)}</Text>
        </View>

        {err ? <Text style={styles.errorBanner}>{err}</Text> : null}

        {stage === 'username' && <UsernameStep COLORS={COLORS} styles={styles} updateProfile={updateProfile} setErr={setErr} />}
        {stage === 'team' && (
          <TeamStep
            COLORS={COLORS} styles={styles} path={path} setPath={setPath}
            createTeam={createTeam} joinTeam={joinTeam} setErr={setErr}
            forceCreate={forceCreate}
          />
        )}
        {stage === 'pending' && (
          <PendingScreen COLORS={COLORS} styles={styles} team={user.team} refreshUser={refreshUser} onCreateOwn={() => { setPath('create'); setForceCreate(true); }} onLogout={logout} />
        )}
        {stage === 'ai' && (
          <AiStep COLORS={COLORS} styles={styles} user={user} saveGeminiToken={saveGeminiToken} saveOpenRouterKey={saveOpenRouterKey} />
        )}

        <TouchableOpacity style={styles.logoutLink} onPress={logout}>
          <MaterialCommunityIcons name="logout" size={14} color={COLORS.onSurfaceVariant} />
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const stageSubtitle = (s) => ({
  username: 'First, claim your personal username.',
  team: 'Create your business workspace, or join your team.',
  pending: 'Your request was sent to the team admin.',
  ai: 'Optionally connect an AI to power up Bug — you can do this later.',
}[s] || '');

// ── Step 1: personal username ───────────────────────────────────────────────
function UsernameStep({ COLORS, styles, updateProfile, setErr }) {
  const [username, setUsername] = useState('');
  const debounced = useDebounce(username, 450);
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (debounced.trim().length < 3) { setAvailable(false); return; }
    let active = true; setChecking(true);
    apiCheckUsername(debounced.trim()).then(d => { if (active) setAvailable(!!d.available); }).catch(() => { if (active) setAvailable(false); }).finally(() => active && setChecking(false));
    return () => { active = false; };
  }, [debounced]);

  const submit = async () => {
    setBusy(true); setErr('');
    try { await updateProfile({ username: username.trim().toLowerCase() }); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <Animated.View entering={FadeInDown.duration(260)} style={styles.card}>
      <View style={styles.cardHead}><MaterialCommunityIcons name="at" size={22} color={COLORS.primary} /><Text style={styles.cardTitle}>Your username</Text></View>
      <CustomInput
        placeholder="@username" value={username} autoCapitalize="none"
        onChangeText={(t) => setUsername(t.replace(/[^a-zA-Z0-9_]/g, ''))}
        rightIcon={checking ? <ActivityIndicator size="small" color={COLORS.onSurfaceVariant} /> : username.length > 2 ? <MaterialCommunityIcons name={available ? 'check-circle' : 'close-circle'} size={20} color={available ? '#34D399' : COLORS.error} /> : null}
      />
      <Text style={styles.hint}>This is how teammates will see you. 3–30 letters, numbers or _.</Text>
      <CustomButton title={busy ? 'Saving…' : 'Continue'} onPress={submit} disabled={!available || busy} style={{ marginTop: SPACING.md }} />
    </Animated.View>
  );
}

// ── Step 2: create or join a team ───────────────────────────────────────────
function TeamStep({ COLORS, styles, path, setPath, createTeam, joinTeam, setErr, forceCreate }) {
  const [bizName, setBizName] = useState('');
  const [bizUser, setBizUser] = useState('');
  const debounced = useDebounce(bizUser, 450);
  const [checking, setChecking] = useState(false);
  const [avail, setAvail] = useState(null); // null | true | false
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (debounced.trim().length < 3) { setAvail(null); return; }
    let active = true; setChecking(true);
    checkTeamUsername(debounced.trim())
      .then(d => { if (active) setAvail(path === 'join' ? d.exists : d.available); })
      .catch(() => { if (active) setAvail(null); })
      .finally(() => active && setChecking(false));
    return () => { active = false; };
  }, [debounced, path]);

  const doCreate = async () => {
    setBusy(true); setErr('');
    try { await createTeam(bizUser.trim().toLowerCase(), bizName.trim()); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const doJoin = async () => {
    setBusy(true); setErr('');
    try { await joinTeam(bizUser.trim().toLowerCase()); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <Animated.View entering={FadeInDown.duration(260)}>
      {!forceCreate && (
        <View style={styles.pathRow}>
          <SelectableCard icon={<FontAwesome5 name="user-plus" size={15} color={COLORS.onSurface} />} title="Create a Team" description="You become the admin." isSelected={path === 'create'} onPress={() => setPath('create')} />
          <SelectableCard icon={<FontAwesome5 name="sign-in-alt" size={15} color={COLORS.onSurface} />} title="Join a Team" description="Request access from an admin." isSelected={path === 'join'} onPress={() => setPath('join')} />
        </View>
      )}

      <View style={styles.card}>
        {path === 'create' ? (
          <>
            <View style={styles.cardHead}><MaterialCommunityIcons name="office-building-outline" size={22} color={COLORS.primary} /><Text style={styles.cardTitle}>Create your business</Text></View>
            <Text style={styles.fieldLabel}>Business name</Text>
            <CustomInput placeholder="Acme Inc." value={bizName} onChangeText={setBizName} />
            <Text style={styles.fieldLabel}>Business username (unique)</Text>
            <CustomInput placeholder="acme" value={bizUser} autoCapitalize="none" onChangeText={(t) => setBizUser(t.replace(/[^a-zA-Z0-9_]/g, ''))}
              rightIcon={checking ? <ActivityIndicator size="small" color={COLORS.onSurfaceVariant} /> : bizUser.length > 2 ? <MaterialCommunityIcons name={avail ? 'check-circle' : 'close-circle'} size={20} color={avail ? '#34D399' : COLORS.error} /> : null} />
            <Text style={styles.hint}>Teammates use this handle to find and join your workspace.</Text>
            <CustomButton title={busy ? 'Creating…' : 'Create Team'} onPress={doCreate} disabled={busy || !bizName.trim() || avail !== true} style={{ marginTop: SPACING.md }} />
          </>
        ) : (
          <>
            <View style={styles.cardHead}><MaterialCommunityIcons name="account-multiple-plus-outline" size={22} color={COLORS.primary} /><Text style={styles.cardTitle}>Join a team</Text></View>
            <Text style={styles.fieldLabel}>Business username</Text>
            <CustomInput placeholder="acme" value={bizUser} autoCapitalize="none" onChangeText={(t) => setBizUser(t.replace(/[^a-zA-Z0-9_]/g, ''))}
              rightIcon={checking ? <ActivityIndicator size="small" color={COLORS.onSurfaceVariant} /> : bizUser.length > 2 ? <MaterialCommunityIcons name={avail ? 'check-circle' : 'close-circle'} size={20} color={avail ? '#34D399' : COLORS.error} /> : null} />
            <Text style={styles.hint}>{avail === false ? 'No team found with that username.' : 'Ask your admin for the business username, then request to join.'}</Text>
            <CustomButton title={busy ? 'Requesting…' : 'Request to Join'} onPress={doJoin} disabled={busy || avail !== true} style={{ marginTop: SPACING.md }} />
          </>
        )}
      </View>
    </Animated.View>
  );
}

// ── Pending approval ────────────────────────────────────────────────────────
function PendingScreen({ COLORS, styles, team, refreshUser, onCreateOwn, onLogout }) {
  useEffect(() => {
    const t = setInterval(() => { refreshUser(); }, 7000); // poll for approval
    return () => clearInterval(t);
  }, []);
  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.card}>
      <View style={styles.pendingIcon}><Loader size={40} /></View>
      <Text style={styles.pendingTitle}>Waiting for approval</Text>
      <Text style={styles.pendingSub}>You requested to join <Text style={{ color: COLORS.primary, fontWeight: '700' }}>{team.businessName}</Text>. The admin will approve you shortly — this updates automatically.</Text>
      <CustomButton title="Check status now" onPress={refreshUser} style={{ marginTop: SPACING.md }} />
      <TouchableOpacity style={styles.altLink} onPress={onCreateOwn}>
        <Text style={styles.altLinkText}>Or create your own team and operate solo →</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// Gemini OAuth button — isolated so its auth hook only mounts in a secure context.
function GeminiConnect({ COLORS, styles, user, saveGeminiToken }) {
  const [connecting, setConnecting] = useState(false);
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID, redirectUri,
    scopes: ['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/generative-language.retriever', 'https://www.googleapis.com/auth/generative-language.tuning'],
  });
  useEffect(() => {
    if (response?.type === 'success' && response.authentication?.accessToken) {
      saveGeminiToken(response.authentication.accessToken).finally(() => setConnecting(false));
    } else if (response?.type === 'error' || response?.type === 'dismiss') setConnecting(false);
  }, [response]);
  return (
    <TouchableOpacity style={[styles.aiBtn, user.hasGeminiToken && styles.aiBtnDone]} onPress={() => { setConnecting(true); promptAsync(); }} disabled={connecting}>
      <MaterialCommunityIcons name={user.hasGeminiToken ? 'check-circle' : 'star-four-points'} size={18} color={user.hasGeminiToken ? '#34D399' : COLORS.primary} />
      <Text style={styles.aiBtnText}>{user.hasGeminiToken ? 'Gemini Connected' : connecting ? 'Connecting…' : 'Connect Google Gemini'}</Text>
    </TouchableOpacity>
  );
}

// ── AI (optional) ───────────────────────────────────────────────────────────
function AiStep({ COLORS, styles, user, saveGeminiToken, saveOpenRouterKey }) {
  const [orKey, setOrKey] = useState('');
  const [savingOr, setSavingOr] = useState(false);
  const [orErr, setOrErr] = useState('');
  const connected = user.hasGeminiToken || user.hasOpenRouterKey;

  const saveOr = async () => {
    if (!orKey.trim()) return;
    setSavingOr(true); setOrErr('');
    try { await saveOpenRouterKey(orKey.trim()); setOrKey(''); } catch (e) { setOrErr(e.message); } finally { setSavingOr(false); }
  };

  return (
    <Animated.View entering={FadeInDown.duration(260)}>
      <View style={styles.card}>
        <View style={styles.cardHead}><MaterialCommunityIcons name="creation" size={22} color={COLORS.primary} /><Text style={styles.cardTitle}>Power up with AI <Text style={styles.optional}>· optional</Text></Text></View>
        <Text style={styles.hint}>Connect Google Gemini or an OpenRouter key to enable Bug chat. You can skip and do this anytime from Settings.</Text>

        {oauthSupported() && <GeminiConnect COLORS={COLORS} styles={styles} user={user} saveGeminiToken={saveGeminiToken} />}

        {!user.hasOpenRouterKey && (
          <View style={{ marginTop: SPACING.sm }}>
            <CustomInput placeholder="sk-or-v1-…" value={orKey} onChangeText={setOrKey} secureTextEntry autoCapitalize="none" />
            {orErr ? <Text style={styles.errorText}>{orErr}</Text> : null}
          </View>
        )}
        <TouchableOpacity style={[styles.aiBtn, { marginTop: SPACING.sm }, user.hasOpenRouterKey && styles.aiBtnDone]} onPress={saveOr} disabled={savingOr || (!orKey && !user.hasOpenRouterKey)}>
          <MaterialCommunityIcons name={user.hasOpenRouterKey ? 'check-circle' : 'key'} size={18} color={user.hasOpenRouterKey ? '#34D399' : COLORS.primary} />
          <Text style={styles.aiBtnText}>{user.hasOpenRouterKey ? 'OpenRouter Connected' : savingOr ? 'Saving…' : 'Connect OpenRouter Key'}</Text>
        </TouchableOpacity>
      </View>

      <CustomButton
        title={connected ? 'Continue to Dashboard' : 'Skip — Continue to Dashboard'}
        onPress={() => router.replace('/bug/dashboard')}
        style={{ marginTop: SPACING.md }}
      />
    </Animated.View>
  );
}

const getStyles = (COLORS) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flexGrow: 1, padding: SPACING.lg, maxWidth: 560, width: '100%', alignSelf: 'center' },
  header: { marginTop: SPACING.xl, marginBottom: SPACING.lg },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginBottom: SPACING.md },
  brand: { ...TYPOGRAPHY.headlineMd, color: COLORS.primary, fontWeight: '800', letterSpacing: 1 },
  title: { ...TYPOGRAPHY.headlineLg, fontSize: 28, color: COLORS.onSurface, fontWeight: '800' },
  subtitle: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurfaceVariant, marginTop: 4 },
  errorBanner: { ...TYPOGRAPHY.bodySm, color: COLORS.error, marginBottom: SPACING.md, backgroundColor: `${COLORS.error}1A`, padding: SPACING.sm, borderRadius: ROUNDED.md },

  card: { backgroundColor: COLORS.surfaceContainerLow, borderWidth: 1, borderColor: COLORS.outlineVariant, borderRadius: ROUNDED.xl, padding: SPACING.lg, marginBottom: SPACING.md },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  cardTitle: { ...TYPOGRAPHY.headlineMd, fontSize: 19, color: COLORS.onSurface, fontWeight: '800' },
  optional: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant, fontWeight: '600' },
  fieldLabel: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6, marginTop: SPACING.sm },
  hint: { ...TYPOGRAPHY.bodySm, color: COLORS.onSurfaceVariant, marginTop: 6 },
  pathRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md, flexWrap: 'wrap' },

  pendingIcon: { alignItems: 'center', marginVertical: SPACING.md },
  pendingTitle: { ...TYPOGRAPHY.headlineMd, color: COLORS.onSurface, fontWeight: '800', textAlign: 'center' },
  pendingSub: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurfaceVariant, textAlign: 'center', marginTop: SPACING.xs },
  altLink: { marginTop: SPACING.md, alignItems: 'center' },
  altLinkText: { ...TYPOGRAPHY.labelMd, color: COLORS.primary, fontWeight: '600' },

  aiBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, backgroundColor: COLORS.surfaceContainerHighest, borderWidth: 1, borderColor: COLORS.outlineVariant, paddingVertical: 12, borderRadius: ROUNDED.md },
  aiBtnDone: { borderColor: '#34D39955', backgroundColor: '#34D39915' },
  aiBtnText: { ...TYPOGRAPHY.labelMd, color: COLORS.onSurface, fontWeight: '700' },

  errorText: { color: COLORS.error, fontSize: 12, marginTop: 4 },
  logoutLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: SPACING.lg, paddingVertical: SPACING.sm },
  logoutText: { ...TYPOGRAPHY.labelMd, color: COLORS.onSurfaceVariant },
});
