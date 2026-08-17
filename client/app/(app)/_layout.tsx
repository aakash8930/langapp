import { Redirect, Tabs, usePathname } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ColorValue } from 'react-native';

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

  const primary = ['/', '/learn', '/practice', '/profile'].includes(pathname);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.colors.paper },
        tabBarActiveTintColor: theme.colors.shu,
        tabBarInactiveTintColor: theme.colors.inkSoft,
        tabBarStyle: primary
          ? {
              backgroundColor: theme.colors.surface,
              borderTopColor: theme.colors.hairline,
              borderTopWidth: theme.hairlineWidth,
              height: 64,
              paddingTop: 6,
              paddingBottom: 8,
            }
          : { display: 'none' },
        tabBarLabelStyle: {
          fontFamily: theme.families.ui,
          fontSize: 14,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: ({ color }) => <TabGlyph glyph="今" color={color} /> }} />
      <Tabs.Screen name="learn" options={{ title: 'Learn', tabBarIcon: ({ color }) => <TabGlyph glyph="学" color={color} /> }} />
      <Tabs.Screen name="practice" options={{ title: 'Practice', tabBarIcon: ({ color }) => <TabGlyph glyph="練" color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => <TabGlyph glyph="人" color={color} /> }} />
      {[
        'chat', 'combined-test', 'explore', 'friends', 'leaderboard', 'notifications',
        'onboarding', 'settings', 'verify-email', 'checkpoint/[unit]', 'dm/[userId]',
        'lesson/[id]', 'study/[id]',
      ].map((name) => <Tabs.Screen key={name} name={name} options={{ href: null }} />)}
    </Tabs>
  );
}

function TabGlyph({ glyph, color }: { glyph: string; color: ColorValue }) {
  const theme = useTheme();
  return <Text style={{ fontFamily: theme.families.ja, fontSize: 18, color }}>{glyph}</Text>;
}

const styles = StyleSheet.create({
  gate: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 },
  title: { fontFamily: 'ZenKakuGothicNew_700Bold', fontSize: 24, textAlign: 'center' },
  body: { fontFamily: 'ZenKakuGothicNew_400Regular', fontSize: 16, lineHeight: 24, textAlign: 'center' },
  primary: { borderRadius: 12, paddingHorizontal: 28, paddingVertical: 13, marginTop: 8 },
  primaryText: { fontFamily: 'ZenKakuGothicNew_700Bold', fontSize: 15 },
  link: { fontFamily: 'ZenKakuGothicNew_500Medium', fontSize: 15, padding: 8 },
});
