import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Pressable,
  Image,
  Platform,
  Animated,
  ScrollView,
  TouchableWithoutFeedback
} from 'react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  FadeIn,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '@/contexts/ThemeContext';
import { TYPOGRAPHY, SPACING, ROUNDED } from '@/constants';

const AnimatedPressable = Reanimated.createAnimatedComponent(Pressable);

// Hollow ring that fills up clockwise based on usage (0..1).
function UsageRing({ pct, COLORS }) {
  const size = 20;
  const stroke = 2.5;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const filled = Math.min(Math.max(pct, 0), 1);
  const dash = circ * filled;
  return (
    <Svg width={size} height={size}>
      <Circle
        cx={size / 2} cy={size / 2} r={r}
        stroke={`${COLORS.onSurfaceVariant}33`} strokeWidth={stroke} fill="none"
      />
      {filled > 0 && (
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={COLORS.primary} strokeWidth={stroke} fill="none"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      )}
    </Svg>
  );
}

// Fast vs Thinking selector for the Bug model: Fast = quickest answer,
// Thinking = best answer (Bug consults several models and synthesizes).
function ModeToggle({ mode, setMode, styles, COLORS }) {
  const Btn = ({ value, icon, label }) => {
    const active = mode === value;
    return (
      <TouchableOpacity
        style={[styles.modeBtn, active && styles.modeBtnActive]}
        onPress={() => setMode(value)}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name={icon} size={13} color={active ? COLORS.onPrimary : COLORS.onSurfaceVariant} />
        <Text style={[styles.modeText, active && styles.modeTextActive]}>{label}</Text>
      </TouchableOpacity>
    );
  };
  return (
    <Reanimated.View entering={FadeIn.duration(200)} style={styles.modeRow}>
      <View style={styles.modeToggle}>
        <Btn value="fast" icon="lightning-bolt" label="Fast" />
        <Btn value="thinking" icon="brain" label="Thinking" />
      </View>
    </Reanimated.View>
  );
}

function SendButton({ active, loading, onPress, styles, COLORS }) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  useEffect(() => {
    if (active) {
      scale.value = withSequence(
        withTiming(1.15, { duration: 120 }),
        withTiming(1, { duration: 120 })
      );
    }
  }, [active]);

  return (
    <AnimatedPressable
      style={[styles.submitButton, active && styles.submitButtonActive, animatedStyle]}
      onPress={onPress}
      onPressIn={() => { scale.value = withTiming(0.88, { duration: 90 }); }}
      onPressOut={() => { scale.value = withTiming(1, { duration: 130 }); }}
      disabled={loading || !active}
    >
      <MaterialCommunityIcons
        name={loading ? 'loading' : 'arrow-up'}
        size={20}
        color={active ? COLORS.onPrimary : COLORS.onSurfaceVariant}
      />
    </AnimatedPressable>
  );
}

export default function ChatInput({
  inputText,
  setInputText,
  isInputFocused,
  setIsInputFocused,
  attachments,
  setAttachments,
  selectedModel,
  setSelectedModel,
  webSearchEnabled,
  setWebSearchEnabled,
  isModelSelectorOpen,
  toggleModelSelector,
  dropdownAnim,
  searchPulseAnim,
  handleSend,
  loading,
  pickDocument,
  MODELS,
  usage = {},
  usageLimit = null,
  mode = 'fast',
  setMode = () => {},
  isBugSelected = false
}) {
  const { COLORS } = useTheme();
  const styles = getStyles(COLORS);

  return (
    <View style={styles.inputAreaWrapper}>
      <View style={styles.inputContainerOuter}>
        {/* Animated Dropdown Menu placed right above the pill */}
        {isModelSelectorOpen && (
          <>
            <TouchableWithoutFeedback onPress={toggleModelSelector}>
              <View style={StyleSheet.absoluteFillObject} />
            </TouchableWithoutFeedback>
            <Animated.View style={[styles.modelDropdown, { opacity: dropdownAnim, transform: [{ translateY: dropdownAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>
              <ScrollView style={styles.modelDropdownScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {(() => {
                  // Fill against the real OpenRouter daily cap when known; otherwise
                  // fall back to a relative gauge (share of the busiest model).
                  const maxUsed = Math.max(1, ...MODELS.free.map((m) => usage[m.id] || 0));
                  const denom = usageLimit && usageLimit > 0 ? usageLimit : maxUsed;
                  return MODELS.free.map((model) => {
                    const used = usage[model.id] || 0;
                    const isBug = model.locked || model.id === 'bug/auto';
                    return (
                      <TouchableOpacity
                        key={model.id}
                        style={[styles.modelDropdownItem, selectedModel.id === model.id && styles.modelDropdownItemActive]}
                        onPress={() => {
                          setSelectedModel(model);
                          toggleModelSelector();
                        }}
                      >
                        {isBug && <MaterialCommunityIcons name="bug" size={16} color={COLORS.primary} />}
                        <Text
                          style={[styles.modelDropdownItemText, selectedModel.id === model.id && styles.modelDropdownItemTextActive]}
                          numberOfLines={1}
                        >
                          {model.name}
                        </Text>
                        {isBug && (
                          <View style={styles.smartBadge}>
                            <Text style={styles.smartBadgeText}>SMART</Text>
                          </View>
                        )}
                        {selectedModel.id === model.id && (
                           <MaterialCommunityIcons name="check" size={14} color={COLORS.primary} />
                        )}
                        <UsageRing pct={used / denom} COLORS={COLORS} />
                      </TouchableOpacity>
                    );
                  });
                })()}
              </ScrollView>
            </Animated.View>
          </>
        )}

        {attachments.length > 0 && (
          <View style={styles.attachmentPreviewContainer}>
            {attachments.map((uri, idx) => (
              <Reanimated.View key={idx} entering={FadeIn.duration(250)} style={styles.attachmentPreviewWrapper}>
                <Image source={{ uri }} style={styles.attachmentPreview} />
                <TouchableOpacity
                  style={styles.attachmentRemove}
                  onPress={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                >
                  <MaterialCommunityIcons name="close" size={14} color={COLORS.onPrimary} />
                </TouchableOpacity>
              </Reanimated.View>
            ))}
          </View>
        )}

        {isBugSelected && <ModeToggle mode={mode} setMode={setMode} styles={styles} COLORS={COLORS} />}

        <View style={[styles.inputBox, isInputFocused && styles.inputBoxFocused]}>
          <TextInput
            style={[styles.textInput, Platform.OS === 'web' && { outlineStyle: 'none' }]}
            placeholder="Ask follow-up or provide new directives..."
            placeholderTextColor={COLORS.onSurfaceVariant}
            value={inputText}
            onChangeText={setInputText}
            onFocus={() => { setIsInputFocused(true); if (isModelSelectorOpen) toggleModelSelector(); }}
            onBlur={() => setIsInputFocused(false)}
            onKeyPress={(e) => {
              // Web: Enter sends, Shift+Enter inserts a newline.
              if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
                e.preventDefault();
                if (!loading && (inputText.trim() || attachments.length > 0)) handleSend();
              }
            }}
            multiline
            maxLength={2000}
          />
          <View style={styles.inputActionsRow}>
            <View style={styles.multiModalTools}>
              <TouchableOpacity style={styles.toolButton} onPress={pickDocument}>
                <MaterialCommunityIcons name="plus" size={20} color={COLORS.onSurfaceVariant} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toolButton, webSearchEnabled && styles.toolButtonActive]}
                onPress={() => setWebSearchEnabled(!webSearchEnabled)}
                disabled={loading}
              >
                <Animated.View style={{ opacity: searchPulseAnim }}>
                  <MaterialCommunityIcons
                    name={webSearchEnabled ? 'web' : 'web-off'}
                    size={20}
                    color={webSearchEnabled ? COLORS.primary : COLORS.onSurfaceVariant}
                  />
                </Animated.View>
              </TouchableOpacity>
              
              {/* Model Switcher Pill in Input Box */}
              <TouchableOpacity style={styles.modelPillSmall} onPress={toggleModelSelector}>
                <Text style={styles.modelPillTextSmall}>{selectedModel.name}</Text>
                <MaterialCommunityIcons name={isModelSelectorOpen ? "chevron-down" : "chevron-up"} size={14} color={COLORS.onSurfaceVariant} />
              </TouchableOpacity>
            </View>
            
            <SendButton
              active={inputText.trim().length > 0 || attachments.length > 0}
              loading={loading}
              onPress={handleSend}
              styles={styles}
              COLORS={COLORS}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const getStyles = (COLORS) => StyleSheet.create({
  // Input Area
  inputAreaWrapper: { 
    position: 'absolute', bottom: 0, left: 0, right: 0, 
    padding: SPACING.md, 
    backgroundColor: COLORS.background,
    borderTopWidth: 1, borderTopColor: 'transparent',
    zIndex: 20,
  },
  inputContainerOuter: { maxWidth: 800, width: '100%', alignSelf: 'center', position: 'relative' },
  inputBox: {
    backgroundColor: COLORS.surfaceContainerLow, 
    borderWidth: 1, borderColor: COLORS.outlineVariant,
    borderRadius: 16, 
    padding: SPACING.xs,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5,
    zIndex: 5
  },
  inputBoxFocused: { borderColor: COLORS.primary, shadowColor: COLORS.primary, shadowOpacity: 0.3 },
  textInput: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurface, minHeight: 60, maxHeight: 150, paddingHorizontal: SPACING.sm, paddingTop: SPACING.sm },
  inputActionsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.xs, paddingHorizontal: 4 },
  multiModalTools: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  toolButton: { padding: 8, borderRadius: ROUNDED.full },
  toolButtonActive: { backgroundColor: `${COLORS.primary}1A` },
  submitButton: { width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.surfaceContainerHighest, justifyContent: 'center', alignItems: 'center' },
  submitButtonActive: { backgroundColor: COLORS.primary },
  
  attachmentPreviewContainer: { flexDirection: 'row', paddingBottom: SPACING.sm, gap: SPACING.sm },
  attachmentPreviewWrapper: { position: 'relative' },
  attachmentPreview: { width: 60, height: 60, borderRadius: ROUNDED.md, borderWidth: 1, borderColor: COLORS.outlineVariant },
  attachmentRemove: { position: 'absolute', top: -6, right: -6, backgroundColor: COLORS.error, borderRadius: ROUNDED.full, width: 20, height: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.background },
  
  modelPillSmall: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.surfaceContainerHighest,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: ROUNDED.full, marginLeft: SPACING.xs
  },
  modelPillTextSmall: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant, fontSize: 12 },
  modelDropdown: {
    position: 'absolute', bottom: '100%', left: SPACING.sm, marginBottom: SPACING.xs,
    backgroundColor: COLORS.surface,
    borderRadius: ROUNDED.lg,
    padding: SPACING.xs,
    minWidth: 200,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 10,
    borderWidth: 1, borderColor: COLORS.outlineVariant,
    zIndex: 100
  },
  modelDropdownScroll: { maxHeight: 200 },
  modelDropdownItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.sm, borderRadius: ROUNDED.md, marginBottom: 2 },
  modelDropdownItemActive: { backgroundColor: `${COLORS.primary}1A` },
  modelDropdownItemText: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurface, flex: 1 },
  modelDropdownItemTextActive: { color: COLORS.primary, fontWeight: 'bold' },
  smartBadge: { backgroundColor: `${COLORS.primary}1A`, borderRadius: ROUNDED.full, paddingHorizontal: 6, paddingVertical: 2 },
  smartBadgeText: { ...TYPOGRAPHY.labelSm, fontSize: 9, fontWeight: '800', color: COLORS.primary, letterSpacing: 0.5 },

  // Bug Fast/Thinking selector
  modeRow: { flexDirection: 'row', justifyContent: 'flex-start', marginBottom: SPACING.xs, marginLeft: 4 },
  modeToggle: { flexDirection: 'row', backgroundColor: COLORS.surfaceContainerHighest, borderRadius: ROUNDED.full, padding: 2 },
  modeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: ROUNDED.full },
  modeBtnActive: { backgroundColor: COLORS.primary },
  modeText: { ...TYPOGRAPHY.labelSm, fontSize: 11, fontWeight: '700', color: COLORS.onSurfaceVariant },
  modeTextActive: { color: COLORS.onPrimary },
});
