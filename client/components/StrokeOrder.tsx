/*
 * React Native Animated values are intentionally mutable refs, and the fetch
 * effect resets visible state when its character key changes. The React DOM
 * compiler rules do not model either native pattern correctly.
 */
/* eslint-disable react-hooks/refs, react-hooks/set-state-in-effect */
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, Text, View, Linking } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { strokesUrlForChar } from '@/api/strokes';
import { useTheme } from '@/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * Dash length used to draw a stroke.
 *
 * The web normalises every path with `pathLength="1"`, which react-native-svg
 * does not support — so there is no way to ask a path how long it is here. A
 * constant comfortably longer than the longest stroke in a 109×109 box gives a
 * dash that always covers the whole stroke, at the cost of short strokes
 * finishing their draw before the timer ends.
 *
 * That trade is deliberate: the alternative is measuring path lengths, which
 * means parsing béziers somewhere. The visible symptom is a slight variation in
 * drawing speed between a long stroke and a short one, which is what a hand
 * does anyway.
 */
const DASH = 260;

const DRAW_MS = 420;
const GAP_MS = 90;

type Strokes = { char: string; viewBox: string; paths: string[] };

/**
 * How a character is written: the strokes, in order, each drawn from its start.
 *
 * Ported from the website's version, and the same reasoning applies — numbered
 * arrows on a static glyph have to be decoded before they teach anything, and a
 * printed character cannot show direction at all. Direction is half of what
 * stroke order means, which is why this animates rather than listing.
 *
 * The strokes are KanjiVG, CC BY-SA 3.0. Attribution is an obligation of that
 * licence, so the credit renders here, beside the strokes, rather than being
 * filed in a settings screen. See `NOTICE` at the repo root.
 */
export function StrokeOrder({ char, size = 128 }: { char: string; size?: number }) {
  const theme = useTheme();
  const [data, setData] = useState<Strokes | null>(null);
  const [failed, setFailed] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const progress = useRef<Animated.Value[]>([]).current;
  const [run, setRun] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setFailed(false);

    fetch(strokesUrlForChar(char))
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('none'))))
      .then((json: Strokes) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        // A character with no stroke data renders without a diagram. That is
        // the designed fallback — the character itself is already on screen
        // above this — not an error worth surfacing mid-lesson.
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [char]);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => setReduceMotion(false));
  }, []);

  useEffect(() => {
    if (!data) return;

    // One driver per stroke, rebuilt whenever the character or the replay
    // changes. Reduced motion starts them complete rather than animating
    // faster — the app's rule, and a half-drawn character left on screen would
    // be worse than no animation at all.
    progress.length = 0;
    for (let i = 0; i < data.paths.length; i += 1) {
      progress.push(new Animated.Value(reduceMotion ? 0 : DASH));
    }

    if (reduceMotion) return;

    const animation = Animated.stagger(
      DRAW_MS + GAP_MS,
      progress.map((value) =>
        Animated.timing(value, {
          toValue: 0,
          duration: DRAW_MS,
          // strokeDashoffset is an SVG prop, not a transform — the native
          // driver cannot carry it.
          useNativeDriver: false,
        }),
      ),
    );
    animation.start();
    return () => animation.stop();
  }, [data, reduceMotion, run, progress]);

  if (failed) return null;

  if (!data) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: theme.radius.sm,
          backgroundColor: theme.colors.hairline,
          opacity: 0.4,
        }}
      />
    );
  }

  return (
    <View style={{ alignItems: 'center', gap: theme.spacing.xs }}>
      <Svg
        width={size}
        height={size}
        viewBox={data.viewBox}
        accessibilityRole="image"
        accessibilityLabel={`How to write ${char}: ${data.paths.length} strokes`}
      >
        {/* The finished character underneath, faint, so a stroke draws into a
            shape rather than into empty space and the learner can see where it
            is heading before it arrives. */}
        {data.paths.map((d, index) => (
          <Path
            key={`ghost-${index}`}
            d={d}
            fill="none"
            stroke={theme.colors.hairline}
            strokeWidth={5.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {data.paths.map((d, index) => (
          <AnimatedPath
            key={`draw-${run}-${index}`}
            d={d}
            fill="none"
            stroke={theme.colors.shu}
            strokeWidth={5.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={`${DASH}`}
            strokeDashoffset={progress[index] ?? 0}
          />
        ))}
      </Svg>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <Pressable
          onPress={() => setRun((n) => n + 1)}
          accessibilityRole="button"
          accessibilityLabel={`Replay how to write ${char}`}
          hitSlop={theme.spacing.md}
        >
          <Text
            style={{
              fontFamily: theme.families.ui,
              fontSize: theme.fontSize.small,
              color: theme.colors.ai,
            }}
          >
            Replay
          </Text>
        </Pressable>
        <Text
          style={{
            fontFamily: theme.families.ui,
            fontSize: theme.fontSize.small,
            color: theme.colors.inkSoft,
          }}
        >
          {data.paths.length} {data.paths.length === 1 ? 'stroke' : 'strokes'}
        </Text>
      </View>

      {/* The licence credit, where the strokes are. */}
      <Pressable
        onPress={() => void Linking.openURL('https://kanjivg.tagaini.net/')}
        accessibilityRole="link"
        accessibilityLabel="Stroke order data from KanjiVG, licensed CC BY-SA 3.0"
      >
        <Text
          style={{
            fontFamily: theme.families.ui,
            fontSize: theme.fontSize.caption,
            color: theme.colors.inkSoft,
          }}
        >
          Strokes: KanjiVG, CC BY-SA 3.0
        </Text>
      </Pressable>
    </View>
  );
}
