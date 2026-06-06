import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { TYPOGRAPHY, ROUNDED, SPACING } from '@/constants';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * CustomInput component following the Cognitive Architecture design system.
 */
export const CustomInput = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType = 'default',
  error,
  isPassword = false,
  rightIcon,
  ...props
}) => {
  const { COLORS } = useTheme();
  const styles = getStyles(COLORS);
  
  const [isFocused, setIsFocused] = useState(false);
  const [isSecure, setIsSecure] = useState(isPassword);

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      
      <View style={[
        styles.inputContainer,
        isFocused && styles.inputContainerFocused,
        error ? styles.inputContainerError : null,
      ]}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.onSurfaceVariant}
          secureTextEntry={isSecure}
          keyboardType={keyboardType}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
        
        {isPassword ? (
          <TouchableOpacity 
            style={styles.rightIconContainer} 
            onPress={() => setIsSecure(!isSecure)}
          >
            <MaterialCommunityIcons 
              name={isSecure ? "eye-outline" : "eye-off-outline"} 
              size={20} 
              color={COLORS.onSurfaceVariant} 
            />
          </TouchableOpacity>
        ) : rightIcon ? (
          <View style={styles.rightIconContainer}>
            {rightIcon}
          </View>
        ) : null}
      </View>
      
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

const getStyles = (COLORS) => StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
  },
  label: {
    ...TYPOGRAPHY.labelMd,
    color: COLORS.onSurface,
    marginBottom: SPACING.xs,
  },
  inputContainer: {
    height: 48,
    borderRadius: ROUNDED.default, // 8px
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    backgroundColor: COLORS.surfaceContainerLowest,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
  },
  inputContainerFocused: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surfaceContainerLow,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  inputContainerError: {
    borderColor: COLORS.error,
  },
  input: {
    ...TYPOGRAPHY.bodyMd,
    color: COLORS.onSurface,
    flex: 1,
    height: '100%',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  },
  rightIconContainer: {
    marginLeft: SPACING.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    ...TYPOGRAPHY.labelSm,
    color: COLORS.error,
    marginTop: SPACING.xs,
  },
});
