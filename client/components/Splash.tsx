import { Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { useEffect } from 'react';
import { useTheme } from '@/theme';

/**
 * Shown while fonts load and the stored session is checked. Deliberately not a
 * spinner: on a warm start this is visible for a few frames, and a spinner that
 * flashes for 80ms reads as a glitch.
 */
export function Splash() {
  const theme = useTheme();
  const pulse = useSharedValue(0.72);

  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1, { duration: 900 }), withTiming(0.72, { duration: 900 })), -1, true);
  }, [pulse]);

  const markStyle = useAnimatedStyle(() => ({ opacity: pulse.value, transform: [{ scale: 0.96 + pulse.value * 0.04 }] }));

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.paper }}>
      <Animated.View entering={FadeIn.duration(360)} style={[{ alignItems: 'center' }, markStyle]}>
        <Text style={{ fontFamily: theme.families.jaBold, fontSize: 58, color: theme.colors.ink, lineHeight: 70 }}>言</Text>
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(140).duration(420)}>
        <Text style={{ marginTop: theme.spacing.md, fontFamily: theme.families.ui, fontSize: theme.fontSize.title, color: theme.colors.inkSoft, letterSpacing: 2 }}>langapp</Text>
        <Text style={{ marginTop: theme.spacing.xs, textAlign: 'center', fontFamily: theme.families.ui, fontSize: theme.fontSize.caption, color: theme.colors.inkSoft }}>YOUR JAPANESE LEARNING SPACE</Text>
      </Animated.View>
    </View>
  );
}
