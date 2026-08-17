import {
  useFonts,
  ZenKakuGothicNew_300Light,
  ZenKakuGothicNew_400Regular,
  ZenKakuGothicNew_500Medium,
  ZenKakuGothicNew_700Bold,
} from '@expo-google-fonts/zen-kaku-gothic-new';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, View, type AppStateStatus } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/components/AuthProvider';
import { Splash } from '@/components/Splash';
import { isOffline } from '@/lib/errors';
import { ThemeProvider, useTheme } from '@/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Retry transient server failures twice. Network-unreachable errors stop
      // immediately because each attempt can consume the full request timeout;
      // the visible error state already offers an explicit retry action.
      retry: (failureCount, error) => !isOffline(error) && failureCount < 2,
      staleTime: 30_000,
    },
  },
});

export default function RootLayout() {
  const theme = useTheme();

  // React Query's focus tracking is built for the web's window events, which
  // never fire here. Without this, coming back from the background serves
  // whatever was on screen when the phone was locked.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      focusManager.setFocused(state === 'active');
    });
    return () => subscription.remove();
  }, []);

  const [fontsLoaded, fontError] = useFonts({
    ZenKakuGothicNew_300Light,
    ZenKakuGothicNew_400Regular,
    ZenKakuGothicNew_500Medium,
    ZenKakuGothicNew_700Bold,
  });

  // Hold on the paper ground rather than flashing unstyled Latin fallback text
  // and then reflowing once Zen Kaku arrives. If the font fails outright we
  // render anyway — a missing face is better than a permanently blank app.
  if (!fontsLoaded && !fontError) {
    return <View style={{ flex: 1, backgroundColor: theme.colors.paper }} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {/* Inside AuthProvider, because the preference is a field on the user. */}
        <ThemedApp />
      </AuthProvider>
    </QueryClientProvider>
  );
}

/**
 * Resolves the user's theme preference before anything themed renders.
 *
 * Defaults to `system` while signed out or still loading, which is what the app
 * did unconditionally before the setting existed — so the login screen and the
 * splash keep following the OS.
 */
function ThemedApp() {
  const { user } = useAuth();

  return (
    <ThemeProvider preference={user?.settings.theme ?? 'system'}>
      <SafeAreaProvider>
        <ThemedStatusBar />
        <RootNavigator />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

function ThemedStatusBar() {
  const theme = useTheme();
  return <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />;
}

function RootNavigator() {
  const theme = useTheme();
  const { status } = useAuth();

  // Gate here so the route groups below never have to reason about 'loading' —
  // each one only ever sees a settled session.
  if (status === 'loading') return <Splash />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.paper },
      }}
    />
  );
}
