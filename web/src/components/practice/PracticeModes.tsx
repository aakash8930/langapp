import { PracticeSessionPage, type PracticeModeConfig } from './PracticeSession';
import type { PracticeSkill } from './practiceTypes';

const MODES = {
  daily: {
    mode: 'daily',
    title: 'Daily Practice',
    eyebrow: 'Personalized daily plan',
    description: 'A balanced application session shaped by your confidence evidence and today’s course content — never a due-card queue.',
    icon: 'calendar',
    defaultCount: 12,
    startLabel: 'Build today’s practice',
    note: 'Weak items are prioritized, then vocabulary, kanji, grammar, and reading are interleaved for a balanced daily plan.',
  },
  mixed: {
    mode: 'mixed',
    title: 'Mixed Practice',
    eyebrow: 'Interleaved skills',
    description: 'Switch between course skills and generated formats so recall has to survive a change in context.',
    icon: 'grid',
    defaultCount: 15,
    allowCount: true,
    allowSkills: true,
    startLabel: 'Start mixed session',
    note: 'The server draws from multiple real lessons and interleaves skills. Correct answers are never embedded in the question payload.',
  },
  weak: {
    mode: 'weak',
    title: 'Weak Areas',
    eyebrow: 'Evidence-led drills',
    description: 'Target low-confidence course items using real answer history, error counts, recency, and question-format performance.',
    icon: 'brain',
    defaultCount: 12,
    allowCount: true,
    allowSkills: true,
    startLabel: 'Target my weak areas',
    note: 'This session only uses items with learner evidence. If you are new, complete Mixed or Daily Practice first to establish a baseline.',
  },
  timed: {
    mode: 'timed',
    title: 'Timed Practice',
    eyebrow: 'Accuracy under pressure',
    description: 'Choose a real time limit, watch the countdown, and keep only the answers completed before the server deadline.',
    icon: 'history',
    defaultCount: 40,
    allowSkills: true,
    allowTime: true,
    startLabel: 'Start timed session',
    note: 'The session closes at the server deadline. Unanswered questions are excluded from accuracy instead of being presented as completed work.',
  },
  random: {
    mode: 'random',
    title: 'Random Practice',
    eyebrow: 'Filtered course sampler',
    description: 'Sample real available learning content with useful level, skill, and question-count controls.',
    icon: 'wand-2',
    defaultCount: 10,
    allowCount: true,
    allowSkills: true,
    allowLevel: true,
    startLabel: 'Generate random practice',
    note: 'Foundation covers kana material; the current JLPT catalog supplies N5 vocabulary, kanji, and grammar. Unsupported levels are not listed.',
  },
  challenge: {
    mode: 'challenge',
    title: 'Challenge Mode',
    eyebrow: 'Combo scoring · 3 minute clock',
    description: 'Build a streak, earn escalating points, chase your personal best, and earn a truthful first-challenge XP award each day.',
    icon: 'trophy',
    defaultCount: 20,
    startLabel: 'Accept the challenge',
    note: 'Correct streaks raise your combo and pressure multiplier. A wrong answer resets the combo, while the three-minute server clock keeps running.',
  },
} satisfies Record<string, PracticeModeConfig>;

export function DailyPracticePage() { return <PracticeSessionPage config={MODES.daily} />; }
export function MixedPracticePage() { return <PracticeSessionPage config={MODES.mixed} />; }
export function WeakAreasPracticePage() { return <PracticeSessionPage config={MODES.weak} />; }
export function TimedPracticePage() { return <PracticeSessionPage config={MODES.timed} />; }
export function RandomPracticePage({ initialSkill }: { initialSkill?: PracticeSkill }) {
  return <PracticeSessionPage config={MODES.random} initialSkills={initialSkill ? [initialSkill] : undefined} />;
}
export function ChallengeModePage() { return <PracticeSessionPage config={MODES.challenge} />; }
