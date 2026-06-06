import { Stack } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * Auth stack layout — headerless screens for Login & Signup.
 */
export default function AuthLayout() {
  const { COLORS } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="reset-password" />
      <Stack.Screen name="verify" />
    </Stack>
  );
}
