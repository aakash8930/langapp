import { createFileRoute } from '@tanstack/react-router';
import { DictionarySearch } from '../components/library/Corpus';
import { useDictionaryHistory } from '../hooks/useDictionaryHistory';

export const Route = createFileRoute('/dictionary')({
  component: DictPage,
});

function DictPage() {
  const { history, addQuery, clear } = useDictionaryHistory();

  return (
    <div>
      <DictionarySearch />

      {history.length > 0 && (
        <div style={{ maxWidth: '600px', margin: 'var(--s-lg) auto 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--s-sm)' }}>
            <span style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-caption)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Recent searches</span>
            <button className="btn btn-sm btn-secondary" onClick={clear}>Clear</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--s-sm)' }}>
            {history.slice(0, 10).map((h, i) => (
              <button
                key={i}
                className="vocab-tag"
                onClick={() => addQuery(h.query)}
                title={`Searched ${new Date(h.timestamp).toLocaleDateString()}`}
                style={{ cursor: 'pointer' }}
              >
                {h.query}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
