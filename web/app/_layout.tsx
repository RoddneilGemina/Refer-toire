import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useState, useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { RepertoireProvider } from '@/context/RepertoireContext';
import { UpdateService } from '@/services/updateService';
import UpdateAvailableModal from '@/components/UpdateAvailableModal';
import { AppRelease } from '@/types/update';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <RepertoireProvider>
      <RootLayoutNav />
    </RepertoireProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const [availableRelease, setAvailableRelease] = useState<AppRelease | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState<boolean>(false);

  useEffect(() => {
    // Start background auto-scanner for updates on launch & periodic timer
    const unsubscribe = UpdateService.startAutoScanner((release) => {
      setAvailableRelease(release);
      setShowUpdateModal(true);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="login"
          options={{
            presentation: 'modal',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="score/[id]"
          options={{
            headerShown: false,
            orientation: 'all',
          }}
        />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>

      <UpdateAvailableModal
        visible={showUpdateModal}
        release={availableRelease}
        onDismiss={() => setShowUpdateModal(false)}
      />
    </ThemeProvider>
  );
}
