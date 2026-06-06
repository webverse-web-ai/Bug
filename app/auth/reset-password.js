import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform,
  SafeAreaView,
  TouchableOpacity,
  TextInput
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CustomInput, CustomButton } from '@/components/ui';
import { TYPOGRAPHY, SPACING, ROUNDED } from '@/constants';
import { useTheme } from '@/contexts/ThemeContext';
import { resetPassword } from '@/client/api/authService';
import { validatePassword } from '@/utils/validation';

export default function ResetPasswordScreen() {
  const { COLORS } = useTheme();
  const styles = getStyles(COLORS);
  const router = useRouter();
  const { email, previewUrl } = useLocalSearchParams();
  
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const inputRefs = useRef([]);

  const handleOtpChange = (value, index) => {
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Move to next input
    if (value && index < 5) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyPress = (e, index) => {
    // Move to previous input on backspace if current is empty
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1].focus();
    }
  };

  const handleResetPassword = async () => {
    setErrorMessage('');
    const otpCode = otp.join('');
    
    if (otpCode.length !== 6) {
      setErrorMessage('Please enter the full 6-digit code');
      return;
    }

    if (!validatePassword(password, 6)) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }
    
    setLoading(true);
    try {
      await resetPassword(email, otpCode, password);
      // Redirect back to login upon success
      router.replace('/auth/login');
    } catch (error) {
      setErrorMessage(error.message || 'Failed to reset password');
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
            <Text style={styles.title}>Create New Password</Text>
            <Text style={styles.subtitle}>Enter the 6-digit code sent to {email} and pick a new password.</Text>
          </View>

          {previewUrl && (
            <View style={styles.testModeBanner}>
              <Text style={styles.testModeTitle}>Testing Mode (Ethereal Email)</Text>
              <Text style={styles.testModeText}>Your reset code was sent to a virtual inbox.</Text>
              <TouchableOpacity onPress={() => window.open(previewUrl, '_blank')}>
                <Text style={styles.testModeLink}>Click here to view your code.</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.label}>Verification Code</Text>
            <View style={styles.otpContainer}>
              {otp.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => (inputRefs.current[index] = ref)}
                  style={[
                    styles.otpInput,
                    digit ? styles.otpInputFilled : null
                  ]}
                  maxLength={1}
                  keyboardType="number-pad"
                  value={digit}
                  onChangeText={(value) => handleOtpChange(value, index)}
                  onKeyPress={(e) => handleKeyPress(e, index)}
                  selectionColor={COLORS.primary}
                />
              ))}
            </View>

            <CustomInput
              label="New Password"
              placeholder="Enter your new password"
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
              title="Reset Password"
              onPress={handleResetPassword}
              loading={loading}
              style={styles.submitButton}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (COLORS) => StyleSheet.create({
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
  testModeBanner: {
    backgroundColor: COLORS.surfaceVariant,
    padding: SPACING.md,
    borderRadius: ROUNDED.default,
    marginBottom: SPACING.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  testModeTitle: {
    ...TYPOGRAPHY.labelMd,
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  testModeText: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.onSurfaceVariant,
    textAlign: 'center',
  },
  testModeLink: {
    ...TYPOGRAPHY.bodySm,
    color: '#89ceff',
    textDecorationLine: 'underline',
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  card: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: ROUNDED.lg,
    padding: SPACING.lg,
  },
  label: {
    ...TYPOGRAPHY.labelMd,
    color: COLORS.onSurface,
    marginBottom: SPACING.xs,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  otpInput: {
    width: 45,
    height: 55,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceContainerLowest,
    color: COLORS.onSurface,
    fontSize: 24,
    fontFamily: TYPOGRAPHY.headlineLgMobile.fontFamily,
    textAlign: 'center',
  },
  otpInputFilled: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
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
  submitButton: {
    marginTop: SPACING.sm,
  },
});
