import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState, type SyntheticEvent } from 'react';

import { fetchLesson, type LessonSummary, type Unit } from '../api';
import { revealOnScroll } from '../motion';
import { queryKeys } from '../queryKeys';
import { LessonItems } from './LessonItems';

/**
 * The shape of the curriculum data the route loader returns. Live here
 * because `Curriculum` is the only consumer; the route file imports it.
 */
export type Load =
  | { state: 'loading' }
  | { state: 'ready'; units: Unit[] }
  | { state: 'error'; message: string };

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
  learnId,
}: {
  load: Load;
  completedLessonIds: string[] | null;
  /**
   * A lesson the learner was sent here to read, set by `#/learn/<id>` when a
   * finished lesson's successor has not been learned yet. That row opens itself
   * and scrolls into view.
   */
  learnId: string | null;
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
          <div>
            <p className="section-idx">The Course</p>
            <h2>Your Learning Path</h2>
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
              <UnitCard
                key={unit.slug}
                unit={unit}
                index={index}
                stateOf={stateOf}
                learnId={learnId}
              />
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
  learnId,
}: {
  unit: Unit;
  index: number;
  stateOf: (lesson: LessonSummary) => LessonState;
  learnId: string | null;
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

      {/*
        Only once there is progress to show. An empty bar on every unit of an
        untouched course is six rows of nothing, and it makes the syllabus look
        like a list of things not done rather than a list of things to do.

        Not a `progressbar` role: the count beside it already says "3 / 5
        lessons" in text, and announcing the same ratio twice is noise. This is
        the picture of that number.
      */}
      {done > 0 ? (
        <div className="unit-progress" aria-hidden="true">
          <span style={{ width: `${(done / unit.lessons.length) * 100}%` }} />
        </div>
      ) : null}

      <ol className="lessons">
        {unit.lessons.map((lesson) => (
          <LessonRow
            key={lesson.id}
            lesson={lesson}
            state={stateOf(lesson)}
            highlight={lesson.id === learnId}
          />
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
function LessonRow({
  lesson,
  state,
  highlight,
}: {
  lesson: LessonSummary;
  state: LessonState;
  highlight: boolean;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);

  const detailQuery = useQuery({
    queryKey: queryKeys.lessons.detail(lesson.id),
    queryFn: () => fetchLesson(lesson.id),
    // Gated on the row being opened — a page of 32 collapsed rows would
    // otherwise fire 32 fetches at once on first paint. The query cache means
    // a second visit to the same row (close → reopen) reads from cache.
    enabled: open,
  });

  /**
   * Open and scroll to the lesson the learner was sent here to read.
   *
   * Setting `.open` imperatively rather than passing `open` as a prop: React
   * would then own the attribute, and the learner collapsing the row by hand
   * would put the DOM and React's idea of it out of step. Assigning the
   * property still fires `toggle`, so the content fetch below runs exactly as
   * it does for a click.
   */
  useEffect(() => {
    if (!highlight || !detailsRef.current) return;

    const node = detailsRef.current;
    node.open = true;
    setOpen(true);
    node.scrollIntoView({
      block: 'center',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
    });
  }, [highlight]);

  function onToggle(event: SyntheticEvent<HTMLDetailsElement>) {
    // `event.currentTarget.open` is the DOM truth after this toggle. The
    // query is gated on `open`, so a close means we drop the local trigger
    // and the cached data sits idle until the row is opened again.
    setOpen(event.currentTarget.open);
  }

  const detail = detailQuery.data;
  const loading = open && detailQuery.isPending;
  const error = detailQuery.isError
    ? detailQuery.error instanceof Error
      ? detailQuery.error.message
      : 'Could not load this lesson.'
    : null;

  return (
    <li>
      <details
        ref={detailsRef}
        className={`lesson${highlight ? ' lesson-highlight' : ''}`}
        onToggle={onToggle}
      >
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
              {highlight ? (
                <p className="learn-first" role="status">
                  <strong>Learn this one first.</strong> Read through what it teaches, then
                  start it — the quiz asks about every item below.
                </p>
              ) : null}
              <LessonItems items={detail.items} />
              <div className="lesson-actions">
                {state.locked ? (
                  <p className="muted">
                    {state.lockedBy
                      ? `Finish “${state.lockedBy}” to unlock this.`
                      : 'Finish the previous lesson to unlock this.'}
                  </p>
                ) : state.completed ? (
                  // Already taught. Straight to the questions — walking the
                  // cards again is what the list above is for.
                  <a className="button" href={`#/lesson/${lesson.id}`}>
                    Practise again
                  </a>
                ) : (
                  <>
                    {/* Never seen. The teach step first, because a quiz on
                        material that has not been presented is a guessing
                        game — the same reason a finished lesson whose
                        successor is unlearned sends you here rather than
                        into its quiz. */}
                    <a className="button" href={`#/study/${lesson.id}`}>
                      Learn it
                    </a>
                    <a className="link-button" href={`#/lesson/${lesson.id}`}>
                      Skip to the quiz
                    </a>
                  </>
                )}
              </div>
            </>
          ) : null}
        </div>
      </details>
    </li>
  );
}
