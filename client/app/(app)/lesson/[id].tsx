import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Alert, BackHandler, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  answerExercise,
  completeLesson,
  fetchExercises,
  type AnswerResult,
  type CompleteLessonResult,
  type PromptKind,
  type Question,
} from '@/api/exercises';
import { hasAudio, revealsAnswer } from '@/api/audio';
import { fetchLessons } from '@/api/lessons';
import { fetchProgress } from '@/api/progress';
import { Button } from '@/components/Button';
import { ErrorState } from '@/components/ErrorState';
import { FormError } from '@/components/FormError';
import { LessonSkeleton } from '@/components/LessonSkeleton';
import { QuestionPrompt } from '@/components/QuestionPrompt';
import { OptionButton, type OptionState } from '@/components/OptionButton';
import { SessionProgress } from '@/components/SessionProgress';
import { SpeakButton } from '@/components/SpeakButton';
import { errorText } from '@/lib/errors';
import { newAttempt } from '@/lib/exercises';
import { groupByUnit, lessonAfter, withLockState } from '@/lib/lessons';
import { answerFeedback, tapFeedback } from '@/lib/haptics';
import { useTheme } from '@/theme';

/**
 * How long feedback stays before the screen moves itself along. Matches the
 * website — same rule, same reasoning: a right answer only needs to register,
 * while a wrong one has to be read, and for grammar that is a whole sentence.
 * Both were cut after the first pass read as sluggish.
 */
const CORRECT_MS = 400;
const WRONG_MS = 2400;

/** How long the summary sits before it carries on by itself. */
const NEXT_MS = 4200;

/**
 * What happens once this lesson is finished cleanly.
 *
 * One rule, and it deliberately does not branch on first-completion vs
 * practice: look at the next lesson in teaching order and ask whether it has
 * been learned. Practice chains into more practice; unlearned material sends
 * the learner home, where the path already points at what to do next — a quiz
 * on something never taught is a guessing game.
 *
 * `unknown` is its own case because an unloaded lesson list looks identical to
 * a finished course, and telling someone on lesson three that they have
 * finished would be worse than saying nothing.
 */
type NextStep =
  | { kind: 'practise'; id: string; title: string }
  | { kind: 'learn'; title: string }
  | { kind: 'courseComplete' }
  | { kind: 'unknown' };

/**
 * The exercise flow: one question per screen, answered against the server.
 *
 * Nothing about a run is persisted until `/complete` at the end — there is no
 * server-side session, so leaving halfway genuinely discards the answers. That
 * is the whole reason for the confirmation on exit.
 *
 * **A lesson is pass-or-repeat.** Every question is asked exactly once; a wrong
 * answer does not stop the run, it fails it. That mirrors the server, whose
 * completion gate looks for an attempt with everything answered correctly — so
 * a run with a mistake would be refused by `/complete` anyway, and the screen
 * reads the same rule off the answers it already holds rather than sending a
 * request it knows will 409.
 */
export default function Lesson() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();

  /**
   * Drawn once per run and held. Bumped by "Run it again", which is what makes a
   * repeat a genuinely new attempt rather than a re-answer of the same one.
   */
  const [run, setRun] = useState(0);
  const [attempt, setAttempt] = useState(newAttempt);
  /**
   * How far through the questions, and what came back for each one behind us.
   *
   * A walking index, not a queue. The queue re-asked a wrong question until it
   * was answered right, which made every finished run clean by construction —
   * so a lesson could not actually be failed, only delayed. Now one mistake
   * costs the run: `answered` is what that verdict is read from at the end.
   */
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState<AnswerResult[]>([]);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [summary, setSummary] = useState<CompleteLessonResult | null>(null);
  /** Reached the end with at least one wrong. The lesson did not complete. */
  const [failed, setFailed] = useState(false);
  /** Auto-advance paused by a tap on the feedback — the timing escape hatch. */
  const [held, setHeld] = useState(false);
  // The text typed into the wordReading input. Cleared on `advance()` so a
  // new question starts from an empty box; the input also clears itself when
  // disabled-by-result, so this state is the source of truth.
  const [typedText, setTypedText] = useState('');

  const exercises = useQuery({
    queryKey: ['exercises', id, attempt, run],
    queryFn: () => fetchExercises(id, attempt),
    // The set is a pure function of (lesson, user, attempt), so it cannot go
    // stale within a run — and refetching mid-lesson would only risk a flicker
    // on a screen the learner is mid-thought on.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const answer = useMutation({
    mutationFn: (
      variables:
        | { exerciseId: string; body: { optionId: string } }
        | { exerciseId: string; body: { text: string } },
    ) => answerExercise(id, variables.exerciseId, variables.body),
    onSuccess: (data) => {
      answerFeedback(data.correct);
      setResult(data);
    },
  });

  /**
   * What comes after this lesson. Read from the same two caches the home screen
   * uses, so nothing extra is fetched in the common case — both are warm by the
   * time anyone reaches a lesson from home.
   */
  const progressQuery = useQuery({
    queryKey: ['progress'],
    queryFn: fetchProgress,
    staleTime: 5 * 60_000,
  });
  const lessonsQuery = useQuery({
    queryKey: ['lessons'],
    queryFn: () => fetchLessons(),
    staleTime: 5 * 60_000,
  });

  const complete = useMutation({
    mutationFn: () => completeLesson(id),
    onSuccess: (data) => {
      setSummary(data);
      // XP, the due-card count and the completed-lesson set all just moved.
      void queryClient.invalidateQueries({ queryKey: ['progress'] });
    },
  });

  const questions = exercises.data?.questions ?? [];
  const total = questions.length;

  const question = questions[index];
  /** Questions behind us, including the one showing feedback right now. */
  const seen = answered.length + (result ? 1 : 0);
  const correctCount =
    answered.filter((each) => each.correct).length + (result?.correct ? 1 : 0);
  const isLast = total > 0 && index === total - 1;
  /** Already unwinnable: no sequence of answers from here completes the lesson. */
  const broken = answered.some((each) => !each.correct) || result?.correct === false;

  const nextStep = ((): NextStep => {
    const all = lessonsQuery.data;
    const completedIds = progressQuery.data?.completedLessonIds;
    if (!all || !completedIds) return { kind: 'unknown' };

    const units = groupByUnit(withLockState(all, completedIds));
    const next = lessonAfter(units, id);
    if (!next) return { kind: 'courseComplete' };
    return next.completed
      ? { kind: 'practise', id: next.id, title: next.title }
      : { kind: 'learn', title: next.title };
  })();

  // Answers live only in this component's state, so there is something to lose
  // from the first one until `/complete` has landed.
  const answersAtRisk = summary === null && !failed && seen > 0;

  const leave = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  const goToNext = useCallback(() => {
    // `replace`, not `push`: chaining lessons must not build a back stack of
    // finished ones for the hardware back button to walk through.
    if (nextStep.kind === 'practise') router.replace(`/lesson/${nextStep.id}`);
    else leave();
  }, [nextStep, router, leave]);

  const requestExit = useCallback(() => {
    if (!answersAtRisk) {
      leave();
      return;
    }

    Alert.alert(
      'Leave this lesson?',
      `You have ${correctCount} of ${total} correct. Leaving discards them — a lesson only counts once you finish it.`,
      [
        { text: 'Keep going', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: leave },
      ],
    );
  }, [answersAtRisk, leave, correctCount, total]);

  // Android's hardware back would otherwise walk straight out of the lesson.
  // iOS has no equivalent event; its swipe-back is disabled below instead.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!answersAtRisk) return false;
      requestExit();
      return true;
    });
    return () => subscription.remove();
  }, [answersAtRisk, requestExit]);

  function choose(optionId: string) {
    if (!question || answer.isPending || result) return;
    tapFeedback();
    answer.mutate({ exerciseId: question.exerciseId, body: { optionId } });
  }

  function submitTyped() {
    if (!question || question.type !== 'wordReading') return;
    if (answer.isPending || result) return;
    // The submit button is disabled when the input is empty, but Enter on the
    // hardware keyboard (Android) can still fire this. A defensive trim guards
    // against the same empty answer that web's input already rejects.
    const text = typedText.trim();
    if (text.length === 0) return;
    tapFeedback();
    answer.mutate({ exerciseId: question.exerciseId, body: { text } });
  }

  const advance = useCallback(() => {
    if (!result) return;

    const settled = [...answered, result];

    if (index + 1 < total) {
      setAnswered(settled);
      setIndex(index + 1);
      setResult(null);
      setHeld(false);
      // Clear the typed text along with the previous result. A typed answer
      // that survived across questions would be a stale state leak.
      setTypedText('');
      // Clears a failed attempt's error along with the previous result.
      answer.reset();
      return;
    }

    // End of the run. One wrong answer means the lesson did not complete, and
    // `/complete` would refuse it — so we do not ask.
    setAnswered(settled);
    if (settled.some((each) => !each.correct)) {
      setFailed(true);
      return;
    }
    complete.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answered, index, result, total]);

  /** Start the lesson over as a genuinely new attempt. */
  const runAgain = useCallback(() => {
    setAttempt(newAttempt());
    setRun((n) => n + 1);
    setIndex(0);
    setAnswered([]);
    setResult(null);
    setFailed(false);
    setHeld(false);
    setTypedText('');
    answer.reset();
    complete.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Move on by itself once feedback has been read.
   *
   * A right answer needs only long enough to register; a wrong one has to be
   * *read*, since it is the only place the correct answer appears. Tapping the
   * feedback holds it open — an auto-advancing screen with no way to stop it
   * fails WCAG 2.2.1, and a phone has no hover to pause on.
   */
  useEffect(() => {
    if (!result || held || summary || failed) return;

    const timer = setTimeout(advance, result.correct ? CORRECT_MS : WRONG_MS);
    return () => clearTimeout(timer);
  }, [result, held, summary, failed, advance]);

  function optionState(optionId: string): OptionState {
    if (result) {
      if (optionId === result.selectedOptionId) {
        return result.correct ? 'chosenRight' : 'chosenWrong';
      }
      if (optionId === result.correctOptionId) return 'answer';
      return 'muted';
    }
    if (answer.isPending) {
      return answer.variables?.body !== undefined &&
        'optionId' in answer.variables.body &&
        answer.variables.body.optionId === optionId
        ? 'pending'
        : 'muted';
    }
    return 'idle';
  }

  return (
    <View
      style={{
        flex: 1,
        paddingTop: insets.top + theme.spacing.md,
        paddingBottom: insets.bottom + theme.spacing.xl,
      }}
    >
      {/* Swipe-back would bypass the confirmation the same way hardware back
          does, so it is off exactly while there are answers to lose. */}
      <Stack.Screen options={{ gestureEnabled: !answersAtRisk }} />

      {exercises.isPending ? (
        <LessonSkeleton />
      ) : exercises.isError ? (
        <Centered>
          <ErrorState
            error={exercises.error}
            onRetry={() => void exercises.refetch()}
            onDismiss={leave}
          />
        </Centered>
      ) : summary ? (
        <Summary summary={summary} total={total} next={nextStep} onNext={goToNext} onDone={leave} />
      ) : failed ? (
        <Failed
          answered={answered}
          questions={questions}
          onAgain={runAgain}
          onLeave={leave}
        />
      ) : !question ? (
        // The API 422s on a lesson with no kana, so this is close to
        // unreachable — but an empty set must not render a blank screen.
        <Centered>
          <FormError message="This lesson has no questions yet. Try another one." />
          <Button label="Back to home" variant="secondary" onPress={leave} />
        </Centered>
      ) : (
        <>
          <View style={{ paddingHorizontal: theme.spacing.xl, gap: theme.spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <LeaveButton onPress={requestExit} />
            </View>
            {/* Position through the lesson, not score. Every question is asked
                exactly once now, so the two are different numbers — the caption
                carries the score. */}
            <SessionProgress
              position={index}
              total={total}
              caption={`${correctCount} / ${total} correct`}
              // Parallel to `questions`, because the walk only moves forward:
              // question n is answered at step n. The one showing feedback
              // right now is included, so a verdict colours its pip
              // immediately rather than on the way to the next question.
              outcomes={questions.map((_, position) =>
                position < answered.length
                  ? answered[position].correct
                  : position === index && result
                    ? result.correct
                    : undefined,
              )}
            />

            {/* Said the moment it is true rather than held to the end. Letting
                someone answer the rest of a doomed run and only then telling
                them would be a surprise this screen should never spring. */}
            {broken ? (
              <Text
                style={{
                  fontFamily: theme.families.ui,
                  fontSize: theme.fontSize.small,
                  color: theme.colors.inkSoft,
                }}
              >
                This run can’t complete the lesson — you’ll need a clean one to pass.
              </Text>
            ) : null}
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

            {/*
              Audio, but never where it would answer the question.

              A `vocab` prompt asks what a word means in English — listening
              reveals nothing, so hearing it while choosing is the point. A
              `wordReading` prompt asks for the romaji, so the recording *is*
              the answer spoken, and the doubled consonant in がっこう is
              audible; it is withheld until the feedback, where it becomes the
              correction rather than a hint. Same rule as review cards.
            */}
            {hasAudio(question.promptKind) &&
            (!revealsAnswer(question.promptKind) || result !== null) ? (
              <SpeakButton
                {...(question.promptKind === 'kana'
                  ? { kanaId: question.itemId }
                  : { vocabId: question.itemId })}
                label="Hear it"
              />
            ) : null}

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
              <WordReadingInput
                value={typedText}
                onChangeText={setTypedText}
                onSubmit={submitTyped}
                disabled={result !== null || answer.isPending}
              />
            ) : (
              question.options.map((option) => (
                <OptionButton
                  key={option.id}
                  label={option.value}
                  state={optionState(option.id)}
                  onPress={() => choose(option.id)}
                />
              ))
            )}

            {answer.isError ? (
              <FormError message={errorText(answer.error)} />
            ) : complete.isError ? (
              <FormError message={errorText(complete.error)} />
            ) : (
              <Feedback
                result={result}
                kind={question.promptKind}
                held={held}
                onToggleHold={() => setHeld((current) => !current)}
              />
            )}

            <Button
              label={isLast ? 'Finish lesson' : 'Next question'}
              onPress={advance}
              // Always rendered, so answering never shifts the options out from
              // under a thumb that is already moving.
              disabled={result === null}
              loading={complete.isPending}
            />
          </View>
        </>
      )}
    </View>
  );
}

/**
 * Holds a constant two lines of space whether or not there is anything to say,
 * so the button below it never moves.
 */
function Feedback({
  result,
  kind,
  held,
  onToggleHold,
}: {
  result: AnswerResult | null;
  kind: PromptKind;
  held: boolean;
  onToggleHold: () => void;
}) {
  const theme = useTheme();
  const height = theme.lineHeight.body * 2;

  if (!result) return <View style={{ height }} />;

  return (
    <Pressable
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      // The pause. A phone has no hover to hold a countdown open on, so the
      // feedback itself is the target: tap to stop the auto-advance, tap again
      // to let it run. Without this the screen would move on regardless of how
      // long the reader needs, which fails WCAG 2.2.1.
      accessibilityLabel={
        held ? 'Auto-advance paused. Tap to resume.' : 'Tap to pause auto-advance.'
      }
      onPress={onToggleHold}
      style={{ height, justifyContent: 'center' }}
    >
      <Text
        style={{
          fontFamily: theme.families.ui,
          fontSize: theme.fontSize.body,
          lineHeight: theme.lineHeight.body,
          color: result.correct ? theme.colors.shu : theme.colors.danger,
        }}
      >
        {result.correct ? 'Correct' : 'Not quite'}
      </Text>
      {result.correct ? null : (
        <Text
          style={{
            fontFamily: theme.families.ui,
            fontSize: theme.fontSize.body,
            lineHeight: theme.lineHeight.body,
            color: theme.colors.inkSoft,
          }}
        >
          {/* "あ is ‘a’" reads correctly for a character or a word. For a
              gapped sentence it does not — the sentence is not the particle,
              the gap is. So the sentence is shown filled in instead. */}
          {kind === 'grammar'
            ? `The answer is “${result.correctValue}”: ${result.prompt.replace('＿', result.correctValue)}`
            : `${result.prompt} is “${result.correctValue}”.`}
        </Text>
      )}
    </Pressable>
  );
}

/**
 * Reached the end of a run with at least one wrong answer.
 *
 * The lesson is not finished and no XP was earned. Listing what was missed makes
 * the repeat a study aid rather than a punishment — the learner sees the three
 * they got wrong before re-answering all twelve.
 */
function Failed({
  answered,
  questions,
  onAgain,
  onLeave,
}: {
  answered: AnswerResult[];
  questions: Question[];
  onAgain: () => void;
  onLeave: () => void;
}) {
  const theme = useTheme();
  const wrong = answered.filter((each) => !each.correct);
  const byExerciseId = new Map(questions.map((q) => [q.exerciseId, q]));

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
          fontSize: theme.fontSize.title,
          color: theme.colors.ink,
        }}
      >
        Not quite finished
      </Text>

      <Text
        style={{
          fontFamily: theme.families.ui,
          fontSize: theme.fontSize.body,
          lineHeight: theme.lineHeight.body,
          color: theme.colors.inkSoft,
        }}
      >
        {wrong.length === 1
          ? 'One answer was wrong, so this lesson is not complete yet.'
          : `${wrong.length} answers were wrong, so this lesson is not complete yet.`}{' '}
        Run it again and get every question right to finish it.
      </Text>

      <View style={{ gap: theme.spacing.md }}>
        {wrong.map((each) => {
          const question = byExerciseId.get(each.exerciseId);
          const answerText =
            question?.promptKind === 'grammar'
              ? each.prompt.replace('＿', each.correctValue)
              : each.correctValue;

          return (
            <View
              key={each.exerciseId}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                gap: theme.spacing.lg,
                paddingBottom: theme.spacing.md,
                borderBottomWidth: theme.hairlineWidth,
                borderBottomColor: theme.colors.hairline,
              }}
            >
              <Text
                style={{
                  fontFamily: theme.families.ja,
                  fontSize: theme.fontSize.bodyLarge,
                  color: theme.colors.ink,
                  flexShrink: 1,
                }}
              >
                {each.prompt}
              </Text>
              <Text
                style={{
                  fontFamily: theme.families.ui,
                  fontSize: theme.fontSize.body,
                  color: theme.colors.shu,
                  textAlign: 'right',
                  flexShrink: 1,
                }}
              >
                {answerText}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={{ gap: theme.spacing.md }}>
        <Button label="Run it again" onPress={onAgain} />
        <Button label="Back to home" variant="secondary" onPress={onLeave} />
      </View>
    </ScrollView>
  );
}

function Summary({
  summary,
  total,
  next,
  onNext,
  onDone,
}: {
  summary: CompleteLessonResult;
  total: number;
  next: NextStep;
  onNext: () => void;
  onDone: () => void;
}) {
  const theme = useTheme();
  const [held, setHeld] = useState(false);

  // Carries on by itself, like the questions did. Tapping anywhere on the
  // summary stops it — the same escape hatch the feedback offers, for the same
  // reason.
  useEffect(() => {
    if (held) return;
    const timer = setTimeout(onNext, NEXT_MS);
    return () => clearTimeout(timer);
  }, [held, onNext]);

  const cards =
    summary.cardsCreated > 0
      ? `${summary.cardsCreated} added to review`
      : 'Already in your reviews';

  return (
    <ScrollView
      onTouchStart={() => setHeld(true)}
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
          {/* The award differs between the two, so the copy should too. */}
          {summary.firstCompletion ? 'Lesson complete' : 'Practice complete'}
        </Text>
        <Text
          style={{
            fontFamily: theme.families.ui,
            fontSize: theme.fontSize.body,
            lineHeight: theme.lineHeight.body,
            color: theme.colors.inkSoft,
          }}
        >
          {summary.title}
        </Text>
      </View>

      <View>
        {/* Reaching this screen at all means a clean run — the only route here
            is every question answered correctly — so the row states that rather
            than asking the reader to compare two numbers that are always
            equal. */}
        <SummaryRow label="Correct" value={`Clean run — ${total} of ${total}`} />
        <SummaryRow label="XP earned" value={`+${summary.xpAwarded}`} emphasis />
        {/* Gems are shown next to XP because they are earned by the same act and
            differ only in what they buy — a heart refill rather than a level. */}
        <SummaryRow label="Gems earned" value={`+${summary.gemsAwarded}`} emphasis />
        <SummaryRow label="Cards" value={cards} />
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        {next.kind === 'practise' ? (
          <Text
            style={{
              fontFamily: theme.families.ui,
              fontSize: theme.fontSize.small,
              color: theme.colors.inkSoft,
            }}
          >
            Next: {next.title} — you have learned this one, so it starts straight away.
          </Text>
        ) : next.kind === 'learn' ? (
          <Text
            style={{
              fontFamily: theme.families.ui,
              fontSize: theme.fontSize.small,
              color: theme.colors.inkSoft,
            }}
          >
            Next: {next.title} — you have not learned this one yet. Read it through
            first.
          </Text>
        ) : next.kind === 'courseComplete' ? (
          <Text
            style={{
              fontFamily: theme.families.ui,
              fontSize: theme.fontSize.small,
              color: theme.colors.inkSoft,
            }}
          >
            That is the last lesson. Everything from here is review.
          </Text>
        ) : null}

        <Button
          label={next.kind === 'practise' ? 'Start it now' : 'Back to home'}
          onPress={onNext}
        />
        {next.kind === 'practise' ? (
          <Button label="Back to home" variant="secondary" onPress={onDone} />
        ) : null}
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

/**
 * The wordReading input: a single line of text and a Submit button.
 *
 * The same panel switches from four buttons to a text input without resizing —
 * the surrounding spacing stays the same, so the learner's thumb has somewhere
 * to go that hasn't moved. The Submit button is disabled until there's
 * something to send, so an empty submission does not surface.
 */
function WordReadingInput({
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
        // The learner's typing their answer — we never want to imply this is
        // a password or that autocapitalisation will help. iOS still tries.
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
          // Latin lowercase. Letting the platform upscale or change script
          // would silently mis-grade the answer.
          textTransform: 'none',
        }}
      />
      <Button label="Submit" onPress={onSubmit} disabled={disabled || value.trim().length === 0} />
    </View>
  );
}

function LeaveButton({ onPress }: { onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Leave this lesson"
      // Padding plus hit slop rather than a drawn box: the target clears 44pt
      // without the word sitting inside a button that competes with the answers.
      hitSlop={theme.spacing.md}
      style={({ pressed }) => ({
        paddingVertical: theme.spacing.sm,
        paddingLeft: theme.spacing.lg,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text
        style={{
          fontFamily: theme.families.ui,
          fontSize: theme.fontSize.body,
          color: theme.colors.ai,
        }}
      >
        Leave
      </Text>
    </Pressable>
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
