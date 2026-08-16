import { Redirect, Stack, usePathname } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/components/AuthProvider';
import { useTheme } from '@/theme';

export default function AppLayout() {
  const theme = useTheme();
  const { status, user, refresh, logout } = useAuth();
  const pathname = usePathname();

  if (status === 'unauthenticated') return <Redirect href="/welcome" />;

  // A cold offline launch has tokens but no authoritative account state. Never
  // guess that verification/onboarding is complete and expose product routes.
  if (!user) {
    return (
      <View style={[styles.gate, { backgroundColor: theme.colors.paper }]}>
        <ActivityIndicator color={theme.colors.shu} />
        <Text style={[styles.title, { color: theme.colors.ink }]}>Account status unavailable</Text>
        <Text style={[styles.body, { color: theme.colors.inkSoft }]}>
          Connect to the internet so GENKŌ can confirm your email and setup status.
        </Text>
        <Pressable style={[styles.primary, { backgroundColor: theme.colors.ink }]} onPress={() => void refresh().catch(() => undefined)}>
          <Text style={[styles.primaryText, { color: theme.colors.paper }]}>Try again</Text>
        </Pressable>
        <Pressable onPress={() => void logout()}>
          <Text style={[styles.link, { color: theme.colors.shu }]}>Sign out</Text>
        </Pressable>
      </View>
    );
  }

  if (!user.emailVerified && pathname !== '/verify-email') {
    return <Redirect href="/verify-email" />;
  }

  if (user.emailVerified && !user.onboardingState.onboardingComplete && pathname !== '/onboarding') {
    return <Redirect href="/onboarding" />;
  }

  if (
    user.emailVerified &&
    user.onboardingState.onboardingComplete &&
    (pathname === '/verify-email' || pathname === '/onboarding')
  ) {
    return <Redirect href="/" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.paper },
      }}
    />
  );
}

const styles = StyleSheet.create({
  gate: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 },
  title: { fontFamily: 'ZenKakuGothicNew_700Bold', fontSize: 24, textAlign: 'center' },
  body: { fontFamily: 'ZenKakuGothicNew_400Regular', fontSize: 16, lineHeight: 24, textAlign: 'center' },
  primary: { borderRadius: 12, paddingHorizontal: 28, paddingVertical: 13, marginTop: 8 },
  primaryText: { fontFamily: 'ZenKakuGothicNew_700Bold', fontSize: 15 },
  link: { fontFamily: 'ZenKakuGothicNew_500Medium', fontSize: 15, padding: 8 },
});
