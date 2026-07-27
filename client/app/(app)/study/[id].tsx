import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchLesson } from '@/api/lessons';
import { kindHasStrokes } from '@/api/strokes';
import { Button } from '@/components/Button';
import { ErrorState } from '@/components/ErrorState';
import { CardBack, CardFront } from '@/components/ReviewCardFace';
import { LessonSkeleton } from '@/components/LessonSkeleton';
import { SessionProgress } from '@/components/SessionProgress';
import { SpeakButton } from '@/components/SpeakButton';
import { StrokeOrder } from '@/components/StrokeOrder';
import { tapFeedback } from '@/lib/haptics';
import { useTheme } from '@/theme';

/**
 * The teach step: one item at a time, before any question is asked.
 *
 * ## Why the app needed a new screen rather than a port
 *
 * The website had the material already — as a list inside a disclosure — so its
 * teach step was a re-presentation. The app had nothing: home linked straight
 * into the quiz, and `fetchLesson` did not exist on this side at all. A learner
 * met あ for the first time as a multiple-choice question.
 *
 * ## Front and back, not front then back
 *
 * Both halves of the card are shown at once, which is the opposite of the review
 * screen a few files away — and deliberately. Review is retrieval: the answer is
 * withheld because recalling it is the exercise. Study is presentation: there is
 * nothing to retrieve yet, and hiding the reading behind a tap would be a quiz
 * with no stakes.
 *
 * Reusing `CardFront`/`CardBack` rather than writing a third renderer means a
 * character is shown here exactly as it will be shown in review — including the
 * manuscript cell, the romaji display rule, and the play button on vocabulary.
 */
export default function Study() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [index, setIndex] = useState(0);

  const lesson = useQuery({
    queryKey: ['lesson', id],
    queryFn: () => fetchLesson(id),
    // Seeded content: it does not change between openings, and re-fetching
    // would only risk a flicker mid-read.
    staleTime: 5 * 60_000,
  });

  const items = lesson.data?.items ?? [];
  const item = items[index];
  const last = items.length > 0 && index === items.length - 1;

  function leave() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  function startQuiz() {
    // `replace`: the quiz is where this screen was leading, and leaving it
    // should return to the course rather than back into the walkthrough.
    router.replace(`/lesson/${id}`);
  }

  return (
    <View
      style={{
        flex: 1,
        paddingTop: insets.top + theme.spacing.md,
        paddingBottom: insets.bottom + theme.spacing.xl,
      }}
    >
      {lesson.isPending ? (
        <LessonSkeleton />
      ) : lesson.isError ? (
        <View style={{ flex: 1, justifyContent: 'center', padding: theme.spacing.xl }}>
          <ErrorState
            error={lesson.error}
            onRetry={() => void lesson.refetch()}
            onDismiss={leave}
          />
        </View>
      ) : !item ? (
        <View style={{ flex: 1, justifyContent: 'center', padding: theme.spacing.xl, gap: theme.spacing.lg }}>
          <Text
            style={{
              fontFamily: theme.families.ui,
              fontSize: theme.fontSize.body,
              color: theme.colors.inkSoft,
              textAlign: 'center',
            }}
          >
            This lesson has nothing to show yet.
          </Text>
          <Button label="Back to home" variant="secondary" onPress={leave} />
        </View>
      ) : (
        <>
          <View style={{ paddingHorizontal: theme.spacing.xl, gap: theme.spacing.md }}>
            <SessionProgress
              position={index + 1}
              total={items.length}
              caption={`${index + 1} / ${items.length}`}
            />
            <Text
              style={{
                fontFamily: theme.families.ui,
                fontSize: theme.fontSize.small,
                color: theme.colors.inkSoft,
                textAlign: 'center',
              }}
            >
              {lesson.data?.title}
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
            {/* Keyed by item id so moving on remounts — without it the audio
                player on a vocabulary card would keep the previous word. */}
            <View key={item.id} style={{ alignItems: 'center', gap: theme.spacing.xl }}>
              <CardFront item={item} />
              <CardBack item={item} />

              {/* Nothing here is graded, so a kana can be heard on sight —
                  which is exactly what the quiz withholds, because its options
                  are the romaji that hearing it would give away. */}
              {item.kind === 'kana' ? <SpeakButton kanaId={item.id} label="Hear it" /> : null}

              {/* Yōon are two glyphs: きゃ gets a diagram each, in reading
                  order — the same way the cells above lay it out. */}
              {kindHasStrokes(item.kind) ? (
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    gap: theme.spacing.lg,
                  }}
                >
                  {[...(item.kind === 'kana' ? item.kana : item.kind === 'kanji' ? item.char : '')].map(
                    (glyph, position) => (
                      <StrokeOrder key={`${position}-${glyph}`} char={glyph} />
                    ),
                  )}
                </View>
              ) : null}
            </View>
          </ScrollView>

          <View style={{ paddingHorizontal: theme.spacing.xl, gap: theme.spacing.sm }}>
            <Button
              label={last ? 'Start the quiz' : 'Next'}
              onPress={() => {
                tapFeedback();
                if (last) startQuiz();
                else setIndex((n) => Math.min(n + 1, items.length - 1));
              }}
            />
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Button
                  label="Back"
                  variant="secondary"
                  disabled={index === 0}
                  onPress={() => setIndex((n) => Math.max(n - 1, 0))}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label={last ? 'Leave' : 'Skip to quiz'}
                  variant="secondary"
                  onPress={last ? leave : startQuiz}
                />
              </View>
            </View>
          </View>
        </>
      )}
    </View>
  );
}
