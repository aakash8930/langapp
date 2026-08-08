import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useSession } from '../useSession';

interface Challenge {
  id: string;
  title: string;
  desc: string;
  target: number;
  current: number;
  unit: string;
  icon: string;
  xpReward: number;
}

const CHALLENGES: Challenge[] = [
  { id: 'review', title: 'Daily Reviewer', desc: 'Complete 20 reviews today', target: 20, current: 0, unit: 'reviews', icon: '🔄', xpReward: 30 },
  { id: 'vocab', title: 'Word Master', desc: 'Practice 10 vocabulary words', target: 10, current: 0, unit: 'words', icon: '📝', xpReward: 20 },
  { id: 'kanji', title: 'Kanji Starter', desc: 'Learn 5 new kanji characters', target: 5, current: 0, unit: 'kanji', icon: '漢', xpReward: 25 },
  { id: 'grammar', title: 'Grammar Guru', desc: 'Complete 3 grammar exercises', target: 3, current: 0, unit: 'exercises', icon: '文', xpReward: 20 },
  { id: 'listen', title: 'Ear Training', desc: 'Complete 15 listening questions', target: 15, current: 0, unit: 'questions', icon: '🎧', xpReward: 25 },
];

export function ChallengesPage() {
  const { session } = useSession();
  const signedIn = session.state === 'signedIn';
  const progress = signedIn ? session.progress : null;
  const [challenges] = useState<Challenge[]>(() =>
    CHALLENGES.map((c) => {
      if (c.id === 'review' && progress) c.current = Math.min(c.target, progress.daily.reviewsDone);
      if (c.id === 'vocab' && progress) c.current = Math.min(c.target, progress.daily.lessonsDone);
      return c;
    }),
  );

  const completed = challenges.filter((c) => c.current >= c.target).length;

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">Daily Challenges</h1>
        <p className="page-sub">
          {completed === challenges.length
            ? 'All challenges complete! 🎉'
            : `${completed} of ${challenges.length} challenges completed`}
        </p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-md)', maxWidth: '600px', margin: '0 auto' }}>
        {challenges.map((c) => {
          const pct = Math.min(100, (c.current / c.target) * 100);
          const done = c.current >= c.target;
          return (
            <div key={c.id} className="glass panel" style={{
              padding: 'var(--s-lg)',
              opacity: done ? 1 : undefined,
              borderLeft: done ? '4px solid var(--brand-success)' : undefined,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--s-sm)' }}>
                <div>
                  <span style={{ fontSize: '1.5rem', marginRight: 'var(--s-sm)' }}>{c.icon}</span>
                  <strong>{c.title}</strong>
                  <span style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-caption)', marginLeft: 'var(--s-sm)' }}>+{c.xpReward} XP</span>
                </div>
                {done && <span style={{ color: 'var(--brand-success)', fontWeight: 700 }}>✓ Done</span>}
              </div>
              <p style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-small)', margin: '0 0 var(--s-sm)' }}>{c.desc}</p>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-sm)' }}>
                <div className="band-bar" style={{ flex: 1, height: '8px' }}>
                  <span className="band-bar-fill" style={{ width: `${pct}%`, background: done ? 'var(--brand-success)' : 'var(--brand-primary)' }} />
                </div>
                <span className="tabular" style={{ fontSize: 'var(--text-caption)', minWidth: '60px', textAlign: 'right' }}>
                  {c.current} / {c.target} {c.unit}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="glass panel" style={{ marginTop: 'var(--s-xl)', padding: 'var(--s-lg)', textAlign: 'center', maxWidth: '600px', margin: 'var(--s-xl) auto 0' }}>
        <p className="card-note" style={{ margin: 0 }}>
          Challenges reset daily. Complete them to earn bonus XP and track your progress.
        </p>
        <div style={{ display: 'flex', gap: 'var(--s-md)', justifyContent: 'center', marginTop: 'var(--s-md)', flexWrap: 'wrap' }}>
          <Link className="btn btn-primary" to="/leagues">View Leaderboard</Link>
          <Link className="btn btn-secondary" to="/achievements">View Achievements</Link>
        </div>
      </div>
    </div>
  );
}
