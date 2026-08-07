import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { fetchLeaderboard } from '../api';
import { useSession } from '../useSession';

export function ExamHubPage() {
  const { session } = useSession();
  const signedIn = session.state === 'signedIn';

  const leaderboard = useQuery({
    queryKey: ['leaderboard'],
    queryFn: fetchLeaderboard,
    enabled: signedIn,
  });

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">Exams & Leaderboard</h1>
        <p className="page-sub">Test your knowledge and see how you stack up.</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--s-lg)', marginBottom: 'var(--s-xl)' }}>
        <Link className="glass panel" to="/jlpt-mock-test" style={{ padding: 'var(--s-xl)', textDecoration: 'none' }}>
          <div style={{ fontSize: '2rem', marginBottom: 'var(--s-sm)' }}>📝</div>
          <strong style={{ display: 'block', marginBottom: 'var(--s-xs)', fontSize: 'var(--text-large)' }}>JLPT N5 Mock Test</strong>
          <span style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-small)' }}>12 questions · 5 minutes · Timed with pass/fail scoring</span>
        </Link>

        <Link className="glass panel" to="/jlpt-results" style={{ padding: 'var(--s-xl)', textDecoration: 'none' }}>
          <div style={{ fontSize: '2rem', marginBottom: 'var(--s-sm)' }}>📊</div>
          <strong style={{ display: 'block', marginBottom: 'var(--s-xs)', fontSize: 'var(--text-large)' }}>Results History</strong>
          <span style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-small)' }}>Track your scores, trends, and pass rate over time</span>
        </Link>

        <Link className="glass panel" to="/jlpt" style={{ padding: 'var(--s-xl)', textDecoration: 'none' }}>
          <div style={{ fontSize: '2rem', marginBottom: 'var(--s-sm)' }}>🎓</div>
          <strong style={{ display: 'block', marginBottom: 'var(--s-xs)', fontSize: 'var(--text-large)' }}>JLPT Dashboard</strong>
          <span style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-small)' }}>802 N5 words · 104 N5 kanji · 12 N5 grammar points</span>
        </Link>

        <Link className="glass panel" to="/leagues" style={{ padding: 'var(--s-xl)', textDecoration: 'none' }}>
          <div style={{ fontSize: '2rem', marginBottom: 'var(--s-sm)' }}>🏆</div>
          <strong style={{ display: 'block', marginBottom: 'var(--s-xs)', fontSize: 'var(--text-large)' }}>Leaderboard</strong>
          <span style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-small)' }}>Weekly XP rankings · Compete with other learners</span>
        </Link>
      </div>

      {signedIn && leaderboard.data && (
        <div className="glass panel" style={{ padding: 'var(--s-lg)' }}>
          <h2 style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-caption)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--s-md)' }}>
            Your rank this week
          </h2>
          <div style={{ display: 'flex', gap: 'var(--s-xl)', flexWrap: 'wrap' }}>
            <div>
              <span style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-small)' }}>Rank</span>
              <p style={{ fontSize: 'var(--text-heading)', fontWeight: 700, margin: 'var(--s-xs) 0' }}>
                #{leaderboard.data.yourRank ?? '—'}
              </p>
            </div>
            <div>
              <span style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-small)' }}>Weekly XP</span>
              <p style={{ fontSize: 'var(--text-heading)', fontWeight: 700, margin: 'var(--s-xs) 0', color: 'var(--brand-primary)' }}>
                {leaderboard.data.rows.find((r) => r.isYou)?.weeklyXp?.toLocaleString() ?? '—'}
              </p>
            </div>
            <div>
              <span style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-small)' }}>Tier</span>
              <p style={{ fontSize: 'var(--text-heading)', fontWeight: 700, margin: 'var(--s-xs) 0' }}>
                {leaderboard.data.tierName}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
