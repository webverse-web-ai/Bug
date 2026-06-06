import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  FlatList
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { TYPOGRAPHY, SPACING, ROUNDED } from '@/constants';
import { useAuth } from '@/contexts/AuthContext';
import ChatInterface from '@/components/ChatInterface';

const { width } = Dimensions.get('window');

export default function DashboardIndex() {
  const { themeMode, toggleTheme, COLORS } = useTheme();
  const styles = getStyles(COLORS);
  
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        
        {/* Top App Bar */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={toggleDrawer} style={styles.iconButton}>
              <MaterialCommunityIcons name="menu" size={24} color={COLORS.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Bug AI</Text>
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
        <ChatInterface />

        {/* Sliding Navigation Drawer */}
        {isDrawerOpen && (
          <TouchableWithoutFeedback onPress={toggleDrawer}>
            <Animated.View style={[styles.drawerOverlay, { opacity: overlayAnim }]} />
          </TouchableWithoutFeedback>
        )}
        <Animated.View style={[styles.drawer, { transform: [{ translateX: drawerAnim }] }]}>
          <View style={styles.drawerHeader}>
            <View style={styles.logoRow}>
              <MaterialCommunityIcons name="bug" size={28} color={COLORS.primary} />
              <Text style={styles.drawerTitle}>BUG BOS</Text>
            </View>
            <TouchableOpacity onPress={toggleDrawer} style={styles.iconButton}>
              <MaterialCommunityIcons name="close" size={24} color={COLORS.onSurfaceVariant} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.drawerLinks}>
            <TouchableOpacity style={styles.drawerLinkActive}>
              <MaterialCommunityIcons name="chat-outline" size={20} color={COLORS.onPrimaryContainer} />
              <Text style={styles.drawerLinkTextActive}>Chat Sessions</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.drawerLink}>
              <MaterialCommunityIcons name="database" size={20} color={COLORS.onSurfaceVariant} />
              <Text style={styles.drawerLinkText}>Knowledge Base</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.drawerLink}>
              <MaterialCommunityIcons name="chart-line" size={20} color={COLORS.onSurfaceVariant} />
              <Text style={styles.drawerLinkText}>System Metrics</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.drawerLink} onPress={handleGoToSetup}>
              <MaterialCommunityIcons name="cog" size={20} color={COLORS.onSurfaceVariant} />
              <Text style={styles.drawerLinkText}>Settings</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.drawerFooter}>
            <TouchableOpacity style={styles.drawerLink} onPress={handleLogout}>
              <MaterialCommunityIcons name="logout" size={20} color={COLORS.error} />
              <Text style={[styles.drawerLinkText, { color: COLORS.error }]}>Log out</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (COLORS) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1, position: 'relative' },
  
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
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  iconButton: { padding: SPACING.xs, borderRadius: ROUNDED.full },
  headerTitle: { ...TYPOGRAPHY.headlineMd, fontWeight: '800', color: COLORS.onSurface },
  modelPill: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
    backgroundColor: COLORS.surfaceContainerLow,
    borderWidth: 1, borderColor: COLORS.outlineVariant,
    paddingHorizontal: SPACING.sm, paddingVertical: 4,
    borderRadius: ROUNDED.full
  },
  modelPillText: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurface },

  // Drawer
  drawerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 40 },
  drawer: { 
    position: 'absolute', top: 0, left: 0, bottom: 0, width: 280, 
    backgroundColor: COLORS.surfaceContainerLow, 
    borderRightWidth: 1, borderRightColor: COLORS.outlineVariant,
    zIndex: 50, paddingVertical: SPACING.lg
  },
  drawerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.md, marginBottom: SPACING.lg },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  drawerTitle: { ...TYPOGRAPHY.headlineMd, fontWeight: 'bold', color: COLORS.primary },
  drawerLinks: { flex: 1, paddingHorizontal: SPACING.sm, gap: 4 },
  drawerLink: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md, borderRadius: ROUNDED.lg },
  drawerLinkActive: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md, borderRadius: ROUNDED.lg, backgroundColor: COLORS.secondaryContainer },
  drawerLinkText: { ...TYPOGRAPHY.labelMd, color: COLORS.onSurfaceVariant },
  drawerLinkTextActive: { ...TYPOGRAPHY.labelMd, color: COLORS.onSecondaryContainer },
  drawerFooter: { paddingHorizontal: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: `${COLORS.outlineVariant}80` },

  // Modals
  modalOverlayView: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.background, borderTopLeftRadius: ROUNDED.xl, borderTopRightRadius: ROUNDED.xl, height: '80%', padding: SPACING.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  modalTitle: { ...TYPOGRAPHY.headlineMd, color: COLORS.onSurface },
  searchInput: { backgroundColor: COLORS.surfaceContainerLow, borderRadius: ROUNDED.lg, padding: SPACING.md, color: COLORS.onSurface, marginBottom: SPACING.md, ...TYPOGRAPHY.bodyMd, borderWidth: 1, borderColor: COLORS.outlineVariant },
  sectionHeader: { ...TYPOGRAPHY.labelMd, color: COLORS.onSurfaceVariant, marginTop: SPACING.lg, marginBottom: SPACING.sm, textTransform: 'uppercase' },
  modelItem: { flexDirection: 'row', justifyContent: 'space-between', padding: SPACING.md, borderRadius: ROUNDED.md, backgroundColor: COLORS.surfaceContainerLow, marginBottom: SPACING.xs, borderWidth: 1, borderColor: 'transparent' },
  modelItemActive: { borderWidth: 1, borderColor: COLORS.primary },
  modelItemText: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurface },
  modelItemTextActive: { color: COLORS.primary, fontWeight: 'bold' },
});
