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
  TouchableWithoutFeedback
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, ROUNDED } from '@/constants';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '@/contexts/AuthContext';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '@/contexts/ThemeContext';
import Markdown from 'react-native-markdown-display';

const MODELS = {
  free: [
    { id: 'openai/gpt-oss-120b:free', name: 'GPT OSS 120B' },
    { id: 'moonshotai/kimi-k2.6:free', name: 'Kimi K2.6' },
    { id: 'qwen/qwen3-coder:free', name: 'Qwen 3 Coder' },
    { id: 'sourceful/riverflow-v2.5-pro:free', name: 'Riverflow V2.5 Pro' },
    { id: 'nvidia/nemotron-3-super-120b-a12b:free', name: 'Nemotron 3 Super' }
  ]
};

const ThinkingAnimation = ({ isWebSearch }) => {
  const { COLORS } = useTheme();
  const styles = getStyles(COLORS);
  const pulseAnim = useRef(new Animated.Value(0.4)).current;
  const [iconIndex, setIconIndex] = useState(0);
  const [textIndex, setTextIndex] = useState(0);
  
  const icons = ['book-open-blank-variant', 'book-open-variant', 'book-open-page-variant'];

  const webSearchThoughts = [
    "Formulating queries...",
    "Scanning the web...",
    "Reading relevant sources...",
    "Extracting key facts...",
    "Synthesizing information..."
  ];

  const standardThoughts = [
    "Analyzing context...",
    "Accessing knowledge...",
    "Structuring response...",
    "Refining wording...",
    "Finalizing details..."
  ];

  const thoughts = isWebSearch ? webSearchThoughts : standardThoughts;

  useEffect(() => {
    const iconInterval = setInterval(() => {
      setIconIndex((prev) => (prev + 1) % icons.length);
    }, 250);
    
    const textInterval = setInterval(() => {
      setTextIndex((prev) => (prev < thoughts.length - 1 ? prev + 1 : prev));
    }, 1200);

    return () => {
      clearInterval(iconInterval);
      clearInterval(textInterval);
    };
  }, [isWebSearch]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        })
      ])
    ).start();
  }, [pulseAnim]);

  return (
    <Animated.View style={[styles.thinkingContainer, { opacity: pulseAnim }]}>
      <MaterialCommunityIcons name={icons[iconIndex]} size={20} color={COLORS.primary} />
      <Text style={styles.thinkingText}>
        {thoughts[textIndex]}
      </Text>
    </Animated.View>
  );
};

export default function ChatInterface() {
  const { user } = useAuth();
  const { COLORS } = useTheme();
  const styles = getStyles(COLORS);
  
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  
  const searchPulseAnim = useRef(new Animated.Value(1)).current;
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [selectedModel, setSelectedModel] = useState(MODELS.free[0]);
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
  
  const flatListRef = useRef(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const dropdownAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadChatHistory();
  }, []);

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
      let token = Platform.OS === 'web' ? localStorage.getItem('jwt_token') : await SecureStore.getItemAsync('jwt_token');
      if (!token) return;

      const response = await fetch('/api/chat/history', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (response.ok && data.messages.length > 0) {
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

  useEffect(() => {
    if (messages.length > 0 && flatListRef.current && !showScrollDown) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, loading]);

  const handleScroll = (event) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 150;
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
          webSearch: webSearchEnabled
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to get response');
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

  const renderMessage = ({ item }) => {
    const isModel = item.role === 'model';
    
    if (isModel) {
      return (
        <View style={styles.messageRowModel}>
          <View style={styles.messageHeader}>
            <View style={styles.modelAvatar}>
              <MaterialCommunityIcons name="auto-fix" size={14} color={COLORS.primary} />
            </View>
            <Text style={styles.modelHeaderName}>BUG CEO AGENT</Text>
          </View>
          <View style={styles.messageContentModel}>
            <Markdown style={styles.markdownStyles}>{item.text}</Markdown>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.messageRowUser}>
        <View style={styles.messageHeaderUser}>
          <Text style={styles.userHeaderName}>{user?.username?.toUpperCase() || 'USER'}</Text>
        </View>
        <View style={styles.messageContentUser}>
          {item.attachments?.map((uri, idx) => (
             <Image key={idx} source={{ uri }} style={styles.chatImage} />
          ))}
          <Text style={styles.messageTextUser}>{item.text}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
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
            if (!showScrollDown) flatListRef.current?.scrollToEnd({ animated: false });
          }}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
          onScrollBeginDrag={() => { if (isModelSelectorOpen) toggleModelSelector(); Keyboard.dismiss(); }}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {showScrollDown && (
        <TouchableOpacity
          style={styles.scrollDownButton}
          onPress={() => flatListRef.current?.scrollToEnd({ animated: true })}
        >
          <MaterialCommunityIcons name="arrow-down-circle" size={32} color={COLORS.primary} style={{ opacity: 0.8 }} />
        </TouchableOpacity>
      )}

      {/* Bottom Input Area */}
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
                  {MODELS.free.map((model) => (
                    <TouchableOpacity 
                      key={model.id}
                      style={[styles.modelDropdownItem, selectedModel.id === model.id && styles.modelDropdownItemActive]}
                      onPress={() => {
                        setSelectedModel(model);
                        toggleModelSelector();
                      }}
                    >
                      <Text style={[styles.modelDropdownItemText, selectedModel.id === model.id && styles.modelDropdownItemTextActive]}>
                        {model.name}
                      </Text>
                      {selectedModel.id === model.id && (
                         <MaterialCommunityIcons name="check" size={14} color={COLORS.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </Animated.View>
            </>
          )}

          {attachments.length > 0 && (
            <View style={styles.attachmentPreviewContainer}>
              {attachments.map((uri, idx) => (
                <View key={idx} style={styles.attachmentPreviewWrapper}>
                  <Image source={{ uri }} style={styles.attachmentPreview} />
                  <TouchableOpacity 
                    style={styles.attachmentRemove} 
                    onPress={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                  >
                    <MaterialCommunityIcons name="close" size={14} color={COLORS.onPrimary} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <View style={[styles.inputBox, isInputFocused && styles.inputBoxFocused]}>
            <TextInput
              style={[styles.textInput, Platform.OS === 'web' && { outlineStyle: 'none' }]}
              placeholder="Ask follow-up or provide new directives..."
              placeholderTextColor={COLORS.onSurfaceVariant}
              value={inputText}
              onChangeText={setInputText}
              onFocus={() => { setIsInputFocused(true); if (isModelSelectorOpen) toggleModelSelector(); }}
              onBlur={() => setIsInputFocused(false)}
              multiline
              maxLength={2000}
            />
            <View style={styles.inputActionsRow}>
              <View style={styles.multiModalTools}>
                <TouchableOpacity style={styles.toolButton} onPress={pickDocument}>
                  <MaterialCommunityIcons name="plus" size={20} color={COLORS.onSurfaceVariant} />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.toolButton}
                  onPress={() => setWebSearchEnabled(!webSearchEnabled)}
                >
                  <Animated.View style={{ opacity: searchPulseAnim }}>
                    <MaterialCommunityIcons 
                      name="web" 
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
              
              <TouchableOpacity 
                style={[styles.submitButton, (inputText.trim().length > 0 || attachments.length > 0) && styles.submitButtonActive]} 
                onPress={handleSend}
                disabled={loading || (!inputText.trim() && attachments.length === 0)}
              >
                <MaterialCommunityIcons 
                  name="arrow-up" 
                  size={20} 
                  color={(inputText.trim().length > 0 || attachments.length > 0) ? COLORS.onPrimary : COLORS.onSurfaceVariant} 
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const getStyles = (COLORS) => StyleSheet.create({
  // Chat Area
  chatContainer: { padding: SPACING.lg, paddingBottom: 150 },
  loadingHistory: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  messageRowModel: { flexDirection: 'col', marginBottom: SPACING.lg, alignItems: 'flex-start' },
  messageHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginBottom: 4 },
  modelAvatar: { 
    width: 24, height: 24, borderRadius: 4, 
    backgroundColor: COLORS.surfaceContainerHighest, 
    borderWidth: 1, borderColor: `${COLORS.primary}4D`,
    justifyContent: 'center', alignItems: 'center' 
  },
  modelHeaderName: { ...TYPOGRAPHY.labelSm, color: COLORS.primary, letterSpacing: 0.5 },
  messageContentModel: { paddingLeft: 0, paddingRight: SPACING.xl },
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
    },
    link: { color: COLORS.primary, textDecorationLine: 'none' },
  },

  scrollDownButton: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },

  messageRowUser: { flexDirection: 'col', marginBottom: SPACING.lg, alignItems: 'flex-end', marginTop: SPACING.md },
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
    maxWidth: '85%' 
  },
  messageTextUser: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurface },
  chatImage: { width: 200, height: 200, borderRadius: ROUNDED.md, marginBottom: SPACING.sm, resizeMode: 'cover' },

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
  submitButton: { width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.surfaceContainerHighest, justifyContent: 'center', alignItems: 'center' },
  submitButtonActive: { backgroundColor: COLORS.primary },
  disclaimerText: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant, textAlign: 'center', marginTop: SPACING.sm, opacity: 0.7 },
  
  attachmentPreviewContainer: { flexDirection: 'row', paddingBottom: SPACING.sm, gap: SPACING.sm },
  attachmentPreviewWrapper: { position: 'relative' },
  attachmentPreview: { width: 60, height: 60, borderRadius: ROUNDED.md, borderWidth: 1, borderColor: COLORS.outlineVariant },
  attachmentRemove: { position: 'absolute', top: -5, right: -5, backgroundColor: COLORS.error, borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center', zIndex: 10 },

  thinkingContainer: { flexDirection: 'row', gap: SPACING.sm, padding: SPACING.md, alignItems: 'center', alignSelf: 'flex-start', marginLeft: 40 },
  thinkingText: { ...TYPOGRAPHY.bodySm, color: COLORS.onSurfaceVariant, opacity: 0.8, fontStyle: 'italic' },
  thinkingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },

  // Model Selector inside Input Box
  modelPillSmall: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: `${COLORS.surfaceContainerHighest}80`,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: ROUNDED.md,
    marginLeft: 4
  },
  modelPillTextSmall: { ...TYPOGRAPHY.labelSm, color: COLORS.onSurfaceVariant },
  
  modelDropdown: {
    position: 'absolute', bottom: '100%', left: 40, marginBottom: 8,
    width: 200, maxHeight: 220,
    backgroundColor: COLORS.surfaceContainerHigh,
    borderRadius: ROUNDED.lg,
    borderWidth: 1, borderColor: COLORS.outlineVariant,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
    zIndex: 100, overflow: 'hidden'
  },
  modelDropdownScroll: { padding: 4 },
  modelDropdownItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10, borderRadius: ROUNDED.sm },
  modelDropdownItemActive: { backgroundColor: `${COLORS.primaryContainer}20` },
  modelDropdownItemText: { ...TYPOGRAPHY.labelMd, color: COLORS.onSurface },
  modelDropdownItemTextActive: { color: COLORS.primary, fontWeight: 'bold' },
});
