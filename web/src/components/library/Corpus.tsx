import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';

import type { ResolvedItem } from '../../api';
import { useKanjiBookmarks } from '../../hooks/useKanjiBookmarks';
import { Icon } from '../ui/Icon';
import {
  itemsOfKind,
  searchableText,
  useCorpus,
  type GrammarItem,
  type KanjiItem,
  type VocabItem,
} from './useCorpus';
import { KANJI_WRITES } from './kanjiWrites';

import './corpus.css';

/**
 * How many rows are painted at once.
 *
 * There are 929 authored vocabulary rows. Rendering all of them is thousands of DOM
 * nodes for a list nobody scrolls to the bottom of, and it makes the search
 * field feel sticky on every keystroke. A cap plus a count is the honest,
 * dependency-free version of virtualisation: the screen says how many matched
 * and how many it is showing, so a truncated list is never mistaken for the
 * whole answer.
 */
const RENDER_CAP = 120;

/**
 * The shared frame: a search box, the loading/error/empty states, and a count.
 *
 * Every library screen has the same three failure modes and the same header, so
 * they share one component rather than four near-identical copies that drift —
 * the `.btn` / `.button` lesson, applied before it happens rather than after.
 */
function LibraryFrame({
  title,
  glyph,
  blurb,
  placeholder,
  items,
  render,
  onSearch,
}: {
  title: string;
  glyph: string;
  blurb: string;
  placeholder: string;
  /** Already narrowed to one kind by the caller. */
  items: ResolvedItem[] | null;
  render: (matched: ResolvedItem[]) => React.ReactNode;
  onSearch?: (query: string) => void;
}) {
  const corpus = useCorpus();
  const [query, setQuery] = useState('');

  const matched = useMemo(() => {
    if (!items) return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => searchableText(item).toLowerCase().includes(needle));
  }, [items, query]);

  const shown = matched.slice(0, RENDER_CAP);

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">
          <span className="ja library-title-glyph" aria-hidden="true">
            {glyph}
          </span>{' '}
          {title}
        </h1>
        <p className="page-sub">{blurb}</p>
      </header>

      <form className="library-search" onSubmit={(event) => { event.preventDefault(); onSearch?.(query); }}>
        <Icon name="search" size={16} />
        <input
          className="library-search-input"
          type="search"
          placeholder={placeholder}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onBlur={() => { if (query.trim()) onSearch?.(query); }}
          aria-label={`Search ${title.toLowerCase()}`}
        />
      </form>

      {corpus.isPending ? (
        <p className="card-note">Loading the syllabus…</p>
      ) : corpus.isError ? (
        <p className="note note-error">
          <strong>The syllabus could not be loaded.</strong>
          <span>The API may be asleep. Nothing is wrong with your progress.</span>
        </p>
      ) : (
        <>
          {/* A partial corpus is usable, but the learner has to be told it is
              partial — otherwise a missing word looks like it was never taught. */}
          {corpus.data.failedUnits.length > 0 ? (
            <p className="card-note">
              {corpus.data.failedUnits.length} of the course&rsquo;s units could not be loaded, so
              this list is incomplete.
            </p>
          ) : null}

          <p className="library-count tabular" role="status">
            {matched.length === 0
              ? 'Nothing matches that.'
              : shown.length < matched.length
                ? `Showing ${shown.length} of ${matched.length} — narrow the search to see more.`
                : `${matched.length} ${matched.length === 1 ? 'entry' : 'entries'}`}
          </p>

          {render(shown)}
        </>
      )}
    </div>
  );
}

/** Authored words: lemma, reading, romaji, gloss, part of speech, JLPT level. */
export function VocabularyLibrary() {
  const corpus = useCorpus();
  const items = corpus.data ? itemsOfKind(corpus.data.items, 'vocab') : null;

  return (
    <LibraryFrame
      title="Vocabulary"
      glyph="語"
      blurb="Every word the course teaches, across all units."
      placeholder="Search by word, reading or meaning…"
      items={items}
      render={(matched) => (
        <ul className="vocab-list">
          {(matched as VocabItem[]).map((item) => (
            <li className="vocab-row" key={item.id}>
              <span className="vocab-lemma ja" lang="ja">
                {item.lemma}
              </span>
              <span className="vocab-reading ja" lang="ja">
                {/* Only when it differs — a reading identical to the word is
                    noise, and for kana-only words it always is. */}
                {item.reading === item.lemma ? '' : item.reading}
              </span>
              <span className="vocab-gloss">{item.gloss}</span>
              <span className="vocab-meta">
                {item.romaji ? <span className="vocab-romaji">{item.romaji}</span> : null}
                <span className="vocab-tag">{item.pos}</span>
                <span className="vocab-tag vocab-tag-jlpt">{item.jlpt}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    />
  );
}

/** Authored kanji, as a grid with an expandable detail per character. */
export function KanjiLibrary() {
  const corpus = useCorpus();
  const items = corpus.data ? itemsOfKind(corpus.data.items, 'kanji') : null;
  const { isBookmarked, toggle } = useKanjiBookmarks();

  return (
    <LibraryFrame
      title="Kanji"
      glyph="漢"
      blurb="Every character the course teaches, with readings, stroke count, and compound words."
      placeholder="Search by character, meaning or reading…"
      items={items}
      render={(matched) => (
        <ul className="kanji-grid">
          {(matched as KanjiItem[]).map((item) => {
            const compounds = KANJI_WRITES[item.char] ?? [];
            const bm = isBookmarked(item.char);

            return (
            <li key={item.id}>
              <details className="kanji-card">
                <summary className="kanji-summary">
                  <span className="kanji-char ja" lang="ja">
                    {item.char}
                  </span>
                  <span className="kanji-meaning">{item.meanings[0] ?? '—'}</span>
                  <button
                    type="button"
                    className="vocab-bookmark-btn"
                    style={{ marginLeft: 'auto', color: bm ? '#f59e0b' : undefined }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggle(item.char, item.meanings[0] ?? '');
                    }}
                    title={bm ? 'Remove bookmark' : 'Bookmark'}
                  >
                    {bm ? '★' : '☆'}
                  </button>
                </summary>

                <dl className="kanji-facts">
                  <div>
                    <dt>Meanings</dt>
                    <dd>{item.meanings.join(', ') || '—'}</dd>
                  </div>
                  <div>
                    <dt>On</dt>
                    <dd className="ja" lang="ja">{item.on.join('、') || '—'}</dd>
                  </div>
                  <div>
                    <dt>Kun</dt>
                    <dd className="ja" lang="ja">{item.kun.join('、') || '—'}</dd>
                  </div>
                  <div>
                    <dt>Strokes</dt>
                    <dd className="tabular">{item.strokes}</dd>
                  </div>
                  {(item as any).radical && (
                    <div><dt>Radical</dt><dd className="ja" lang="ja">{(item as any).radical}</dd></div>
                  )}
                  {(item as any).jlpt && (
                    <div><dt>JLPT</dt>
                    <dd><span className="vocab-tag vocab-tag-jlpt">{(item as any).jlpt}</span></dd></div>
                  )}
                </dl>

                {compounds.length > 0 && (
                  <div style={{ marginTop: 'var(--s-md)', paddingTop: 'var(--s-md)', borderTop: '1px solid var(--hairline)' }}>
                    <h3 style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-caption)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 var(--s-sm)' }}>
                      Writes these words
                    </h3>
                    <div className="vocab-related-tags">
                      {compounds.map((w) => (
                        <span key={w} className="vocab-tag vocab-tag-related">{w}</span>
                      ))}
                    </div>
                  </div>
                )}
              </details>
            </li>
            );
          })}
        </ul>
      )}
    />
  );
}

/** Authored grammar points, each with its explanation and worked examples. */
export function GrammarLibrary() {
  const corpus = useCorpus();
  const items = corpus.data ? itemsOfKind(corpus.data.items, 'grammar') : null;

  return (
    <LibraryFrame
      title="Grammar"
      glyph="文"
      blurb="Every pattern the course teaches, with its examples."
      placeholder="Search by pattern or explanation…"
      items={items}
      render={(matched) => (
        <ul className="grammar-list">
          {(matched as GrammarItem[]).map((item) => (
            <li key={item.id}>
              <details className="grammar-card">
                <summary className="grammar-summary">
                  <Link to="/grammar/$id" params={{ id: item.id }} className="grammar-title" style={{ textDecoration: 'none' }}>
                    {item.title}
                  </Link>
                  <span className="vocab-tag vocab-tag-jlpt">{item.jlpt}</span>
                </summary>

                <p className="grammar-explanation">{item.explanation}</p>

                {item.examples.length > 0 ? (
                  <ul className="example-list">
                    {item.examples.map((example, index) => (
                      <li className="example" key={`${item.id}-${index}`}>
                        <p className="example-sentence ja" lang="ja">
                          {example.sentence.replace('＿', example.answer)}
                        </p>
                        {example.romaji ? (
                          <p className="example-romaji">{example.romaji}</p>
                        ) : null}
                        <p className="example-gloss">{example.gloss}</p>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </details>
            </li>
          ))}
        </ul>
      )}
    />
  );
}

/**
 * Search across every kind at once.
 *
 * This is the honest form of "Dictionary" for this product. A real dictionary
 * is a reference work covering the language; this covers **the items in the
 * currently authored course** and says so, because there is no whole-language dictionary API behind it
 * and pretending otherwise would have a learner conclude a word does not exist
 * in Japanese when it merely is not in the syllabus yet.
 */
export function DictionarySearch({ onSearch }: { onSearch?: (query: string) => void }) {
  const corpus = useCorpus();
  const items = corpus.data?.items ?? null;

  return (
    <LibraryFrame
      title="Dictionary"
      glyph="辞"
      blurb="Everything in the syllabus — words, characters, kana and grammar — in one search. This is the course's content, not the whole language."
      placeholder="Search anything in the course…"
      items={items}
      onSearch={onSearch}
      render={(matched) => (
        <ul className="dict-list">
          {matched.map((item) => {
            const face = dictFace(item);
            const destination = item.kind === 'kanji' ? `/kanji/${item.id}` : item.kind === 'grammar' ? `/grammar/${item.id}` : item.kind === 'vocab' ? '/vocabulary' : item.kind === 'kana' ? `/${item.script}` : '/dictionary';
            return (
              <li className="dict-row" key={`${item.kind}-${item.id}`}>
                <a href={destination} className="dict-entry-link">
                  <span className="dict-glyph ja" lang="ja">{face.glyph}</span>
                  <span className="dict-body"><span className="dict-label">{face.label}</span><span className="dict-note">{face.note}</span></span>
                  <span className={`vocab-tag dict-kind dict-kind-${item.kind}`}>{item.kind}</span>
                  <span className="dict-details">Details →</span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    />
  );
}

/** One row's face, whichever kind it is. */
function dictFace(item: ResolvedItem): { glyph: string; label: string; note: string } {
  switch (item.kind) {
    case 'kana':
      return { glyph: item.kana, label: item.romaji, note: `${item.script} · row ${item.row}` };
    case 'vocab':
      return {
        glyph: item.lemma,
        label: item.gloss,
        note: [item.reading === item.lemma ? '' : item.reading, item.romaji, item.pos]
          .filter(Boolean)
          .join(' · '),
      };
    case 'kanji':
      return {
        glyph: item.char,
        label: item.meanings.join(', ') || '—',
        note: [item.on.join('、'), item.kun.join('、')].filter(Boolean).join(' · '),
      };
    case 'grammar':
      return { glyph: '文', label: item.title, note: item.jlpt };
  }
}
