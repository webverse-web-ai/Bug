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

    const inAuthGroup = segments[0] === 'auth';

    if (!user && !inAuthGroup) {
      // Redirect to the login page
      router.replace('/auth/login');
    } else if (user) {
      const hasCompletedSetup = !!user.username;
      
      if (!hasCompletedSetup && segments[0] !== 'setup') {
        router.replace('/setup');
      } else if (hasCompletedSetup && (inAuthGroup || segments[0] === 'setup')) {
        router.replace('/(dashboard)');
      }
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
