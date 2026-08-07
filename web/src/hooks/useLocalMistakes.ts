import { useCallback, useSyncExternalStore } from 'react';

export interface KanaMistake {
  kana: string;
  romaji: string;
  timestamp: number;
}

const STORAGE_KEY = 'hiragana_mistakes';

let cachedRaw: string | null = null;
let cachedValue: KanaMistake[] = [];

function readMistakes(): KanaMistake[] {
  const raw = localStorage.getItem(STORAGE_KEY) ?? '';
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  try {
    cachedValue = raw ? (JSON.parse(raw) as KanaMistake[]) : [];
  } catch {
    cachedValue = [];
  }
  return cachedValue;
}

function writeMistakes(mistakes: KanaMistake[]): void {
  cachedRaw = JSON.stringify(mistakes);
  cachedValue = mistakes;
  localStorage.setItem(STORAGE_KEY, cachedRaw);
}

let listeners: (() => void)[] = [];

function subscribe(callback: () => void) {
  listeners = [...listeners, callback];
  return () => {
    listeners = listeners.filter((l) => l !== callback);
  };
}

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

export function useLocalMistakes() {
  const mistakes = useSyncExternalStore(subscribe, readMistakes);

  const add = useCallback((kana: string, romaji: string) => {
    const current = readMistakes();
    if (current.some((m) => m.kana === kana)) return;
    const updated = [...current, { kana, romaji, timestamp: Date.now() }];
    writeMistakes(updated);
    notify();
  }, []);

  const remove = useCallback((kana: string) => {
    const updated = readMistakes().filter((m) => m.kana !== kana);
    writeMistakes(updated);
    notify();
  }, []);

  const clear = useCallback(() => {
    writeMistakes([]);
    notify();
  }, []);

  return { mistakes, add, remove, clear };
}
