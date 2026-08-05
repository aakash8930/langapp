import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';

import { fetchKanaCurriculum, type KanaCurriculumRow } from '../../api';
import { queryKeys } from '../../queryKeys';
import { useStrokes } from '../../strokes';
import { useSession } from '../../useSession';
import { StrokeOrder } from '../StrokeOrder';

import './kana-library.css';

/**
 * The selected character, larger.
 *
 * Its own component because it calls `useStrokes`, and a hook cannot live
 * inside the conditional branch that decides whether a character is selected
 * at all.
 *
 * That call is **not** a second request: `StrokeOrder` runs the same query
 * under the same key, so this reads the cache. It is here only so the panel can
 * distinguish "no diagram yet" from "no diagram ever" — `StrokeOrder` renders
 * `null` on error by design, and a panel that silently omits the thing the
 * learner clicked for reads as broken.
 *
 * Right now the seeded database has stroke data for nothing, so this note is
 * what every character shows. That is the honest state of the content rather
 * than a bug in this screen.
 */
function KanaDetail({ entry, known }: { entry: KanaCurriculumRow; known: boolean }) {
  const strokes = useStrokes(entry.kana);

  return (
    <>
      <p className="kana-detail-glyph ja" lang="ja">
        {entry.kana}
      </p>
      <p className="kana-detail-romaji">{entry.romaji}</p>

      <StrokeOrder char={entry.kana} />

      {strokes.isError ? (
        <p className="card-note">No stroke diagram for this character yet.</p>
      ) : null}

      <dl className="kana-detail-facts">
        <div>
          <dt>Row</dt>
          <dd>{entry.row}</dd>
        </div>
        {/*
          Omitted rather than shown as "unknown". `taughtInLesson` is null until
          the server's attribution migration runs — which is every row today —
          and a fact that reads the same for all 208 characters is noise
          wearing a label.
        */}
        {entry.taughtInLesson === null ? null : (
          <div>
            <dt>Taught in</dt>
            <dd>Lesson {entry.taughtInLesson + 1}</dd>
          </div>
        )}
        <div>
          <dt>Status</dt>
          <dd>{known ? 'Learned' : 'Not learned yet'}</dd>
        </div>
      </dl>
    </>
  );
}

/**
 * The gojūon, as a browsable chart. Backs both `/hiragana` and `/katakana`.
 *
 * ## Where the data comes from
 *
 * `GET /lessons/curriculum` — public, one request, and it returns the canonical
 * character list in curriculum order with each row's gojūon group and the
 * lesson that teaches it. Nothing on this site read that endpoint before this
 * screen; the sidebar carried Hiragana and Katakana as `planned` rows while the
 * data to build them was already on the wire.
 *
 * ## "Learned" is the server's list, not a guess
 *
 * `learningState.knownKana` is what the server says this learner has been
 * taught — the same list the reading feed is filtered by. It is not derived
 * from completed lessons here, because those two can legitimately disagree
 * (completing a lesson is what *adds* to `knownKana`, and the server owns that
 * transition). One source, and it is the one the rest of the product uses.
 *
 * Signed out, nothing is marked and the chart is still fully browsable, which
 * is right for a public endpoint on a shop window.
 *
 * ## No per-character lesson link
 *
 * `taughtInLesson` is a lesson **order within its unit**, not a lesson id, and
 * the curriculum row does not carry the unit. Resolving it to a real lesson
 * would mean guessing which unit a character belongs to from its script, which
 * is true for the seeded content today and is not something the response
 * promises. So the number is shown as provenance — "taught in lesson 3" — and
 * the way into the teaching is the catalog link at the top, which is honest
 * about being a catalog.
 */
export function KanaLibrary({ script }: { script: 'hiragana' | 'katakana' }) {
  const { session } = useSession();
  const [selected, setSelected] = useState<KanaCurriculumRow | null>(null);

  const curriculum = useQuery({
    queryKey: queryKeys.content.kanaCurriculum,
    queryFn: fetchKanaCurriculum,
    // The gojūon does not change. Re-fetching it on every visit is pure waste.
    staleTime: 60 * 60_000,
  });

  const known = new Set(
    session.state === 'signedIn' ? (session.user.learningState?.knownKana ?? []) : [],
  );

  const rows = (curriculum.data ?? []).filter((entry) => entry.script === script);

  // Grouped by gojūon row, in the order the rows first appear — the response is
  // already in curriculum order, so this preserves the teaching sequence rather
  // than imposing an alphabetical one.
  const groups: { row: string; entries: KanaCurriculumRow[] }[] = [];
  for (const entry of rows) {
    const group = groups.find((candidate) => candidate.row === entry.row);
    if (group) group.entries.push(entry);
    else groups.push({ row: entry.row, entries: [entry] });
  }

  const learned = rows.filter((entry) => known.has(entry.kana)).length;
  const title = script === 'hiragana' ? 'Hiragana' : 'Katakana';
  const glyph = script === 'hiragana' ? 'あ' : 'ア';

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">
          <span className="ja kana-title-glyph" aria-hidden="true">
            {glyph}
          </span>{' '}
          {title}
        </h1>
        <p className="page-sub">
          {curriculum.isPending
            ? 'Loading the chart…'
            : session.state === 'signedIn'
              ? `${learned} of ${rows.length} characters learned so far.`
              : `${rows.length} characters. Sign in to track which you have learned.`}
        </p>
      </header>

      {/* Loading, empty and error — the rule for every list on this site. */}
      {curriculum.isPending ? (
        <p className="card-note">Loading the chart…</p>
      ) : curriculum.isError ? (
        <p className="note note-error">
          <strong>The chart could not be loaded.</strong>
          <span>The API may be asleep. Nothing is wrong with your progress.</span>
        </p>
      ) : rows.length === 0 ? (
        <p className="card-note">
          The server returned no {title.toLowerCase()} characters. That is a content problem rather
          than a display one.
        </p>
      ) : (
        <div className="kana-layout">
          <div className="kana-chart">
            {groups.map((group) => (
              <section className="kana-row" key={group.row} aria-labelledby={`row-${group.row}`}>
                <h2 className="kana-row-label" id={`row-${group.row}`}>
                  {group.row}
                </h2>

                <ul className="kana-cells">
                  {group.entries.map((entry) => {
                    const isKnown = known.has(entry.kana);
                    return (
                      <li key={entry.id}>
                        <button
                          type="button"
                          className={[
                            'kana-cell',
                            isKnown ? 'kana-cell-known' : '',
                            selected?.id === entry.id ? 'kana-cell-selected' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          onClick={() => setSelected(entry)}
                          aria-pressed={selected?.id === entry.id}
                        >
                          <span className="kana-cell-glyph ja" lang="ja">
                            {entry.kana}
                          </span>
                          <span className="kana-cell-romaji">{entry.romaji}</span>
                          {isKnown ? <span className="visually-hidden"> — learned</span> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>

          {/*
            The detail panel. `StrokeOrder` fetches its own stroke data and
            renders nothing when a character has none, so a gap here is the
            designed fallback rather than a failure worth a banner.
          */}
          <aside className="kana-detail glass" aria-live="polite">
            {selected ? (
              <KanaDetail entry={selected} known={known.has(selected.kana)} />
            ) : (
              <p className="card-note">
                Pick a character to see it larger, with its stroke order where the server has it.
              </p>
            )}

            <Link className="btn btn-secondary btn-sm" to="/courses">
              Open the catalog
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}
