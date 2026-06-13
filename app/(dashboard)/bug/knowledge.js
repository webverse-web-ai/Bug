import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeOutLeft, LinearTransition, FadeIn } from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { TYPOGRAPHY, SPACING, ROUNDED } from '@/constants';
import DashboardShell from '@/components/layout/DashboardShell';
import { getKnowledge, createKnowledge, updateKnowledge, deleteKnowledge } from '@/client/api';

function KnowledgeCard({ item, onEdit, onDelete, COLORS, styles }) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <Animated.View
      entering={FadeInDown.duration(280)}
      exiting={FadeOutLeft.duration(200)}
      layout={LinearTransition.springify().damping(18)}
      style={styles.card}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <MaterialCommunityIcons
            name={item.source === 'ai' ? 'robot-happy-outline' : 'book-open-variant'}
            size={16}
            color={COLORS.primary}
          />
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title || 'Untitled'}</Text>
        </View>
        <View style={[styles.badge, item.source === 'ai' && styles.badgeAi]}>
          <Text style={[styles.badgeText, item.source === 'ai' && styles.badgeTextAi]}>
            {item.source === 'ai' ? 'AI' : 'You'}
          </Text>
        </View>
      </View>

      <Text style={styles.cardContent}>{item.content}</Text>

      <View style={styles.cardActions}>
        {confirmDelete ? (
          <>
            <Text style={styles.confirmText}>Delete this?</Text>
            <TouchableOpacity style={styles.actionBtn} onPress={() => { setConfirmDelete(false); onDelete(item.id); }}>
              <MaterialCommunityIcons name="check" size={16} color={COLORS.error} />
              <Text style={[styles.actionText, { color: COLORS.error }]}>Yes</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => setConfirmDelete(false)}>
              <MaterialCommunityIcons name="close" size={16} color={COLORS.onSurfaceVariant} />
              <Text style={styles.actionText}>No</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.actionBtn} onPress={() => onEdit(item)}>
              <MaterialCommunityIcons name="pencil-outline" size={16} color={COLORS.onSurfaceVariant} />
              <Text style={styles.actionText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => setConfirmDelete(true)}>
              <MaterialCommunityIcons name="delete-outline" size={16} color={COLORS.error} />
              <Text style={[styles.actionText, { color: COLORS.error }]}>Delete</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </Animated.View>
  );
}

function KnowledgeBody() {
  const { COLORS } = useTheme();
  const styles = getStyles(COLORS);

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [titleInput, setTitleInput] = useState('');
  const [contentInput, setContentInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadEntries(); }, []);

  const loadEntries = async () => {
    try {
      setLoading(true);
      const data = await getKnowledge();
      setEntries(data || []);
      setError('');
    } catch (e) {
      setError(e.message || 'Failed to load knowledge');
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setEditingId(null);
    setTitleInput('');
    setContentInput('');
    setShowForm(true);
  };

  const openEdit = (item) => {
    setEditingId(item.id);
    setTitleInput(item.title || '');
    setContentInput(item.content || '');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setTitleInput('');
    setContentInput('');
  };

  const handleSave = async () => {
    if (!contentInput.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        const updated = await updateKnowledge(editingId, { title: titleInput, content: contentInput });
        setEntries(prev => prev.map(e => (e.id === editingId ? { ...e, ...updated } : e)));
      } else {
        const created = await createKnowledge(titleInput, contentInput);
        setEntries(prev => [created, ...prev]);
      }
      closeForm();
    } catch (e) {
      setError(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const prev = entries;
    setEntries(entries.filter(e => e.id !== id)); // optimistic
    try {
      await deleteKnowledge(id);
    } catch (e) {
      setError(e.message || 'Failed to delete');
      setEntries(prev); // rollback
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      {/* Page intro + Add button (inside the page, not the header) */}
      <View style={styles.pageIntro}>
        <View style={{ flex: 1 }}>
          <Text style={styles.pageTitle}>Knowledge Base</Text>
          <Text style={styles.pageSubtitle}>Facts Bug remembers about you across every chat.</Text>
        </View>
        {!showForm && (
          <TouchableOpacity style={styles.addButton} onPress={openAdd}>
            <MaterialCommunityIcons name="plus" size={18} color={COLORS.onPrimary} />
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Add / Edit form */}
      {showForm && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.form}>
          <Text style={styles.formTitle}>{editingId ? 'Edit knowledge' : 'New knowledge'}</Text>
          <TextInput
            style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' }]}
            placeholder="Title (optional) — e.g. My name"
            placeholderTextColor={COLORS.onSurfaceVariant}
            value={titleInput}
            onChangeText={setTitleInput}
            maxLength={80}
          />
          <TextInput
            style={[styles.input, styles.textArea, Platform.OS === 'web' && { outlineStyle: 'none' }]}
            placeholder="What should Bug remember? e.g. My name is Devaman and I prefer concise answers."
            placeholderTextColor={COLORS.onSurfaceVariant}
            value={contentInput}
            onChangeText={setContentInput}
            multiline
            maxLength={1000}
          />
          <View style={styles.formActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={closeForm}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, (!contentInput.trim() || saving) && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={!contentInput.trim() || saving}
            >
              <Text style={styles.saveBtnText}>{saving ? 'Saving...' : editingId ? 'Update' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

      {/* List */}
      {loading ? (
        <><SkeletonCard rows={2} /><SkeletonCard rows={3} /><SkeletonCard rows={2} /></>
      ) : entries.length === 0 ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="brain" size={40} color={COLORS.onSurfaceVariant} />
          <Text style={styles.emptyTitle}>Nothing learned yet</Text>
          <Text style={styles.emptyText}>
            Add facts and preferences, or just chat — Bug automatically learns durable details about you.
          </Text>
        </View>
      ) : (
        entries.map(item => (
          <KnowledgeCard
            key={item.id}
            item={item}
            onEdit={openEdit}
            onDelete={handleDelete}
            COLORS={COLORS}
            styles={styles}
          />
        ))
      )}
    </ScrollView>
  );
}

export default function KnowledgeBaseScreen() {
  return (
    <DashboardShell title="Knowledge Base">
      <KnowledgeBody />
    </DashboardShell>
  );
}

const getStyles = (COLORS) => StyleSheet.create({
  scroll: { padding: SPACING.lg, maxWidth: 760, width: '100%', alignSelf: 'center' },

  pageIntro: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md, marginBottom: SPACING.lg },
  pageTitle: { ...TYPOGRAPHY.headlineMd, color: COLORS.onSurface, fontWeight: '800' },
  pageSubtitle: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurfaceVariant, marginTop: 2 },
  addButton: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.primary, paddingHorizontal: SPACING.md, paddingVertical: 9,
    borderRadius: ROUNDED.full,
  },
  addButtonText: { ...TYPOGRAPHY.labelMd, color: COLORS.onPrimary, fontWeight: '700' },

  form: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderWidth: 1, borderColor: COLORS.outlineVariant,
    borderRadius: ROUNDED.xl, padding: SPACING.lg, marginBottom: SPACING.lg, gap: SPACING.sm,
  },
  formTitle: { ...TYPOGRAPHY.labelLg, color: COLORS.onSurface, fontWeight: '700', marginBottom: SPACING.xs },
  input: {
    ...TYPOGRAPHY.bodyMd, color: COLORS.onSurface,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1, borderColor: COLORS.outlineVariant, borderRadius: ROUNDED.default,
    paddingHorizontal: SPACING.md, paddingVertical: 10,
  },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.sm, marginTop: SPACING.xs },
  cancelBtn: { paddingHorizontal: SPACING.lg, paddingVertical: 10, borderRadius: ROUNDED.default },
  cancelBtnText: { ...TYPOGRAPHY.labelMd, color: COLORS.onSurfaceVariant },
  saveBtn: { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.lg, paddingVertical: 10, borderRadius: ROUNDED.default },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { ...TYPOGRAPHY.labelMd, color: COLORS.onPrimary, fontWeight: '700' },

  errorBanner: { ...TYPOGRAPHY.bodySm, color: COLORS.error, marginBottom: SPACING.md },

  center: { paddingVertical: SPACING.xl * 2, alignItems: 'center' },
  empty: { alignItems: 'center', paddingVertical: SPACING.xl * 2, gap: SPACING.sm },
  emptyTitle: { ...TYPOGRAPHY.labelLg, color: COLORS.onSurface, fontWeight: '700' },
  emptyText: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurfaceVariant, textAlign: 'center', maxWidth: 340 },

  card: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderWidth: 1, borderColor: COLORS.outlineVariant,
    borderRadius: ROUNDED.lg, padding: SPACING.md, marginBottom: SPACING.md,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.xs },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, flex: 1 },
  cardTitle: { ...TYPOGRAPHY.labelLg, color: COLORS.onSurface, fontWeight: '700', flexShrink: 1 },
  badge: { backgroundColor: COLORS.surfaceContainerHighest, paddingHorizontal: 8, paddingVertical: 2, borderRadius: ROUNDED.full },
  badgeAi: { backgroundColor: `${COLORS.primary}1A` },
  badgeText: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant, fontSize: 10, fontWeight: '700' },
  badgeTextAi: { color: COLORS.primary },
  cardContent: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurfaceVariant, lineHeight: 21 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginTop: SPACING.md },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { ...TYPOGRAPHY.labelMd, color: COLORS.onSurfaceVariant },
  confirmText: { ...TYPOGRAPHY.labelMd, color: COLORS.error, fontWeight: '700', marginRight: 'auto' },
});
