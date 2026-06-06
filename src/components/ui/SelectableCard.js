import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { TYPOGRAPHY, SPACING, ROUNDED } from '@/constants';
import { useTheme } from '@/contexts/ThemeContext';

export const SelectableCard = ({
  icon,
  title,
  description,
  isSelected,
  onPress,
  style,
}) => {
  const { COLORS } = useTheme();
  const styles = getStyles(COLORS);
  
  return (
    <TouchableOpacity
      style={[
        styles.card,
        isSelected && styles.cardSelected,
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.iconContainer}>
        {icon}
      </View>
      <View style={styles.textContainer}>
        <Text style={[styles.title, isSelected && styles.titleSelected]}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
    </TouchableOpacity>
  );
};

const getStyles = (COLORS) => StyleSheet.create({
  card: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: ROUNDED.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  cardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surfaceContainer,
  },
  iconContainer: {
    backgroundColor: COLORS.surfaceContainerHigh,
    width: 40,
    height: 40,
    borderRadius: ROUNDED.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  textContainer: {
    gap: 4,
  },
  title: {
    ...TYPOGRAPHY.labelMd,
    color: COLORS.onSurface,
  },
  titleSelected: {
    color: COLORS.primary,
  },
  description: {
    ...TYPOGRAPHY.bodySm,
    color: COLORS.onSurfaceVariant,
  },
});
