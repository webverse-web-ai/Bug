import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { COLORS, SPACING, TYPOGRAPHY, ROUNDED } from '@/constants/theme';
import { CustomButton } from '@/components/ui';

export default function VerifyScreen() {
  const { email, previewUrl } = useLocalSearchParams();
  const { verifyOTP } = useAuth();
  
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
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

  const handleVerify = async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      Alert.alert('Error', 'Please enter a 6-digit code');
      return;
    }

    setLoading(true);
    try {
      await verifyOTP(email, otpCode);
      // If successful, the AuthContext state will change and _layout.js will redirect
      // But we can also force a redirect just in case
      router.replace('/');
    } catch (error) {
      Alert.alert('Verification Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.onSurface} />
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={styles.header}>
          <MaterialCommunityIcons name="email-check-outline" size={60} color={COLORS.primary} style={styles.icon} />
          <Text style={styles.title}>Verify Email</Text>
          <Text style={styles.subtitle}>
            We've sent a 6-digit verification code to
          </Text>
          <Text style={styles.emailText}>{email}</Text>
        </View>

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

        {previewUrl && (
          <View style={styles.testModeBanner}>
            <Text style={styles.testModeTitle}>Testing Mode (Ethereal Email)</Text>
            <Text style={styles.testModeText}>Your OTP was sent to a virtual inbox.</Text>
            <TouchableOpacity onPress={() => window.open(previewUrl, '_blank')}>
              <Text style={styles.testModeLink}>Click here to view your email and get the code.</Text>
            </TouchableOpacity>
          </View>
        )}

        <CustomButton
          title={loading ? "Verifying..." : "Verify Account"}
          onPress={handleVerify}
          disabled={loading || otp.join('').length !== 6}
          style={styles.verifyButton}
        />

        <View style={styles.resendContainer}>
          <Text style={styles.resendText}>Didn't receive the code? </Text>
          <TouchableOpacity onPress={() => Alert.alert('Notice', 'Resend logic to be implemented')}>
            <Text style={styles.resendLink}>Resend</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  backButton: {
    marginTop: 50,
    marginLeft: SPACING.md,
    padding: SPACING.sm,
    alignSelf: 'flex-start',
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  icon: {
    marginBottom: SPACING.md,
  },
  title: {
    fontFamily: TYPOGRAPHY.headlineLgMobile.fontFamily,
    fontSize: 28,
    color: COLORS.onSurface,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontFamily: TYPOGRAPHY.bodyMd.fontFamily,
    fontSize: 16,
    color: COLORS.onSurfaceVariant,
    textAlign: 'center',
  },
  emailText: {
    fontFamily: TYPOGRAPHY.bodyLg.fontFamily,
    fontSize: 16,
    color: COLORS.primary,
    marginTop: 4,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xl,
  },
  otpInput: {
    width: 45,
    height: 55,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    color: COLORS.onSurface,
    fontSize: 24,
    fontFamily: TYPOGRAPHY.headlineLgMobile.fontFamily,
    textAlign: 'center',
  },
  otpInputFilled: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
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
  verifyButton: {
    marginBottom: SPACING.xl,
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  resendText: {
    color: COLORS.onSurfaceVariant,
    fontFamily: TYPOGRAPHY.bodyMd.fontFamily,
  },
  resendLink: {
    color: COLORS.primary,
    fontFamily: TYPOGRAPHY.bodyMd.fontFamily,
    fontWeight: 'bold',
  },
});
