import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING } from '@/constants';

/**
 * Horizontal divider with centered text label (e.g. "OR").
 */
const Divider = ({ text = 'OR' }) => {
  return (
    <View style={styles.container}>
      <View style={styles.line} />
      <Text style={styles.text}>{text}</Text>
      <View style={styles.line} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.xl,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.outlineVariant,
  },
  text: {
    paddingHorizontal: SPACING.lg,
    ...TYPOGRAPHY.labelSm,
    color: COLORS.onSurfaceVariant,
    textTransform: 'uppercase',
  },
});

export default Divider;
