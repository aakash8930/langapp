import { useState } from 'react';
import { Link } from '@tanstack/react-router';

interface TestResult {
  date: string;
  score: number;
  total: number;
  passed: boolean;
  level: string;
}

function loadResults(): TestResult[] {
  try {
    const raw = localStorage.getItem('jlpt_results');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function JLPTResults() {
  const [results] = useState<TestResult[]>(() => loadResults());

  if (results.length === 0) {
    return (
      <div className="page">
        <header className="page-head">
          <h1 className="page-title">JLPT Results</h1>
        </header>
        <div className="glass panel quiz-summary">
          <h2>No test results yet</h2>
          <p className="summary-note">Take a mock test to see your results tracked here.</p>
          <div style={{ display: 'flex', gap: 'var(--s-md)', marginTop: 'var(--s-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link className="btn btn-primary" to="/jlpt-mock-test">Take Mock Test</Link>
          </div>
        </div>
      </div>
    );
  }

  const best = Math.max(...results.map((r) => r.score));
  const passed = results.filter((r) => r.passed).length;
  const improving = results.length >= 2 && results[results.length - 1].score > results[0].score;

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">JLPT Results</h1>
        <p className="page-sub">Track your mock test performance over time.</p>
      </header>

      <section className="stat-band" style={{ marginBottom: 'var(--s-xl)' }}>
        <div className="stat-tile glass">
          <p className="stat-tile-label">Tests taken</p>
          <p className="stat-tile-value tabular">{results.length}</p>
        </div>
        <div className="stat-tile glass">
          <p className="stat-tile-label">Best score</p>
          <p className="stat-tile-value tabular" style={{ color: best >= 60 ? 'var(--brand-success)' : 'var(--shu)' }}>{best}%</p>
        </div>
        <div className="stat-tile glass">
          <p className="stat-tile-label">Pass rate</p>
          <p className="stat-tile-value tabular">{results.length > 0 ? Math.round((passed / results.length) * 100) : 0}%</p>
        </div>
        <div className="stat-tile glass">
          <p className="stat-tile-label">Trend</p>
          <p className="stat-tile-value tabular" style={{ color: improving ? 'var(--brand-success)' : 'var(--ink-soft)' }}>
            {improving ? '↑ Improving' : '—'}
          </p>
        </div>
      </section>

      <div className="glass panel" style={{ padding: 'var(--s-xl)' }}>
        <h2 style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-caption)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--s-md)' }}>
          Score history
        </h2>

        {/* Score bar chart */}
        <div className="forecast-bars" style={{ marginBottom: 'var(--s-lg)', paddingBottom: 'var(--s-lg)', borderBottom: '1px solid var(--hairline)' }}>
          {results.map((r, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--s-xs)', flex: 1 }}>
              <span className="tabular" style={{ fontSize: 'var(--text-caption)', fontWeight: 700, color: r.passed ? 'var(--brand-success)' : 'var(--shu)' }}>
                {r.score}%
              </span>
              <div style={{
                width: '100%', maxWidth: '40px',
                height: `${Math.max(8, r.score * 0.8)}px`,
                background: r.passed ? 'var(--brand-success)' : 'var(--shu)',
                borderRadius: 'var(--radius-sm) 0 0 0',
                opacity: 0.7,
                minWidth: '20px',
              }} />
              <span style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-soft)' }}>#{i + 1}</span>
            </div>
          ))}
        </div>

        {/* Results list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-sm)' }}>
          {results.slice().reverse().map((r, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--s-sm) var(--s-md)', borderRadius: 'var(--radius-md)', background: r.passed ? 'color-mix(in srgb, var(--brand-success) 8%, transparent)' : 'color-mix(in srgb, var(--shu) 8%, transparent)' }}>
              <div>
                <span style={{ fontSize: 'var(--text-small)', color: 'var(--ink-soft)' }}>
                  {new Date(r.date).toLocaleDateString()}
                </span>
                <span className="vocab-tag vocab-tag-jlpt" style={{ marginLeft: 'var(--s-sm)' }}>{r.level}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <strong className="tabular" style={{ color: r.passed ? 'var(--brand-success)' : 'var(--shu)' }}>
                  {r.score}%
                </strong>
                <span style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-soft)', display: 'block' }}>
                  {r.passed ? 'Pass' : 'Needs work'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--s-md)', marginTop: 'var(--s-lg)', justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link className="btn btn-primary" to="/jlpt-mock-test">Take another test</Link>
        <Link className="btn btn-secondary" to="/jlpt">Back to JLPT dashboard</Link>
      </div>
    </div>
  );
}
