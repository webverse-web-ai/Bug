import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { CustomButton } from '@/components/ui';
import { COLORS, TYPOGRAPHY, SPACING } from '@/constants';

export default function DashboardIndex() {
  const { user, logout } = useAuth();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.subtitle}>Welcome back, {user?.fullName || 'User'}!</Text>

        <View style={styles.card}>
          <Text style={styles.text}>This is the protected dashboard area.</Text>
          <Text style={styles.text}>Your email: {user?.email}</Text>
        </View>

        <CustomButton
          title="Log Out"
          onPress={logout}
          style={styles.logoutButton}
          variant="outline"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    padding: SPACING.lg,
  },
  title: {
    ...TYPOGRAPHY.headlineLgMobile,
    color: COLORS.onSurface,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    ...TYPOGRAPHY.bodyLg,
    color: COLORS.onSurfaceVariant,
    marginBottom: SPACING.xl,
  },
  card: {
    backgroundColor: COLORS.surfaceContainerLow,
    padding: SPACING.lg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    marginBottom: SPACING.xl,
  },
  text: {
    ...TYPOGRAPHY.bodyMd,
    color: COLORS.onSurface,
    marginBottom: SPACING.sm,
  },
  logoutButton: {
    marginTop: 'auto',
    marginBottom: SPACING.xl,
  }
});
