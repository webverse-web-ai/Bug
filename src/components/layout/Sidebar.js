import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  TextInput
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeOutLeft,
  LinearTransition,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { TYPOGRAPHY, SPACING, ROUNDED } from '@/constants';

const AnimatedFlatList = Animated.FlatList;

function SessionRow({
  item,
  isActive,
  isEditing,
  editTitle,
  setEditTitle,
  handleRename,
  setEditingSessionId,
  handleSelectSession,
  handleDelete,
  COLORS,
  styles,
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const startEdit = () => {
    setConfirmDelete(false);
    setEditingSessionId(item.id);
    setEditTitle(item.title);
  };

  return (
    <Animated.View
      entering={FadeInDown.duration(250)}
      exiting={FadeOutLeft.duration(200)}
      style={animatedStyle}
    >
      <Pressable
        style={isActive ? styles.drawerLinkActive : styles.drawerLink}
        onPress={() => !isEditing && !confirmDelete && handleSelectSession(item.id)}
        onPressIn={() => { scale.value = withTiming(0.97, { duration: 90 }); }}
        onPressOut={() => { scale.value = withTiming(1, { duration: 120 }); }}
      >
        <MaterialCommunityIcons
          name={confirmDelete ? 'delete-alert-outline' : 'message-outline'}
          size={18}
          color={confirmDelete ? COLORS.error : isActive ? COLORS.onSecondaryContainer : COLORS.onSurfaceVariant}
        />

        {isEditing ? (
          <>
            <TextInput
              style={styles.editTitleInput}
              value={editTitle}
              onChangeText={setEditTitle}
              onSubmitEditing={() => handleRename(item.id)}
              autoFocus
              placeholder="Chat name"
              placeholderTextColor={COLORS.onSurfaceVariant}
            />
            <View style={styles.actionRow}>
              <TouchableOpacity onPress={() => handleRename(item.id)} hitSlop={8}>
                <MaterialCommunityIcons name="check" size={18} color={COLORS.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditingSessionId(null)} hitSlop={8}>
                <MaterialCommunityIcons name="close" size={18} color={COLORS.onSurfaceVariant} />
              </TouchableOpacity>
            </View>
          </>
        ) : confirmDelete ? (
          <>
            <Text style={styles.confirmText} numberOfLines={1}>Delete this chat?</Text>
            <View style={styles.actionRow}>
              <TouchableOpacity
                onPress={() => { setConfirmDelete(false); handleDelete(item.id); }}
                hitSlop={8}
              >
                <MaterialCommunityIcons name="check" size={18} color={COLORS.error} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setConfirmDelete(false)} hitSlop={8}>
                <MaterialCommunityIcons name="close" size={18} color={COLORS.onSurfaceVariant} />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <Text
              style={isActive ? styles.drawerLinkTextActive : styles.drawerLinkText}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            <View style={styles.actionRow}>
              <TouchableOpacity onPress={startEdit} hitSlop={8}>
                <MaterialCommunityIcons name="pencil-outline" size={16} color={COLORS.onSurfaceVariant} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setConfirmDelete(true)} hitSlop={8}>
                <MaterialCommunityIcons name="delete-outline" size={16} color={COLORS.error} />
              </TouchableOpacity>
            </View>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function Sidebar({
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
  handleLogout
}) {
  const { COLORS } = useTheme();
  const styles = getStyles(COLORS);

  return (
    <>
      <View style={styles.drawerHeader}>
        <View style={styles.logoRow}>
          <MaterialCommunityIcons name="bug" size={28} color={COLORS.primary} />
          <Text style={styles.drawerTitle}>BUG BOS</Text>
        </View>
        {!isDesktop && (
          <TouchableOpacity onPress={toggleDrawer} style={styles.iconButton}>
            <MaterialCommunityIcons name="close" size={24} color={COLORS.onSurfaceVariant} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.drawerLinks}>
        <TouchableOpacity style={styles.newChatButton} onPress={handleNewChat}>
          <MaterialCommunityIcons name="plus" size={20} color={COLORS.onPrimary} />
          <Text style={styles.newChatText}>New Chat</Text>
        </TouchableOpacity>

        <Text style={styles.sectionHeader}>Chat Sessions ({sessions ? sessions.length : 0})</Text>

        {(!sessions || sessions.length === 0) ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="chat-outline" size={28} color={COLORS.onSurfaceVariant} />
            <Text style={styles.emptyText}>No chats yet</Text>
            <Text style={styles.emptySubtext}>Start a new chat to see it here.</Text>
          </View>
        ) : (
          <AnimatedFlatList
            data={sessions}
            keyExtractor={item => item.id}
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            itemLayoutAnimation={LinearTransition.springify().damping(18)}
            renderItem={({ item }) => (
              <SessionRow
                item={item}
                isActive={item.id === currentSessionId}
                isEditing={item.id === editingSessionId}
                editTitle={editTitle}
                setEditTitle={setEditTitle}
                handleRename={handleRename}
                setEditingSessionId={setEditingSessionId}
                handleSelectSession={handleSelectSession}
                handleDelete={handleDelete}
                COLORS={COLORS}
                styles={styles}
              />
            )}
          />
        )}

        <View style={styles.bottomLinksContainer}>
          <TouchableOpacity
            style={styles.drawerLink}
            onPress={() => { if (!isDesktop) toggleDrawer(); router.push('/bug/knowledge'); }}
          >
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
      </View>

      <View style={styles.drawerFooter}>
        <TouchableOpacity style={styles.drawerLink} onPress={handleLogout}>
          <MaterialCommunityIcons name="logout" size={20} color={COLORS.error} />
          <Text style={[styles.drawerLinkText, { color: COLORS.error }]}>Log out</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const getStyles = (COLORS) => StyleSheet.create({
  drawerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.md, marginBottom: SPACING.lg },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  drawerTitle: { ...TYPOGRAPHY.headlineMd, fontWeight: 'bold', color: COLORS.primary },
  iconButton: { padding: SPACING.xs, borderRadius: ROUNDED.full },

  drawerLinks: { flex: 1, paddingHorizontal: SPACING.sm, gap: 4 },
  newChatButton: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.md, borderRadius: ROUNDED.lg, backgroundColor: COLORS.primary, justifyContent: 'center', marginBottom: SPACING.sm },
  newChatText: { ...TYPOGRAPHY.labelLg, color: COLORS.onPrimary, fontWeight: 'bold' },

  sectionHeader: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant, marginBottom: SPACING.xs, marginLeft: SPACING.xs, textTransform: 'uppercase', fontWeight: 'bold' },

  drawerLink: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.md, borderRadius: ROUNDED.lg },
  drawerLinkActive: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.md, borderRadius: ROUNDED.lg, backgroundColor: COLORS.secondaryContainer },
  drawerLinkText: { ...TYPOGRAPHY.labelMd, color: COLORS.onSurfaceVariant, flex: 1 },
  drawerLinkTextActive: { ...TYPOGRAPHY.labelMd, color: COLORS.onSecondaryContainer, flex: 1, fontWeight: 'bold' },
  editTitleInput: { flex: 1, ...TYPOGRAPHY.labelMd, color: COLORS.onSurface, padding: 0, margin: 0, borderBottomWidth: 1, borderBottomColor: COLORS.primary },
  confirmText: { flex: 1, ...TYPOGRAPHY.labelMd, color: COLORS.error, fontWeight: 'bold' },
  actionRow: { flexDirection: 'row', gap: 14, marginLeft: 'auto', alignItems: 'center' },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.lg, gap: SPACING.xs },
  emptyText: { ...TYPOGRAPHY.labelLg, color: COLORS.onSurfaceVariant, fontWeight: 'bold' },
  emptySubtext: { ...TYPOGRAPHY.bodySm, color: COLORS.onSurfaceVariant, textAlign: 'center', opacity: 0.7 },

  bottomLinksContainer: { marginTop: SPACING.md, borderTopWidth: 1, borderTopColor: `${COLORS.outlineVariant}80`, paddingTop: SPACING.sm, gap: 4 },
  drawerFooter: { paddingHorizontal: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: `${COLORS.outlineVariant}80` },
});
