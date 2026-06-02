import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { COLORS, TYPOGRAPHY, ROUNDED, SPACING } from '../../constants';

/**
 * CustomButton component following the Cognitive Architecture design system.
 * 
 * @param {string} title - Text to display on the button
 * @param {function} onPress - Function to call on press
 * @param {string} variant - 'primary' (solid Sky Blue) or 'secondary' (transparent with subtle border)
 * @param {boolean} disabled - Whether the button is disabled
 * @param {boolean} loading - Whether to show a loading indicator
 */
export const CustomButton = ({ 
  title, 
  onPress, 
  variant = 'primary', 
  disabled = false, 
  loading = false,
  icon,
  style
}) => {
  const isPrimary = variant === 'primary';

  return (
    <TouchableOpacity
      style={[
        styles.button,
        isPrimary ? styles.primaryButton : styles.secondaryButton,
        disabled && styles.disabledButton,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? COLORS.onPrimary : COLORS.onSurface} />
      ) : (
        <>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          <Text
            style={[
              styles.text,
              isPrimary ? styles.primaryText : styles.secondaryText,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    height: 48,
    borderRadius: ROUNDED.default, // 8px
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.md, // 16px
    flexDirection: 'row',
  },
  iconContainer: {
    marginRight: SPACING.sm,
  },
  primaryButton: {
    backgroundColor: COLORS.primary, // Sky Blue
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.outlineVariant, // subtle border
  },
  disabledButton: {
    opacity: 0.5,
  },
  text: {
    ...TYPOGRAPHY.labelMd,
    textAlign: 'center',
  },
  primaryText: {
    color: COLORS.onPrimary,
  },
  secondaryText: {
    color: COLORS.onSurface,
  },
});
