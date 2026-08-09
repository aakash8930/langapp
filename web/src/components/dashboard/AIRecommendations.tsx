import { Link } from '@tanstack/react-router';
import { useRef } from 'react';

import { inTeachingOrder, type Progress, type Unit } from '../../api';
import { Icon } from '../ui/Icon';

/**
 * What to do next, beyond the very next thing — surfaced as an
 * "AI recommendations" row.
 *
 * ## These are derived, not curated
 *
 * The design shows four hand-picked tiles with cover art — "て-form Explained",
 * "漢字の書き方", a photograph of ramen. There is no recommendation endpoint,
 * no lesson artwork on the wire, and no editorial surface to curate from, so a
 * curated row would have meant hard-coding four lessons into the client and
 * watching them rot the first time the syllabus changed.
 *
 * What is derivable is genuinely useful and is what this shows: the next few
 * lessons in **teaching order** that have not been completed, skipping the one
 * the Continue card already offers. The rename from "Coming up" to "AI
 * recommendations" is cosmetic — there is still no recommendation algorithm,
 * and the JSDoc above the function carries the same caveat.
 *
 * ## No images
 *
 * Each tile carries its unit's Japanese name on a tinted plate. Aside from
 * there being no artwork to render, CLAUDE.md is explicit that nothing behind a
 * glass panel may become a photograph — the worst-case contrast guarantee the
 * whole glass layer depends on assumes a flat ground.
 */
export function AIRecommendations({ units, progress }: { units: Unit[]; progress: Progress }) {
  const scroller = useRef<HTMLUListElement>(null);

  const unitOf = new Map<string, Unit>();
  for (const unit of units) {
    for (const lesson of unit.lessons) unitOf.set(lesson.id, unit);
  }

  const completed = new Set(progress.completedLessonIds);
  const upcoming = inTeachingOrder(units)
    .filter((lesson) => !completed.has(lesson.id))
    // The first one is the Continue card's lesson; showing it again here as one
    // of four equal options undercuts the single clear next step.
    .slice(1, 9);

  if (upcoming.length === 0) return null;

  /*
   * Paging by 80% of the visible width rather than by a tile count: the number
   * of tiles on screen changes with the viewport, and a fixed step either
   * overshoots on a phone or crawls on a desktop. The overlap is deliberate —
   * a page that moves exactly one screen leaves nothing to anchor against.
   */
  function page(direction: -1 | 1) {
    const element = scroller.current;
    if (!element) return;
    element.scrollBy({ left: direction * element.clientWidth * 0.8, behavior: 'smooth' });
  }

  return (
    <section className="card ai-recommendations-card glass" aria-labelledby="ai-recommendations-heading">
      <div className="card-head">
        <h2 className="card-title" id="ai-recommendations-heading">
          <span className="card-title-icon" aria-hidden="true">
            <Icon name="bot" size={18} />
          </span>
          AI recommendations
        </h2>

        {/*
          The arrows are an enhancement over a natively scrollable list, not the
          only way through it — the row scrolls by wheel, trackpad, touch and
          keyboard without them. That is why they are safe to hide on a narrow
          screen, where touch is the obvious gesture and two buttons is clutter.
        */}
        <div className="recommend-pager">
          <button type="button" className="pager-btn" onClick={() => page(-1)} aria-label="Scroll back">
            <Icon name="chevron-left" size={16} />
          </button>
          <button
            type="button"
            className="pager-btn"
            onClick={() => page(1)}
            aria-label="Scroll forward"
          >
            <Icon name="chevron-right" size={16} />
          </button>
        </div>
      </div>

      <ul className="recommend-row" ref={scroller}>
        {upcoming.map((lesson) => {
          const unit = unitOf.get(lesson.id);
          return (
            <li key={lesson.id}>
              <Link className="recommend-tile" to="/courses" search={{ learn: lesson.id }}>
                <span className="recommend-plate" aria-hidden="true">
                  <span className="ja">{unit?.ja || '日本語'}</span>
                </span>
                <span className="recommend-unit">{unit?.label ?? lesson.unit}</span>
                <span className="recommend-title">{lesson.title}</span>
                <span className="recommend-meta tabular">
                  {lesson.itemCount} {lesson.itemCount === 1 ? 'item' : 'items'}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}