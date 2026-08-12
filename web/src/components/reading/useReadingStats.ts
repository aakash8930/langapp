import { useCallback, useMemo, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'reading_stats_v2';

type ReadingCompletion = {
  id: string;
  characters: number;
  seconds: number;
  wordIds: string[];
  jlpt: string;
  completedAt: number;
  localDate: string;
};

type ReadingStats = {
  activeSeconds: number;
  openedIds: string[];
  completions: ReadingCompletion[];
  lookupEvents: { wordId: string; at: number }[];
  quizAnswered: number;
  quizCorrect: number;
};

const EMPTY: ReadingStats = { activeSeconds: 0, openedIds: [], completions: [], lookupEvents: [], quizAnswered: 0, quizCorrect: 0 };
let cachedRaw: string | null = null;
let cachedValue: ReadingStats = EMPTY;
let listeners: (() => void)[] = [];

function validStats(value: unknown): value is ReadingStats {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ReadingStats>;
  return typeof candidate.activeSeconds === 'number'
    && Array.isArray(candidate.openedIds)
    && Array.isArray(candidate.completions)
    && Array.isArray(candidate.lookupEvents)
    && typeof candidate.quizAnswered === 'number'
    && typeof candidate.quizCorrect === 'number';
}

function readStats(): ReadingStats {
  const raw = localStorage.getItem(STORAGE_KEY) ?? '';
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : EMPTY;
    cachedValue = validStats(parsed) ? parsed : EMPTY;
  } catch {
    cachedValue = EMPTY;
  }
  return cachedValue;
}

function writeStats(next: ReadingStats) {
  cachedRaw = JSON.stringify(next);
  cachedValue = next;
  localStorage.setItem(STORAGE_KEY, cachedRaw);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners = [...listeners, listener];
  return () => { listeners = listeners.filter((entry) => entry !== listener); };
}

function localDate(timestamp = Date.now()): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function streakDays(dates: string[]): number {
  const unique = new Set(dates);
  if (unique.size === 0) return 0;
  const cursor = new Date();
  const today = localDate(cursor.getTime());
  if (!unique.has(today)) {
    cursor.setDate(cursor.getDate() - 1);
    if (!unique.has(localDate(cursor.getTime()))) return 0;
  }
  let streak = 0;
  while (unique.has(localDate(cursor.getTime()))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function useReadingStats() {
  const stats = useSyncExternalStore(subscribe, readStats);
  const recordOpen = useCallback((id: string) => {
    const current = readStats();
    if (current.openedIds.includes(id)) return;
    writeStats({ ...current, openedIds: [...current.openedIds, id] });
  }, []);
  const addReadingTime = useCallback((seconds: number) => {
    const whole = Math.max(0, Math.floor(seconds));
    if (whole === 0) return;
    const current = readStats();
    writeStats({ ...current, activeSeconds: current.activeSeconds + whole });
  }, []);
  const recordCompletion = useCallback((entry: { id: string; characters: number; seconds: number; wordIds: string[]; jlpt: string }) => {
    const current = readStats();
    const now = Date.now();
    writeStats({ ...current, completions: [...current.completions, { ...entry, seconds: Math.max(0, Math.floor(entry.seconds)), wordIds: [...new Set(entry.wordIds)], completedAt: now, localDate: localDate(now) }] });
  }, []);
  const recordLookup = useCallback((wordId: string) => {
    const current = readStats();
    writeStats({ ...current, lookupEvents: [...current.lookupEvents, { wordId, at: Date.now() }] });
  }, []);
  const recordQuizAnswer = useCallback((correct: boolean) => {
    const current = readStats();
    writeStats({ ...current, quizAnswered: current.quizAnswered + 1, quizCorrect: current.quizCorrect + (correct ? 1 : 0) });
  }, []);
  const reset = useCallback(() => writeStats(EMPTY), []);

  const summary = useMemo(() => {
    const charactersRead = stats.completions.reduce((total, completion) => total + completion.characters, 0);
    const encounteredWords = new Set(stats.completions.flatMap((completion) => completion.wordIds));
    const lookedUpWords = new Set(stats.lookupEvents.map((event) => event.wordId));
    const timed = stats.completions.filter((completion) => completion.seconds >= 5);
    const timedCharacters = timed.reduce((total, completion) => total + completion.characters, 0);
    const timedSeconds = timed.reduce((total, completion) => total + completion.seconds, 0);
    return {
      charactersRead,
      uniqueWordsEncountered: encounteredWords.size,
      lookupCount: stats.lookupEvents.length,
      uniqueWordsLookedUp: lookedUpWords.size,
      streak: streakDays(stats.completions.map((completion) => completion.localDate)),
      charactersPerMinute: timedSeconds > 0 ? Math.round((timedCharacters / timedSeconds) * 60) : null,
      quizAccuracy: stats.quizAnswered > 0 ? Math.round((stats.quizCorrect / stats.quizAnswered) * 100) : null,
    };
  }, [stats]);

  return { stats, summary, recordOpen, addReadingTime, recordCompletion, recordLookup, recordQuizAnswer, reset };
}
