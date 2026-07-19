import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  fetchDueReviews,
  gradeReview,
  type DueCard,
  type GradeResult,
  type ReviewGrade,
} from '@/api/reviews';
import { Button } from '@/components/Button';
import { ErrorState } from '@/components/ErrorState';
import { FormError } from '@/components/FormError';
import { GradeScale } from '@/components/GradeScale';
import { CardBack, CardFront } from '@/components/ReviewCardFace';
import { ReviewSkeleton } from '@/components/ReviewSkeleton';
import { SessionProgress } from '@/components/SessionProgress';
import { gradeFeedback, tapFeedback } from '@/lib/haptics';
import { formatInterval, summarize } from '@/lib/reviews';
import { useTheme } from '@/theme';

/**
 * The review session — the screen this app exists to show.
 *
 * The design constraint that shapes everything below is that grading twenty
 * cards must not feel like twenty round trips. So the queue is local and the UI
 * never waits: a grade advances the card immediately and the POST catches up
 * behind it. The server is the authority on scheduling, but it is not on the
 * critical path of the next card appearing.
 *
 * What that costs is a rollback story, which is the `requeued` list below.
 */
export default function Review() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const reducedMotion = useReducedMotion();

  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  /** Confirmed by the server. A grade whose POST failed is not in here. */
  const [results, setResults] = useState<GradeResult[]>([]);
  /**
   * Cards whose grade failed to save, appended to the end of the session for
   * one more go. Tracked separately from the fetched batch so the query stays
   * the single source of what was originally due.
   */
  const [requeued, setRequeued] = useState<DueCard[]>([]);
  /** Ids already re-queued once — a second failure drops the card instead. */
  const [retried, setRetried] = useState<string[]>([]);
  const [lost, setLost] = useState(0);

  const due = useQuery({
    queryKey: ['reviews', 'due'],
    queryFn: fetchDueReviews,
    // The session works a fixed queue. A refetch mid-session would swap cards
    // out from under the person grading them.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  // The fetched batch plus anything that bounced. Derived, never stored, so
  // there is no second copy of the queue to keep in sync.
  const queue: DueCard[] = [...(due.data?.cards ?? []), ...requeued];
  const card = queue[index];
  const remaining = queue.length - index;
  const stats = summarize(results);

  /**
   * XP and the due count are re-read once, on the way out — not after each
   * grade. Twenty grades would otherwise mean twenty refetches of /me/progress
   * competing with the twenty POSTs that actually matter, on the one screen
   * whose whole design goal is that it never feels like it is waiting.
   */
  const refreshProgress = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['progress'] });
  }, [queryClient]);

  const restart = useCallback(() => {
    refreshProgress();
    void due.refetch().then(() => {
      setIndex(0);
      setRevealed(false);
      setResults([]);
      setRequeued([]);
      setRetried([]);
      setLost(0);
    });
  }, [due, refreshProgress]);

  const leave = useCallback(() => {
    refreshProgress();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [refreshProgress, router]);

  function reveal() {
    if (revealed) return;
    tapFeedback();
    setRevealed(true);
  }

  function submit(chosen: ReviewGrade) {
    if (!card || !revealed) return;

    gradeFeedback();

    // Whether this was the last card has to be decided now, while the queue is
    // still the one the learner was looking at. See the rollback note below.
    const wasLastCard = index === queue.length - 1;

    // Advance first, ask later. Everything below this point is bookkeeping that
    // happens while the next card is already on screen.
    setIndex((current) => current + 1);
    setRevealed(false);

    /**
     * Called directly rather than through `useMutation`, which is a deliberate
     * exception to the "server state lives in React Query" rule.
     *
     * `useMutation` keeps exactly one slot for the callbacks passed to
     * `mutate()`, and each new call overwrites it and detaches the observer
     * from the previous mutation. Grade a second card before the first POST
     * resolves — the normal case here, and guaranteed on a slow network — and
     * the first card's callbacks never fire. The POST still lands, so the
     * server stays right, but the client silently loses the result: XP and
     * accuracy under-report, and a failure never gets re-queued.
     *
     * Nothing is given up by dropping it. Every field `useMutation` exposes
     * describes a single latest mutation, and this screen deliberately reads
     * none of them — the session's state is the ledger below.
     */
    gradeReview(card.cardId, chosen).then(
      (result) => {
        setResults((current) => [...current, result]);
      },
      () => {
        // The card was never graded, so it should come back — but not always.
        //
        // Not if it has already bounced once: re-queueing unconditionally
        // loops forever against an API that is simply down, which for this
        // project is a normal Tuesday.
        //
        // And not if it was the last card, because by the time this failure
        // lands the summary is already on screen, and yanking it away to
        // re-ask a card is a worse answer than telling the truth in the
        // summary — which is what `lost` does.
        if (wasLastCard || retried.includes(card.cardId)) {
          setLost((current) => current + 1);
          return;
        }
        setRetried((current) => [...current, card.cardId]);
        setRequeued((current) => [...current, card]);
      },
    );
  }

  const failed = requeued.length + lost;
  const sessionOver = queue.length > 0 && index >= queue.length;

  return (
    <View
      style={{
        flex: 1,
        paddingTop: insets.top + theme.spacing.md,
        paddingBottom: insets.bottom + theme.spacing.xl,
      }}
    >
      {due.isPending ? (
        <ReviewSkeleton />
      ) : due.isError ? (
        <Centered>
          <ErrorState
            error={due.error}
            onRetry={() => void due.refetch()}
            onDismiss={leave}
          />
        </Centered>
      ) : queue.length === 0 ? (
        <Centered>
          <Text
            style={{
              fontFamily: theme.families.ui,
              fontSize: theme.fontSize.title,
              lineHeight: theme.lineHeight.title,
              color: theme.colors.ink,
            }}
          >
            Nothing is due yet
          </Text>
          <Text
            style={{
              fontFamily: theme.families.ui,
              fontSize: theme.fontSize.body,
              lineHeight: theme.lineHeight.body,
              color: theme.colors.inkSoft,
            }}
          >
            Cards arrive here after you finish a lesson, and come back on their own
            schedule once you have graded them.
          </Text>
          <Button label="Back to home" onPress={leave} />
        </Centered>
      ) : sessionOver ? (
        <Summary
          stats={stats}
          lost={lost}
          totalDue={due.data.totalDue}
          onMore={restart}
          onDone={leave}
          loadingMore={due.isRefetching}
        />
      ) : !card ? null : (
        <>
          <View style={{ paddingHorizontal: theme.spacing.xl, gap: theme.spacing.md }}>
            <SessionProgress
              position={index + 1}
              total={queue.length}
              caption={`${remaining} left`}
            />
            {/* Above the card, never below: a banner appearing must not shove
                the grade scale under a thumb that is already coming down. */}
            {failed > 0 ? (
              <FormError
                message={
                  requeued.length > 0
                    ? `${failed} ${failed === 1 ? 'grade' : 'grades'} didn’t save. Those cards are back at the end of this session.`
                    : `${failed} ${failed === 1 ? 'grade' : 'grades'} didn’t save. Grade them again next session.`
                }
              />
            ) : null}
          </View>

          <Pressable
            onPress={reveal}
            // The whole middle of the screen is the reveal target — at 6am the
            // thumb should not have to find anything.
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Answer shown' : 'Tap to reveal the answer'}
            accessibilityState={{ expanded: revealed }}
            style={{ flex: 1 }}
          >
            <ScrollView
              contentContainerStyle={{
                flexGrow: 1,
                justifyContent: 'center',
                alignItems: 'center',
                padding: theme.spacing.xl,
                gap: theme.spacing.xl,
              }}
            >
              <Animated.View
                // Keyed by position as well as card, so each card mounts and
                // plays its own entrance rather than the content swapping in
                // place — including a re-queued card, which carries the same id
                // it had the first time round.
                key={`${index}-${card.cardId}`}
                entering={reducedMotion ? undefined : FadeIn.duration(theme.duration.base)}
                style={{ alignItems: 'center', gap: theme.spacing.xl }}
              >
                <CardFront item={card.item} />

                {revealed ? (
                  <Animated.View
                    entering={reducedMotion ? undefined : FadeIn.duration(theme.duration.fast)}
                  >
                    <CardBack item={card.item} />
                  </Animated.View>
                ) : (
                  <Text
                    style={{
                      fontFamily: theme.families.ui,
                      fontSize: theme.fontSize.small,
                      color: theme.colors.inkSoft,
                    }}
                  >
                    Tap to reveal
                  </Text>
                )}
              </Animated.View>
            </ScrollView>
          </Pressable>

          <View style={{ paddingHorizontal: theme.spacing.xl }}>
            {/* Always mounted, dimmed until the answer is out. Swapping a
                control in here would move the tap targets at the exact moment
                the thumb is travelling toward them. */}
            <GradeScale onGrade={submit} disabled={!revealed} />
          </View>
        </>
      )}
    </View>
  );
}

function Summary({
  stats,
  lost,
  totalDue,
  onMore,
  onDone,
  loadingMore,
}: {
  stats: ReturnType<typeof summarize>;
  lost: number;
  totalDue: number;
  onMore: () => void;
  onDone: () => void;
  loadingMore: boolean;
}) {
  const theme = useTheme();

  // `totalDue` was true when the batch was fetched; anything graded `again`
  // has since come back. Offering another pass is honest either way — the
  // refetch is what actually decides whether there is more to do.
  const mayHaveMore = totalDue > stats.reviewed;

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: 'center',
        padding: theme.spacing.xl,
        gap: theme.spacing.xl,
      }}
    >
      <Text
        style={{
          fontFamily: theme.families.ui,
          fontSize: theme.fontSize.heading,
          lineHeight: theme.lineHeight.heading,
          color: theme.colors.ink,
        }}
      >
        Session complete
      </Text>

      <View>
        <SummaryRow label="Reviewed" value={`${stats.reviewed}`} />
        <SummaryRow
          label="Recalled"
          value={`${stats.recalled} of ${stats.reviewed} · ${stats.accuracyPercent}%`}
        />
        <SummaryRow label="XP earned" value={`+${stats.xpEarned}`} emphasis />
        <SummaryRow
          label="Next card due"
          value={
            stats.nextDueMinutes === null ? '—' : formatInterval(stats.nextDueMinutes)
          }
        />
      </View>

      {lost > 0 ? (
        <FormError
          message={`${lost} ${lost === 1 ? 'grade' : 'grades'} couldn’t be saved. Those cards stay due and will come back next session.`}
        />
      ) : null}

      <View style={{ gap: theme.spacing.md }}>
        {mayHaveMore ? (
          <Button label="Review more" onPress={onMore} loading={loadingMore} />
        ) : null}
        <Button
          label="Back to home"
          variant={mayHaveMore ? 'secondary' : 'primary'}
          onPress={onDone}
        />
      </View>
    </ScrollView>
  );
}

function SummaryRow({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.lg,
        paddingVertical: theme.spacing.lg,
        borderBottomWidth: theme.hairlineWidth,
        borderBottomColor: theme.colors.hairline,
      }}
    >
      <Text
        style={{
          fontFamily: theme.families.ui,
          fontSize: theme.fontSize.body,
          color: theme.colors.inkSoft,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: theme.families.ui,
          fontSize: theme.fontSize.body,
          color: emphasis ? theme.colors.shu : theme.colors.ink,
          ...theme.tabularFigures,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function Centered({ children }: { children: ReactNode }) {
  const theme = useTheme();

  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        padding: theme.spacing.xl,
        gap: theme.spacing.lg,
      }}
    >
      {children}
    </View>
  );
}
