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
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { 
  CustomInput, 
  CustomButton, 
  SocialLoginButtons 
} from '../../src/components/ui';
import { COLORS, TYPOGRAPHY, SPACING, ROUNDED } from '../../src/constants';
import { signupUser } from '../../src/services/authService';
import { validateEmail, validatePassword, validateRequired } from '../../src/utils/validation';

export default function SignupScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSignup = async () => {
    setErrorMessage('');
    
    // Validate
    const isNameValid = validateRequired(name);
    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password, 6);
    
    if (!isNameValid) setNameError('Name is required');
    if (!isEmailValid) setEmailError('Invalid email format');
    if (!isPasswordValid) setPasswordError('Password must be at least 6 characters');

    if (!isNameValid || !isEmailValid || !isPasswordValid) {
      return;
    }
    
    setLoading(true);
    try {
      const response = await signupUser(name, email, password);
      router.push({ pathname: '/auth/verify', params: { email, previewUrl: response.previewUrl } });
    } catch (error) {
      setErrorMessage(error.message || 'Signup failed');
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
            <Text style={styles.title}>Sign up for Bug</Text>
            <Text style={styles.subtitle}>Create an account to get started.</Text>
          </View>

          <View style={styles.card}>
            <CustomInput
              label="Full Name"
              placeholder="Enter your name"
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (nameError) setNameError(validateRequired(text) ? '' : 'Name is required');
              }}
              error={nameError}
            />

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
              placeholder="Create a password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (passwordError) setPasswordError(validatePassword(text, 6) ? '' : 'Password must be at least 6 characters');
              }}
              isPassword
              error={passwordError}
            />

            {errorMessage ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{errorMessage}</Text>
              </View>
            ) : null}

            <CustomButton
              title="Create Account"
              onPress={handleSignup}
              loading={loading}
              style={styles.signUpButton}
            />

            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <SocialLoginButtons 
              onGooglePress={() => {}}
              onFacebookPress={() => {}}
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Text 
              style={styles.footerLink}
              onPress={() => router.push('/auth/login')}
            >
              Log in
            </Text>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  signUpButton: {
    marginBottom: SPACING.lg,
    marginTop: SPACING.xs,
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
