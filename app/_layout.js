import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { 
  SpaceGrotesk_400Regular, 
  SpaceGrotesk_500Medium, 
  SpaceGrotesk_600SemiBold, 
  SpaceGrotesk_700Bold 
} from '@expo-google-fonts/space-grotesk';
import { 
  JetBrainsMono_500Medium 
} from '@expo-google-fonts/jetbrains-mono';
import { useEffect, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { AnimatedSplashScreen } from '@/components/ui';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';

SplashScreen.preventAutoHideAsync();

function RootLayoutNav({ appReady, setAppReady }) {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Wait until both the splash animation finishes and auth is done loading
    if (loading || !appReady) return;

    const inAuth = segments[0] === 'auth';
    const inSetup = segments[0] === 'setup';
    // Fully onboarded = personal username AND an approved team membership. This
    // must match (dashboard)/_layout exactly, or the two gates ping-pong forever.
    const onboarded = !!user?.username && !!user?.team && user.team.myStatus === 'approved';

    if (!user) {
      if (!inAuth) router.replace('/auth/login');
    } else if (!onboarded) {
      // Incomplete users belong on /setup — but never redirect while already
      // there (that would loop as they complete each step).
      if (!inSetup) router.replace('/setup');
    } else {
      // Onboarded: bounce off auth pages, but DON'T force-leave /setup so the
      // optional AI step (shown after the team is created) stays reachable.
      if (inAuth) router.replace('/(dashboard)');
    }
  }, [user, loading, segments, appReady]);

  return (
    <>
      <StatusBar style="light" />
      {!appReady && (
        <AnimatedSplashScreen onFinish={() => setAppReady(true)} />
      )}
      {appReady && (
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="auth" />
          <Stack.Screen name="setup" />
          <Stack.Screen name="(dashboard)" />
        </Stack>
      )}
    </>
  );
}

export default function RootLayout() {
  const [appReady, setAppReady] = useState(false);
  const [loaded, error] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    JetBrainsMono_500Medium,
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <RootLayoutNav appReady={appReady} setAppReady={setAppReady} />
      </AuthProvider>
    </ThemeProvider>
  );
}
