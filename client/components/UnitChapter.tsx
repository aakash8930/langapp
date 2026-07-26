import { Pressable, Text, View } from 'react-native';

import { LessonNode, type NodeState } from '@/components/LessonNode';
import type { LessonWithState, UnitGroup } from '@/lib/lessons';
import { useTheme } from '@/theme';

/**
 * Horizontal offsets, in multiples of `spacing.xxl`, cycled down the path so it
 * winds instead of running straight.
 *
 * Four entries rather than three so the pattern does not read as a zigzag with an
 * obvious period — it returns to centre between each side, which is what makes it
 * look like a trail rather than a sawtooth.
 */
const SWAY = [0, 1, 0, -1];

/**
 * One unit, drawn as a stretch of path — and the piece that makes ten units and
 * 58 lessons navigable.
 *
 * Only the *current* unit is expanded. Finished units collapse to a single line,
 * and future units to a heading with a lock. That is the whole reason the path
 * beats the flat list it replaces: the old screen rendered all 58 rows at equal
 * weight, so it had no "you are here" and no sense of an ending. Here the screen
 * is mostly a short summary of where you have been, one expanded stretch of
 * where you are, and a legible run of what is coming.
 *
 * A done unit can still be reopened by tapping it, because practising a finished
 * lesson is a real thing to want — `/complete` pays a smaller practice award on a
 * repeat, so the server already supports it.
 */
export function UnitChapter({
  group,
  nextLessonId,
  expanded,
  onToggle,
  onPressLesson,
}: {
  group: UnitGroup;
  nextLessonId: string | undefined;
  expanded: boolean;
  onToggle: (unit: string) => void;
  onPressLesson: (lesson: LessonWithState) => void;
}) {
  const theme = useTheme();
  const total = group.lessons.length;

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <ChapterHeading
        group={group}
        total={total}
        expanded={expanded}
        onToggle={() => onToggle(group.unit)}
      />

      {expanded ? (
        <View style={{ gap: theme.spacing.md, paddingVertical: theme.spacing.sm }}>
          {group.lessons.map((lesson, index) => (
            <View
              key={lesson.id}
              style={{
                alignItems: 'center',
                // The sway. `transform` rather than margin so the row keeps its
                // full width and the node stays centred within it — margin would
                // shift the layout box and make the connectors misalign.
                transform: [{ translateX: SWAY[index % SWAY.length] * theme.spacing.xxl }],
              }}
            >
              <LessonNode
                lesson={lesson}
                state={nodeState(lesson, nextLessonId)}
                position={index + 1}
                onPress={onPressLesson}
              />
              {index < total - 1 ? <Connector /> : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/**
 * The link between two nodes.
 *
 * A plain 2pt bar, not a curve: drawing a true bezier between swayed nodes needs
 * react-native-svg, and adding a dependency to round off a decoration is a bad
 * trade in a repo whose rules say to ask before adding one. The sway plus a
 * straight link already reads as a path.
 */
function Connector() {
  const theme = useTheme();

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: 2,
        height: theme.spacing.lg,
        marginTop: theme.spacing.xs,
        backgroundColor: theme.colors.hairline,
        borderRadius: theme.radius.pill,
      }}
    />
  );
}

function ChapterHeading({
  group,
  total,
  expanded,
  onToggle,
}: {
  group: UnitGroup;
  total: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();
  const { status, label, completedCount, index } = group;

  const state =
    status === 'done'
      ? `All ${total} done`
      : status === 'locked'
        ? 'Locked'
        : `${completedCount} of ${total}`;

  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={`Chapter ${index + 1}, ${label}. ${state}. ${
        expanded ? 'Collapse' : 'Expand'
      }`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.md,
        borderBottomWidth: theme.hairlineWidth,
        borderBottomColor: theme.colors.hairline,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View style={{ flex: 1, gap: theme.spacing.xs }}>
        <Text
          style={{
            fontFamily: theme.families.ui,
            fontSize: theme.fontSize.caption,
            color: theme.colors.inkSoft,
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}
        >
          Chapter {index + 1}
        </Text>
        <Text
          style={{
            fontFamily: theme.families.ui,
            fontSize: theme.fontSize.bodyLarge,
            // A locked chapter stays readable rather than greyed to noise: what
            // is coming is part of what makes the course feel finite.
            color: status === 'locked' ? theme.colors.inkSoft : theme.colors.ink,
          }}
        >
          {label}
        </Text>
      </View>

      <Text
        style={[
          {
            fontFamily: theme.families.ui,
            fontSize: theme.fontSize.small,
            color: status === 'done' ? theme.colors.shu : theme.colors.inkSoft,
          },
          theme.tabularFigures,
        ]}
      >
        {status === 'done' ? '✓' : state}
      </Text>
    </Pressable>
  );
}

function nodeState(lesson: LessonWithState, nextLessonId: string | undefined): NodeState {
  if (lesson.id === nextLessonId) return 'next';
  if (lesson.completed) return 'done';
  if (lesson.locked) return 'locked';
  return 'open';
}
