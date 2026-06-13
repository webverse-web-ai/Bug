import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { canView } from '@/client/permissions';
import { TYPOGRAPHY } from '@/constants';

// Mobile bottom navigation (matches the Stitch BottomNavBar) — quick access to
// the agents/areas. Hidden on desktop (the sidebar covers it there).
const TABS = [
  { key: 'home',  label: 'Home',    icon: 'view-dashboard-outline', match: (p) => p.startsWith('/bug/dashboard'), href: '/bug/dashboard' },
  { key: 'chat',  label: 'Chat',    icon: 'robot-happy-outline', match: (p) => p === '/bug', href: '/bug' },
  { key: 'pulse', label: 'Pulse',   icon: 'pulse',               match: (p) => p.startsWith('/bug/pulse'), href: '/bug/pulse' },
  { key: 'tally', label: 'Tally',   icon: 'calculator-variant',  match: (p) => p.startsWith('/bug/tally'), href: '/bug/tally' },
  { key: 'acct',  label: 'Account', icon: 'account-circle-outline', match: (p) => p.startsWith('/setup'), href: '/setup' },
];

export default function BottomNav() {
  const { COLORS } = useTheme();
  const { user } = useAuth();
  const styles = getStyles(COLORS);
  const pathname = usePathname() || '';

  const tabs = TABS.filter(t => !['pulse', 'tally'].includes(t.key) || canView(user, t.key));

  return (
    <View style={styles.bar}>
      {tabs.map((t) => {
        const active = t.match(pathname);
        return (
          <TouchableOpacity
            key={t.key}
            style={styles.tab}
            activeOpacity={0.7}
            onPress={() => { if (!active) router.push(t.href); }}
          >
            <MaterialCommunityIcons name={t.icon} size={23} color={active ? COLORS.primary : COLORS.onSurfaceVariant} />
            <Text style={[styles.label, active && { color: COLORS.primary, fontWeight: '700' }]}>{t.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const getStyles = (COLORS) => StyleSheet.create({
  bar: {
    flexDirection: 'row',
    height: 62,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.outlineVariant,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(8px)' } : {}),
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  label: { ...TYPOGRAPHY.labelSm, fontSize: 10, color: COLORS.onSurfaceVariant },
});
