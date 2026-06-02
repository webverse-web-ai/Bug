import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform,
  SafeAreaView,
  TouchableOpacity,
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CustomInput, CustomButton } from '../../src/components/ui';
import { COLORS, TYPOGRAPHY, SPACING, ROUNDED } from '../../src/constants';
import { forgotPassword } from '../../src/services/authService';
import { validateEmail } from '../../src/utils/validation';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSendEmail = async () => {
    setErrorMessage('');
    
    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }
    
    setLoading(true);
    try {
      const response = await forgotPassword(email);
      router.push({ pathname: '/auth/reset-password', params: { email, previewUrl: response.previewUrl } });
    } catch (error) {
      setErrorMessage(error.message || 'Failed to send recovery email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.onSurface} />
        </TouchableOpacity>

        <View style={styles.content}>
          <View style={styles.header}>
            <MaterialCommunityIcons name="lock-reset" size={60} color={COLORS.primary} style={styles.icon} />
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>Enter your email address and we'll send you a link to reset your password.</Text>
          </View>

          <View style={styles.card}>
            <CustomInput
              label="Email"
              placeholder="Enter your email"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (emailError) setEmailError(validateEmail(text) ? '' : 'Invalid email format');
              }}
              keyboardType="email-address"
              error={emailError}
            />

            {errorMessage ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{errorMessage}</Text>
              </View>
            ) : null}

            <CustomButton
              title="Send Recovery Code"
              onPress={handleSendEmail}
              loading={loading}
              style={styles.sendButton}
            />
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
  backButton: {
    marginTop: 20,
    marginLeft: SPACING.md,
    padding: SPACING.sm,
    alignSelf: 'flex-start',
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.marginMobile,
    justifyContent: 'center',
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  icon: {
    marginBottom: SPACING.md,
  },
  title: {
    ...TYPOGRAPHY.headlineLgMobile,
    color: COLORS.onSurface,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    ...TYPOGRAPHY.bodyMd,
    color: COLORS.onSurfaceVariant,
    textAlign: 'center',
  },
  card: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: ROUNDED.lg,
    padding: SPACING.lg,
  },
  errorBanner: {
    backgroundColor: COLORS.errorContainer,
    padding: SPACING.md,
    borderRadius: ROUNDED.sm,
    marginBottom: SPACING.md,
  },
  errorBannerText: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.onErrorContainer,
    textAlign: 'center',
  },
  sendButton: {
    marginTop: SPACING.sm,
  },
});
