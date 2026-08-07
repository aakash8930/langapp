import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';

import { useCorpus } from '../components/library/useCorpus';
import { fetchMemoryModel } from '../api';
import { useSession } from '../useSession';
import { queryKeys } from '../queryKeys';

export function JLPTDashboard() {
  const corpus = useCorpus();
  const { session } = useSession();
  const signedIn = session.state === 'signedIn';

  const memory = useQuery({
    queryKey: queryKeys.learning.memoryModel,
    queryFn: fetchMemoryModel,
    enabled: signedIn,
  });

  const items = corpus.data?.items ?? [];

  const n5Words = items.filter((i) => i.kind === 'vocab' && ('jlpt' in i && i.jlpt === 'N5')).length;
  const n5Kanji = items.filter((i) => i.kind === 'kanji' && ('jlpt' in i && i.jlpt === 'N5')).length;
  const n5Grammar = items.filter((i) => i.kind === 'grammar' && ('jlpt' in i && i.jlpt === 'N5')).length;

  const levels = ['N5', 'N4', 'N3', 'N2', 'N1'] as const;

  if (corpus.isPending) {
    return <div className="page"><header className="page-head"><h1 className="page-title">JLPT</h1></header><p className="card-note">Loading…</p></div>;
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">JLPT Practice</h1>
        <p className="page-sub">
          Track your readiness for the Japanese Language Proficiency Test.
        </p>
      </header>

      <div className="stat-band" style={{ marginBottom: 'var(--s-xl)' }}>
        <div className="stat-tile glass">
          <p className="stat-tile-label">N5 Words</p>
          <p className="stat-tile-value tabular">{n5Words}</p>
          <p className="stat-tile-note">in the course corpus</p>
        </div>
        <div className="stat-tile glass">
          <p className="stat-tile-label">N5 Kanji</p>
          <p className="stat-tile-value tabular">{n5Kanji}</p>
          <p className="stat-tile-note">characters taught</p>
        </div>
        <div className="stat-tile glass">
          <p className="stat-tile-label">N5 Grammar</p>
          <p className="stat-tile-value tabular">{n5Grammar}</p>
          <p className="stat-tile-note">patterns covered</p>
        </div>
        <div className="stat-tile glass">
          <p className="stat-tile-label">Retention</p>
          <p className="stat-tile-value tabular">{memory.data ? `${Math.round(memory.data.overallRetentionRate)}%` : '—'}</p>
          <p className="stat-tile-note">overall SRS recall</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 'var(--s-md)' }}>
        {levels.map((lvl) => {
          const hasData = lvl === 'N5';
          const wordCount = hasData ? n5Words : 0;
          const kanjiCount = hasData ? n5Kanji : 0;
          const isAvailable = hasData;

          return (
            <div key={lvl} className="glass panel" style={{ padding: 'var(--s-lg)', opacity: isAvailable ? 1 : 0.6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--s-md)' }}>
                <h2 style={{ margin: 0, fontSize: 'var(--text-title)', fontWeight: 700 }}>{lvl}</h2>
                {!isAvailable && <span className="placeholder-pill" style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-soft)' }}>Coming soon</span>}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-small)' }}>Vocabulary</span>
                  <span className="tabular" style={{ fontWeight: 600 }}>{wordCount || '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-small)' }}>Kanji</span>
                  <span className="tabular" style={{ fontWeight: 600 }}>{kanjiCount || '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-small)' }}>Grammar</span>
                  <span className="tabular" style={{ fontWeight: 600 }}>{lvl === 'N5' ? n5Grammar : '—'}</span>
                </div>
              </div>

              {isAvailable && (
                <Link className="btn btn-sm btn-primary" to="/vocabulary" style={{ marginTop: 'var(--s-md)', display: 'block', textAlign: 'center' }}>
                  Browse N5 words
                </Link>
              )}
            </div>
          );
        })}
      </div>

      <div className="glass panel" style={{ marginTop: 'var(--s-xl)', padding: 'var(--s-lg)', textAlign: 'center' }}>
        <p className="card-note" style={{ margin: '0 0 var(--s-md)' }}>
          Currently <strong>802 N5 words</strong>, <strong>104 N5 kanji</strong>, and <strong>12 N5 grammar points</strong> are in the course.
        </p>
        <div style={{ display: 'flex', gap: 'var(--s-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link className="btn btn-primary" to="/jlpt-mock-test">Take N5 Mock Test</Link>
          <Link className="btn btn-secondary" to="/jlpt-results">View Results</Link>
          <Link className="btn btn-secondary" to="/vocabulary">Browse N5 words</Link>
          <Link className="btn btn-secondary" to="/kanji">Browse N5 kanji</Link>
        </div>
      </div>
    </div>
  );
}
