import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';

import { useVocabLists } from '../hooks/useVocabLists';
import { exportAsJson, exportAsCsv } from '../components/library/exportVocab';

export const Route = createFileRoute('/vocab-lists')({
  component: ListsRoute,
});

function ListsRoute() {
  const { lists, create, remove, removeEntry } = useVocabLists();
  const [newName, setNewName] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [exportText, setExportText] = useState('');
  const [exportFor, setExportFor] = useState('');

  const toggle = (id: string) => {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">
          <span className="ja library-title-glyph" aria-hidden="true">📋</span>{' '}
          Custom Lists
        </h1>
        <p className="page-sub">
          {lists.length} list{lists.length === 1 ? '' : 's'} — create, curate, and export.
        </p>
      </header>

      <div style={{ display: 'flex', gap: 'var(--s-md)', marginBottom: 'var(--s-xl)', flexWrap: 'wrap', alignItems: 'center' }}>
        <Link className="btn btn-sm btn-secondary" to="/vocabulary">
          ← Browse vocabulary
        </Link>
        <input
          className="reading-input"
          style={{ maxWidth: '260px', fontSize: 'var(--text-body)' }}
          placeholder="New list name…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newName.trim()) {
              create(newName.trim());
              setNewName('');
            }
          }}
        />
        <button
          className="btn btn-sm btn-primary"
          onClick={() => { if (newName.trim()) { create(newName.trim()); setNewName(''); } }}
          disabled={!newName.trim()}
        >
          Create
        </button>
      </div>

      {exportText && (
        <div className="export-area">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--s-md)' }}>
            <span style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-small)' }}>
              Export for: <strong>{exportFor}</strong>
            </span>
            <button
              className="btn btn-sm btn-secondary"
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(exportText);
              }}
            >
              Copy
            </button>
          </div>
          <pre>{exportText}</pre>
        </div>
      )}

      {lists.length === 0 ? (
        <div className="glass panel quiz-summary">
          <h2>No lists yet</h2>
          <p className="summary-note">
            Create a list, then add words from the vocabulary browser.
          </p>
        </div>
      ) : (
        lists.map((list) => (
          <div key={list.id} className="list-card">
            <div className="list-card-header">
              <button
                type="button"
                className="link-button"
                onClick={() => toggle(list.id)}
                style={{ fontWeight: 700, fontSize: 'var(--text-large)' }}
              >
                {expanded.has(list.id) ? '▾' : '▸'} {list.name}
              </button>
              <div style={{ display: 'flex', gap: 'var(--s-sm)', alignItems: 'center' }}>
                <span className="list-card-count">{list.entries.length} words</span>
                <button
                  className="btn btn-sm btn-secondary"
                  type="button"
                  onClick={() => {
                    setExportFor(list.name);
                    setExportText(exportAsJson(list.entries.map((e) => ({
                      lemma: e.lemma,
                      reading: e.reading,
                      gloss: e.gloss,
                      addedAt: e.addedAt,
                    }))));
                  }}
                >
                  Export JSON
                </button>
                <button
                  className="btn btn-sm btn-secondary"
                  type="button"
                  onClick={() => {
                    setExportFor(list.name);
                    setExportText(exportAsCsv(list.entries.map((e) => ({
                      lemma: e.lemma,
                      reading: e.reading,
                      gloss: e.gloss,
                      addedAt: e.addedAt,
                    }))));
                  }}
                >
                  Export CSV
                </button>
                <button
                  className="btn btn-sm btn-secondary"
                  type="button"
                  onClick={() => remove(list.id)}
                  style={{ color: 'var(--danger)' }}
                >
                  Delete
                </button>
              </div>
            </div>

            {expanded.has(list.id) && (
              <>
                {list.entries.length === 0 ? (
                  <p className="card-note">No words yet. Browse vocabulary and use "Add to list".</p>
                ) : (
                  list.entries.map((entry) => (
                    <div key={entry.id} className="list-entry-row">
                      <span className="list-entry-lemma ja" lang="ja">{entry.lemma}</span>
                      <span className="list-entry-gloss">{entry.gloss}</span>
                      <button
                        type="button"
                        className="list-entry-remove"
                        onClick={() => removeEntry(list.id, entry.id)}
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}

                <Link
                  className="btn btn-sm btn-primary"
                  to="/vocabulary"
                  style={{ marginTop: 'var(--s-md)', display: 'inline-block' }}
                >
                  Browse to add words
                </Link>
              </>
            )}
          </div>
        ))
      )}
    </div>
  );
}
