import { useEffect, useRef, useState } from 'react';

import { fetchLesson, type LessonDetail, type LessonSummary, type Unit } from '../api';
import { revealOnScroll } from '../motion';
import type { Load } from '../App';
import { LessonItems } from './LessonItems';

export function Curriculum({ load }: { load: Load }) {
  const listRef = useRef<HTMLDivElement>(null);

  // Re-armed whenever the units land, since the cards do not exist before then.
  useEffect(() => {
    if (load.state !== 'ready' || !listRef.current) return;
    revealOnScroll([...listRef.current.querySelectorAll('.reveal')], { stagger: 70 });
  }, [load.state]);

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
              Each unit is gated on the one before it. Open a lesson to see exactly what it
              teaches — this is the same content the app serves.
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
              <UnitCard key={unit.slug} unit={unit} index={index} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function UnitCard({ unit, index }: { unit: Unit; index: number }) {
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
          {unit.itemCount}
          <span className="unit-count-label">items</span>
        </span>
      </div>

      <ol className="lessons">
        {unit.lessons.map((lesson) => (
          <LessonRow key={lesson.id} lesson={lesson} />
        ))}
      </ol>
    </article>
  );
}

/**
 * A lesson, expandable to show what it teaches.
 *
 * `<details>` rather than a hand-rolled disclosure: it is keyboard operable,
 * announced correctly, and findable by in-page search even while closed, none
 * of which a div with an onClick gets for free. The contents load on first
 * open — 32 lessons eagerly fetched would be 32 requests for content most
 * visitors will never expand.
 */
function LessonRow({ lesson }: { lesson: LessonSummary }) {
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
          <span className="lesson-meta tabular">{lesson.itemCount}</span>
        </summary>

        <div className="lesson-body">
          {loading ? (
            <p className="muted">Loading…</p>
          ) : error ? (
            <p className="muted">{error}</p>
          ) : detail ? (
            <LessonItems items={detail.items} />
          ) : null}
        </div>
      </details>
    </li>
  );
}
