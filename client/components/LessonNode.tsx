import { Pressable, Text, View } from 'react-native';

import type { LessonWithState } from '@/lib/lessons';
import { useTheme } from '@/theme';

/** Diameter of a node. The `next` node is drawn larger — see below. */
const SIZE = 56;
const SIZE_NEXT = 72;

/**
 * One lesson on the path: a circle, not a row.
 *
 * ## Why a circle and not the old list row
 *
 * The list this replaces was 58 rows of title-plus-subtitle, which is accurate
 * and unreadable — nothing in it says "you are here". A node has one job: carry
 * its state in its silhouette, so the path reads at a glance from four feet away
 * and the learner's eye lands on the next thing without reading a word.
 *
 * ## The four states, and what distinguishes them
 *
 * Deliberately **not** distinguished by colour alone — that fails for a
 * colourblind learner and in bright sun. Each state differs in *fill*, *border*
 * and *glyph* together:
 *
 * - `done` — solid vermilion, a check. Filled means spent.
 * - `next` — solid vermilion, larger, ringed. The only node on the screen at
 *   this size, which is what makes it the target.
 * - `open` — hollow with a vermilion border. Available, not urgent.
 * - `locked` — flat surface fill, hairline border, muted number. Legible on
 *   purpose: seeing what is coming is what makes a unit feel finite, which is the
 *   same reasoning the old `LessonRow` used for not greying locked rows out.
 *
 * No shadow and no gradient — the house style permits a 1px hairline and nothing
 * else, so depth here comes from size and fill rather than elevation.
 */
export type NodeState = 'done' | 'next' | 'open' | 'locked';

export function LessonNode({
  lesson,
  state,
  position,
  onPress,
}: {
  lesson: LessonWithState;
  state: NodeState;
  /** 1-based position within the unit, shown on nodes that have no icon. */
  position: number;
  onPress: (lesson: LessonWithState) => void;
}) {
  const theme = useTheme();

  const size = state === 'next' ? SIZE_NEXT : SIZE;
  const filled = state === 'done' || state === 'next';

  const label =
    state === 'locked'
      ? `${lesson.title}, locked. ${
          lesson.lockedBy ? `Complete “${lesson.lockedBy}” first.` : 'Finish the earlier lessons.'
        }`
      : state === 'done'
        ? `${lesson.title}, complete. Practise again.`
        : `${lesson.title}. ${lesson.itemCount} items.`;

  return (
    <View style={{ alignItems: 'center', gap: theme.spacing.xs }}>
      <Pressable
        onPress={() => onPress(lesson)}
        disabled={state === 'locked'}
        accessibilityRole="button"
        accessibilityState={{ disabled: state === 'locked' }}
        accessibilityLabel={label}
        // The circle is already 56pt, comfortably over the 44pt minimum; hitSlop
        // covers the gap between staggered nodes so a near-miss still lands.
        hitSlop={theme.spacing.sm}
        style={({ pressed }) => ({
          width: size,
          height: size,
          borderRadius: theme.radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: filled ? theme.colors.shu : theme.colors.surface,
          borderWidth: state === 'locked' ? theme.hairlineWidth : 2,
          borderColor:
            state === 'locked'
              ? theme.colors.hairline
              : state === 'open'
                ? theme.colors.shu
                : theme.colors.shu,
          opacity: pressed && state !== 'locked' ? 0.7 : 1,
        })}
      >
        <Text
          allowFontScaling={false}
          style={[
            {
              fontFamily: theme.families.ui,
              // The check and lock are glyphs, not icons from a font pack — one
              // less dependency, and they scale with the node.
              //
              // 🔒 is the one place colour enters that the palette does not
              // control: it renders in the platform emoji font, so it is gold
              // rather than ink. Kept because it is instantly legible and needs
              // no asset, but it is the first thing to replace if a real icon set
              // ever lands. ✓ is U+2713, a text glyph, so it takes `color`.
              fontSize: state === 'next' ? theme.fontSize.title : theme.fontSize.bodyLarge,
              color: filled ? theme.colors.paper : theme.colors.inkSoft,
            },
            theme.tabularFigures,
          ]}
        >
          {state === 'done' ? '✓' : state === 'locked' ? '🔒' : position}
        </Text>
      </Pressable>

      {state === 'next' ? (
        <Text
          style={{
            fontFamily: theme.families.ui,
            fontSize: theme.fontSize.caption,
            color: theme.colors.shu,
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}
        >
          Start
        </Text>
      ) : null}
    </View>
  );
}
