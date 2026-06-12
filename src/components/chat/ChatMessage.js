import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, Platform, TouchableOpacity } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import { useTheme } from '@/contexts/ThemeContext';
import { TYPOGRAPHY, SPACING, ROUNDED } from '@/constants';

// Reveals text progressively when `enabled` so Bug's replies read as typed live,
// not pasted. Longer messages reveal more chars per tick so they never drag
// (capped at ~140 ticks ≈ ~1.7s regardless of length).
function useTypewriter(text, enabled, speed = 12) {
  const [shown, setShown] = useState(enabled ? '' : text);
  useEffect(() => {
    if (!enabled) { setShown(text); return; }
    setShown('');
    let i = 0;
    const step = Math.max(1, Math.ceil(text.length / 140));
    const id = setInterval(() => {
      i += step;
      if (i >= text.length) {
        setShown(text);
        clearInterval(id);
      } else {
        setShown(text.slice(0, i));
      }
    }, speed);
    return () => clearInterval(id);
  }, [text, enabled]);
  return shown;
}

export default function ChatMessage({ item, user }) {
  const { COLORS } = useTheme();
  const styles = getStyles(COLORS);
  const [copied, setCopied] = useState(false);

  const isModel = item.role === 'model';
  const displayText = useTypewriter(item.text || '', isModel && !!item.typing);

  const handleCopy = async () => {
    const text = item.text || '';
    let ok = false;

    // Preferred: async Clipboard API (only available in secure contexts / localhost).
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch (e) {
      ok = false;
    }

    // Fallback for non-secure contexts (e.g. served over a LAN IP).
    if (!ok && Platform.OS === 'web' && typeof document !== 'undefined') {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch (e) {
        ok = false;
      }
    }

    // Show the "Copied" confirmation when it worked.
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
    // Native (iOS/Android) needs `expo-clipboard`; install it to enable copy there.
  };

  if (isModel) {
    return (
      <Animated.View entering={FadeInUp.duration(350).springify().damping(18)} style={styles.messageRowModel}>
        <View style={styles.messageHeader}>
          <View style={styles.modelAvatar}>
            <MaterialCommunityIcons name="auto-fix" size={14} color={COLORS.primary} />
          </View>
          <Text style={styles.modelHeaderName}>BUG CEO AGENT</Text>
        </View>
        <View style={styles.messageContentModel}>
          <Markdown style={styles.markdownStyles}>{displayText}</Markdown>
        </View>
        <TouchableOpacity style={styles.copyButton} onPress={handleCopy} hitSlop={8} activeOpacity={0.7}>
          <MaterialCommunityIcons
            name={copied ? 'check' : 'content-copy'}
            size={13}
            color={copied ? (COLORS.success || '#4CAF50') : COLORS.onSurfaceVariant}
          />
          <Text style={[styles.copyText, copied && { color: COLORS.success || '#4CAF50' }]}>
            {copied ? 'Copied' : 'Copy'}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInUp.duration(300).springify().damping(18)} style={styles.messageRowUser}>
      <View style={styles.messageHeaderUser}>
        <Text style={styles.userHeaderName}>{user?.username?.toUpperCase() || 'USER'}</Text>
      </View>
      <View style={styles.messageContentUser}>
        {item.attachments?.map((uri, idx) => (
           <Image key={idx} source={{ uri }} style={styles.chatImage} />
        ))}
        <Text style={styles.messageTextUser}>{item.text}</Text>
      </View>
    </Animated.View>
  );
}

const getStyles = (COLORS) => StyleSheet.create({
  messageRowModel: { 
    flexDirection: 'column', 
    marginBottom: SPACING.xl,
    maxWidth: '95%',
    alignSelf: 'flex-start'
  },
  messageHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginBottom: 4 },
  modelAvatar: { 
    width: 24, height: 24, borderRadius: 4, 
    backgroundColor: COLORS.surfaceContainerHighest, 
    borderWidth: 1, borderColor: `${COLORS.primary}4D`,
    justifyContent: 'center', alignItems: 'center' 
  },
  messageContentModel: { 
    flex: 1, 
    backgroundColor: COLORS.surfaceContainerLow, 
    padding: SPACING.md, 
    borderRadius: 16, 
    borderTopLeftRadius: 4, 
    borderWidth: 1, 
    borderColor: COLORS.outlineVariant,
    ...(Platform.OS === 'web' ? { wordBreak: 'break-word', overflowWrap: 'break-word' } : {})
  },
  modelHeaderName: { ...TYPOGRAPHY.labelSm, color: COLORS.primary, letterSpacing: 0.5 },
  copyButton: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, marginLeft: 2, paddingVertical: 2, alignSelf: 'flex-start' },
  copyText: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant },
  
  messageRowUser: { flexDirection: 'column', marginBottom: SPACING.lg, alignItems: 'flex-end', marginTop: SPACING.md },
  messageHeaderUser: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginBottom: 4 },
  userHeaderName: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant, letterSpacing: 0.5 },
  userAvatar: { 
    width: 24, height: 24, borderRadius: ROUNDED.full, 
    backgroundColor: COLORS.primaryContainer, 
    justifyContent: 'center', alignItems: 'center' 
  },
  userAvatarText: { ...TYPOGRAPHY.labelSm, color: COLORS.onPrimaryContainer, fontWeight: 'bold' },
  messageContentUser: { 
    backgroundColor: `${COLORS.primaryContainer}1A`, 
    padding: SPACING.md, 
    borderRadius: 16, 
    borderTopRightRadius: 4, 
    borderWidth: 1, 
    borderColor: `${COLORS.primary}33`,
    maxWidth: '85%',
    ...(Platform.OS === 'web' ? { wordBreak: 'break-word', overflowWrap: 'break-word' } : {})
  },
  messageTextUser: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurface },
  chatImage: { width: 200, height: 200, borderRadius: ROUNDED.md, marginBottom: SPACING.sm, resizeMode: 'cover' },

  markdownStyles: {
    body: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurface, lineHeight: 24 },
    heading1: { ...TYPOGRAPHY.h2, color: COLORS.onSurface, marginVertical: SPACING.sm },
    heading2: { ...TYPOGRAPHY.h3, color: COLORS.onSurface, marginVertical: SPACING.sm },
    heading3: { ...TYPOGRAPHY.h4, color: COLORS.onSurface, marginVertical: SPACING.xs },
    paragraph: { marginVertical: SPACING.xs },
    list_item: { marginVertical: 2 },
    bullet_list: { marginBottom: SPACING.sm },
    ordered_list: { marginBottom: SPACING.sm },
    blockquote: {
      borderLeftWidth: 4,
      borderLeftColor: COLORS.primary,
      paddingLeft: SPACING.md,
      fontStyle: 'italic',
      marginVertical: SPACING.sm,
      backgroundColor: `${COLORS.surfaceContainerHighest}80`,
      padding: SPACING.sm,
      borderRadius: ROUNDED.sm
    },
    code_inline: {
      backgroundColor: COLORS.surfaceContainerHighest,
      color: COLORS.primary,
      fontFamily: 'JetBrainsMono_500Medium',
      borderRadius: 4,
      paddingHorizontal: 4,
    },
    code_block: {
      backgroundColor: COLORS.surfaceContainerHighest,
      color: COLORS.onSurfaceVariant,
      fontFamily: 'JetBrainsMono_500Medium',
      borderRadius: ROUNDED.md,
      padding: SPACING.md,
      marginVertical: SPACING.sm,
      ...(Platform.OS === 'web' ? { whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowX: 'auto' } : {}),
    },
    link: { color: COLORS.primary, textDecorationLine: 'none' },
  },
});
