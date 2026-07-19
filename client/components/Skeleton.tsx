import { useEffect } from 'react';
import { View, type DimensionValue } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';

/**
 * A block standing in for content that has not arrived.
 *
 * Preferred over a spinner because it says something a spinner cannot: how much
 * is coming and roughly what shape it is. The screen does not jump when the
 * data lands, which on the home screen is the difference between arriving
 * somewhere and watching something assemble itself.
 *
 * The pulse is a slow opacity fade — no shimmer sweep, which would be a
 * gradient, and no movement. Under reduced motion it holds still entirely,
 * rather than merely pulsing faster.
 */
export function Skeleton({
  width = '100%',
  height,
  radius,
}: {
  width?: DimensionValue;
  height: number;
  radius?: number;
}) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (reducedMotion) return;
    // Held at the dim end as long as it is at the bright end, so the rhythm
    // reads as breathing rather than blinking.
    pulse.value = withRepeat(
      withTiming(0.45, { duration: theme.duration.slow * 2 }),
      -1,
      true,
    );
  }, [pulse, reducedMotion, theme.duration.slow]);

  const animated = useAnimatedStyle(() => ({ opacity: pulse.value }));

  const style = {
    width,
    height,
    borderRadius: radius ?? theme.radius.sm,
    backgroundColor: theme.colors.hairline,
  } as const;

  // A static View under reduced motion — Animated.View with a frozen shared
  // value would still run a worklet on every frame for no visible reason.
  if (reducedMotion) return <View style={style} />;

  return <Animated.View style={[style, animated]} />;
}

/**
 * Wraps a screen's skeleton composition. Marks the whole group as one busy
 * element so a screen reader announces "loading" once, instead of walking a
 * stack of anonymous blocks.
 */
export function SkeletonGroup({
  label,
  fill,
  children,
}: {
  label: string;
  /** Expand to the parent's height, for a skeleton that stands in for a whole screen. */
  fill?: boolean;
  children: React.ReactNode;
}) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      style={{ gap: theme.spacing.lg, ...(fill ? { flex: 1 } : {}) }}
    >
      {children}
    </View>
  );
}
