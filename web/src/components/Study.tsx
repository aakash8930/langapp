import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { fetchLesson, type ResolvedItem } from '../api';
import { mnemonicsFor } from '../mnemonics';
import { queryKeys } from '../queryKeys';
import { go, goBack } from '../useRoute';
import { Item } from './LessonItems';
import { SpeakButton } from './SpeakButton';
import { StrokeOrder } from './StrokeOrder';
import { TraceCanvas } from './TraceCanvas';

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
  const [index, setIndex] = useState(0);

  const lessonQuery = useQuery({
    queryKey: queryKeys.lessons.detail(lessonId),
    queryFn: () => fetchLesson(lessonId),
  });

  // Reset to the first item whenever the lesson changes. TanStack Query
  // keeps the previous lesson's data around while the new one is loading,
  // so without this reset a navigation between lessons would briefly show
  // the right side of one lesson with the left side of another.
  useEffect(() => {
    setIndex(0);
  }, [lessonId]);

  // Left and right arrows walk the cards. A walkthrough that can only be
  // advanced by pointer is slower than the list it replaced.
  useEffect(() => {
    if (!lessonQuery.data) return;

    const items = lessonQuery.data.items;

    function onKey(event: KeyboardEvent) {
      if (event.key === 'ArrowRight') setIndex((n) => Math.min(n + 1, items.length - 1));
      if (event.key === 'ArrowLeft') setIndex((n) => Math.max(n - 1, 0));
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lessonQuery.data]);

  if (lessonQuery.isError) {
    return (
      <div className="glass panel note note-error" role="alert">
        <strong>Can’t load this lesson.</strong>
        <span>
          {lessonQuery.error instanceof Error
            ? lessonQuery.error.message
            : 'Could not load this lesson.'}
        </span>
        <button className="btn btn-primary" type="button" onClick={goBack}>
          Back to the course
        </button>
      </div>
    );
  }

  const lesson = lessonQuery.data;
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
        <button className="btn btn-primary" type="button" onClick={goBack}>
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

        {/* Nothing here is graded, so a character can be heard on sight — which
            is exactly what the quiz has to withhold for kana. */}
        {item.kind === 'vocab' ? <SpeakButton vocabId={item.id} label="Hear it" /> : null}
        {item.kind === 'kana' ? <SpeakButton kanaId={item.id} label="Hear it" /> : null}

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

        {/*
          The hook, under the diagram that motivates it. Kana only: a kanji's
          meaning is not recoverable from its shape by a story, and inventing
          one would teach a false etymology for a character that has a real one.
        */}
        {item.kind === 'kana' ? <Mnemonics kana={item.kana} /> : null}

        {/*
          Writing it, having just watched it written. One canvas per glyph, so
          きゃ is traced as two characters — which is what it is.

          Only where the course actually asks for handwriting. A kanji in this
          unit is asked for by *meaning*, and the busiest of them has 18 strokes
          against the busiest kana's 4 — tracing 顔 in a 188px box teaches
          frustration, not stroke order.
        */}
        {item.kind === 'kana' ? (
          <div className="trace-row">
            {[...item.kana].map((glyph, position) => (
              <TraceCanvas key={`${position}-${glyph}`} char={glyph} />
            ))}
          </div>
        ) : null}

        {/*
          Words from this same lesson that use the character. Derived from what
          the lesson already carries rather than authored — so it can never
          reference a word the learner has not been given, and it simply shows
          nothing on a lesson with no vocabulary.
        */}
        {item.kind === 'kana' ? <SeenIn kana={item.kana} items={items} /> : null}

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
              className="btn btn-primary"
              type="button"
              onClick={() => go({ name: 'lesson', id: lessonId })}
            >
              Start the quiz
            </button>
          ) : (
            <button
              className="btn btn-primary"
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

/**
 * The memory hook for a kana, or nothing at all.
 *
 * Rendered as its own block rather than folded into the item card because it is
 * a different *kind* of claim: everything else on this screen is what the
 * character is, and this is a story about it that happens to be useful. The
 * heading says so, so nobody memorises the mnemonic as a fact about Japanese.
 *
 * Yōon get one per glyph — きゃ is two characters and two hooks.
 */
function Mnemonics({ kana }: { kana: string }) {
  const hints = mnemonicsFor(kana);
  if (hints.length === 0) return null;

  return (
    <div className="mnemonics">
      <p className="mnemonic-kicker">A way to remember it</p>
      {hints.map(({ char, hint }) => (
        <p className="mnemonic" key={char}>
          {hints.length > 1 ? <span className="ja mnemonic-char">{char}</span> : null}
          <span>{renderEmphasis(hint)}</span>
        </p>
      ))}
    </div>
  );
}

/**
 * The `**bold**` spans in a mnemonic, which are always the syllable being
 * hooked. Parsed rather than stored as markup so the data file stays plain
 * text — and a stray `**` degrades to visible asterisks rather than to
 * injected markup, which is the failure mode worth having.
 */
function renderEmphasis(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
      <strong key={index}>{part.slice(2, -2)}</strong>
    ) : (
      part
    ),
  );
}

/**
 * Vocabulary from this lesson containing the character being taught.
 *
 * A character in isolation is a shape; the same character inside a word is the
 * thing the learner will actually meet. Restricted to the current lesson's own
 * items on purpose — pulling from the whole course would show words built on
 * kana that have not been taught yet, which is the ordering the curriculum
 * exists to protect.
 */
function SeenIn({ kana, items }: { kana: string; items: ResolvedItem[] }) {
  // Matched against the reading as well as the lemma: a word written with kanji
  // still *contains* the kana being taught, and its reading is where that shows.
  const words = items.filter(
    (each): each is Extract<ResolvedItem, { kind: 'vocab' }> =>
      each.kind === 'vocab' &&
      [...kana].every((glyph) => each.lemma.includes(glyph) || each.reading.includes(glyph)),
  );

  if (words.length === 0) return null;

  return (
    <div className="seen-in">
      <p className="mnemonic-kicker">In this lesson</p>
      <ul className="seen-in-list">
        {words.slice(0, 4).map((word) => (
          <li key={word.id}>
            <span className="ja seen-in-word">{word.lemma}</span>
            <span className="seen-in-gloss">{word.gloss}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
