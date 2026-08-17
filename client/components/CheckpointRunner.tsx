import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, BackHandler, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  type CheckpointMiss,
  type CheckpointQuestion,
  type CheckpointResult,
  type CheckpointSet,
  answerCheckpoint,
  startCheckpoint,
  submitCheckpoint,
} from '@/api/checkpoints';
import {
  type CombinedTestMiss,
  type CombinedTestQuestion,
  type CombinedTestResult,
  type CombinedTestSet,
  answerCombinedTest,
  startCombinedTest,
  submitCombinedTest,
} from '@/api/combined-test';
import type { ExerciseOption, PromptKind } from '@/api/exercises';
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
 * Which test the runner is driving.
 *
 * `perUnit` is the existing end-of-unit test; `combined` is the new
 * across-units one. The screens that wrap this component set the value;
 * the runner picks the matching API based on it.
 */
export type CheckpointRunnerSource =
  | { kind: 'perUnit'; unit: string }
  | { kind: 'combined' };

/**
 * A question the runner renders. The two server shapes
 * (`CheckpointQuestion` from the per-unit route and
 * `CombinedTestQuestion` from the combined-test route) are structurally
 * identical, so a single union type covers both.
 */
type RunnerQuestion = {
  exerciseId: string;
  itemId: string;
  type: string;
  prompt: string;
  promptKind: PromptKind;
  question: string;
  options?: ExerciseOption[];
};

type RunnerSet =
  | { kind: 'perUnit'; set: CheckpointSet }
  | { kind: 'combined'; set: CombinedTestSet };

type RunnerResult =
  | { kind: 'perUnit'; result: CheckpointResult }
  | { kind: 'combined'; result: CombinedTestResult };

/**
 * The shared body of the per-unit and combined-test screens.
 *
 * ## Why this is one component with a `source` prop rather than two screens
 *
 * The two screens look the same because the *tests* look the same: same
 * one-shot answer rule, same no-feedback-mid-test policy, same missed-at-
 * submit summary. Each difference (URL shape, result label, XP narrative)
 * is a single conditional keyed on `source.kind`, not a parallel copy of
 * 600 lines.
 *
 * ## The "no feedback" rule applies to both
 *
 * The original screen's class comment applies here unchanged: a test
 * withholds per-question verdicts and only releases the answer key at
 * submit, because a later question can be about the same item. The server
 * enforces it (sends `correctValue: ''`); the runner respects it (no
 * "right!" / "wrong!" panel).
 *
 * ## Concurrent mutations
 *
 * Same as the per-unit screen: answers are plain async calls with the
 * ledger in a ref, because per-call `useMutation` callbacks detach from
 * earlier calls and lose their result. Submit `allSettled`s the in-flight
 * ones — an unanswered question counts as wrong.
 */
export function CheckpointRunner({
  source,
  onDone,
}: {
  source: CheckpointRunnerSource;
  onDone: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<Phase>({ name: 'loading' });
  const [typedText, setTypedText] = useState('');
  const [busy, setBusy] = useState(false);

  /** When the current question went on screen, for `responseTimeMs`. */
  const shownAt = useRef(Date.now());

  /**
   * Answers still in flight. Submitting before they land would score the
   * attempt without them — an unanswered question counts as wrong, so a
   * lost race reads as a failure rather than a gap.
   */
  const pending = useRef(new Set<Promise<unknown>>());

  /** Answers whose POST failed outright, so the summary can say so. */
  const [lost, setLost] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const promise =
      source.kind === 'perUnit'
        ? startCheckpoint(source.unit).then((set) => ({ kind: 'perUnit' as const, set }))
        : startCombinedTest().then((set) => ({ kind: 'combined' as const, set }));

    promise
      .then((loaded) => {
        if (cancelled) return;
        shownAt.current = Date.now();
        setPhase(
          loaded.set.questions.length === 0
            ? { name: 'empty' }
            : { name: 'asking', source: loaded, index: 0 },
        );
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setPhase({ name: 'error', error });
      });

    return () => {
      cancelled = true;
    };
  }, [source.kind, source.kind === 'perUnit' ? source.unit : null]);

  const inProgress = phase.name === 'asking' && phase.index > 0;

  const requestExit = useCallback(() => {
    if (!inProgress) {
      onDone();
      return;
    }

    Alert.alert(
      'Leave this test?',
      'Your answers so far are saved. Coming back picks up where you left off — the test stays open until you finish it.',
      [
        { text: 'Keep going', style: 'cancel' },
        { text: 'Leave', onPress: onDone },
      ],
    );
  }, [inProgress, onDone]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!inProgress) return false;
      requestExit();
      return true;
    });
    return () => subscription.remove();
  }, [inProgress, requestExit]);

  const finish = useCallback(
    async (loaded: RunnerSet) => {
      setPhase({ name: 'submitting' });

      // Let the in-flight answers land. `allSettled`, not `all`: one failed
      // POST must not block the submit, since the attempt exists either way
      // and the learner is owed a score.
      await Promise.allSettled([...pending.current]);

      try {
        const result =
          loaded.kind === 'perUnit'
            ? { kind: 'perUnit' as const, result: await submitCheckpoint(loaded.set.unit, loaded.set.attempt) }
            : { kind: 'combined' as const, result: await submitCombinedTest(loaded.set.attempt) };

        setPhase({ name: 'done', result });

        // XP, streak and the due count all move on a pass, and the home screen
        // reads them from /me/progress.
        void queryClient.invalidateQueries({ queryKey: ['progress'] });
      } catch (error) {
        setPhase({ name: 'error', error });
      }
    },
    [queryClient],
  );

  function answer(question: RunnerQuestion, body: { optionId: string } | { text: string }) {
    if (phase.name !== 'asking' || busy) return;
    tapFeedback();

    const elapsed = Date.now() - shownAt.current;
    const responseTimeMs = elapsed <= MAX_PLAUSIBLE_MS ? { responseTimeMs: elapsed } : {};

    const request =
      phase.source.kind === 'perUnit'
        ? answerCheckpoint(phase.source.set.unit, phase.source.set.attempt, question.exerciseId, {
            ...body,
            ...responseTimeMs,
          })
        : answerCombinedTest(phase.source.set.attempt, question.exerciseId, {
            ...body,
            ...responseTimeMs,
          });

    const tracked = request.catch(() => {
      setLost((n) => n + 1);
    });

    pending.current.add(tracked);
    void tracked.finally(() => pending.current.delete(tracked));

    setTypedText('');
    shownAt.current = Date.now();

    const nextIndex = phase.index + 1;
    if (nextIndex >= phase.source.set.questions.length) {
      setBusy(true);
      void finish(phase.source).finally(() => setBusy(false));
      return;
    }

    setPhase({ ...phase, index: nextIndex });
  }

  const isCombined = source.kind === 'combined';
  const headingLabel = isCombined ? 'Combined test' : 'Unit test';

  return (
    <View
      style={{
        flex: 1,
        paddingTop: insets.top + theme.spacing.md,
        paddingBottom: insets.bottom + theme.spacing.xl,
      }}
    >
      {phase.name === 'loading' ? (
        <LessonSkeleton />
      ) : phase.name === 'error' ? (
        <Centered>
          <ErrorState error={phase.error} onDismiss={onDone} />
        </Centered>
      ) : phase.name === 'empty' ? (
        <Centered>
          <FormError message="There is nothing to test in this set yet." />
          <Button label="Back to home" variant="secondary" onPress={onDone} />
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
        <Summary result={phase.result} headingLabel={headingLabel} lost={lost} onDone={onDone} />
      ) : (
        <Asking
          phase={phase}
          headingLabel={headingLabel}
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
  | { name: 'asking'; source: RunnerSet; index: number }
  | { name: 'submitting' }
  | { name: 'done'; result: RunnerResult };

function Asking({
  phase,
  headingLabel,
  busy,
  typedText,
  onChangeTyped,
  onAnswer,
  onLeave,
}: {
  phase: { name: 'asking'; source: RunnerSet; index: number };
  headingLabel: string;
  busy: boolean;
  typedText: string;
  onChangeTyped: (text: string) => void;
  onAnswer: (q: RunnerQuestion, body: { optionId: string } | { text: string }) => void;
  onLeave: () => void;
}) {
  const theme = useTheme();
  const question = phase.source.set.questions[phase.index];
  const total = phase.source.set.questions.length;
  const caption =
    phase.source.kind === 'combined'
      ? `${headingLabel} — question ${phase.index + 1} of ${total}`
      : `${headingLabel} — question ${phase.index + 1} of ${total}`;

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
        <SessionProgress position={phase.index + 1} total={total} caption={caption} />

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
  headingLabel,
  lost,
  onDone,
}: {
  result: RunnerResult;
  headingLabel: string;
  lost: number;
  onDone: () => void;
}) {
  const theme = useTheme();

  // Both shapes carry `score`, `passed`, `xpAwarded`, `missed`. The per-unit
  // shape carries `unit`; the combined shape carries `unitSlugs`. Render
  // whichever one applies and ignore the rest.
  const percent = Math.round(result.result.score * 100);
  const missed = result.result.missed;

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
          {result.result.passed ? 'Test passed' : 'Not passed yet'}
        </Text>
        <Text
          style={{
            fontFamily: theme.families.ui,
            fontSize: theme.fontSize.body,
            lineHeight: theme.lineHeight.body,
            color: theme.colors.inkSoft,
          }}
        >
          {headingLabel}
        </Text>
        {result.kind === 'combined' ? (
          <Text
            style={{
              fontFamily: theme.families.ui,
              fontSize: theme.fontSize.small,
              lineHeight: theme.lineHeight.small,
              color: theme.colors.inkSoft,
            }}
          >
            {result.result.unitSlugs
              .map((slug) => labelFor(slug))
              .join(' · ')}
          </Text>
        ) : null}
      </View>

      <View>
        <SummaryRow
          label="Score"
          value={`${percent}% — ${result.result.correctCount} of ${result.result.questionCount}`}
          emphasis
        />
        <SummaryRow
          label="Needed"
          value={`${Math.round(result.result.passMark * 100)}%`}
        />
        {result.kind === 'combined' ? (
          <SummaryRow label="Units tested" value={`${result.result.unitSlugs.length}`} />
        ) : null}
        {result.result.xpAwarded > 0 ? (
          <SummaryRow label="XP earned" value={`+${result.result.xpAwarded}`} emphasis />
        ) : null}
      </View>

      {lost > 0 ? (
        <FormError
          message={`${lost} ${lost === 1 ? 'answer' : 'answers'} didn’t reach the server and ${
            lost === 1 ? 'was' : 'were'
          } marked wrong. That’s a connection problem, not your result — the test is worth retaking.`}
        />
      ) : null}

      {missed.length > 0 ? (
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
          {missed.map((miss: CheckpointMiss | CombinedTestMiss) => (
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

/**
 * Map a finished-unit slug to a friendly label for the summary. Falls back to
 * the slug so a future unit the seed grows before this map knows about
 * does not crash the screen.
 */
function labelFor(slug: string): string {
  return unitLabel(slug);
}