import { useEffect, useRef, useState } from 'react';

import { fetchLesson, type LessonDetail, type LessonSummary, type Unit } from '../api';
import { revealOnScroll } from '../motion';
import type { Load } from '../App';
import { LessonItems } from './LessonItems';

/**
 * Lock state is derived here, not served: `/lessons` is shared, unauthenticated
 * content with no per-user fields, and the completed set comes from
 * `/me/progress`. Signed out, `completedLessonIds` is null and nothing is
 * locked — a visitor browsing the syllabus should see all of it.
 */
type LessonState = { completed: boolean; locked: boolean; lockedBy?: string };

export function Curriculum({
  load,
  completedLessonIds,
}: {
  load: Load;
  completedLessonIds: string[] | null;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (load.state !== 'ready' || !listRef.current) return;
    revealOnScroll([...listRef.current.querySelectorAll('.reveal')], { stagger: 70 });
  }, [load.state]);

  const titleById =
    load.state === 'ready'
      ? new Map(load.units.flatMap((u) => u.lessons).map((l) => [l.id, l.title]))
      : new Map<string, string>();

  function stateOf(lesson: LessonSummary): LessonState {
    if (completedLessonIds === null) return { completed: false, locked: false };
    const done = new Set(completedLessonIds);
    const blocker = lesson.prerequisiteLessonIds.find((id) => !done.has(id));
    return {
      completed: done.has(lesson.id),
      locked: blocker !== undefined,
      lockedBy: blocker ? titleById.get(blocker) : undefined,
    };
  }

  return (
    <section className="section">
      <div className="wrap">
        <div className="section-head">
          <span className="section-kanji ja" aria-hidden="true">
            道
          </span>
          <div>
            <p className="section-idx">The course</p>
            <h2>Six units, in the order they unlock</h2>
            <p className="section-sub">
              Each unit is gated on the one before it. Open a lesson to see what it teaches, or
              start it to be quizzed on every item.
            </p>
          </div>
        </div>

        {load.state === 'loading' ? (
          <div className="glass panel note" role="status">
            Loading the curriculum…
          </div>
        ) : load.state === 'error' ? (
          <div className="glass panel note note-error" role="alert">
            <strong>Can’t load the curriculum.</strong>
            <span>{load.message}</span>
          </div>
        ) : (
          <div className="units" ref={listRef}>
            {load.units.map((unit, index) => (
              <UnitCard key={unit.slug} unit={unit} index={index} stateOf={stateOf} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function UnitCard({
  unit,
  index,
  stateOf,
}: {
  unit: Unit;
  index: number;
  stateOf: (lesson: LessonSummary) => LessonState;
}) {
  const done = unit.lessons.filter((l) => stateOf(l).completed).length;

  return (
    <article className="glass panel unit reveal">
      <div className="unit-head">
        <span className="unit-index tabular" aria-hidden="true">
          {String(index + 1).padStart(2, '0')}
        </span>
        <div className="unit-titles">
          <h3>
            {unit.label} <span className="unit-ja ja">{unit.ja}</span>
          </h3>
          <p>{unit.blurb}</p>
        </div>
        <span className="unit-count tabular">
          {done > 0 ? `${done} / ${unit.lessons.length}` : unit.itemCount}
          <span className="unit-count-label">{done > 0 ? 'lessons' : 'items'}</span>
        </span>
      </div>

      <ol className="lessons">
        {unit.lessons.map((lesson) => (
          <LessonRow key={lesson.id} lesson={lesson} state={stateOf(lesson)} />
        ))}
      </ol>
    </article>
  );
}

/**
 * `<details>` rather than a hand-rolled disclosure: keyboard operable,
 * announced correctly, and findable by in-page search while closed. Contents
 * load on first open — 32 lessons fetched eagerly would be 32 requests for
 * content most visitors never expand.
 */
function LessonRow({ lesson, state }: { lesson: LessonSummary; state: LessonState }) {
  const [detail, setDetail] = useState<LessonDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function open(event: React.SyntheticEvent<HTMLDetailsElement>) {
    if (!event.currentTarget.open || detail || loading) return;

    setLoading(true);
    fetchLesson(lesson.id)
      .then(setDetail)
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : 'Could not load this lesson.'),
      )
      .finally(() => setLoading(false));
  }

  return (
    <li>
      <details className="lesson" onToggle={open}>
        <summary>
          <span className="lesson-title">{lesson.title}</span>
          {state.completed ? (
            <span className="lesson-badge" title="Completed">
              ○
            </span>
          ) : null}
          <span className="lesson-meta tabular">{lesson.itemCount}</span>
        </summary>

        <div className="lesson-body">
          {loading ? (
            <p className="muted">Loading…</p>
          ) : error ? (
            <p className="muted">{error}</p>
          ) : detail ? (
            <>
              <LessonItems items={detail.items} />
              <div className="lesson-actions">
                {state.locked ? (
                  <p className="muted">
                    {state.lockedBy
                      ? `Finish “${state.lockedBy}” to unlock this.`
                      : 'Finish the previous lesson to unlock this.'}
                  </p>
                ) : (
                  <a className="button" href={`#/lesson/${lesson.id}`}>
                    {state.completed ? 'Practise again' : 'Start lesson'}
                  </a>
                )}
              </div>
            </>
          ) : null}
        </div>
      </details>
    </li>
  );
}
