import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  useWindowDimensions
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { TYPOGRAPHY, SPACING, ROUNDED } from '@/constants';
import { useAuth } from '@/contexts/AuthContext';
import { getSessions, renameSession, deleteSession } from '@/client/api';
import ChatInterface from '@/components/ChatInterface';
import Sidebar from '@/components/layout/Sidebar';

const { width } = Dimensions.get('window');

export default function DashboardIndex() {
  const { themeMode, toggleTheme, COLORS } = useTheme();
  const styles = getStyles(COLORS);
  
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [chatNonce, setChatNonce] = useState(0);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  
  const drawerAnim = useRef(new Animated.Value(-300)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  const { logout } = useAuth();

  const toggleDrawer = () => {
    if (isDrawerOpen) {
      Animated.parallel([
        Animated.timing(drawerAnim, { toValue: -300, duration: 300, useNativeDriver: true }),
        Animated.timing(overlayAnim, { toValue: 0, duration: 300, useNativeDriver: true })
      ]).start(() => setIsDrawerOpen(false));
    } else {
      setIsDrawerOpen(true);
      Animated.parallel([
        Animated.timing(drawerAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(overlayAnim, { toValue: 1, duration: 300, useNativeDriver: true })
      ]).start();
    }
  };

  const handleLogout = async () => {
    toggleDrawer();
    await logout();
  };

  const handleGoToSetup = () => {
    toggleDrawer();
    import('expo-router').then(({ router }) => router.replace('/setup'));
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const data = await getSessions();
      setSessions(data || []);
    } catch (e) {
      console.error('Failed to load sessions:', e);
    }
  };

  const handleNewChat = () => {
    setCurrentSessionId(null);
    setChatNonce(n => n + 1); // force a fresh chat view even if already on a new chat
    if (isDrawerOpen) toggleDrawer();
  };

  const handleSelectSession = (id) => {
    setCurrentSessionId(id);
    if (isDrawerOpen) toggleDrawer();
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
      if (currentSessionId === id) setCurrentSessionId(null);
      loadSessions();
    } catch (e) {
      console.error('Failed to delete session:', e);
    }
  };

  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;
  const currentTitle = currentSessionId ? sessions.find(s => s.id === currentSessionId)?.title || 'Bug AI' : 'New Chat';

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const toggleSidebar = () => {
    if (isDesktop) {
      setIsSidebarOpen(!isSidebarOpen);
    } else {
      toggleDrawer();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        
        <View style={{ flex: 1, flexDirection: 'row' }}>
          
          {/* Desktop Sidebar (Toggleable) */}
          {isDesktop && isSidebarOpen && (
            <View style={styles.sidebarDesktop}>
              <Sidebar 
                isDesktop={isDesktop}
                toggleDrawer={toggleDrawer}
                handleNewChat={handleNewChat}
                sessions={sessions}
                currentSessionId={currentSessionId}
                editingSessionId={editingSessionId}
                editTitle={editTitle}
                setEditTitle={setEditTitle}
                handleRename={handleRename}
                setEditingSessionId={setEditingSessionId}
                handleSelectSession={handleSelectSession}
                handleDelete={handleDelete}
                handleGoToSetup={handleGoToSetup}
                handleLogout={handleLogout}
              />
            </View>
          )}

          {/* Main App Content Area */}
          <View style={{ flex: 1, flexDirection: 'column' }}>
            
            {/* Top App Bar */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <TouchableOpacity onPress={toggleSidebar} style={styles.iconButton}>
                  <MaterialCommunityIcons name="menu" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                
                <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
                  {currentTitle}
                </Text>
              </View>

              <View style={styles.headerRight}>
                <TouchableOpacity style={styles.iconButton} onPress={toggleTheme}>
                  <MaterialCommunityIcons 
                    name={themeMode === 'dark' ? "weather-sunny" : "weather-night"} 
                    size={22} 
                    color={COLORS.onSurfaceVariant} 
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Chat Component */}
            <ChatInterface
              key={currentSessionId || `new-${chatNonce}`}
              sessionId={currentSessionId}
              onChatUpdated={(id) => {
                if (id !== currentSessionId) {
                  setCurrentSessionId(id);
                }
                loadSessions();
              }}
            />
          </View>
        </View>

        {/* Sliding Navigation Drawer (Mobile Only) */}
        {!isDesktop && isDrawerOpen && (
          <TouchableWithoutFeedback onPress={toggleDrawer}>
            <Animated.View style={[styles.drawerOverlay, { opacity: overlayAnim }]} />
          </TouchableWithoutFeedback>
        )}
        {!isDesktop && (
          <Animated.View style={[styles.drawer, { transform: [{ translateX: drawerAnim }] }]}>
            <Sidebar 
              isDesktop={isDesktop}
              toggleDrawer={toggleDrawer}
              handleNewChat={handleNewChat}
              sessions={sessions}
              currentSessionId={currentSessionId}
              editingSessionId={editingSessionId}
              editTitle={editTitle}
              setEditTitle={setEditTitle}
              handleRename={handleRename}
              setEditingSessionId={setEditingSessionId}
              handleSelectSession={handleSelectSession}
              handleDelete={handleDelete}
              handleGoToSetup={handleGoToSetup}
              handleLogout={handleLogout}
            />
          </Animated.View>
        )}

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (COLORS) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1, position: 'relative', overflow: 'hidden' },
  
  // Header
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

  // Drawer styles needed by the container
  drawerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 40 },
  drawer: { 
    position: 'absolute', top: 0, left: 0, bottom: 0, width: 280, 
    backgroundColor: COLORS.surfaceContainerLow, 
    borderRightWidth: 1, borderRightColor: COLORS.outlineVariant,
    zIndex: 50, paddingVertical: SPACING.lg
  },
  sidebarDesktop: {
    width: 280,
    backgroundColor: COLORS.surfaceContainerLow,
    borderRightWidth: 1,
    borderRightColor: COLORS.outlineVariant,
    paddingVertical: SPACING.lg,
  },

  // Modals
  modalOverlayView: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.background, borderTopLeftRadius: ROUNDED.xl, borderTopRightRadius: ROUNDED.xl, height: '80%', padding: SPACING.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  searchInput: { backgroundColor: COLORS.surfaceContainerLow, borderRadius: ROUNDED.lg, padding: SPACING.md, color: COLORS.onSurface, marginBottom: SPACING.md, ...TYPOGRAPHY.bodyMd, borderWidth: 1, borderColor: COLORS.outlineVariant },
  sectionHeader: { ...TYPOGRAPHY.labelMd, color: COLORS.onSurfaceVariant, marginTop: SPACING.lg, marginBottom: SPACING.sm, textTransform: 'uppercase' },
  modelItem: { flexDirection: 'row', justifyContent: 'space-between', padding: SPACING.md, borderRadius: ROUNDED.md, backgroundColor: COLORS.surfaceContainerLow, marginBottom: SPACING.xs, borderWidth: 1, borderColor: 'transparent' },
  modelItemActive: { borderWidth: 1, borderColor: COLORS.primary },
  modelItemText: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurface },
  modelItemTextActive: { color: COLORS.primary, fontWeight: 'bold' },
});
