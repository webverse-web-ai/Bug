import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAuth } from '../src/contexts/AuthContext';
import { CustomButton } from '../src/components/ui';
import { COLORS, TYPOGRAPHY, SPACING } from '../src/constants';

export default function Index() {
  const { user, logout } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to BUG</Text>
      <Text style={styles.subtitle}>
        Hello, {user?.fullName || 'User'}! You are successfully authenticated.
      </Text>
      
      <CustomButton 
        title="Log Out" 
        onPress={logout} 
        variant="secondary"
        style={styles.logoutButton}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  title: {
    ...TYPOGRAPHY.headlineLg,
    color: COLORS.primary,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    ...TYPOGRAPHY.bodyLg,
    color: COLORS.onSurface,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  logoutButton: {
    minWidth: 200,
  }
});
