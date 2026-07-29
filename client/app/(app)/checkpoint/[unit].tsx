import { useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, BackHandler, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  answerCheckpoint,
  startCheckpoint,
  submitCheckpoint,
  type CheckpointQuestion,
  type CheckpointResult,
  type CheckpointSet,
} from '@/api/checkpoints';
import { Button } from '@/components/Button';
import { ErrorState } from '@/components/ErrorState';
import { FormError } from '@/components/FormError';
import { LessonSkeleton } from '@/components/LessonSkeleton';
import { OptionButton } from '@/components/OptionButton';
import { QuestionPrompt } from '@/components/QuestionPrompt';
import { SessionProgress } from '@/components/SessionProgress';
import { tapFeedback } from '@/lib/haptics';
import { unitLabel } from '@/lib/lessons';
import { useTheme } from '@/theme';

/**
 * Beyond this, elapsed time is not a measurement of anything — the phone was
 * locked, the app was backgrounded, the learner put it down. The server keeps
 * cumulative running means per item, so one sample from an abandoned session
 * sits in that item's average for a very long time. Omitting the field is
 * honest; absent means "no sample", not zero.
 *
 * This matters more on a phone than on the website, where a tab is usually
 * either in front of you or closed.
 */
const MAX_PLAUSIBLE_MS = 5 * 60 * 1000;

/**
 * The end-of-unit test.
 *
 * ## Why this is not the lesson screen with a flag
 *
 * They look alike and behave oppositely, and each difference is one a shared
 * screen would have to branch on:
 *
 *  - **No feedback panel.** A lesson shows the right answer the moment you get
 *    one wrong — correct for teaching, wrong for a test, because a later
 *    question can be about the same item. The server enforces it by sending
 *    `correctValue: ''`, so there is nothing to render even if this screen
 *    wanted to. The answers arrive at submit, in `missed`.
 *  - **No audio.** Not even on `vocab` prompts, where the lesson plays it
 *    freely because listening cannot reveal an English gloss. A test is
 *    stricter than `hasAudio`/`revealsAnswer`: hearing the word is help with
 *    recognising the written form. Relaxing that is a pedagogical call.
 *  - **No auto-advance and no hold-to-pause.** There is no verdict to read, so
 *    there is nothing to time — the screen moves when the learner answers.
 *  - **Answers are fire-and-forget.** Twenty questions must not feel like
 *    twenty round trips, so the screen advances and the POST settles behind
 *    it. A lesson has to wait, because the verdict *is* the response.
 *
 * ## Concurrent mutations
 *
 * Answers overlap by design, so per-call `useMutation` callbacks are exactly
 * the trap `client/CLAUDE.md` documents — the observer keeps one slot and a
 * second call detaches the first. These are plain async calls with the ledger
 * in a ref.
 */
export default function Checkpoint() {
  const { unit } = useLocalSearchParams<{ unit: string }>();
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<Phase>({ name: 'loading' });
  const [typedText, setTypedText] = useState('');
  const [busy, setBusy] = useState(false);

  /** When the current question went on screen, for `responseTimeMs`. */
  const shownAt = useRef(Date.now());

  /**
   * Answers still in flight. Submitting before they land would score the
   * attempt without them — an unanswered question counts as wrong, so a lost
   * race reads as a failure rather than a gap.
   */
  const pending = useRef(new Set<Promise<unknown>>());

  /** Answers whose POST failed outright, so the summary can say so. */
  const [lost, setLost] = useState(0);

  useEffect(() => {
    let cancelled = false;

    startCheckpoint(unit)
      .then((set) => {
        if (cancelled) return;
        shownAt.current = Date.now();
        setPhase(
          set.questions.length === 0
            ? { name: 'empty' }
            : { name: 'asking', set, index: 0 },
        );
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setPhase({ name: 'error', error });
      });

    return () => {
      cancelled = true;
    };
  }, [unit]);

  const leave = useCallback(() => {
    router.replace('/');
  }, [router]);

  /**
   * True while there is an attempt open with answers in it.
   *
   * Leaving does not discard them the way leaving a lesson does — the attempt
   * is server-side and resumes on the way back in — but it does leave a test
   * half-finished, and the copy says so rather than implying the work is lost.
   */
  const inProgress = phase.name === 'asking' && phase.index > 0;

  const requestExit = useCallback(() => {
    if (!inProgress) {
      leave();
      return;
    }

    Alert.alert(
      'Leave this test?',
      'Your answers so far are saved. Coming back picks up where you left off — the test stays open until you finish it.',
      [
        { text: 'Keep going', style: 'cancel' },
        { text: 'Leave', onPress: leave },
      ],
    );
  }, [inProgress, leave]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!inProgress) return false;
      requestExit();
      return true;
    });
    return () => subscription.remove();
  }, [inProgress, requestExit]);

  const finish = useCallback(
    async (set: CheckpointSet) => {
      setPhase({ name: 'submitting' });

      // Let the in-flight answers land. `allSettled`, not `all`: one failed
      // POST must not block the submit, since the attempt exists either way
      // and the learner is owed a score.
      await Promise.allSettled([...pending.current]);

      try {
        const result = await submitCheckpoint(set.unit, set.attempt);
        setPhase({ name: 'done', result });

        // XP, streak and the due count all move on a pass, and the home screen
        // reads them from /me/progress.
        void queryClient.invalidateQueries({ queryKey: ['progress'] });
        void queryClient.invalidateQueries({ queryKey: ['reviews', 'due'] });
      } catch (error) {
        setPhase({ name: 'error', error });
      }
    },
    [queryClient],
  );

  function answer(question: CheckpointQuestion, body: { optionId: string } | { text: string }) {
    if (phase.name !== 'asking' || busy) return;
    tapFeedback();

    const elapsed = Date.now() - shownAt.current;
    const request = answerCheckpoint(phase.set.unit, phase.set.attempt, question.exerciseId, {
      ...body,
      ...(elapsed <= MAX_PLAUSIBLE_MS ? { responseTimeMs: elapsed } : {}),
    }).catch(() => {
      setLost((n) => n + 1);
    });

    pending.current.add(request);
    void request.finally(() => pending.current.delete(request));

    setTypedText('');
    shownAt.current = Date.now();

    const nextIndex = phase.index + 1;
    if (nextIndex >= phase.set.questions.length) {
      setBusy(true);
      void finish(phase.set).finally(() => setBusy(false));
      return;
    }

    setPhase({ ...phase, index: nextIndex });
  }

  // No haptic on answering beyond the tap: `answerFeedback(correct)` would be a
  // verdict, and this screen deliberately does not give one until the end.

  const label = unitLabel(unit);

  return (
    <View
      style={{
        flex: 1,
        paddingTop: insets.top + theme.spacing.md,
        paddingBottom: insets.bottom + theme.spacing.xl,
      }}
    >
      <Stack.Screen options={{ gestureEnabled: !inProgress }} />

      {phase.name === 'loading' ? (
        <LessonSkeleton />
      ) : phase.name === 'error' ? (
        <Centered>
          <ErrorState error={phase.error} onDismiss={leave} />
        </Centered>
      ) : phase.name === 'empty' ? (
        <Centered>
          <FormError message="This unit has nothing to test yet. Try another one." />
          <Button label="Back to home" variant="secondary" onPress={leave} />
        </Centered>
      ) : phase.name === 'submitting' ? (
        <Centered>
          <Text
            style={{
              fontFamily: theme.families.ui,
              fontSize: theme.fontSize.body,
              color: theme.colors.inkSoft,
              textAlign: 'center',
            }}
          >
            Marking your test…
          </Text>
        </Centered>
      ) : phase.name === 'done' ? (
        <Summary result={phase.result} label={label} lost={lost} onDone={leave} />
      ) : (
        <Asking
          phase={phase}
          label={label}
          busy={busy}
          typedText={typedText}
          onChangeTyped={setTypedText}
          onAnswer={answer}
          onLeave={requestExit}
        />
      )}
    </View>
  );
}

type Phase =
  | { name: 'loading' }
  | { name: 'error'; error: unknown }
  | { name: 'empty' }
  | { name: 'asking'; set: CheckpointSet; index: number }
  | { name: 'submitting' }
  | { name: 'done'; result: CheckpointResult };

function Asking({
  phase,
  label,
  busy,
  typedText,
  onChangeTyped,
  onAnswer,
  onLeave,
}: {
  phase: { name: 'asking'; set: CheckpointSet; index: number };
  label: string;
  busy: boolean;
  typedText: string;
  onChangeTyped: (text: string) => void;
  onAnswer: (q: CheckpointQuestion, body: { optionId: string } | { text: string }) => void;
  onLeave: () => void;
}) {
  const theme = useTheme();
  const question = phase.set.questions[phase.index];
  const total = phase.set.questions.length;

  return (
    <>
      <View style={{ paddingHorizontal: theme.spacing.xl, gap: theme.spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <Button label="Leave" variant="secondary" onPress={onLeave} />
        </View>

        {/*
          A plain fill, no per-question pips.

          The lesson passes `outcomes` so its bar can show which questions were
          right — this screen has no idea, by design, because the server
          withholds every verdict until submit. Grey pips that never colour in
          would look broken; "how far through am I" is the only question this
          bar can honestly answer.
        */}
        <SessionProgress
          position={phase.index + 1}
          total={total}
          caption={`${label} — question ${phase.index + 1} of ${total}`}
        />

        <Text
          style={{
            fontFamily: theme.families.ui,
            fontSize: theme.fontSize.small,
            color: theme.colors.inkSoft,
          }}
        >
          One answer each — you can’t change it, and you’ll see how you did at the end.
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: theme.spacing.xl,
          gap: theme.spacing.xl,
        }}
      >
        <QuestionPrompt prompt={question.prompt} kind={question.promptKind} />

        <Text
          style={{
            fontFamily: theme.families.ui,
            fontSize: theme.fontSize.body,
            lineHeight: theme.lineHeight.body,
            color: theme.colors.inkSoft,
            textAlign: 'center',
          }}
        >
          {question.question}
        </Text>
      </ScrollView>

      <View style={{ paddingHorizontal: theme.spacing.xl, gap: theme.spacing.sm }}>
        {question.type === 'wordReading' ? (
          <TypedAnswer
            value={typedText}
            onChangeText={onChangeTyped}
            onSubmit={() => {
              const text = typedText.trim();
              if (text.length === 0) return;
              onAnswer(question, { text });
            }}
            disabled={busy}
          />
        ) : question.options && question.options.length > 0 ? (
          question.options.map((option) => (
            <OptionButton
              key={option.id}
              label={option.value}
              // Always `idle`: there is no pending or marked state to show,
              // because no verdict comes back. Tapping advances.
              state={busy ? 'muted' : 'idle'}
              onPress={() => onAnswer(question, { optionId: option.id })}
            />
          ))
        ) : (
          <FormError message="This question needs a newer version of the app to answer." />
        )}
      </View>
    </>
  );
}

function Summary({
  result,
  label,
  lost,
  onDone,
}: {
  result: CheckpointResult;
  label: string;
  lost: number;
  onDone: () => void;
}) {
  const theme = useTheme();
  const percent = Math.round(result.score * 100);

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: 'center',
        padding: theme.spacing.xl,
        gap: theme.spacing.xl,
      }}
    >
      <View style={{ gap: theme.spacing.sm }}>
        <Text
          style={{
            fontFamily: theme.families.ui,
            fontSize: theme.fontSize.heading,
            lineHeight: theme.lineHeight.heading,
            color: theme.colors.ink,
          }}
        >
          {result.passed ? 'Test passed' : 'Not passed yet'}
        </Text>
        <Text
          style={{
            fontFamily: theme.families.ui,
            fontSize: theme.fontSize.body,
            lineHeight: theme.lineHeight.body,
            color: theme.colors.inkSoft,
          }}
        >
          {label}
        </Text>
      </View>

      <View>
        <SummaryRow
          label="Score"
          value={`${percent}% — ${result.correctCount} of ${result.questionCount}`}
          emphasis
        />
        <SummaryRow label="Needed" value={`${Math.round(result.passMark * 100)}%`} />
        {result.xpAwarded > 0 ? (
          <SummaryRow label="XP earned" value={`+${result.xpAwarded}`} emphasis />
        ) : null}
        {result.scheduledForReview > 0 ? (
          <SummaryRow label="Added to review" value={`${result.scheduledForReview}`} />
        ) : null}
      </View>

      {/*
        The whole consequence of failing, said plainly. Nothing is locked and no
        progress is taken away — the missed items just come back sooner. A
        learner who thinks a failed test costs them something will avoid taking
        one, which defeats the point of having it.
      */}
      {result.scheduledForReview > 0 ? (
        <Text
          style={{
            fontFamily: theme.families.ui,
            fontSize: theme.fontSize.small,
            lineHeight: theme.lineHeight.small,
            color: theme.colors.inkSoft,
          }}
        >
          {result.scheduledForReview === 1 ? 'The item' : 'The items'} you missed{' '}
          {result.scheduledForReview === 1 ? 'is' : 'are'} waiting in your reviews. Nothing is
          locked — {result.passed ? 'this is just what to practise next.' : 'take the test again whenever you like.'}
        </Text>
      ) : null}

      {lost > 0 ? (
        <FormError
          message={`${lost} ${lost === 1 ? 'answer' : 'answers'} didn’t reach the server and ${
            lost === 1 ? 'was' : 'were'
          } marked wrong. That’s a connection problem, not your result — the test is worth retaking.`}
        />
      ) : null}

      {result.missed.length > 0 ? (
        <View style={{ gap: theme.spacing.sm }}>
          <Text
            style={{
              fontFamily: theme.families.ui,
              fontSize: theme.fontSize.caption,
              color: theme.colors.inkSoft,
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            What to remember
          </Text>
          {result.missed.map((miss) => (
            <View
              key={miss.itemId}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: theme.spacing.md,
                paddingVertical: theme.spacing.sm,
                borderBottomWidth: theme.hairlineWidth,
                borderBottomColor: theme.colors.hairline,
              }}
            >
              <Text
                style={{
                  fontFamily: theme.families.jaMedium,
                  fontSize: theme.fontSize.bodyLarge,
                  color: theme.colors.ink,
                  flexShrink: 1,
                }}
              >
                {miss.prompt}
              </Text>
              <Text
                style={{
                  fontFamily: theme.families.ui,
                  fontSize: theme.fontSize.small,
                  color: theme.colors.shu,
                  textAlign: 'right',
                  flexShrink: 1,
                }}
              >
                {miss.answered ? '' : 'not answered — '}
                {miss.correctValue}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <Button label="Back to home" onPress={onDone} />
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
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.md,
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
        style={[
          {
            fontFamily: theme.families.ui,
            fontSize: theme.fontSize.body,
            color: emphasis ? theme.colors.shu : theme.colors.ink,
          },
          theme.tabularFigures,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

/**
 * The typed-answer field.
 *
 * Not shared with the lesson's `WordReadingInput`: that one disables itself
 * around a verdict and clears on `advance()`. Here there is no verdict, and the
 * clearing happens in the answer handler. Threading a `showsVerdict` prop
 * through both would be more code than the duplication.
 */
function TypedAnswer({
  value,
  onChangeText,
  onSubmit,
  disabled,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  disabled: boolean;
}) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        editable={!disabled}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        textContentType="none"
        returnKeyType="send"
        onSubmitEditing={onSubmit}
        placeholder="Type the romaji"
        placeholderTextColor={theme.colors.inkSoft}
        accessibilityLabel="Type the romaji for this word"
        style={{
          fontFamily: theme.families.ui,
          fontSize: theme.fontSize.body,
          lineHeight: theme.lineHeight.body,
          color: theme.colors.ink,
          backgroundColor: theme.colors.surface,
          borderWidth: theme.hairlineWidth,
          borderColor: theme.colors.hairline,
          borderRadius: theme.radius.md,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.md,
          textTransform: 'none',
        }}
      />
      <Button label="Answer" onPress={onSubmit} disabled={disabled || value.trim().length === 0} />
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
