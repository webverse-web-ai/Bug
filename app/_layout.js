import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { 
  Inter_400Regular, 
  Inter_600SemiBold, 
  Inter_700Bold 
} from '@expo-google-fonts/inter';
import { 
  JetBrainsMono_500Medium 
} from '@expo-google-fonts/jetbrains-mono';
import { useEffect, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { AnimatedSplashScreen } from '../src/components/ui';
import { AuthProvider, useAuth } from '../src/contexts/AuthContext';

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
    } else if (user && inAuthGroup) {
      // Redirect away from the auth pages
      router.replace('/');
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
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
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
    <AuthProvider>
      <RootLayoutNav appReady={appReady} setAppReady={setAppReady} />
    </AuthProvider>
  );
}
