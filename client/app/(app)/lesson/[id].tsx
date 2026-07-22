import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Alert, BackHandler, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  answerExercise,
  completeLesson,
  fetchExercises,
  type AnswerResult,
  type CompleteLessonResult,
  type PromptKind,
} from '@/api/exercises';
import { Button } from '@/components/Button';
import { ErrorState } from '@/components/ErrorState';
import { FormError } from '@/components/FormError';
import { LessonSkeleton } from '@/components/LessonSkeleton';
import { QuestionPrompt } from '@/components/QuestionPrompt';
import { OptionButton, type OptionState } from '@/components/OptionButton';
import { SessionProgress } from '@/components/SessionProgress';
import { errorText } from '@/lib/errors';
import { newAttempt } from '@/lib/exercises';
import { answerFeedback, tapFeedback } from '@/lib/haptics';
import { useTheme } from '@/theme';

/**
 * The exercise flow: one question per screen, answered against the server.
 *
 * Nothing about a run is persisted until `/complete` at the end — there is no
 * server-side session, so leaving halfway genuinely discards the answers. That
 * is the whole reason for the confirmation on exit.
 */
export default function Lesson() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();

  // Drawn once per entry and held for the run. See newAttempt().
  const [attempt] = useState(newAttempt);
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [summary, setSummary] = useState<CompleteLessonResult | null>(null);

  const exercises = useQuery({
    queryKey: ['exercises', id, attempt],
    queryFn: () => fetchExercises(id, attempt),
    // The set is a pure function of (lesson, user, attempt), so it cannot go
    // stale within a run — and refetching mid-lesson would only risk a flicker
    // on a screen the learner is mid-thought on.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const answer = useMutation({
    mutationFn: (variables: { exerciseId: string; optionId: string }) =>
      answerExercise(id, variables.exerciseId, variables.optionId),
    onSuccess: (data) => {
      answerFeedback(data.correct);
      setResult(data);
      if (data.correct) setCorrectCount((count) => count + 1);
    },
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
  const question = questions[index];
  const total = questions.length;
  const isLast = total > 0 && index === total - 1;

  // Answers live only in this component's state, so there is something to lose
  // from the first one until `/complete` has landed.
  const answersAtRisk = summary === null && (index > 0 || result !== null);

  const leave = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  const requestExit = useCallback(() => {
    if (!answersAtRisk) {
      leave();
      return;
    }

    const answered = index + (result ? 1 : 0);
    Alert.alert(
      'Leave this lesson?',
      `You have answered ${answered} of ${total}. Leaving discards them — a lesson only counts once you finish it.`,
      [
        { text: 'Keep going', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: leave },
      ],
    );
  }, [answersAtRisk, index, leave, result, total]);

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
    answer.mutate({ exerciseId: question.exerciseId, optionId });
  }

  function advance() {
    if (isLast) {
      complete.mutate();
      return;
    }
    setIndex((current) => current + 1);
    setResult(null);
    // Clears a failed attempt's error along with the previous result.
    answer.reset();
  }

  function optionState(optionId: string): OptionState {
    if (result) {
      if (optionId === result.selectedOptionId) {
        return result.correct ? 'chosenRight' : 'chosenWrong';
      }
      if (optionId === result.correctOptionId) return 'answer';
      return 'muted';
    }
    if (answer.isPending) {
      return answer.variables?.optionId === optionId ? 'pending' : 'muted';
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
        <Summary summary={summary} correctCount={correctCount} total={total} onDone={leave} />
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
            <SessionProgress
              position={index + 1}
              total={total}
              caption={`${index + 1} / ${total}`}
            />
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
            {question.options.map((option) => (
              <OptionButton
                key={option.id}
                label={option.value}
                state={optionState(option.id)}
                onPress={() => choose(option.id)}
              />
            ))}

            {answer.isError ? (
              <FormError message={errorText(answer.error)} />
            ) : complete.isError ? (
              <FormError message={errorText(complete.error)} />
            ) : (
              <Feedback result={result} kind={question.promptKind} />
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
function Feedback({ result, kind }: { result: AnswerResult | null; kind: PromptKind }) {
  const theme = useTheme();
  const height = theme.lineHeight.body * 2;

  if (!result) return <View style={{ height }} />;

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
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
    </View>
  );
}

function Summary({
  summary,
  correctCount,
  total,
  onDone,
}: {
  summary: CompleteLessonResult;
  correctCount: number;
  total: number;
  onDone: () => void;
}) {
  const theme = useTheme();

  const cards =
    summary.cardsCreated > 0
      ? `${summary.cardsCreated} added to review`
      : 'Already in your reviews';

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
        <SummaryRow label="Correct" value={`${correctCount} of ${total}`} />
        <SummaryRow label="XP earned" value={`+${summary.xpAwarded}`} emphasis />
        <SummaryRow label="Cards" value={cards} />
      </View>

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
