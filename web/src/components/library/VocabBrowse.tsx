import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';

import { audioUrlForVocab } from '../../audio';
import type { VocabItem } from './useCorpus';
import { useCorpus } from './useCorpus';

import './vocab-browse.css';

export function VocabBrowse({
  bookmarked,
  onToggleBookmark,
  lists,
  onAddToList,
  listFilter,
  listEntries,
}: {
  bookmarked: Set<string>;
  onToggleBookmark: (id: string, lemma: string, reading: string, gloss: string) => void;
  lists: { id: string; name: string }[];
  onAddToList: (listId: string, entry: { id: string; lemma: string; reading: string; gloss: string; pos: string; jlpt: string }) => void;
  listFilter?: string | null;
  listEntries?: { id: string }[] | null;
}) {
  const corpus = useCorpus();
  const items = corpus.data ? corpus.data.items.filter((i): i is VocabItem => i.kind === 'vocab') : [];
  const [query, setQuery] = useState('');
  const [selectedList, setSelectedList] = useState('');

  const filtered = useMemo(() => {
    let result = items;
    if (listFilter && listEntries) {
      const entryIds = new Set(listEntries.map((e) => e.id));
      result = result.filter((i) => entryIds.has(i.id));
    }
    const needle = query.trim().toLowerCase();
    if (!needle) return result;
    return result.filter((item) =>
      `${item.lemma} ${item.reading} ${item.romaji ?? ''} ${item.gloss} ${item.pos}`
        .toLowerCase()
        .includes(needle),
    );
  }, [items, query, listFilter, listEntries]);

  if (corpus.isPending) {
    return (
      <div className="page">
        <header className="page-head">
          <h1 className="page-title">
            <span className="ja library-title-glyph" aria-hidden="true">語</span>{' '}
            {listFilter ? `List: ${listFilter}` : 'Vocabulary'}
          </h1>
        </header>
        <p className="card-note">Loading the syllabus…</p>
      </div>
    );
  }

  if (corpus.isError) {
    return (
      <div className="page">
        <header className="page-head">
          <h1 className="page-title">
            <span className="ja library-title-glyph" aria-hidden="true">語</span>{' '}
            {listFilter ? `List: ${listFilter}` : 'Vocabulary'}
          </h1>
        </header>
        <p className="note note-error">
          <strong>The syllabus could not be loaded.</strong>
        </p>
      </div>
    );
  }

  const RENDER_CAP = 150;
  const shown = filtered.slice(0, RENDER_CAP);

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">
          <span className="ja library-title-glyph" aria-hidden="true">語</span>{' '}
          {listFilter ? `List: ${listFilter}` : 'Vocabulary'}
        </h1>
        <p className="page-sub">
          {listFilter
            ? `${filtered.length} word${filtered.length === 1 ? '' : 's'} in this list.`
            : 'Every word the course teaches. Click a row for details, audio, and bookmarks.'}
        </p>
      </header>

      <div className="vocab-toolbar">
        <div className="library-search">
          <span style={{ fontSize: 'var(--text-small)' }}>🔍</span>
          <input
            className="library-search-input"
            type="search"
            placeholder="Search by word, reading or meaning…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search vocabulary"
          />
        </div>
        {!listFilter && (
          <>
            <Link className="btn btn-sm btn-secondary" to="/vocab-bookmarks">
              Bookmarks ({bookmarked.size})
            </Link>
            <Link className="btn btn-sm btn-secondary" to="/vocab-lists">
              Lists ({lists.length})
            </Link>
            <Link className="btn btn-sm btn-secondary" to="/vocab-practice">
              Practice
            </Link>
          </>
        )}
      </div>

      <p className="library-count tabular" role="status">
        {filtered.length === 0
          ? 'Nothing matches that.'
          : shown.length < filtered.length
            ? `Showing ${shown.length} of ${filtered.length} — narrow the search to see more.`
            : `${filtered.length} ${filtered.length === 1 ? 'entry' : 'entries'}`}
      </p>

      <ul className="vocab-list">
        {shown.map((item) => (
          <VocabRow
            key={item.id}
            item={item}
            isBookmarked={bookmarked.has(item.id)}
            onToggleBookmark={onToggleBookmark}
            lists={lists}
            selectedList={selectedList}
            onSelectList={setSelectedList}
            onAddToList={onAddToList}
          />
        ))}
      </ul>
    </div>
  );
}

function VocabRow({
  item,
  isBookmarked,
  onToggleBookmark,
  lists,
  selectedList,
  onSelectList,
  onAddToList,
}: {
  item: VocabItem;
  isBookmarked: boolean;
  onToggleBookmark: (id: string, lemma: string, reading: string, gloss: string) => void;
  lists: { id: string; name: string }[];
  selectedList: string;
  onSelectList: (id: string) => void;
  onAddToList: (listId: string, entry: any) => void;
}) {
  const audioEl = useRef<HTMLAudioElement | null>(null);
  const [audioDead, setAudioDead] = useState(false);

  useEffect(() => {
    audioEl.current = null;
    setAudioDead(false);
  }, [item.id]);

  return (
    <li>
      <details className="vocab-detail-card">
        <summary className="vocab-detail-summary">
          <span className="vocab-lemma ja" lang="ja">{item.lemma}</span>
          <span className="vocab-reading ja" lang="ja">
            {item.reading === item.lemma ? '' : item.reading}
          </span>
          <span className="vocab-gloss">{item.gloss}</span>
          <span className="vocab-meta">
            {item.romaji ? <span className="vocab-romaji">{item.romaji}</span> : null}
            <span className="vocab-tag">{item.pos}</span>
            <span className="vocab-tag vocab-tag-jlpt">{item.jlpt}</span>
            <button
              type="button"
              className={`vocab-bookmark-btn ${isBookmarked ? 'vocab-bookmarked' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleBookmark(item.id, item.lemma, item.reading, item.gloss);
              }}
              title={isBookmarked ? 'Remove bookmark' : 'Bookmark'}
            >
              {isBookmarked ? '★' : '☆'}
            </button>
          </span>
        </summary>

        <div className="vocab-detail-body">
          <dl className="vocab-detail-facts">
            <div><dt>Word</dt><dd className="ja" lang="ja">{item.lemma}</dd></div>
            {item.reading !== item.lemma && (
              <div><dt>Reading</dt><dd className="ja" lang="ja">{item.reading}</dd></div>
            )}
            {item.romaji && <div><dt>Romaji</dt><dd>{item.romaji}</dd></div>}
            <div><dt>Meaning</dt><dd>{item.gloss}</dd></div>
            <div><dt>Part of speech</dt><dd>{item.pos}</dd></div>
            <div><dt>JLPT</dt><dd><span className="vocab-tag vocab-tag-jlpt">{item.jlpt}</span></dd></div>
          </dl>

          {(item.examples ?? []).length > 0 && (
            <div className="vocab-examples">
              <h3 className="vocab-section-title">Examples</h3>
              <ul className="example-list">
                {(item.examples ?? []).map((ex, i) => (
                  <li className="example" key={i}>
                    <p className="example-sentence ja" lang="ja">{ex.sentence}</p>
                    {ex.romaji && <p className="example-romaji">{ex.romaji}</p>}
                    <p className="example-gloss">{ex.gloss}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(item.synonyms ?? []).length > 0 && (
            <div className="vocab-related">
              <h3 className="vocab-section-title">Synonyms</h3>
              <div className="vocab-related-tags">
                {(item.synonyms ?? []).map((s) => <span key={s} className="vocab-tag vocab-tag-related">{s}</span>)}
              </div>
            </div>
          )}

          {(item.antonyms ?? []).length > 0 && (
            <div className="vocab-related">
              <h3 className="vocab-section-title">Antonyms</h3>
              <div className="vocab-related-tags">
                {(item.antonyms ?? []).map((a) => <span key={a} className="vocab-tag vocab-tag-related">{a}</span>)}
              </div>
            </div>
          )}

          <div className="vocab-detail-actions">
            <button
              type="button"
              className="speak"
              disabled={audioDead}
              onClick={(e) => {
                e.preventDefault();
                if (!audioEl.current) {
                  audioEl.current = new Audio(audioUrlForVocab(item.id));
                }
                audioEl.current.currentTime = 0;
                void audioEl.current.play().catch(() => setAudioDead(true));
              }}
              title={audioDead ? 'No audio available' : 'Play audio'}
            >
              <span aria-hidden="true">{audioDead ? '×' : '▶'}</span>
              <span>{audioDead ? 'No audio' : 'Hear it'}</span>
            </button>

            <button
              type="button"
              className={`btn btn-sm ${isBookmarked ? 'btn-primary' : 'btn-secondary'}`}
              onClick={(e) => {
                e.preventDefault();
                onToggleBookmark(item.id, item.lemma, item.reading, item.gloss);
              }}
            >
              {isBookmarked ? '★ Bookmarked' : '☆ Bookmark'}
            </button>

            {lists.length > 0 && (
              <div className="vocab-list-picker">
                <select
                  className="vocab-list-select"
                  value={selectedList}
                  onChange={(e) => onSelectList(e.target.value)}
                  onClick={(ev) => ev.stopPropagation()}
                >
                  <option value="">Add to list…</option>
                  {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
                {selectedList && (
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={(e) => {
                      e.preventDefault();
                      onAddToList(selectedList, {
                        id: item.id, lemma: item.lemma, reading: item.reading,
                        gloss: item.gloss, pos: item.pos, jlpt: item.jlpt,
                      });
                      onSelectList('');
                    }}
                  >
                    Add
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </details>
    </li>
  );
}
