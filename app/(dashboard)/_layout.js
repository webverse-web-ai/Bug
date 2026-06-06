import { Stack, Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { View, ActivityIndicator } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

export default function DashboardLayout() {
  const { user, loading } = useAuth();
  const { COLORS } = useTheme();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // Redirect to login if user is not authenticated
  if (!user) {
    return <Redirect href="/auth/login" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.background }
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Dashboard' }} />
    </Stack>
  );
}
