import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';

// A whisper-quiet ambient wash behind the app — two large, very faint radial
// glows (primary + tertiary tinted) for a clean, premium feel. Web only; native
// keeps the flat themed background. Sits behind all content, never interactive.
export default function AmbientBackground({ COLORS }) {
  if (Platform.OS !== 'web') return null;
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundImage: [
            `radial-gradient(1100px circle at 6% -12%, ${COLORS.primary}12, transparent 55%)`,
            `radial-gradient(900px circle at 104% -6%, ${COLORS.tertiary}0d, transparent 50%)`,
          ].join(', '),
        },
      ]}
    />
  );
}
