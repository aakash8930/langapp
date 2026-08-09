import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';

import { fetchDueReviews, type ResolvedItem } from '../../api';
import { queryKeys } from '../../queryKeys';
import { waitedFor } from './days';
import { Icon } from '../ui/Icon';

function itemFace(item: ResolvedItem): { glyph: string; label: string; kind: string } {
  switch (item.kind) {
    case 'kana':
      return { glyph: item.kana, label: item.romaji, kind: item.script };
    case 'vocab':
      return { glyph: item.lemma, label: item.gloss, kind: `${item.pos} · ${item.jlpt}` };
    case 'kanji':
      return { glyph: item.char, label: item.meanings.slice(0, 2).join(', '), kind: `${item.strokes} strokes` };
    case 'grammar':
      return { glyph: '文', label: item.title, kind: item.jlpt };
  }
}

/**
 * Upcoming reviews — the same queue as ReviewsCard but framed as
 * "here is what's next" rather than "here is what's overdue".
 *
 * Shares the `/reviews/due` query — the only review data on the wire.
 * When the queue is empty it says so encouragingly rather than hiding.
 */
export function UpcomingReviews() {
  const due = useQuery({
    queryKey: queryKeys.reviews.due,
    queryFn: fetchDueReviews,
    staleTime: 30_000,
  });

  return (
    <section className="card glass" aria-labelledby="upcoming-heading">
      <div className="card-head">
        <h2 className="card-title" id="upcoming-heading">
          Upcoming reviews
        </h2>
        {due.data && due.data.totalDue > 0 ? (
          <span className="card-pill tabular">{due.data.totalDue}</span>
        ) : null}
      </div>

      {due.isPending ? (
        <p className="card-note">Checking the queue…</p>
      ) : due.isError ? (
        <p className="card-note">The review queue could not be loaded.</p>
      ) : due.data.cards.length === 0 ? (
        <p className="card-note">
          Nothing due. Cards come back on their own schedule — an empty queue
          means you are on top of it.
        </p>
      ) : (
        <>
          <ul className="review-list">
            {due.data.cards.slice(0, 3).map((card) => {
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

          {due.data.totalDue > 3 ? (
            <p className="card-note tabular">and {due.data.totalDue - 3} more waiting</p>
          ) : null}

          <Link className="btn btn-primary btn-sm" to="/review" style={{ alignSelf: 'flex-start', marginTop: 'var(--s-sm)' }}>
            <Icon name="refresh-cw" size={16} />
            Start reviewing
          </Link>
        </>
      )}
    </section>
  );
}
