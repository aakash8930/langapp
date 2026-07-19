import { Text, View } from 'react-native';

import { useTheme } from '@/theme';

/**
 * Shown while fonts load and the stored session is checked. Deliberately not a
 * spinner: on a warm start this is visible for a few frames, and a spinner that
 * flashes for 80ms reads as a glitch.
 */
export function Splash() {
  const theme = useTheme();

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.paper,
      }}
    >
      <Text
        style={{
          fontFamily: theme.families.ui,
          fontSize: theme.fontSize.title,
          color: theme.colors.inkSoft,
          letterSpacing: 2,
        }}
      >
        langapp
      </Text>
    </View>
  );
}
