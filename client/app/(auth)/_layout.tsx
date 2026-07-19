import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/components/AuthProvider';
import { useTheme } from '@/theme';

export default function AuthLayout() {
  const theme = useTheme();
  const { status } = useAuth();

  if (status === 'authenticated') return <Redirect href="/" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.paper },
      }}
    />
  );
}
