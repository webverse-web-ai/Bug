import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { COLORS, SPACING } from '@/constants';
import { CustomButton } from '@/components/ui/CustomButton';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';

WebBrowser.maybeCompleteAuthSession();

export const SocialLoginButtons = () => {
  const { oauthLogin } = useAuth();
  const router = useRouter();
  const [loadingProvider, setLoadingProvider] = useState(null);

  const [googleRequest, googleResponse, googlePromptAsync] = Google.useAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
  });

  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const { authentication } = googleResponse;
      handleOAuthLogin('google', authentication.accessToken);
    } else if (googleResponse?.type === 'error') {
      setLoadingProvider(null);
      Alert.alert('Authentication error', 'Failed to authenticate with Google');
    }
  }, [googleResponse]);

  const handleOAuthLogin = async (provider, accessToken) => {
    try {
      setLoadingProvider(provider);
      await oauthLogin(provider, accessToken);
      router.replace('/'); // Redirect to home/tabs on success
    } catch (error) {
      Alert.alert('Login failed', error.message || 'An error occurred during social login.');
    } finally {
      setLoadingProvider(null);
    }
  };

  return (
    <View style={styles.container}>
      <CustomButton
        variant="secondary"
        title="Continue with Google"
        onPress={() => {
          setLoadingProvider('google');
          googlePromptAsync();
        }}
        loading={loadingProvider === 'google'}
        disabled={!googleRequest || loadingProvider !== null}
        icon={loadingProvider !== 'google' ? <FontAwesome5 name="google" size={18} color={COLORS.onSurface} /> : null}
        style={styles.button}
      />
      {/* <CustomButton
        variant="secondary"
        title="Continue with Facebook (Coming Soon)"
        onPress={() => {
           Alert.alert("Coming soon", "Facebook auth requires an App ID to be configured first.");
        }}
        disabled={loadingProvider !== null}
        icon={<FontAwesome5 name="facebook" size={18} color="#1877F2" />}
        style={styles.button}
      /> */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: SPACING.sm, // 8px between buttons
    marginTop: SPACING.md,
  },
  button: {
    // Relying on CustomButton's secondary variant
  }
});
