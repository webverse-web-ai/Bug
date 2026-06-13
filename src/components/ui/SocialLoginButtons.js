import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, Platform } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { SPACING, TYPOGRAPHY } from '@/constants';
import { useTheme } from '@/contexts/ThemeContext';
import { CustomButton } from '@/components/ui/CustomButton';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { oauthSupported } from '@/client/oauthSupport';

WebBrowser.maybeCompleteAuthSession();

// Inner component that owns the auth-request hook. Mounted only when supported.
function GoogleButton() {
  const { COLORS } = useTheme();
  const styles = getStyles(COLORS);
  const { oauthLogin } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
  });

  useEffect(() => {
    if (response?.type === 'success') {
      (async () => {
        try { await oauthLogin('google', response.authentication.accessToken); router.replace('/'); }
        catch (e) { Alert.alert('Login failed', e.message || 'Social login error.'); }
        finally { setLoading(false); }
      })();
    } else if (response?.type === 'error') {
      setLoading(false);
      Alert.alert('Authentication error', 'Failed to authenticate with Google');
    }
  }, [response]);

  return (
    <CustomButton
      variant="secondary"
      title="Continue with Google"
      onPress={() => { setLoading(true); promptAsync(); }}
      loading={loading}
      disabled={!request || loading}
      icon={!loading ? <FontAwesome5 name="google" size={18} color={COLORS.onSurface} /> : null}
    />
  );
}

export const SocialLoginButtons = () => {
  const { COLORS } = useTheme();
  const styles = getStyles(COLORS);

  return (
    <View style={styles.container}>
      {oauthSupported() ? (
        <GoogleButton />
      ) : (
        <Text style={[styles.note, { color: COLORS.onSurfaceVariant }]}>
          Google sign-in is available over https or localhost.
        </Text>
      )}
    </View>
  );
};

const getStyles = (COLORS) => StyleSheet.create({
  container: { gap: SPACING.sm, marginTop: SPACING.md },
  note: { ...TYPOGRAPHY.bodySm, textAlign: 'center', opacity: 0.8 },
});
