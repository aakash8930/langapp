import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';

import { fetchDueReviews, type ResolvedItem } from '../../api';
import { queryKeys } from '../../queryKeys';
import { waitedFor } from './days';

/** The face of an item, whatever kind it is. */
function itemFace(item: ResolvedItem): { glyph: string; label: string; kind: string } {
  switch (item.kind) {
    case 'kana':
      return { glyph: item.kana, label: item.romaji, kind: item.script };
    case 'vocab':
      return { glyph: item.lemma, label: item.gloss, kind: `${item.pos} · ${item.jlpt}` };
    case 'kanji':
      return {
        glyph: item.char,
        label: item.meanings.slice(0, 2).join(', '),
        kind: `${item.strokes} strokes`,
      };
    case 'grammar':
      return { glyph: '文', label: item.title, kind: item.jlpt };
  }
}

/**
 * What is waiting in the review queue.
 *
 * ## "Upcoming" is the one word this card cannot use
 *
 * The design shows three cards with "Due in 15m / 45m / 2h" — a *forward* look
 * at the schedule. `GET /reviews/due` cannot answer that: its query is
 * `due: { $lte: now }`, so every card it returns is already due and there is no
 * endpoint that returns the ones that are not yet. Rendering a future time here
 * would mean inventing the schedule.
 *
 * So the panel shows the queue as it is — what is ready, and how long each item
 * has been waiting, which is the same information pointed the other way and is
 * the figure the API actually holds.
 *
 * ## The count comes from this endpoint, not from `progress.cardsDueNow`
 *
 * Both are true, and they are not the same number: `/reviews/due` is capped at
 * twenty per session, so `count` is what this session will contain and
 * `totalDue` is the backlog. Showing the backlog next to a list of five is what
 * makes "and 27 more" honest rather than confusing.
 */
export function ReviewsCard() {
  const due = useQuery({
    queryKey: queryKeys.reviews.due,
    queryFn: fetchDueReviews,
    // The review session mutates this cache as it grades; a short stale time
    // means coming back to the dashboard shows the shortened queue rather than
    // the one from before the session.
    staleTime: 30_000,
  });

  return (
    <section className="card reviews-card glass" aria-labelledby="reviews-heading">
      <div className="card-head">
        <h2 className="card-title" id="reviews-heading">
          Due now
        </h2>
        {due.data && due.data.totalDue > 0 ? (
          <span className="card-pill tabular">{due.data.totalDue}</span>
        ) : null}
      </div>

      {/* Loading, empty and error — the project's rule for every list. */}
      {due.isPending ? (
        <p className="card-note">Checking the queue…</p>
      ) : due.isError ? (
        <p className="card-note">
          The review queue could not be loaded. The API may be asleep — this page will pick it up
          when it wakes.
        </p>
      ) : due.data.cards.length === 0 ? (
        <p className="card-note">
          Nothing is due. Cards come back on their own schedule, so an empty queue is the goal
          rather than a gap.
        </p>
      ) : (
        <>
          <ul className="review-list">
            {due.data.cards.slice(0, 4).map((card) => {
              const face = itemFace(card.item);
              return (
                <li className="review-row" key={card.cardId}>
                  <span className="review-glyph ja" aria-hidden="true">
                    {face.glyph}
                  </span>
                  <span className="review-body">
                    <span className="review-label">{face.label}</span>
                    <span className="review-kind">{face.kind}</span>
                  </span>
                  <span className="review-wait tabular">
                    {waitedFor(card.due)}
                    <span className="visually-hidden"> waiting</span>
                  </span>
                </li>
              );
            })}
          </ul>

          {due.data.totalDue > 4 ? (
            <p className="card-note tabular">
              and {due.data.totalDue - 4} more waiting
              {due.data.totalDue > due.data.cap
                ? ` — a session takes ${due.data.cap} at a time`
                : ''}
            </p>
          ) : null}

          <Link className="btn btn-primary btn-sm reviews-go" to="/review-session">
            Review {due.data.count}
          </Link>
        </>
      )}
    </section>
  );
}
