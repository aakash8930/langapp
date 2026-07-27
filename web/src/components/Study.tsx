import { useEffect, useState } from 'react';

import { fetchLesson, type LessonDetail } from '../api';
import { go, goBack } from '../useRoute';
import { Item } from './LessonItems';
import { SpeakButton } from './SpeakButton';
import { StrokeOrder } from './StrokeOrder';

/**
 * The teach step: one item at a time, before any question is asked.
 *
 * ## Why this exists
 *
 * The material was already on the site — as a list inside a disclosure on the
 * home page — and that is exactly the complaint it answers. A list is something
 * you skim past on the way to the button underneath it. Reported after using the
 * site: "I am just reading things on the home page and then starting the
 * lesson."
 *
 * One card at a time changes what the screen asks of you. You cannot skim
 * fifteen words at once, the word is large enough to actually look at, and for
 * vocabulary you can hear it — which on the list was impossible, because a play
 * button per row would have been fifteen play buttons.
 *
 * ## It does not quiz
 *
 * Nothing here is graded and nothing is sent to the server. That is the point:
 * this is the half of "learn then practise" that the site did not have, and
 * mixing a question into it would make it the other half again.
 *
 * The list on the home page stays. It is the right shape for browsing a
 * syllabus you have not started, and for coming back to check one character.
 */
export function Study({ lessonId }: { lessonId: string }) {
  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;

    setLesson(null);
    setError(null);
    setIndex(0);

    fetchLesson(lessonId)
      .then((detail) => {
        if (!cancelled) setLesson(detail);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'Could not load this lesson.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  // Left and right arrows walk the cards. A walkthrough that can only be
  // advanced by pointer is slower than the list it replaced.
  useEffect(() => {
    if (!lesson) return;

    const items = lesson.items;

    function onKey(event: KeyboardEvent) {
      if (event.key === 'ArrowRight') setIndex((n) => Math.min(n + 1, items.length - 1));
      if (event.key === 'ArrowLeft') setIndex((n) => Math.max(n - 1, 0));
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lesson]);

  if (error) {
    return (
      <div className="glass panel note note-error" role="alert">
        <strong>Can’t load this lesson.</strong>
        <span>{error}</span>
        <button className="button" type="button" onClick={goBack}>
          Back to the course
        </button>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="glass panel note" role="status">
        Loading the lesson…
      </div>
    );
  }

  const items = lesson.items;
  if (items.length === 0) {
    return (
      <div className="glass panel note">
        <strong>This lesson has no items yet.</strong>
        <button className="button" type="button" onClick={goBack}>
          Back to the course
        </button>
      </div>
    );
  }

  const item = items[index];
  const last = index === items.length - 1;

  return (
    <div className="quiz">
      <div className="quiz-head">
        <button className="link-button" type="button" onClick={goBack}>
          ← Leave
        </button>
        <span className="quiz-count tabular">
          {index + 1} / {items.length}
        </span>
      </div>

      <div
        className="quiz-pips"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={items.length}
        aria-valuenow={index + 1}
        aria-label="Position in this lesson"
      >
        {items.map((each, position) => (
          <span
            key={each.id}
            className={`pip ${position <= index ? 'pip-right' : 'pip-todo'}`}
          />
        ))}
      </div>

      <div className="glass panel study-card">
        <p className="study-kicker">{lesson.title}</p>

        {/* Same renderer the curriculum list uses, so the learner cannot be
            taught one thing here and shown another there. */}
        <div className={`item study-item study-item-${item.kind}`} key={item.id}>
          <Item item={item} />
        </div>

        {item.kind === 'vocab' ? <SpeakButton vocabId={item.id} label="Hear it" /> : null}

        {/*
          Stroke order, for the two kinds that are a single character to be
          written. A vocabulary word is several characters and a grammar point
          is a sentence — neither is something you learn to write as a unit, and
          stacking five diagrams under a word would bury the word.

          Yōon are two glyphs: きゃ gets a diagram each, in reading order, which
          is also how the cells above it are laid out.
        */}
        {item.kind === 'kana' || item.kind === 'kanji' ? (
          <div className="strokes-row">
            {[...(item.kind === 'kana' ? item.kana : item.char)].map((glyph, position) => (
              <StrokeOrder key={`${position}-${glyph}`} char={glyph} />
            ))}
          </div>
        ) : null}

        <div className="study-nav">
          <button
            className="link-button"
            type="button"
            onClick={() => setIndex((n) => Math.max(n - 1, 0))}
            disabled={index === 0}
          >
            ← Back
          </button>

          {last ? (
            <button
              className="button"
              type="button"
              onClick={() => go({ name: 'lesson', id: lessonId })}
            >
              Start the quiz
            </button>
          ) : (
            <button
              className="button"
              type="button"
              onClick={() => setIndex((n) => Math.min(n + 1, items.length - 1))}
            >
              Next
            </button>
          )}
        </div>

        {last ? null : (
          <button
            className="link-button study-skip"
            type="button"
            onClick={() => go({ name: 'lesson', id: lessonId })}
          >
            Skip to the quiz
          </button>
        )}
      </div>
    </div>
  );
}
