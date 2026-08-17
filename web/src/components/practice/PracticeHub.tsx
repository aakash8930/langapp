import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';

import { fetchPracticeOverview } from '../../api';
import { queryKeys } from '../../queryKeys';
import { useSession } from '../../useSession';
import { Icon, type IconName } from '../ui/Icon';
import type { PracticeMode, PracticeOverview, PracticeSkill } from './practiceTypes';
import './practice.css';

const SKILL_META: Record<PracticeSkill, { label: string; icon: IconName; tone: string }> = {
  vocabulary: { label: 'Vocabulary', icon: 'book-open', tone: 'violet' },
  kanji: { label: 'Kanji', icon: 'languages', tone: 'green' },
  grammar: { label: 'Grammar', icon: 'message-circle', tone: 'amber' },
  reading: { label: 'Reading', icon: 'newspaper', tone: 'cyan' },
};

const DEDICATED_SKILLS: { label: string; note: string; icon: IconName; tone: string; to: '/listening' | '/speaking' | '/writing' | '/jlpt' }[] = [
  { label: 'Listening', note: 'Dedicated audio lab', icon: 'headphones', tone: 'blue', to: '/listening' },
  { label: 'Speaking', note: 'Pronunciation feedback', icon: 'mic', tone: 'rose', to: '/speaking' },
  { label: 'Writing', note: 'Composition workspace', icon: 'pen-tool', tone: 'gold', to: '/writing' },
  { label: 'JLPT Practice', note: 'Exam preparation', icon: 'graduation-cap', tone: 'red', to: '/jlpt' },
];

const MODES: { mode: PracticeMode; title: string; note: string; icon: IconName; tone: string; to: '/daily-practice' | '/mixed-practice' | '/weak-areas' | '/timed-practice' | '/random-practice' | '/challenge-mode' }[] = [
  { mode: 'daily', title: 'Daily Practice', note: 'A personalized plan, not a due queue', icon: 'calendar', tone: 'green', to: '/daily-practice' },
  { mode: 'mixed', title: 'Mixed Practice', note: 'Interleave skills and formats', icon: 'grid', tone: 'violet', to: '/mixed-practice' },
  { mode: 'weak', title: 'Weak Areas', note: 'Target real confidence evidence', icon: 'brain', tone: 'rose', to: '/weak-areas' },
  { mode: 'timed', title: 'Timed Practice', note: 'Work against a server clock', icon: 'history', tone: 'blue', to: '/timed-practice' },
  { mode: 'random', title: 'Random Practice', note: 'Filter a real course sample', icon: 'wand-2', tone: 'gold', to: '/random-practice' },
  { mode: 'challenge', title: 'Challenge Mode', note: 'Combos, pressure, XP, personal best', icon: 'trophy', tone: 'amber', to: '/challenge-mode' },
];

export function PracticeHub() {
  const { session } = useSession();
  const signedIn = session.state === 'signedIn';
  const overview = useQuery({
    queryKey: queryKeys.practice.overview,
    queryFn: fetchPracticeOverview,
    enabled: signedIn,
    staleTime: 30_000,
  });
  const dataReady = signedIn && overview.data !== undefined;

  return (
    <div className="page practice-hub-page">
      <header className="practice-hub-hero">
        <div>
          <p className="practice-eyebrow">Generated exercise center</p>
          <h1>Practice Hub <Icon name="brain" size={30} /></h1>
          <p>Sharpen your skills every day. Small practice, measurable progress.</p>
        </div>
        <div className="practice-hero-proof">
          <Icon name="shield-check" size={19} />
          <span>Server graded<br /><small>No answer keys before submission</small></span>
        </div>
      </header>

      <nav className="practice-hub-tabs" aria-label="Practice Hub sections">
        <a href="#overview" className="is-active">Overview</a>
        <a href="#daily-plan">Daily plan</a>
        <Link to="/weak-areas">Weak areas</Link>
        <a href="#practice-modes">Practice modes</a>
      </nav>

      {session.state === 'loading' && (
        <HubState icon="refresh-cw" title="Checking your Practice account…" />
      )}
      {session.state === 'signedOut' && (
        <HubState
          icon="lock"
          title="Sign in for personalized Practice"
          body="Scores, mistakes, weak-area evidence, plans, and personal bests are account data. The modes below remain visible so you can see what is available."
        >
          <Link className="btn btn-primary" to="/signin">Sign in</Link>
        </HubState>
      )}
      {signedIn && overview.isPending && (
        <HubState icon="refresh-cw" title="Loading server-backed Practice progress…" />
      )}
      {signedIn && overview.isError && (
        <HubState
          icon="wifi-off"
          title="Practice progress is unavailable"
          body="This dashboard will not substitute sample activity or estimated accuracy when the API cannot be reached."
        >
          <button type="button" className="btn btn-secondary" onClick={() => void overview.refetch()}>Try again</button>
        </HubState>
      )}

      <div id="overview" className="practice-hub-layout">
        <main className="practice-hub-main">
          <SkillPractice overview={overview.data} signedIn={dataReady} />
          <DailyPlan overview={overview.data} signedIn={dataReady} />
          <PracticeModes overview={overview.data} />
          <RecentActivity overview={overview.data} signedIn={dataReady} />
        </main>
        <aside className="practice-hub-rail">
          <OverallProgress overview={overview.data} signedIn={dataReady} />
          <StrengthBreakdown overview={overview.data} signedIn={dataReady} />
          <WeakAreaPanel overview={overview.data} signedIn={dataReady} />
          <PracticePrinciple />
        </aside>
      </div>
    </div>
  );
}

function SkillPractice({ overview, signedIn }: { overview?: PracticeOverview; signedIn: boolean }) {
  return (
    <section className="practice-dashboard-section glass" aria-labelledby="skill-practice-heading">
      <SectionHeading eyebrow="Choose a skill to apply and improve" title="Skill Practice" id="skill-practice-heading" />
      <div className="practice-skill-dashboard-grid">
        {(Object.keys(SKILL_META) as PracticeSkill[]).map((skill) => {
          const meta = SKILL_META[skill];
          const stats = overview?.skillStats.find((entry) => entry.skill === skill);
          return (
            <Link key={skill} className={`practice-dashboard-skill tone-${meta.tone}`} to="/random-practice" search={{ skill }}>
              <span className="practice-dashboard-icon"><Icon name={meta.icon} size={28} /></span>
              <strong>{meta.label}</strong>
              <span>{skillDescription(skill)}</span>
              <footer>
                <small>{signedIn && stats?.answered ? `${stats.answered} answered · ${stats.accuracy}%` : 'Dedicated skill practice'}</small>
                <Icon name="arrow-right" size={17} />
              </footer>
            </Link>
          );
        })}
        {DEDICATED_SKILLS.map((skill) => (
          <Link key={skill.label} className={`practice-dashboard-skill tone-${skill.tone}`} to={skill.to}>
            <span className="practice-dashboard-icon"><Icon name={skill.icon} size={28} /></span>
            <strong>{skill.label}</strong>
            <span>{skill.note}</span>
            <footer><small>Open workspace</small><Icon name="arrow-right" size={17} /></footer>
          </Link>
        ))}
      </div>
      <p className="practice-engine-note"><Icon name="info" size={16} /> The shared generated engine currently serves vocabulary, kanji, grammar, and reading with multiple-choice and typed recall. Listening, speaking, writing, and JLPT keep their dedicated real-content workspaces until compatible generators are available.</p>
    </section>
  );
}

function DailyPlan({ overview, signedIn }: { overview?: PracticeOverview; signedIn: boolean }) {
  const plan = overview?.dailyPlan ?? (Object.keys(SKILL_META) as PracticeSkill[]).map((skill) => ({ skill, target: skill === 'vocabulary' ? 5 : 3, completed: 0 }));
  const completed = plan.reduce((sum, item) => sum + item.completed, 0);
  const target = plan.reduce((sum, item) => sum + item.target, 0);
  return (
    <section id="daily-plan" className="practice-dashboard-section glass" aria-labelledby="daily-plan-heading">
      <div className="practice-section-heading-row">
        <SectionHeading eyebrow="Recommended for today" title="Daily Practice Plan" id="daily-plan-heading" />
        <Link className="btn btn-secondary btn-small" to="/daily-practice"><Icon name="play" size={15} /> Start plan</Link>
      </div>
      <div className="practice-daily-list">
        {plan.map((item) => {
          const meta = SKILL_META[item.skill];
          return (
            <div key={item.skill} className="practice-daily-row">
              <span className={`practice-daily-icon tone-${meta.tone}`}><Icon name={meta.icon} size={19} /></span>
              <div><strong>{meta.label} application</strong><small>{dailyDescription(item.skill)}</small></div>
              <span className="tabular">{signedIn ? item.completed : '—'} / {item.target}</span>
              <Link to="/daily-practice">Practice</Link>
            </div>
          );
        })}
      </div>
      <footer className="practice-daily-summary">
        <div><Icon name="check-circle-2" size={21} /><span><strong>{signedIn ? completed : '—'}</strong><small>answered today</small></span></div>
        <div><Icon name="star" size={21} /><span><strong>{signedIn ? `${Math.round((completed / Math.max(1, target)) * 100)}%` : '—'}</strong><small>plan progress</small></span></div>
        <div><Icon name="shield-check" size={21} /><span><strong>0</strong><small>persistent schedules changed</small></span></div>
      </footer>
    </section>
  );
}

function PracticeModes({ overview }: { overview?: PracticeOverview }) {
  return (
    <section id="practice-modes" className="practice-dashboard-section glass" aria-labelledby="practice-modes-heading">
      <SectionHeading eyebrow="Six ways to apply what you know" title="Practice Modes" id="practice-modes-heading" />
      <div className="practice-mode-grid">
        {MODES.map((mode) => (
          <Link key={mode.mode} className={`practice-mode-tile tone-${mode.tone}`} to={mode.to}>
            <Icon name={mode.icon} size={26} />
            <strong>{mode.title}</strong>
            <span>{mode.note}</span>
            {mode.mode === 'challenge' && overview && overview.challengePersonalBest > 0
              ? <small>Best {overview.challengePersonalBest.toLocaleString()} pts</small>
              : <small>Start now <Icon name="arrow-right" size={14} /></small>}
          </Link>
        ))}
      </div>
    </section>
  );
}

function RecentActivity({ overview, signedIn }: { overview?: PracticeOverview; signedIn: boolean }) {
  const recent = overview?.recent ?? [];
  return (
    <section className="practice-dashboard-section glass" aria-labelledby="practice-recent-heading">
      <SectionHeading eyebrow="Persisted sessions only" title="Recent Activity" id="practice-recent-heading" />
      {!signedIn ? <EmptyLine text="Practice history appears after your account data is available." />
        : recent.length === 0 ? <EmptyLine text="No Practice sessions yet. Daily or Mixed Practice is a good first baseline." />
        : <div className="practice-recent-list">{recent.map((item) => {
          const mode = MODES.find((entry) => entry.mode === item.mode)!;
          return (
            <div key={item.id} className="practice-recent-row">
              <span className={`practice-recent-icon tone-${mode.tone}`}><Icon name={mode.icon} size={18} /></span>
              <div><strong>{mode.title}</strong><small>{item.correct} correct of {item.answered} answered · {relativeDate(item.completedAt)}</small></div>
              <span className="tabular">{item.accuracy}%</span>
            </div>
          );
        })}</div>}
    </section>
  );
}

function OverallProgress({ overview, signedIn }: { overview?: PracticeOverview; signedIn: boolean }) {
  const accuracy = overview?.totals.accuracy ?? 0;
  const max = Math.max(1, ...(overview?.dailyActivity.map((day) => day.answered) ?? [1]));
  return (
    <section className="practice-rail-card glass">
      <div className="practice-rail-title"><h2>Overall Progress</h2><span>Application</span></div>
      <div className="practice-overall-row">
        <div className="practice-donut" style={{ '--practice-value': `${signedIn ? accuracy : 0}%` } as React.CSSProperties}><strong>{signedIn ? `${accuracy}%` : '—'}</strong><span>accuracy</span></div>
        <dl><div><dt>Practice time</dt><dd>{signedIn ? formatTime(overview?.totals.practiceSeconds ?? 0) : '—'}</dd></div><div><dt>Answered</dt><dd>{signedIn ? (overview?.totals.answered ?? 0).toLocaleString() : '—'}</dd></div></dl>
      </div>
      <div className="practice-week-bars" aria-label="Questions answered during the last seven days">
        {(overview?.dailyActivity ?? Array.from({ length: 7 }, (_, index) => ({ date: String(index), answered: 0 }))).map((day) => (
          <div key={day.date}><span style={{ height: `${Math.max(day.answered ? 12 : 2, (day.answered / max) * 46)}px` }} /><small>{weekday(day.date)}</small></div>
        ))}
      </div>
    </section>
  );
}

function StrengthBreakdown({ overview, signedIn }: { overview?: PracticeOverview; signedIn: boolean }) {
  return (
    <section className="practice-rail-card glass">
      <div className="practice-rail-title"><h2>Strength Breakdown</h2><Link to="/weak-areas">Drill weak areas</Link></div>
      <div className="practice-strength-list">
        {(Object.keys(SKILL_META) as PracticeSkill[]).map((skill) => {
          const meta = SKILL_META[skill];
          const stats = overview?.skillStats.find((entry) => entry.skill === skill);
          const value = signedIn ? stats?.accuracy ?? 0 : 0;
          return <div key={skill}><span className={`tone-${meta.tone}`}><Icon name={meta.icon} size={16} /></span><strong>{meta.label}</strong><div><i style={{ width: `${value}%` }} /></div><small>{signedIn && stats?.answered ? `${value}%` : '—'}</small></div>;
        })}
      </div>
    </section>
  );
}

function WeakAreaPanel({ overview, signedIn }: { overview?: PracticeOverview; signedIn: boolean }) {
  const weak = overview?.weakAreas.slice(0, 4) ?? [];
  return (
    <section className="practice-rail-card glass">
      <div className="practice-rail-title"><h2>Weak Area Evidence</h2><Link to="/weak-areas">Practice</Link></div>
      {!signedIn ? <EmptyLine text="Confidence evidence appears after your account data is available." />
        : weak.length === 0 ? <EmptyLine text="Answer generated exercises to establish evidence." />
        : <div className="practice-weak-list">{weak.map((item) => (
          <div key={item.id}><span lang="ja">{item.label}</span><small>{item.confidence}% confidence · {item.incorrect} misses</small></div>
        ))}</div>}
    </section>
  );
}

function PracticePrinciple() {
  return (
    <section className="practice-tip-card glass">
      <Icon name="sparkles" size={24} />
      <h2>Practice is not Review</h2>
      <p><strong>Practice</strong> asks whether you can apply completed material through generated exercises.</p>
      <Link to="/practice-hub">Open scheduled Review <Icon name="arrow-right" size={14} /></Link>
    </section>
  );
}

function SectionHeading({ eyebrow, title, id }: { eyebrow: string; title: string; id: string }) {
  return <div className="practice-section-heading"><h2 id={id}>{title}</h2><p>{eyebrow}</p></div>;
}

function HubState({ icon, title, body, children }: { icon: IconName; title: string; body?: string; children?: React.ReactNode }) {
  return <section className="practice-hub-state glass" role="status"><Icon name={icon} size={28} /><div><h2>{title}</h2>{body && <p>{body}</p>}</div>{children}</section>;
}

function EmptyLine({ text }: { text: string }) { return <p className="practice-empty-line">{text}</p>; }
function skillDescription(skill: PracticeSkill) { return ({ vocabulary: 'Recall words in context', kanji: 'Recognize meaning precisely', grammar: 'Apply sentence patterns', reading: 'Produce and parse readings' })[skill]; }
function dailyDescription(skill: PracticeSkill) { return ({ vocabulary: 'Recall meaning across lessons', kanji: 'Test difficult characters', grammar: 'Apply targeted patterns', reading: 'Produce exact readings' })[skill]; }
function formatTime(seconds: number) { if (seconds < 60) return `${seconds}s`; const hours = Math.floor(seconds / 3600); const mins = Math.floor((seconds % 3600) / 60); return hours ? `${hours}h ${mins}m` : `${mins}m`; }
function weekday(date: string) { const value = new Date(`${date}T00:00:00Z`); return Number.isNaN(value.getTime()) ? '—' : value.toLocaleDateString(undefined, { weekday: 'narrow', timeZone: 'UTC' }); }
function relativeDate(value: string | null) { if (!value) return 'saved'; const diff = Date.now() - new Date(value).getTime(); const minutes = Math.max(0, Math.round(diff / 60_000)); if (minutes < 1) return 'just now'; if (minutes < 60) return `${minutes}m ago`; const hours = Math.round(minutes / 60); if (hours < 24) return `${hours}h ago`; return `${Math.round(hours / 24)}d ago`; }
