import React from 'react';
import { View, StyleSheet } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { COLORS, SPACING } from '../../constants';
import { CustomButton } from './CustomButton';

/**
 * SocialLoginButtons component following Cognitive Architecture.
 */
export const SocialLoginButtons = ({ onGooglePress, onFacebookPress }) => {
  return (
    <View style={styles.container}>
      <CustomButton
        variant="secondary"
        title="Continue with Google"
        onPress={onGooglePress}
        icon={<FontAwesome5 name="google" size={18} color={COLORS.onSurface} />}
        style={styles.button}
      />
      <CustomButton
        variant="secondary"
        title="Continue with Facebook"
        onPress={onFacebookPress}
        icon={<FontAwesome5 name="facebook" size={18} color="#1877F2" />}
        style={styles.button}
      />
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
