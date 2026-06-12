import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  Keyboard,
  Platform,
  Image,
  Animated,
  ScrollView,
  TouchableWithoutFeedback,
  Dimensions
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
} from 'react-native-reanimated';
import { COLORS, TYPOGRAPHY, SPACING, ROUNDED } from '@/constants';

import * as SecureStore from 'expo-secure-store';
import { useAuth } from '@/contexts/AuthContext';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '@/contexts/ThemeContext';
import ChatMessage from '@/components/chat/ChatMessage';
import ChatInput from '@/components/chat/ChatInput';
import { getSelectedModels, getUsage } from '@/client/api';
import { BUG_MODEL } from '@/server/lib/bugModel';

// Bug is always first; the rest are filled in from the user's saved selection.
const MODELS = {
  free: [
    BUG_MODEL,
    { id: 'nvidia/nemotron-3-super-120b-a12b:free', name: 'Nemotron 3 Super 120B' },
    { id: 'openai/gpt-oss-120b:free', name: 'GPT OSS 120B' },
  ]
};

// Continuously spinning loader icon
const Spinner = ({ color, size = 14 }) => {
  const rot = useSharedValue(0);
  useEffect(() => {
    rot.value = withRepeat(withTiming(360, { duration: 850, easing: Easing.linear }), -1, false);
  }, []);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }] }));
  return (
    <Reanimated.View style={style}>
      <MaterialCommunityIcons name="loading" size={size} color={color} />
    </Reanimated.View>
  );
};

const ThinkingAnimation = ({ isWebSearch }) => {
  const { COLORS } = useTheme();
  const styles = getStyles(COLORS);
  const [iconIndex, setIconIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0); // real-time seconds spent processing
  const startRef = useRef(Date.now());

  // The beloved "book reading" page-flip cycle in the header
  const bookIcons = ['book-open-blank-variant', 'book-open-variant', 'book-open-page-variant'];
  const searchIcons = ['magnify', 'web', 'magnify-scan'];
  const icons = isWebSearch ? searchIcons : bookIcons;

  const webSearchSteps = [
    'Understanding your request',
    'Searching the web',
    'Reading relevant sources',
    'Extracting key facts',
    'Composing the answer',
  ];
  const standardSteps = [
    'Understanding your request',
    'Recalling relevant knowledge',
    'Reasoning through the problem',
    'Structuring the response',
    'Composing the answer',
  ];
  const steps = isWebSearch ? webSearchSteps : standardSteps;

  // Live elapsed-time counter — ticks every 100ms so it feels real-time.
  useEffect(() => {
    startRef.current = Date.now();
    const timer = setInterval(() => {
      setElapsed((Date.now() - startRef.current) / 1000);
    }, 100);
    return () => clearInterval(timer);
  }, []);

  // Advance ONE step at a time (each replaces the last); hold on the final step
  // until the answer arrives. Book icon keeps flipping throughout.
  useEffect(() => {
    const stepTimer = setInterval(() => {
      setStepIndex((i) => (i < steps.length - 1 ? i + 1 : i));
    }, 1500);
    const iconTimer = setInterval(() => {
      setIconIndex((prev) => (prev + 1) % icons.length);
    }, 250);
    return () => {
      clearInterval(stepTimer);
      clearInterval(iconTimer);
    };
  }, [isWebSearch]);

  return (
    <View style={styles.thinkingContainer}>
      <View style={styles.thinkingTitleRow}>
        <MaterialCommunityIcons name={icons[iconIndex]} size={16} color={COLORS.primary} />
        <Text style={styles.thinkingTitle}>{isWebSearch ? 'Searching' : 'Thinking'}</Text>
        <View style={styles.timerPill}>
          <MaterialCommunityIcons name="timer-outline" size={11} color={COLORS.onSurfaceVariant} />
          <Text style={styles.timerText}>{elapsed.toFixed(1)}s</Text>
        </View>
      </View>

      {/* One reasoning step in series: the current one fades up as the previous
          fades out — no stacked list. */}
      <View style={styles.currentStepWrap}>
        <Reanimated.View
          key={stepIndex}
          entering={FadeInUp.duration(350)}
          exiting={FadeOut.duration(220)}
          style={styles.stepRow}
        >
          <View style={styles.stepIcon}>
            <Spinner color={COLORS.primary} />
          </View>
          <Text style={styles.currentStepText}>{steps[stepIndex]}</Text>
        </Reanimated.View>
      </View>
    </View>
  );
};

// One bouncing dot in the "Initializing" loader.
const InitDot = ({ delay, COLORS, styles }) => {
  const v = useSharedValue(0.3);
  useEffect(() => {
    v.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 380, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 380, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ scale: 0.7 + v.value * 0.4 }] }));
  return <Reanimated.View style={[styles.initDot, style]} />;
};

// Shown briefly while a brand-new chat spins up, before Bug greets the user.
const InitializingAnimation = () => {
  const { COLORS } = useTheme();
  const styles = getStyles(COLORS);
  const pulse = useSharedValue(1);
  const ring = useSharedValue(0.35);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.12, { duration: 620, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.92, { duration: 620, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    ring.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.out(Easing.ease) }), -1, false);
  }, []);

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  // Expanding, fading halo around the bug.
  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.5 * (1 - ring.value),
    transform: [{ scale: 0.8 + ring.value * 0.9 }],
  }));

  return (
    <Reanimated.View entering={FadeInUp.duration(300)} style={styles.initWrap}>
      <View style={styles.initIconWrap}>
        <Reanimated.View style={[styles.initRing, ringStyle]} />
        <Reanimated.View style={iconStyle}>
          <MaterialCommunityIcons name="bug" size={42} color={COLORS.primary} />
        </Reanimated.View>
      </View>
      <Text style={styles.initTitle}>Waking up Bug</Text>
      <View style={styles.initDotsRow}>
        <InitDot delay={0} COLORS={COLORS} styles={styles} />
        <InitDot delay={170} COLORS={COLORS} styles={styles} />
        <InitDot delay={340} COLORS={COLORS} styles={styles} />
      </View>
    </Reanimated.View>
  );
};

export default function ChatInterface({ sessionId, onChatUpdated }) {
  const { user } = useAuth();
  const { COLORS } = useTheme();
  const styles = getStyles(COLORS);
  
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);
  
  const searchPulseAnim = useRef(new Animated.Value(1)).current;
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [models, setModels] = useState(MODELS.free);
  const [selectedModel, setSelectedModel] = useState(MODELS.free[0]);
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
  const [usageCounts, setUsageCounts] = useState({});
  const [usageLimit, setUsageLimit] = useState(null);
  // Bug response mode: 'fast' (quickest answer) or 'thinking' (best answer).
  const [mode, setMode] = useState('fast');

  // Load the user's chosen chat models (from the System Metrics page).
  useEffect(() => {
    let active = true;
    getSelectedModels()
      .then((list) => {
        if (active && Array.isArray(list) && list.length > 0) {
          setModels(list);
          setSelectedModel(list[0]);
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  // Today's per-model request counts (for the usage circles in the picker).
  const refreshUsage = useCallback(() => {
    getUsage()
      .then((data) => {
        setUsageCounts(data?.counts || {});
        setUsageLimit(data?.dailyLimit ?? null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => { refreshUsage(); }, [refreshUsage]);
  
  const flatListRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const dropdownAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadChatHistory();
  }, [sessionId]);

  useEffect(() => {
    let anim;
    if (loading && webSearchEnabled) {
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(searchPulseAnim, { toValue: 0.3, duration: 500, useNativeDriver: true }),
          Animated.timing(searchPulseAnim, { toValue: 1, duration: 500, useNativeDriver: true })
        ])
      );
      anim.start();
    } else {
      searchPulseAnim.setValue(1);
    }
    return () => {
      if (anim) anim.stop();
    };
  }, [loading, webSearchEnabled]);

  const loadChatHistory = async () => {
    try {
      setHistoryLoaded(false);

      if (!sessionId) {
        // New chat starts empty — it only comes alive once the user sends their
        // first message (which triggers the "Waking up Bug" init animation).
        setMessages([]);
        setHistoryLoaded(true);
        return;
      }

      let token = Platform.OS === 'web' ? localStorage.getItem('jwt_token') : await SecureStore.getItemAsync('jwt_token');
      if (!token) return;

      const response = await fetch(`/api/chat/history?sessionId=${sessionId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (response.ok && data.messages && data.messages.length > 0) {
        setMessages(data.messages);
      } else {
        setMessages([{
          id: 'welcome-1',
          role: 'model',
          text: `Operation initialized. How can I assist with your data analysis or system queries today?`
        }]);
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setHistoryLoaded(true);
    }
  };

  // Always scroll to the very bottom — past the last message AND the thinking
  // footer — so nothing is ever hidden. Retried across frames + a timeout for
  // web reliability (scrollToEnd can fire before new content has laid out).
  const scrollToBottom = (animated = true) => {
    stickToBottomRef.current = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToEnd({ animated });
      });
    });
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated }), 120);
  };

  // New / updated messages → follow to the bottom.
  useEffect(() => {
    scrollToBottom(true);
  }, [messages]);

  // Thinking indicator appears (or response finishes) → keep the bottom in view.
  useEffect(() => {
    if (loading) {
      setShowScrollDown(false);
      scrollToBottom(true);
    }
  }, [loading]);

  const handleScroll = (event) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 120;
    // Auto-follow only while near the bottom. If the user scrolls up to read
    // history, stop following until they return to the bottom.
    stickToBottomRef.current = isCloseToBottom;
    setShowScrollDown(!isCloseToBottom);
  };

  const toggleModelSelector = () => {
    if (isModelSelectorOpen) {
      Animated.timing(dropdownAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setIsModelSelectorOpen(false));
    } else {
      setIsModelSelectorOpen(true);
      Animated.timing(dropdownAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*'],
        copyToCacheDirectory: true,
        multiple: false
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        if (Platform.OS === 'web') {
          const res = await fetch(file.uri);
          const blob = await res.blob();
          const reader = new FileReader();
          reader.onloadend = () => {
            setAttachments(prev => [...prev, reader.result]);
          };
          reader.readAsDataURL(blob);
        } else {
          setAttachments(prev => [...prev, file.uri]); 
        }
      }
    } catch (error) {
      console.error("Error picking document:", error);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() && attachments.length === 0) return;

    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: inputText.trim(),
      attachments: [...attachments]
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setAttachments([]);
    setLoading(true);
    Keyboard.dismiss();
    
    if (isModelSelectorOpen) toggleModelSelector();

    try {
      if (!user?.hasOpenRouterKey && !user?.hasGeminiToken) {
        throw new Error('No AI connected. Please go to Setup and connect your OpenRouter or Gemini account.');
      }

      let token = Platform.OS === 'web' ? localStorage.getItem('jwt_token') : await SecureStore.getItemAsync('jwt_token');
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          modelId: selectedModel.id,
          contents: [{ role: 'user', parts: [{ text: userMessage.text }] }],
          attachments: userMessage.attachments,
          webSearch: webSearchEnabled,
          sessionId,
          mode
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to get response');
      }

      if (data.sessionId) {
        if (onChatUpdated) onChatUpdated(data.sessionId);
      }

      const modelText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from model.';
      
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: modelText,
        typing: true
      }]);

    } catch (error) {
      console.error('Chat Error:', error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: `System Error: ${error.message}`
      }]);
    } finally {
      setLoading(false);
      refreshUsage();
    }
  };

  const renderMessage = ({ item }) => (
    <ChatMessage item={item} user={user} />
  );

  return (
    <View style={styles.container}>
      {/* Chat History */}
      {!historyLoaded ? (
        <View style={styles.loadingHistory}>
           <ThinkingAnimation isWebSearch={webSearchEnabled} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.chatContainer}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            loading
              ? (messages.some((m) => m.role === 'model')
                  ? <ThinkingAnimation isWebSearch={webSearchEnabled} />
                  : <InitializingAnimation />)
              : null
          }
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onContentSizeChange={() => {
            // Content grew (new message OR thinking steps appearing). Follow to
            // the very bottom while sticking to bottom or while generating.
            if (stickToBottomRef.current || loading) {
              flatListRef.current?.scrollToEnd({ animated: false });
            }
          }}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
          onScrollBeginDrag={() => { if (isModelSelectorOpen) toggleModelSelector(); Keyboard.dismiss(); }}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* Empty new-chat greeting — disappears once the first message is sent */}
      {historyLoaded && messages.length === 0 && !loading && (
        <Reanimated.View
          entering={FadeIn.duration(400)}
          exiting={FadeOut.duration(250)}
          style={styles.emptyGreeting}
          pointerEvents="none"
        >
          <View style={styles.emptyGreetingIcon}>
            <MaterialCommunityIcons name="bug" size={40} color={COLORS.primary} />
          </View>
          <Text style={styles.emptyGreetingTitle}>Hey buddy, I'm Bug</Text>
          <Text style={styles.emptyGreetingSub}>Ask me anything to get started.</Text>
        </Reanimated.View>
      )}

      {showScrollDown && (
        <TouchableOpacity
          style={styles.scrollDownButton}
          onPress={() => scrollToBottom(true)}
        >
          <MaterialCommunityIcons name="arrow-down-circle" size={32} color={COLORS.primary} style={{ opacity: 0.8 }} />
        </TouchableOpacity>
      )}

      {/* Bottom Input Area */}
      <ChatInput 
        inputText={inputText}
        setInputText={setInputText}
        isInputFocused={isInputFocused}
        setIsInputFocused={setIsInputFocused}
        attachments={attachments}
        setAttachments={setAttachments}
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
        webSearchEnabled={webSearchEnabled}
        setWebSearchEnabled={setWebSearchEnabled}
        isModelSelectorOpen={isModelSelectorOpen}
        toggleModelSelector={toggleModelSelector}
        dropdownAnim={dropdownAnim}
        searchPulseAnim={searchPulseAnim}
        handleSend={handleSend}
        loading={loading}
        pickDocument={pickDocument}
        MODELS={{ free: models }}
        usage={usageCounts}
        usageLimit={usageLimit}
        mode={mode}
        setMode={setMode}
        isBugSelected={selectedModel.id === BUG_MODEL.id}
      />
    </View>
  );
}

const getStyles = (COLORS) => StyleSheet.create({
  // Chat Area
  chatContainer: { padding: SPACING.lg, paddingBottom: Dimensions.get('window').height * 0.8 },
  loadingHistory: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: COLORS.background, overflow: 'hidden' },

  // Empty new-chat centered greeting
  emptyGreeting: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    paddingHorizontal: SPACING.xl,
  },
  emptyGreetingIcon: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: `${COLORS.primary}14`,
    borderWidth: 1, borderColor: `${COLORS.primary}33`,
    justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.xs,
  },
  emptyGreetingTitle: { ...TYPOGRAPHY.headlineMd, color: COLORS.onSurface, fontWeight: '800' },
  emptyGreetingSub: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurfaceVariant },

  // Initializing-chat loader
  initWrap: { alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
  initIconWrap: { width: 84, height: 84, justifyContent: 'center', alignItems: 'center' },
  initRing: {
    position: 'absolute', width: 84, height: 84, borderRadius: 42,
    borderWidth: 2, borderColor: COLORS.primary,
  },
  initTitle: { ...TYPOGRAPHY.labelLg, color: COLORS.primary, fontWeight: '700', letterSpacing: 0.3 },
  initDotsRow: { flexDirection: 'row', gap: 7, marginTop: 2 },
  initDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },

  // Thinking indicator (borderless, Perplexity-style steps)
  thinkingContainer: { marginBottom: SPACING.xl, marginLeft: SPACING.xs, marginRight: SPACING.xl, maxWidth: '92%', alignSelf: 'flex-start', gap: 6 },
  thinkingTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginBottom: 2 },
  thinkingTitle: { ...TYPOGRAPHY.labelMd, color: COLORS.primary, fontWeight: '700', letterSpacing: 0.3 },
  timerPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: COLORS.surfaceContainerHighest,
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: ROUNDED.full,
    marginLeft: SPACING.xs,
  },
  timerText: { ...TYPOGRAPHY.labelSm, fontSize: 11, fontWeight: '700', color: COLORS.onSurfaceVariant, fontVariant: ['tabular-nums'] },
  // Single swapping step (no stacked list)
  currentStepWrap: { minHeight: 24, justifyContent: 'center' },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 2 },
  stepIcon: { width: 16, height: 16, justifyContent: 'center', alignItems: 'center' },
  currentStepText: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurface, flexShrink: 1, fontWeight: '500' },
  scrollDownButton: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${COLORS.surface}E6`, // Slight transparency
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    zIndex: 10,
  },

});
