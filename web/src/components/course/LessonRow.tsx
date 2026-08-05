import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useEffect, useRef, useState, type SyntheticEvent } from 'react';

import { fetchLesson, type LessonSummary } from '../../api';
import { log, logError } from '../../debug';
import { queryKeys } from '../../queryKeys';
import { Icon, type IconName } from '../ui/Icon';
import { LessonItems } from '../LessonItems';
import type { LessonState } from './lessonState';

/**
 * The icon in front of a lesson row, chosen from what the lesson actually
 * contains.
 *
 * The design puts a media type here — a play triangle, a pen, a quiz sheet.
 * There is no media in this product, but `exerciseTypes` is real and says
 * something close enough to be useful: whether a lesson will ask you to pick,
 * to write, or to speak. A lesson with several gets the first that matches, in
 * the order below, because the icon is a hint rather than a full description.
 */
function lessonIcon(lesson: LessonSummary): IconName {
  if (lesson.exerciseTypes.includes('speech')) return 'mic';
  if (lesson.exerciseTypes.includes('wordReading')) return 'pen-tool';
  if (lesson.exerciseTypes.includes('multipleChoice')) return 'grid';
  return 'book-open';
}

/**
 * One lesson.
 *
 * `<details>` rather than a hand-rolled disclosure: keyboard operable,
 * announced correctly, and findable by in-page search while closed. Contents
 * load on first open — 32 lessons fetched eagerly would be 32 requests for
 * content most visitors never expand.
 *
 * Moved here from `Curriculum.tsx` unchanged when `/courses` became the course
 * page. Everything below was load-bearing there and still is.
 */
export function LessonRow({
  lesson,
  index,
  state,
  highlight,
}: {
  lesson: LessonSummary;
  index: number;
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
    if (!highlight) return;
    if (!detailsRef.current) {
      // The ref being empty on a highlighted row means the row rendered without
      // its `<details>` — nothing opens and nothing scrolls, silently.
      logError('ui', `lesson row ${lesson.id} is highlighted but has no <details> node`);
      return;
    }

    log('ui', `lesson row ${lesson.id}: opening and scrolling into view`);

    const node = detailsRef.current;
    node.open = true;
    setOpen(true);
    node.scrollIntoView({
      block: 'center',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
    });
  }, [highlight, lesson.id]);

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
        className={`lesson-item${highlight ? ' lesson-item-highlight' : ''}`}
        onToggle={onToggle}
      >
        <summary className="lesson-summary">
          <span className="lesson-index tabular" aria-hidden="true">
            {index + 1}
          </span>
          <span className="lesson-icon" aria-hidden="true">
            <Icon name={lessonIcon(lesson)} size={16} />
          </span>
          <span className="lesson-name">{lesson.title}</span>

          {/*
            The design puts a duration here — "18 min". Nothing in this product
            records or estimates lesson length, so the item count takes the slot:
            it is the real measure of how much a lesson contains, and it is the
            number the quiz at the end is sized from.
          */}
          <span className="lesson-count tabular">
            {lesson.itemCount} {lesson.itemCount === 1 ? 'item' : 'items'}
          </span>

          {/* The state decides the colour, so it has to be in the class rather
              than left to the container: a lock is not an achievement and must
              not arrive in the same green as a completion tick. */}
          <span
            className={`lesson-mark${state.completed ? ' lesson-mark-done' : state.locked ? ' lesson-mark-locked' : ''}`}
            aria-hidden="true"
          >
            {state.completed ? (
              <Icon name="check" size={14} />
            ) : state.locked ? (
              <Icon name="lock" size={13} />
            ) : null}
          </span>

          <span className="visually-hidden">
            {state.completed ? 'Completed' : state.locked ? 'Locked' : 'Not started'}
          </span>
        </summary>

        <div className="lesson-body">
          {loading ? (
            <p className="card-note">Loading…</p>
          ) : error ? (
            <p className="card-note">{error}</p>
          ) : detail ? (
            <>
              {highlight ? (
                <p className="learn-first" role="status">
                  <strong>Learn this one first.</strong> Read through what it teaches, then start
                  it — the quiz asks about every item below.
                </p>
              ) : null}

              <LessonItems items={detail.items} />

              <div className="lesson-actions">
                {state.locked ? (
                  <p className="card-note">
                    {state.lockedBy
                      ? `Finish “${state.lockedBy}” to unlock this.`
                      : 'Finish the previous lesson to unlock this.'}
                  </p>
                ) : state.completed ? (
                  // Already taught. Straight to the questions — walking the
                  // cards again is what the list above is for.
                  <Link className="btn btn-primary btn-sm" to="/lesson/$id" params={{ id: lesson.id }}>
                    Practise again
                  </Link>
                ) : (
                  <>
                    {/* Never seen. The teach step first, because a quiz on
                        material that has not been presented is a guessing
                        game — the same reason a finished lesson whose
                        successor is unlearned sends you here rather than
                        into its quiz. */}
                    <Link className="btn btn-primary btn-sm" to="/study/$id" params={{ id: lesson.id }}>
                      Learn it
                    </Link>
                    <Link className="link-button" to="/lesson/$id" params={{ id: lesson.id }}>
                      Skip to the quiz
                    </Link>
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
