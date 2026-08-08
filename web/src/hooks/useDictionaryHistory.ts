import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'dict_history';
const MAX_ENTRIES = 20;

interface SearchEntry {
  query: string;
  timestamp: number;
}

let cachedRaw: string | null = null;
let cachedValue: SearchEntry[] = [];

function readAll(): SearchEntry[] {
  const raw = localStorage.getItem(STORAGE_KEY) ?? '';
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  try {
    cachedValue = raw ? (JSON.parse(raw) as SearchEntry[]) : [];
  } catch {
    cachedValue = [];
  }
  return cachedValue;
}

function writeAll(entries: SearchEntry[]): void {
  cachedRaw = JSON.stringify(entries);
  cachedValue = entries;
  localStorage.setItem(STORAGE_KEY, cachedRaw);
}

let listeners: (() => void)[] = [];
function subscribe(cb: () => void) { listeners = [...listeners, cb]; return () => { listeners = listeners.filter(l => l !== cb); }; }
function notify() { for (const l of listeners) l(); }

export function useDictionaryHistory() {
  const history = useSyncExternalStore(subscribe, readAll);

  const addQuery = useCallback((query: string) => {
    const q = query.trim();
    if (!q) return;
    const current = readAll().filter(e => e.query !== q);
    current.unshift({ query: q, timestamp: Date.now() });
    writeAll(current.slice(0, MAX_ENTRIES));
    notify();
  }, []);

  const clear = useCallback(() => { writeAll([]); notify(); }, []);

  return { history, addQuery, clear };
}
