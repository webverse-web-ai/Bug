import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Platform, Animated } from 'react-native';
import { router } from 'expo-router';
import { FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { CustomInput, CustomButton, SelectableCard } from '@/components/ui';
import { COLORS, TYPOGRAPHY, SPACING, ROUNDED } from '@/constants';
import { useAuth } from '@/contexts/AuthContext';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';
import { apiCheckUsername } from '@/client/api/authService';

WebBrowser.maybeCompleteAuthSession();

const redirectUri = makeRedirectUri({ preferLocalhost: true });

// Custom hook for debounce
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => { setDebouncedValue(value); }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function SetupScreen() {
  const { user, saveGeminiToken, saveOpenRouterKey, completeSetup } = useAuth();
  const [username, setUsername] = useState('');
  const debouncedUsername = useDebounce(username, 500);
  
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isUsernameAvailable, setIsUsernameAvailable] = useState(false);
  const [usernameError, setUsernameError] = useState('');

  const [selectedPath, setSelectedPath] = useState('create'); // 'create' | 'join'
  
  const [isAiConnected, setIsAiConnected] = useState(user?.hasGeminiToken || false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  const [openRouterKeyInput, setOpenRouterKeyInput] = useState('');
  const [isOpenRouterConnected, setIsOpenRouterConnected] = useState(user?.hasOpenRouterKey || false);
  const [isSavingOpenRouter, setIsSavingOpenRouter] = useState(false);
  const [openRouterError, setOpenRouterError] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Animation values
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (user?.hasGeminiToken) setIsAiConnected(true);
    if (user?.hasOpenRouterKey) setIsOpenRouterConnected(true);
  }, [user]);

  // Username validation effect
  useEffect(() => {
    if (debouncedUsername.trim().length < 3) {
      setIsUsernameAvailable(false);
      setUsernameError('');
      return;
    }

    let isMounted = true;
    const checkUsername = async () => {
      setIsCheckingUsername(true);
      setUsernameError('');
      try {
        const data = await apiCheckUsername(debouncedUsername);
        if (isMounted) {
          setIsUsernameAvailable(data.available);
          if (!data.available) {
            setUsernameError('This username is already taken.');
          }
        }
      } catch (error) {
        if (isMounted) {
          setIsUsernameAvailable(false);
          setUsernameError('Error checking username.');
        }
      } finally {
        if (isMounted) setIsCheckingUsername(false);
      }
    };
    
    checkUsername();
    return () => { isMounted = false; };
  }, [debouncedUsername]);

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
    redirectUri,
    scopes: [
      'https://www.googleapis.com/auth/cloud-platform',
      'https://www.googleapis.com/auth/generative-language.retriever',
      'https://www.googleapis.com/auth/generative-language.tuning'
    ],
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      if (authentication?.accessToken) {
        saveGeminiToken(authentication.accessToken)
          .then(() => {
            setIsAiConnected(true);
            setIsConnecting(false);
          })
          .catch(err => {
            console.error("Failed to save token to backend:", err);
            setIsConnecting(false);
          });
      }
    } else if (response?.type === 'error' || response?.type === 'dismiss') {
      setIsConnecting(false);
    }
  }, [response]);

  const isFormValid = debouncedUsername && isUsernameAvailable && selectedPath !== null && (isAiConnected || isOpenRouterConnected);

  // Glow animation effect
  useEffect(() => {
    if (isFormValid) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 1000, useNativeDriver: false }),
          Animated.timing(glowAnim, { toValue: 0, duration: 1000, useNativeDriver: false })
        ])
      ).start();
    } else {
      glowAnim.setValue(0);
      Animated.timing(glowAnim).stop();
    }
  }, [isFormValid]);

  const handleContinue = async () => {
    if (!isFormValid) return;
    setIsSubmitting(true);
    try {
      await completeSetup(debouncedUsername, selectedPath);
      router.replace('/(dashboard)');
    } catch (error) {
      console.error('Failed to complete setup:', error);
      alert('Failed to complete setup. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConnectGemini = async () => {
    setIsConnecting(true);
    try {
      await promptAsync();
    } catch (error) {
      console.error('OAuth Error:', error);
      setIsConnecting(false);
    }
  };

  const handleSaveOpenRouter = async () => {
    if (!openRouterKeyInput.trim()) return;
    setIsSavingOpenRouter(true);
    setOpenRouterError('');
    try {
      // The backend will now validate the key directly with OpenRouter
      await saveOpenRouterKey(openRouterKeyInput.trim());
      setIsOpenRouterConnected(true);
      setOpenRouterKeyInput('');
    } catch (error) {
      console.error('Failed to save OpenRouter key:', error);
      setOpenRouterError(error.message || "Failed to validate and save the key.");
    } finally {
      setIsSavingOpenRouter(false);
    }
  };

  const glowShadowColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(0, 0, 0, 0)', COLORS.primary]
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        <View style={styles.header}>
          <Text style={styles.title}>Complete your setup</Text>
          <Text style={styles.subtitle}>
            Customize your AI Cognitive OS experience to fit your unique workflow.
          </Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="at" size={24} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Claim your username</Text>
          </View>
          <CustomInput
            placeholder="@username"
            value={username}
            onChangeText={(text) => {
              setUsername(text);
              setIsUsernameAvailable(false);
              setUsernameError('');
            }}
            rightIcon={
              isCheckingUsername ? (
                <MaterialCommunityIcons name="loading" size={20} color={COLORS.onSurfaceVariant} />
              ) : username.trim().length > 2 ? (
                isUsernameAvailable ? (
                  <MaterialCommunityIcons name="check-circle-outline" size={20} color={COLORS.success || '#4CAF50'} />
                ) : (
                  <MaterialCommunityIcons name="close-circle-outline" size={20} color={COLORS.error || '#F44336'} />
                )
              ) : null
            }
          />
          {usernameError ? <Text style={styles.errorText}>{usernameError}</Text> : null}
          {isUsernameAvailable ? <Text style={styles.successText}>Username available!</Text> : null}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="source-branch" size={24} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Choose your path</Text>
          </View>
          <SelectableCard
            icon={<FontAwesome5 name="user-plus" size={16} color={COLORS.onSurface} />}
            title="Create a Team"
            description="Start a new organization."
            isSelected={selectedPath === 'create'}
            onPress={() => setSelectedPath('create')}
          />
          <SelectableCard
            icon={<FontAwesome5 name="sign-in-alt" size={16} color={COLORS.onSurface} />}
            title="Join a Team"
            description="Connect with colleagues."
            isSelected={selectedPath === 'join'}
            onPress={() => setSelectedPath('join')}
          />
        </View>

        <View style={styles.aiCard}>
          <View style={styles.aiLabelContainer}>
            <MaterialCommunityIcons name="creation" size={14} color={COLORS.primary} />
            <Text style={styles.aiLabelText}>AI INTEGRATION REQUIRED</Text>
          </View>
          <Text style={styles.aiTitle}>Power up with AI</Text>
          <Text style={styles.aiSubtitle}>
            Sign in with your Google account to unlock Gemini-powered cognitive assistance.
          </Text>

          <TouchableOpacity 
            style={[styles.aiButton, isAiConnected && styles.aiButtonConnected]}
            onPress={() => promptAsync()}
            disabled={isConnecting}
          >
            {isAiConnected ? (
              <>
                <MaterialCommunityIcons name="check" size={20} color={COLORS.onSurface} />
                <Text style={styles.aiButtonTextConnected}>Reconnect Google Gemini</Text>
              </>
            ) : isConnecting ? (
              <>
                <MaterialCommunityIcons name="loading" size={16} color={COLORS.background} />
                <Text style={styles.aiButtonText}>Connecting...</Text>
              </>
            ) : (
              <>
                <View style={styles.geminiIconPlaceholder}>
                  <MaterialCommunityIcons name="star-four-points" size={16} color={COLORS.primary} />
                </View>
                <Text style={styles.aiButtonText}>Connect Google Gemini</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.aiCard}>
          <View style={styles.aiLabelContainer}>
            <MaterialCommunityIcons name="api" size={14} color={COLORS.primary} />
            <Text style={styles.aiLabelText}>ALTERNATIVE AI</Text>
          </View>
          <Text style={styles.aiTitle}>OpenRouter API</Text>
          <Text style={styles.aiSubtitle}>
            Connect OpenRouter to access alternative models like GPT 120B.
          </Text>

          {!isOpenRouterConnected && (
            <>
              <CustomInput
                placeholder="sk-or-v1-..."
                value={openRouterKeyInput}
                onChangeText={setOpenRouterKeyInput}
                secureTextEntry={true}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {openRouterError ? <Text style={styles.errorText}>{openRouterError}</Text> : null}
            </>
          )}

          <TouchableOpacity 
            style={[styles.aiButton, { marginTop: SPACING.md }, isOpenRouterConnected && styles.aiButtonConnected]}
            onPress={handleSaveOpenRouter}
            disabled={isSavingOpenRouter || (!openRouterKeyInput && !isOpenRouterConnected)}
          >
            {isOpenRouterConnected && !openRouterKeyInput ? (
              <>
                <MaterialCommunityIcons name="check" size={20} color={COLORS.success || '#4CAF50'} />
                <Text style={[styles.aiButtonTextConnected, { color: COLORS.success || '#4CAF50' }]}>OpenRouter Connected</Text>
              </>
            ) : isSavingOpenRouter ? (
              <>
                <MaterialCommunityIcons name="loading" size={16} color={COLORS.background} />
                <Text style={styles.aiButtonText}>Connecting & Saving...</Text>
              </>
            ) : (
              <>
                <View style={styles.geminiIconPlaceholder}>
                  <MaterialCommunityIcons name="key" size={16} color={COLORS.primary} />
                </View>
                <Text style={styles.aiButtonText}>Connect OpenRouter Key</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <View style={styles.divider} />
          <Animated.View style={[
            styles.continueButtonWrapper, 
            isFormValid && {
              shadowColor: glowShadowColor,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.8,
              shadowRadius: 15,
              elevation: 10,
            }
          ]}>
            <CustomButton
              title={isSubmitting ? "Completing Setup..." : "Continue to Dashboard"}
              onPress={handleContinue}
              disabled={!isFormValid || isSubmitting}
              style={styles.continueButton}
            />
          </Animated.View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  scrollContainer: { flexGrow: 1, padding: SPACING.xl, maxWidth: 600, width: '100%', alignSelf: 'center' },
  header: { marginBottom: SPACING.xl, marginTop: SPACING.xl },
  title: { ...TYPOGRAPHY.headlineLg, color: COLORS.onSurface, marginBottom: SPACING.xs },
  subtitle: { ...TYPOGRAPHY.bodyLg, color: COLORS.onSurfaceVariant },
  section: { marginBottom: SPACING.xl },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md, gap: SPACING.sm },
  sectionTitle: { ...TYPOGRAPHY.headlineMd, color: COLORS.onSurface },
  aiCard: { backgroundColor: COLORS.surfaceContainerLow, borderWidth: 1, borderColor: COLORS.outlineVariant, borderRadius: ROUNDED.xl, padding: SPACING.lg, marginBottom: SPACING.xl },
  aiLabelContainer: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginBottom: SPACING.sm },
  aiLabelText: { ...TYPOGRAPHY.labelSm, color: COLORS.primary },
  aiTitle: { ...TYPOGRAPHY.headlineMd, color: COLORS.onSurface, marginBottom: SPACING.xs },
  aiSubtitle: { ...TYPOGRAPHY.bodyMd, color: COLORS.onSurfaceVariant, marginBottom: SPACING.lg },
  aiButton: { backgroundColor: COLORS.onSurface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: SPACING.lg, borderRadius: ROUNDED.default, gap: SPACING.sm },
  aiButtonConnected: { backgroundColor: COLORS.surfaceContainerHighest, borderWidth: 1, borderColor: COLORS.outlineVariant },
  geminiIconPlaceholder: { backgroundColor: COLORS.surfaceContainerLowest, padding: 4, borderRadius: ROUNDED.sm },
  aiButtonText: { ...TYPOGRAPHY.labelMd, color: COLORS.background },
  aiButtonTextConnected: { ...TYPOGRAPHY.labelMd, color: COLORS.onSurface },
  footer: { marginTop: 'auto', paddingTop: SPACING.xl, paddingBottom: SPACING.xl },
  divider: { height: 1, backgroundColor: COLORS.outlineVariant, marginBottom: SPACING.xl },
  continueButtonWrapper: { borderRadius: ROUNDED.full, overflow: 'visible' },
  continueButton: { width: '100%' },
  errorText: { color: COLORS.error || '#F44336', fontSize: 12, marginTop: 4, marginLeft: 4 },
  successText: { color: COLORS.success || '#4CAF50', fontSize: 12, marginTop: 4, marginLeft: 4 }
});
