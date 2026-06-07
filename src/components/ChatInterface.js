import React, { useState, useRef, useEffect } from 'react';
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
import Svg, { Defs, Pattern, Circle, Rect } from 'react-native-svg';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  FadeInDown,
} from 'react-native-reanimated';
import { COLORS, TYPOGRAPHY, SPACING, ROUNDED } from '@/constants';

// Subtle dotted-grid texture behind the chat (Stitch-style)
const DotGridBackground = ({ color }) => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <Svg width="100%" height="100%">
      <Defs>
        <Pattern id="dotGrid" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
          <Circle cx="2" cy="2" r="1.3" fill={color} />
        </Pattern>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#dotGrid)" />
    </Svg>
  </View>
);
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '@/contexts/AuthContext';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '@/contexts/ThemeContext';
import ChatMessage from '@/components/chat/ChatMessage';
import ChatInput from '@/components/chat/ChatInput';

const MODELS = {
  free: [
    { id: 'openai/gpt-oss-120b:free', name: 'GPT OSS 120B' },
    { id: 'moonshotai/kimi-k2.6:free', name: 'Kimi K2.6' },
    { id: 'qwen/qwen3-coder:free', name: 'Qwen 3 Coder' },
    { id: 'sourceful/riverflow-v2.5-pro:free', name: 'Riverflow V2.5 Pro' },
    { id: 'nvidia/nemotron-3-super-120b-a12b:free', name: 'Nemotron 3 Super' }
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

// A single reasoning step (Perplexity-style): shimmering while active, checked when done
const ThinkingStep = ({ text, status, COLORS, styles }) => {
  const shimmer = useSharedValue(0.55);
  useEffect(() => {
    if (status === 'active') {
      shimmer.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 750, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.5, { duration: 750, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      shimmer.value = withTiming(1, { duration: 200 });
    }
  }, [status]);

  const textStyle = useAnimatedStyle(() => ({
    opacity: status === 'active' ? shimmer.value : 0.5,
  }));

  return (
    <Reanimated.View entering={FadeInDown.duration(300)} style={styles.stepRow}>
      <View style={styles.stepIcon}>
        {status === 'done'
          ? <MaterialCommunityIcons name="check-circle" size={14} color={COLORS.primary} />
          : <Spinner color={COLORS.primary} />}
      </View>
      <Reanimated.Text style={[styles.stepText, status === 'done' && styles.stepTextDone, textStyle]}>
        {text}
      </Reanimated.Text>
    </Reanimated.View>
  );
};

const ThinkingAnimation = ({ isWebSearch }) => {
  const { COLORS } = useTheme();
  const styles = getStyles(COLORS);
  const [iconIndex, setIconIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(1);

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

  // Reveal reasoning steps progressively; hold on the last until the answer arrives
  useEffect(() => {
    const stepTimer = setInterval(() => {
      setVisibleCount((c) => (c < steps.length ? c + 1 : c));
    }, 1300);
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
      </View>

      {steps.slice(0, visibleCount).map((text, i) => (
        <ThinkingStep
          key={i}
          text={text}
          status={i === visibleCount - 1 ? 'active' : 'done'}
          COLORS={COLORS}
          styles={styles}
        />
      ))}
    </View>
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
  const [selectedModel, setSelectedModel] = useState(MODELS.free[0]);
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
  
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
        setMessages([{
          id: 'welcome-1',
          role: 'model',
          text: `Hi ${user?.name?.split(' ')[0] || 'there'}! I'm Bug, your AI assistant. How can I help you today?`
        }]);
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
          sessionId
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
        text: modelText
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
    }
  };

  const renderMessage = ({ item }) => (
    <ChatMessage item={item} user={user} />
  );

  return (
    <View style={styles.container}>
      {/* Dotted texture backdrop */}
      <DotGridBackground color={`${COLORS.onSurfaceVariant}26`} />

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
          ListFooterComponent={loading ? <ThinkingAnimation isWebSearch={webSearchEnabled} /> : null}
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
        MODELS={MODELS}
      />
    </View>
  );
}

const getStyles = (COLORS) => StyleSheet.create({
  // Chat Area
  chatContainer: { padding: SPACING.lg, paddingBottom: Dimensions.get('window').height * 0.8 },
  loadingHistory: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: COLORS.background, overflow: 'hidden' },

  // Thinking indicator (borderless, Perplexity-style steps)
  thinkingContainer: { marginBottom: SPACING.xl, marginLeft: SPACING.xs, marginRight: SPACING.xl, maxWidth: '92%', alignSelf: 'flex-start', gap: 6 },
  thinkingTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginBottom: 2 },
  thinkingTitle: { ...TYPOGRAPHY.labelMd, color: COLORS.primary, fontWeight: '700', letterSpacing: 0.3 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 2 },
  stepIcon: { width: 16, height: 16, justifyContent: 'center', alignItems: 'center' },
  stepText: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurface, flexShrink: 1 },
  stepTextDone: { color: COLORS.onSurfaceVariant },
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
