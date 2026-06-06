import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  KeyboardAvoidingView, 
  Platform,
  ActivityIndicator,
  Keyboard
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, ROUNDED } from '@/constants';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '@/contexts/AuthContext';

export default function DashboardIndex() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const [messages, setMessages] = useState([
    {
      id: 'welcome-1',
      role: 'model',
      text: `Hello ${user?.fullName?.split(' ')[0] || 'there'}, what do you want to explore today?`
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleLogout = async () => {
    setIsMenuOpen(false);
    await logout();
  };

  const handleGoToSetup = () => {
    setIsMenuOpen(false);
    import('expo-router').then(({ router }) => router.replace('/setup'));
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: inputText.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setLoading(true);
    Keyboard.dismiss();

    try {
      if (!user?.hasOpenRouterKey && !user?.hasGeminiToken) {
        throw new Error('No AI connected. Please go to Setup and connect your OpenRouter or Gemini account.');
      }

      // Get the backend JWT token
      let token = null;
      if (Platform.OS === 'web') {
        token = localStorage.getItem('jwt_token');
      } else {
        token = await SecureStore.getItemAsync('jwt_token');
      }

      if (!token) {
        throw new Error('You must be logged in to chat.');
      }

      // Format history for Gemini API
      const apiContents = messages
        .filter(m => m.id !== 'welcome-1') // Gemini expects strictly alternating user/model roles, so let's just pass the real chat
        .concat(userMessage)
        .map(msg => ({
          role: msg.role === 'model' ? 'model' : 'user',
          parts: [{ text: msg.text }]
        }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ contents: apiContents })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to get response');
      }

      // Parse Gemini response
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
        text: `Error: ${error.message}`
      }]);
    } finally {
      setLoading(false);
    }
  };

  const renderMessage = ({ item }) => {
    const isModel = item.role === 'model';
    return (
      <View style={[styles.messageWrapper, isModel ? styles.messageWrapperModel : styles.messageWrapperUser]}>
        {isModel && (
          <View style={styles.aiAvatar}>
            <MaterialCommunityIcons name="star-four-points" size={16} color={COLORS.primary} />
          </View>
        )}
        <View style={[styles.messageBubble, isModel ? styles.messageBubbleModel : styles.messageBubbleUser]}>
          <Text style={[styles.messageText, isModel ? styles.messageTextModel : styles.messageTextUser]}>
            {item.text}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setIsMenuOpen(!isMenuOpen)} style={styles.headerIcon}>
            <MaterialCommunityIcons name="menu" size={28} color={COLORS.onSurface} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Bug AI</Text>
          <View style={styles.headerIcon}>
            <MaterialCommunityIcons name="account-circle-outline" size={28} color={COLORS.onSurfaceVariant} />
          </View>
        </View>

        {/* Dropdown Menu */}
        {isMenuOpen && (
          <View style={styles.dropdownMenu}>
            <TouchableOpacity style={styles.menuItem} onPress={handleGoToSetup}>
              <MaterialCommunityIcons name="cog-outline" size={20} color={COLORS.onSurface} />
              <Text style={styles.menuItemText}>Setup Page</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
              <MaterialCommunityIcons name="logout" size={20} color={COLORS.error} />
              <Text style={[styles.menuItemText, { color: COLORS.error }]}>Log out</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Chat History */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.chatContainer}
          showsVerticalScrollIndicator={false}
        />

        {/* Input Area (Perplexity Style) */}
        <View style={styles.inputContainerWrapper}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="Ask anything..."
              placeholderTextColor={COLORS.onSurfaceVariant}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={2000}
            />
            <View style={styles.inputActions}>
              <TouchableOpacity style={styles.actionButton}>
                <MaterialCommunityIcons name="paperclip" size={20} color={COLORS.onSurfaceVariant} />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.sendButton, inputText.trim().length > 0 && styles.sendButtonActive]} 
                onPress={handleSend}
                disabled={loading || !inputText.trim()}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={COLORS.onPrimary} />
                ) : (
                  <MaterialCommunityIcons 
                    name="arrow-up" 
                    size={20} 
                    color={inputText.trim().length > 0 ? COLORS.onPrimary : COLORS.onSurfaceVariant} 
                  />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outlineVariant,
    position: 'relative',
    zIndex: 10,
  },
  headerIcon: {
    padding: SPACING.xs,
    width: 40,
    alignItems: 'center',
  },
  headerTitle: {
    ...TYPOGRAPHY.headlineMd,
    color: COLORS.onSurface,
  },
  dropdownMenu: {
    position: 'absolute',
    top: 60,
    left: SPACING.lg,
    backgroundColor: COLORS.surfaceContainerHigh,
    borderRadius: ROUNDED.lg,
    padding: SPACING.xs,
    minWidth: 180,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.sm,
    borderRadius: ROUNDED.md,
  },
  menuItemText: {
    ...TYPOGRAPHY.bodyLg,
    color: COLORS.onSurface,
  },
  menuDivider: {
    height: 1,
    backgroundColor: COLORS.outlineVariant,
    marginVertical: SPACING.xs,
    marginHorizontal: SPACING.sm,
  },
  chatContainer: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  messageWrapper: {
    flexDirection: 'row',
    marginBottom: SPACING.lg,
    alignItems: 'flex-start',
  },
  messageWrapperUser: {
    justifyContent: 'flex-end',
  },
  messageWrapperModel: {
    justifyContent: 'flex-start',
    paddingRight: SPACING.xl, // keep it from touching right edge
  },
  aiAvatar: {
    width: 32,
    height: 32,
    borderRadius: ROUNDED.md,
    backgroundColor: COLORS.surfaceContainerHigh,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
  },
  messageBubble: {
    padding: SPACING.md,
    borderRadius: ROUNDED.lg,
    maxWidth: '85%',
  },
  messageBubbleUser: {
    backgroundColor: COLORS.surfaceContainerHigh,
    borderBottomRightRadius: ROUNDED.sm,
  },
  messageBubbleModel: {
    backgroundColor: 'transparent',
    padding: 0,
    marginTop: SPACING.xs,
  },
  messageText: {
    ...TYPOGRAPHY.bodyLg,
  },
  messageTextUser: {
    color: COLORS.onSurface,
  },
  messageTextModel: {
    color: COLORS.onSurface,
    lineHeight: 28,
  },
  inputContainerWrapper: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.lg,
    paddingTop: SPACING.sm,
    backgroundColor: COLORS.background,
  },
  inputContainer: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: ROUNDED.xl,
    padding: SPACING.sm,
    minHeight: 120,
    justifyContent: 'space-between',
  },
  textInput: {
    ...TYPOGRAPHY.bodyLg,
    color: COLORS.onSurface,
    padding: SPACING.sm,
    paddingTop: SPACING.sm,
    maxHeight: 150,
  },
  inputActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },
  actionButton: {
    padding: SPACING.sm,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: ROUNDED.full,
    backgroundColor: COLORS.surfaceContainerHigh,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonActive: {
    backgroundColor: COLORS.primary,
  }
});
