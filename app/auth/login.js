import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform,
  ScrollView,
  SafeAreaView,
  Image,
  Alert,
  TouchableOpacity
} from 'react-native';
import { useRouter } from 'expo-router';
import { 
  CustomInput, 
  CustomButton, 
  SocialLoginButtons 
} from '@/components/ui';
import { TYPOGRAPHY, SPACING, ROUNDED } from '@/constants';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { validateEmail, validatePassword } from '@/utils/validation';

export default function LoginScreen() {
  const { login, error: authError, clearError, user } = useAuth();
  const { COLORS } = useTheme();
  const styles = getStyles(COLORS);
  
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async () => {
    setErrorMessage('');
    
    // Validate
    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password, 1); // just checking if not empty for login
    
    if (!isEmailValid) setEmailError('Invalid email format');
    if (!isPasswordValid) setPasswordError('Password is required');
    
    if (!isEmailValid || !isPasswordValid) {
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      // login success will trigger AuthContext state update
      // Router redirection is usually handled in _layout.js, or we can force it:
      router.replace('/setup');
    } catch (error) {
      setErrorMessage(error.message || 'Login failed');
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
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          
          <View style={styles.header}>
            <Image source={require('../../assets/logo/logo.jpeg')} style={styles.logo} />
            <Text style={styles.title}>Log in to Bug</Text>
            <Text style={styles.subtitle}>Welcome back! Please enter your details.</Text>
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
            
            <CustomInput
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (passwordError) setPasswordError(text ? '' : 'Password is required');
              }}
              isPassword
              error={passwordError}
            />

            <TouchableOpacity 
              style={styles.forgotPasswordContainer}
              onPress={() => router.push('/auth/forgot-password')}
            >
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </TouchableOpacity>

            {errorMessage ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{errorMessage}</Text>
              </View>
            ) : null}

            <CustomButton
              title="Sign In"
              onPress={handleLogin}
              loading={loading}
              style={styles.signInButton}
            />

            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <SocialLoginButtons />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <Text 
              style={styles.footerLink}
              onPress={() => router.push('/auth/signup')}
            >
              Sign up
            </Text>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (COLORS) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background, // Deep charcoal canvas
  },
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: SPACING.marginMobile,
    justifyContent: 'center',
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
    paddingVertical: SPACING.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: ROUNDED.md,
    marginBottom: SPACING.md,
    resizeMode: 'contain',
  },
  title: {
    ...TYPOGRAPHY.headlineLgMobile,
    color: COLORS.onSurface,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    ...TYPOGRAPHY.bodyMd,
    color: COLORS.onSurfaceVariant,
    textAlign: 'center',
  },
  card: {
    backgroundColor: COLORS.surfaceContainerLow, // Layer 1
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: ROUNDED.lg, // 16px
    padding: SPACING.lg,
  },
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginBottom: SPACING.md,
    marginTop: -SPACING.sm, // pulling it up closer to the password input
  },
  forgotPasswordText: {
    ...TYPOGRAPHY.labelMd,
    color: COLORS.primary,
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
  signInButton: {
    marginBottom: SPACING.lg,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.outlineVariant,
  },
  dividerText: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.onSurfaceVariant,
    paddingHorizontal: SPACING.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: SPACING.lg,
  },
  footerText: {
    ...TYPOGRAPHY.bodyMd,
    color: COLORS.onSurfaceVariant,
  },
  footerLink: {
    ...TYPOGRAPHY.labelMd,
    color: COLORS.primary,
  },
});
