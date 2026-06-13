import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Animated,
  TouchableWithoutFeedback,
  useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { TYPOGRAPHY, SPACING, ROUNDED } from '@/constants';
import { getSessions, renameSession, deleteSession } from '@/client/api';
import Sidebar from '@/components/layout/Sidebar';
import BottomNav from '@/components/layout/BottomNav';
import ThemeToggle from '@/components/layout/ThemeToggle';
import AmbientBackground from '@/components/layout/AmbientBackground';

// Lets page content (e.g. the chat) ask the shell to refresh the session list.
const DashboardContext = createContext({ reloadSessions: () => {} });
export const useDashboard = () => useContext(DashboardContext);

/**
 * Shared dashboard chrome: the sidebar (sessions navbar) + top header.
 * Used by both the chat page and the knowledge base so they share one navbar
 * and header. Session navigation is URL-param driven (/bug?session=<id>).
 *
 * Props:
 *  - title?: string         override header title (chat page computes its own)
 *  - currentSessionId?: id  the active chat session (for highlighting/title)
 *  - children               page content rendered in the main area
 */
export default function DashboardShell({ title, currentSessionId = null, children }) {
  const { themeMode, toggleTheme, COLORS } = useTheme();
  const styles = getStyles(COLORS);
  const { logout } = useAuth();
  const pathname = usePathname();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editTitle, setEditTitle] = useState('');

  const drawerAnim = useRef(new Animated.Value(-300)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const railWidth = useRef(new Animated.Value(280)).current;

  const loadSessions = async () => {
    try {
      const data = await getSessions();
      setSessions(data || []);
    } catch (e) {
      console.error('Failed to load sessions:', e);
    }
  };

  // Load on mount and whenever the active session changes (e.g. a new chat was created).
  useEffect(() => {
    loadSessions();
  }, [currentSessionId]);

  const toggleDrawer = () => {
    if (isDrawerOpen) {
      Animated.parallel([
        Animated.timing(drawerAnim, { toValue: -300, duration: 300, useNativeDriver: true }),
        Animated.timing(overlayAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => setIsDrawerOpen(false));
    } else {
      setIsDrawerOpen(true);
      Animated.parallel([
        Animated.timing(drawerAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(overlayAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  };

  const toggleSidebar = () => {
    if (isDesktop) {
      const open = !isSidebarOpen;
      setIsSidebarOpen(open);
      Animated.timing(railWidth, { toValue: open ? 280 : 0, duration: 240, useNativeDriver: false }).start();
    } else {
      toggleDrawer();
    }
  };

  // Navigate to a chat route (replace when already on /bug to avoid history bloat).
  const goToChat = (href) => {
    if (pathname === '/bug') router.replace(href);
    else router.push(href);
  };

  const handleNewChat = () => {
    if (isDrawerOpen) toggleDrawer();
    goToChat(`/bug?new=${Date.now()}`);
  };

  const handleSelectSession = (id) => {
    if (isDrawerOpen) toggleDrawer();
    goToChat(`/bug?session=${id}`);
  };

  const handleRename = async (id) => {
    try {
      if (!editTitle.trim()) return;
      await renameSession(id, editTitle);
      setEditingSessionId(null);
      loadSessions();
    } catch (e) {
      console.error('Failed to rename session:', e);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteSession(id);
      loadSessions();
      if (currentSessionId === id) goToChat(`/bug?new=${Date.now()}`);
    } catch (e) {
      console.error('Failed to delete session:', e);
    }
  };

  const handleGoToSetup = () => {
    if (isDrawerOpen) toggleDrawer();
    router.replace('/setup');
  };

  const handleLogout = async () => {
    if (isDrawerOpen) toggleDrawer();
    await logout();
  };

  const sidebarProps = {
    isDesktop,
    toggleDrawer,
    handleNewChat,
    sessions,
    currentSessionId,
    editingSessionId,
    editTitle,
    setEditTitle,
    handleRename,
    setEditingSessionId,
    handleSelectSession,
    handleDelete,
    handleGoToSetup,
    handleLogout,
  };

  const headerTitle = title
    || (currentSessionId ? (sessions.find(s => s.id === currentSessionId)?.title || 'Bug AI') : 'New Chat');

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <AmbientBackground COLORS={COLORS} />
        <View style={{ flex: 1, flexDirection: 'row' }}>
          {/* Desktop sidebar — collapses smoothly via the hamburger */}
          {isDesktop && (
            <Animated.View style={[styles.railDesktop, { width: railWidth }]}>
              <View style={styles.sidebarDesktop}>
                <Sidebar {...sidebarProps} />
              </View>
            </Animated.View>
          )}

          {/* Main content */}
          <View style={{ flex: 1, flexDirection: 'column' }}>
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <TouchableOpacity onPress={toggleSidebar} style={styles.iconButton} hitSlop={6}>
                  <MaterialCommunityIcons name={isDesktop && isSidebarOpen ? 'backburger' : 'menu'} size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
                  {headerTitle}
                </Text>
              </View>
              <View style={styles.headerRight}>
                <ThemeToggle />
              </View>
            </View>

            <DashboardContext.Provider value={{ reloadSessions: loadSessions }}>
              <View style={{ flex: 1 }}>{children}</View>
            </DashboardContext.Provider>

            {/* Mobile bottom nav — not on the chat page (it has its own input bar) */}
            {!isDesktop && pathname !== '/bug' && <BottomNav />}
          </View>
        </View>

        {/* Mobile sliding drawer */}
        {!isDesktop && isDrawerOpen && (
          <TouchableWithoutFeedback onPress={toggleDrawer}>
            <Animated.View style={[styles.drawerOverlay, { opacity: overlayAnim }]} />
          </TouchableWithoutFeedback>
        )}
        {!isDesktop && (
          <Animated.View style={[styles.drawer, { transform: [{ translateX: drawerAnim }] }]}>
            <Sidebar {...sidebarProps} />
          </Animated.View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (COLORS) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1, position: 'relative', overflow: 'hidden' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    height: 64,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outlineVariant,
    backgroundColor: COLORS.surface,
    zIndex: 10,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  iconButton: { padding: SPACING.xs, borderRadius: ROUNDED.full },
  headerTitle: { ...TYPOGRAPHY.headlineMd, fontWeight: '800', color: COLORS.onSurface, flexShrink: 1 },
  drawerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 40 },
  drawer: {
    position: 'absolute', top: 0, left: 0, bottom: 0, width: 280,
    backgroundColor: COLORS.surfaceContainerLow,
    borderRightWidth: 1, borderRightColor: COLORS.outlineVariant,
    zIndex: 50, paddingVertical: SPACING.lg,
  },
  railDesktop: {
    overflow: 'hidden',
    backgroundColor: COLORS.surfaceContainerLow,
    borderRightWidth: 1,
    borderRightColor: COLORS.outlineVariant,
  },
  sidebarDesktop: {
    width: 280,
    flex: 1,
    paddingVertical: SPACING.lg,
  },
});
