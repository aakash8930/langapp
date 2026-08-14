import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/components/AuthProvider';
import { useTheme } from '@/theme';

export default function AppLayout() {
  const theme = useTheme();
  const { status } = useAuth();

  if (status === 'unauthenticated') return <Redirect href="/welcome" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.paper },
      }}
    />
  );
}
