import { Redirect, Stack, usePathname } from 'expo-router';

import { useAuth } from '@/components/AuthProvider';
import { useTheme } from '@/theme';

export default function AppLayout() {
  const theme = useTheme();
  const { status, user } = useAuth();
  const pathname = usePathname();

  if (status === 'unauthenticated') return <Redirect href="/welcome" />;

  // First-time onboarding (`onboarding.tsx`) gates the rest of this group
  // until `onboardingState.onboardingComplete` is true — every screen in
  // `(app)/`, not just the home route, so a deep link into a lesson mid-
  // onboarding still lands on the wizard first. `user` is null when the app
  // let a launch in without reaching the API (see AuthProvider); there is
  // nothing to gate on in that case, so this is skipped rather than blocking
  // someone out of the whole app because of a network condition.
  if (user && !user.onboardingState.onboardingComplete && pathname !== '/onboarding') {
    return <Redirect href="/onboarding" />;
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
