type ExerciseOption = { id: string; value: string };
type PromptKind = 'kana' | 'vocab' | 'grammar' | 'wordReading' | 'kanji';

export type PracticeMode = 'daily' | 'mixed' | 'weak' | 'timed' | 'random' | 'challenge';
export type PracticeSkill = 'vocabulary' | 'kanji' | 'grammar' | 'reading';
export type PracticeLevel = 'all' | 'foundation' | 'N5';

export type PracticeQuestion = {
  id: string;
  lessonId: string;
  lessonTitle: string;
  unit: string;
  skill: PracticeSkill;
  exerciseId: string;
  itemId: string;
  type: string;
  prompt: string;
  promptKind: PromptKind;
  question: string;
  options?: ExerciseOption[];
  answered: boolean;
};

export type PracticeAnswer = {
  questionId: string;
  skill: PracticeSkill;
  prompt: string;
  correct: boolean;
  selectedValue: string | null;
  correctValue: string;
  responseTimeMs: number;
  points: number;
  combo: number;
  answeredAt: string;
};

export type PracticeSession = {
  id: string;
  mode: PracticeMode;
  status: 'active' | 'completed';
  questions: PracticeQuestion[];
  answers: PracticeAnswer[];
  filters: { skills: PracticeSkill[]; level: PracticeLevel };
  startedAt: string;
  completedAt: string | null;
  deadlineAt: string | null;
  timeLimitSeconds: number | null;
  score: number;
  maxCombo: number;
  xpAwarded: number;
  durationSeconds: number | null;
  metrics: {
    answered: number;
    total: number;
    correct: number;
    accuracy: number;
    mistakes: number;
  };
};

export type PracticeAnswerResponse = {
  answer: PracticeAnswer;
  progress: {
    answered: number;
    total: number;
    score: number;
    combo: number;
    maxCombo: number;
    complete: boolean;
  };
  session?: PracticeSession;
};

export type PracticeOverview = {
  totals: {
    sessions: number;
    answered: number;
    correct: number;
    accuracy: number;
    practiceSeconds: number;
  };
  today: { answered: number; correct: number };
  skillStats: {
    skill: PracticeSkill;
    answered: number;
    correct: number;
    accuracy: number;
  }[];
  dailyActivity: { date: string; answered: number }[];
  dailyPlan: { skill: PracticeSkill; target: number; completed: number }[];
  weakAreas: {
    id: string;
    kind: string;
    label: string;
    confidence: number;
    exposures: number;
    incorrect: number;
    weakestFormat: string | null;
  }[];
  recent: {
    id: string;
    mode: PracticeMode;
    completedAt: string | null;
    answered: number;
    total: number;
    correct: number;
    accuracy: number;
    durationSeconds: number;
    score: number;
    xpAwarded: number;
  }[];
  challengePersonalBest: number;
  capabilities: {
    skills: PracticeSkill[];
    questionTypes: string[];
    levels: string[];
  };
};
