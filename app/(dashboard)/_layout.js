import { Stack, Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import Loader from '@/components/ui/Loader';

export default function DashboardLayout() {
  const { user, loading } = useAuth();
  const { COLORS } = useTheme();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <Loader size={52} label="Loading Bug…" />
      </View>
    );
  }

  // Redirect to login if user is not authenticated
  if (!user) {
    return <Redirect href="/auth/login" />;
  }

  // Team workspace is mandatory: send unfinished users to setup until they have
  // a personal username AND an approved team membership.
  const onboarded = user.username && user.team && user.team.myStatus === 'approved';
  if (!onboarded) {
    return <Redirect href="/setup" />;
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
