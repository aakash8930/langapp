import { Link } from '@tanstack/react-router';

import type { Progress } from '../api';
import { achievementsFor, levelTier } from '../gamification';
import { Achievements } from './Achievements';
import './gamification-hub.css';

export function GamificationHub({ progress }: { progress: Progress }) {
  const badges = achievementsFor(progress);
  const earned = badges.filter((badge) => badge.unlocked).length;
  const levelPercent = progress.xpForNextLevel ? Math.min(100, progress.xpIntoLevel / progress.xpForNextLevel * 100) : 0;
  return <>
    <section className="game-hero glass"><div><p className="game-kicker">REWARD ENGINE</p><h2>Level {progress.level} · {levelTier(progress.level)} tier</h2><p>{progress.xp.toLocaleString()} lifetime XP. XP reflects learning activity and cannot be spent.</p></div><div className="game-level"><span>{progress.xpIntoLevel.toLocaleString()} / {progress.xpForNextLevel.toLocaleString()} XP</span><div><i style={{ width: `${levelPercent}%` }} /></div><small>to level {progress.level + 1}</small></div></section>
    <section className="game-summary-grid">
      <article className="glass"><span>🏆</span><div><b>{earned} achievements</b><small>{badges.length - earned} milestones still ahead</small></div></article>
      <article className="glass"><span>🔥</span><div><b>{progress.streakDays}-day streak</b><small>Consistency is rewarded through achievements</small></div></article>
      <article className="glass"><span>🎯</span><div><b>{progress.daily.xpToday} XP today</b><small>{progress.daily.goalXp} XP daily target</small></div></article>
    </section>
    <Achievements progress={progress} />
    <section className="game-system-grid">
      <article className="glass"><p className="game-kicker">ACTIVE NOW</p><h2>Challenges</h2><p>Short, skill-focused sessions with their own personal-best scoring. They complement learning; they do not alter review scheduling.</p><Link className="btn btn-secondary" to="/challenges">Open challenges</Link></article>
      <article className="glass"><p className="game-kicker">COMMUNITY</p><h2>Leaderboard</h2><p>Weekly activity rankings are handled separately from platform levels and course progress.</p><Link className="btn btn-secondary" to="/leagues">View leaderboard</Link></article>
      <article className="glass game-future"><p className="game-kicker">LEDGER REQUIRED</p><h2>Coins, rewards & missions</h2><p>These need server-owned transaction, redemption, and mission-progress records. They remain unavailable until that auditable reward engine exists.</p><span>Not fabricated from client-side counters</span></article>
    </section>
    <section className="game-rule glass"><div><p className="game-kicker">ARCHITECTURE RULE</p><h2>Learning events earn rewards.</h2><p>Courses, practice, reviews, reading, writing, JLPT, and exams should emit validated events. The reward engine then awards XP, checks achievement rules, and updates challenge or mission progress—without changing the learning system itself.</p></div><div className="game-flow"><b>Learning event</b><i>→</i><b>Validate</b><i>→</i><b>XP & achievements</b><i>→</i><b>Progress & leaderboard</b></div></section>
  </>;
}
