import { Pressable, Text } from 'react-native';

import { useTheme } from '@/theme';

export function ExploreLink({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Explore LangApp" hitSlop={theme.spacing.md} style={({ pressed }) => ({ opacity: pressed ? .6 : 1 })}>
    <Text style={{ fontFamily: theme.families.ui, fontSize: theme.fontSize.body, color: theme.colors.ai }}>Explore</Text>
  </Pressable>;
}
