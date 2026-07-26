import { Text, View } from 'react-native';

import type { Progress } from '@/api/progress';
import { useTheme } from '@/theme';

/**
 * Hearts and gems, as one quiet strip.
 *
 * ## Why pips rather than "3/5"
 *
 * A number tells you the count; five shapes tell you the *loss*. The empty pips
 * stay drawn as hollow outlines rather than disappearing, because the gap is the
 * whole mechanic — "two left" reads very differently from "●●○○○".
 *
 * ## The countdown
 *
 * `nextHeartAt` comes from the server as an instant, and this renders it as a
 * static "next in 12m" rather than a live ticking clock. Deliberate: a per-second
 * timer would re-render the home screen sixty times a minute for a number that
 * only matters to the nearest minute, and the house style has no animation
 * budget for it. It refreshes when the screen does, which is on every arrival.
 */
export function HeartsBar({ progress }: { progress: Progress }) {
  const theme = useTheme();
  const { hearts, gems } = progress;

  const waiting = hearts.current < hearts.max ? minutesUntil(hearts.nextHeartAt) : null;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.lg,
      }}
    >
      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}
        // One label for the group: a screen reader announcing five separate pips
        // is noise, and the count is the meaning.
        accessibilityRole="text"
        accessibilityLabel={
          hearts.current === hearts.max
            ? `Hearts full, ${hearts.max} of ${hearts.max}`
            : `${hearts.current} of ${hearts.max} hearts${
                waiting ? `, next in ${waiting} minutes` : ''
              }`
        }
      >
        {Array.from({ length: hearts.max }, (_, index) => (
          <Pip key={index} filled={index < hearts.current} />
        ))}
        {waiting !== null ? (
          <Text
            style={[
              {
                fontFamily: theme.families.ui,
                fontSize: theme.fontSize.caption,
                color: theme.colors.inkSoft,
                marginLeft: theme.spacing.xs,
              },
              theme.tabularFigures,
            ]}
          >
            +1 in {waiting}m
          </Text>
        ) : null}
      </View>

      <Text
        accessibilityLabel={`${gems} gems`}
        style={[
          {
            fontFamily: theme.families.ui,
            fontSize: theme.fontSize.caption,
            color: theme.colors.ai,
          },
          theme.tabularFigures,
        ]}
      >
        ◆ {gems}
      </Text>
    </View>
  );
}

/**
 * One heart. A filled vermilion disc or a hollow ring of the same size — so the
 * strip never reflows as hearts come and go, and the difference is fill rather
 * than presence.
 */
function Pip({ filled }: { filled: boolean }) {
  const theme = useTheme();
  const size = theme.spacing.md;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: theme.radius.pill,
        backgroundColor: filled ? theme.colors.shu : 'transparent',
        borderWidth: filled ? 0 : theme.hairlineWidth,
        borderColor: theme.colors.hairline,
      }}
    />
  );
}

/**
 * Whole minutes until `iso`, floored at 1 so a heart 20 seconds away never reads
 * "+1 in 0m" — which looks broken rather than imminent. Null when there is
 * nothing to wait for or the timestamp is unusable.
 */
function minutesUntil(iso: string | null): number | null {
  if (!iso) return null;

  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return null;

  const remainingMs = at - Date.now();
  if (remainingMs <= 0) return null;

  return Math.max(1, Math.round(remainingMs / 60_000));
}
