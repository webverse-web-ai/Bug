import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Platform,
  Animated, TouchableWithoutFeedback, useWindowDimensions, ScrollView,
} from 'react-native';
import Reanimated, { FadeInLeft } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { TYPOGRAPHY, SPACING, ROUNDED } from '@/constants';
import { can, canView } from '@/client/permissions';
import BottomNav from '@/components/layout/BottomNav';
import ThemeToggle from '@/components/layout/ThemeToggle';
import AmbientBackground from '@/components/layout/AmbientBackground';

// Colourful icon palette so each menu row reads at a glance.
const NAV_PALETTE = ['#89CEFF', '#34D399', '#FFB86E', '#A78BFA', '#F87171', '#38BDF8', '#FBBF24', '#EC4899'];

// The three top-level agent areas, shown in every section drawer for quick switching.
export const AGENTS = [
  { key: 'dashboard', name: 'Dashboard', role: 'Overview', icon: 'view-dashboard-outline', href: '/bug/dashboard', color: '#89CEFF' },
  { key: 'bug', name: 'Bug', role: 'Chat', icon: 'robot-happy-outline', href: '/bug', color: '#89CEFF' },
  { key: 'pulse', name: 'Pulse', role: 'Orders', icon: 'pulse', href: '/bug/pulse', color: '#34D399' },
  { key: 'tally', name: 'Tally', role: 'Accounts', icon: 'calculator-variant', href: '/bug/tally', color: '#FFB86E' },
];

/**
 * Generic shell for an agent section (Pulse, Tally, …). Renders a section-specific
 * hamburger drawer: the section's own sub-pages + an agent switcher + settings.
 *
 * Props:
 *   agent     { name, role, icon, color }   identity shown atop the drawer
 *   navItems  [{ label, icon, href }]        the section's pages
 *   title     header title
 *   children  page content
 */
export default function SectionShell({ agent, navItems, title, children, requirePermission }) {
  const { themeMode, toggleTheme, COLORS } = useTheme();
  const styles = getStyles(COLORS);
  const { logout, user } = useAuth();
  const blocked = requirePermission && !canView(user, requirePermission);
  const pathname = usePathname() || '';
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [drawerOpen, setDrawerOpen] = useState(false);     // mobile slide-in drawer
  const [sidebarOpen, setSidebarOpen] = useState(true);    // desktop collapsible rail
  const drawerAnim = useRef(new Animated.Value(-300)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const railWidth = useRef(new Animated.Value(264)).current;

  // Hamburger: collapse/expand the rail on desktop, open the drawer on mobile.
  const onMenu = () => {
    if (isDesktop) {
      const open = !sidebarOpen;
      setSidebarOpen(open);
      Animated.timing(railWidth, { toValue: open ? 264 : 0, duration: 240, useNativeDriver: false }).start();
    } else {
      toggleDrawer();
    }
  };

  const toggleDrawer = () => {
    if (drawerOpen) {
      Animated.parallel([
        Animated.timing(drawerAnim, { toValue: -300, duration: 280, useNativeDriver: true }),
        Animated.timing(overlayAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
      ]).start(() => setDrawerOpen(false));
    } else {
      setDrawerOpen(true);
      Animated.parallel([
        Animated.timing(drawerAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.timing(overlayAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]).start();
    }
  };

  const go = (href) => {
    if (!isDesktop && drawerOpen) toggleDrawer();
    if (pathname !== href) router.push(href);
  };

  const isActive = (href) => pathname === href;

  const DrawerBody = (
    <>
      {/* Section identity */}
      <View style={styles.agentHead}>
        <View style={[styles.agentIcon, { backgroundColor: `${agent.color}22`, borderColor: `${agent.color}66` }]}>
          <MaterialCommunityIcons name={agent.icon} size={22} color={agent.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.agentName}>{agent.name}</Text>
          <Text style={styles.agentRole}>{agent.role}</Text>
        </View>
        {!isDesktop && (
          <TouchableOpacity onPress={toggleDrawer} hitSlop={8}><MaterialCommunityIcons name="close" size={22} color={COLORS.onSurfaceVariant} /></TouchableOpacity>
        )}
      </View>

      {/* Section pages */}
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <Text style={styles.navSection}>{agent.name} Menu</Text>
        {navItems.map((it, i) => {
          const active = isActive(it.href);
          const color = it.color || NAV_PALETTE[i % NAV_PALETTE.length];
          return (
            <Reanimated.View key={it.href} entering={FadeInLeft.duration(260).delay(i * 45)}>
              <TouchableOpacity style={[styles.navItem, active && styles.navItemActive]} onPress={() => go(it.href)} activeOpacity={0.7}>
                {active && <View style={[styles.activeBar, { backgroundColor: color }]} />}
                <View style={[styles.iconChip, { backgroundColor: active ? color : `${color}22`, borderColor: active ? color : `${color}55` }]}>
                  <MaterialCommunityIcons name={it.icon} size={17} color={active ? '#0b0f12' : color} />
                </View>
                <Text style={[styles.navText, active && { color: COLORS.onSurface, fontWeight: '700' }]}>{it.label}</Text>
              </TouchableOpacity>
            </Reanimated.View>
          );
        })}

        {/* Agent switcher */}
        <Text style={[styles.navSection, { marginTop: SPACING.md }]}>Switch Agent</Text>
        {AGENTS.filter(a => a.name !== agent.name && (!['pulse', 'tally'].includes(a.key) || canView(user, a.key))).map((a, i) => (
          <Reanimated.View key={a.key} entering={FadeInLeft.duration(260).delay((navItems.length + i) * 45)}>
            <TouchableOpacity style={styles.navItem} onPress={() => go(a.href)} activeOpacity={0.7}>
              <View style={[styles.iconChip, { backgroundColor: `${a.color}22`, borderColor: `${a.color}55` }]}>
                <MaterialCommunityIcons name={a.icon} size={17} color={a.color} />
              </View>
              <Text style={styles.navText}>{a.name} · {a.role}</Text>
            </TouchableOpacity>
          </Reanimated.View>
        ))}
      </ScrollView>

      {/* Footer */}
      <View style={styles.drawerFooter}>
        <TouchableOpacity style={styles.navItem} onPress={() => go('/setup')}>
          <View style={[styles.iconChip, { backgroundColor: `${COLORS.onSurfaceVariant}22`, borderColor: `${COLORS.onSurfaceVariant}44` }]}>
            <MaterialCommunityIcons name="cog-outline" size={17} color={COLORS.onSurfaceVariant} />
          </View>
          <Text style={styles.navText}>Settings</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={async () => { if (!isDesktop && drawerOpen) toggleDrawer(); await logout(); }}>
          <View style={[styles.iconChip, { backgroundColor: `${COLORS.error}22`, borderColor: `${COLORS.error}55` }]}>
            <MaterialCommunityIcons name="logout" size={17} color={COLORS.error} />
          </View>
          <Text style={[styles.navText, { color: COLORS.error }]}>Log out</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <AmbientBackground COLORS={COLORS} />
        <View style={{ flex: 1, flexDirection: 'row' }}>
          {isDesktop && (
            <Animated.View style={[styles.rail, { width: railWidth }]}>
              <View style={styles.railInner}>{DrawerBody}</View>
            </Animated.View>
          )}

          <View style={{ flex: 1 }}>
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <TouchableOpacity onPress={onMenu} style={styles.iconButton} hitSlop={6}>
                  <MaterialCommunityIcons name={isDesktop && sidebarOpen ? 'backburger' : 'menu'} size={24} color={agent.color} />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>{title || agent.name}</Text>
              </View>
              <ThemeToggle />
            </View>

            <View style={{ flex: 1 }}>
              {blocked ? (
                <View style={styles.denied}>
                  <MaterialCommunityIcons name="lock-outline" size={44} color={COLORS.onSurfaceVariant} />
                  <Text style={styles.deniedTitle}>No access to this area</Text>
                  <Text style={styles.deniedSub}>Your role doesn't include {requirePermission === 'tally' ? 'Tally · Accounts' : 'Pulse · Orders'}. Ask your team admin for access.</Text>
                  <TouchableOpacity style={styles.deniedBtn} onPress={() => router.replace('/bug/dashboard')}>
                    <Text style={styles.deniedBtnText}>Back to Dashboard</Text>
                  </TouchableOpacity>
                </View>
              ) : children}
            </View>

            {!isDesktop && <BottomNav />}
          </View>
        </View>

        {!isDesktop && drawerOpen && (
          <TouchableWithoutFeedback onPress={toggleDrawer}>
            <Animated.View style={[styles.overlay, { opacity: overlayAnim }]} />
          </TouchableWithoutFeedback>
        )}
        {!isDesktop && (
          <Animated.View style={[styles.drawer, { transform: [{ translateX: drawerAnim }] }]}>{DrawerBody}</Animated.View>
        )}
      </View>
    </SafeAreaView>
  );
}

const getStyles = (COLORS) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1, position: 'relative', overflow: 'hidden' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.md, height: 64,
    borderBottomWidth: 1, borderBottomColor: COLORS.outlineVariant, backgroundColor: COLORS.surface, zIndex: 10,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, flex: 1 },
  iconButton: { padding: SPACING.xs, borderRadius: ROUNDED.full },
  headerTitle: { ...TYPOGRAPHY.headlineMd, fontWeight: '800', color: COLORS.onSurface, flexShrink: 1 },

  rail: { overflow: 'hidden', backgroundColor: COLORS.surfaceContainerLow, borderRightWidth: 1, borderRightColor: COLORS.outlineVariant },
  railInner: { width: 264, flex: 1, paddingVertical: SPACING.lg, paddingHorizontal: SPACING.sm },
  activeBar: { position: 'absolute', left: 0, top: 8, bottom: 8, width: 3, borderRadius: 2 },
  iconChip: { width: 30, height: 30, borderRadius: 9, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  drawer: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 280, backgroundColor: COLORS.surfaceContainerLow, borderRightWidth: 1, borderRightColor: COLORS.outlineVariant, zIndex: 50, paddingVertical: SPACING.lg, paddingHorizontal: SPACING.sm },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 40 },

  agentHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.sm, paddingBottom: SPACING.md, marginBottom: SPACING.sm, borderBottomWidth: 1, borderBottomColor: `${COLORS.outlineVariant}80` },
  agentIcon: { width: 42, height: 42, borderRadius: ROUNDED.lg, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  agentName: { ...TYPOGRAPHY.headlineMd, fontSize: 20, color: COLORS.onSurface, fontWeight: '800' },
  agentRole: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.5 },

  navSection: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '700', marginLeft: SPACING.sm, marginBottom: 4, marginTop: 4 },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingHorizontal: SPACING.md, paddingVertical: 11, borderRadius: ROUNDED.lg },
  navItemActive: { backgroundColor: COLORS.secondaryContainer },
  navText: { ...TYPOGRAPHY.labelMd, color: COLORS.onSurfaceVariant, flex: 1 },
  drawerFooter: { borderTopWidth: 1, borderTopColor: `${COLORS.outlineVariant}80`, paddingTop: SPACING.sm, marginTop: SPACING.sm },
  denied: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl, gap: SPACING.sm },
  deniedTitle: { ...TYPOGRAPHY.headlineMd, fontSize: 20, color: COLORS.onSurface, fontWeight: '800' },
  deniedSub: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurfaceVariant, textAlign: 'center', maxWidth: 360 },
  deniedBtn: { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.lg, paddingVertical: 11, borderRadius: ROUNDED.full, marginTop: SPACING.sm },
  deniedBtnText: { ...TYPOGRAPHY.labelMd, color: COLORS.onPrimary, fontWeight: '700' },
});
