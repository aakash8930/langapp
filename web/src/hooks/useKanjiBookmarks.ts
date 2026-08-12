import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'kanji_bookmarks';

interface KanjiBookmark {
  char: string;
  meaning: string;
  addedAt: number;
}

let cachedRaw: string | null = null;
let cachedValue: KanjiBookmark[] = [];

function readAll(): KanjiBookmark[] {
  const raw = localStorage.getItem(STORAGE_KEY) ?? '';
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cachedValue = Array.isArray(parsed) ? parsed as KanjiBookmark[] : [];
  } catch {
    cachedValue = [];
  }
  return cachedValue;
}

function writeAll(bookmarks: KanjiBookmark[]): void {
  cachedRaw = JSON.stringify(bookmarks);
  cachedValue = bookmarks;
  localStorage.setItem(STORAGE_KEY, cachedRaw);
}

let listeners: (() => void)[] = [];

function subscribe(cb: () => void) {
  listeners = [...listeners, cb];
  return () => { listeners = listeners.filter((l) => l !== cb); };
}

function notify() { for (const l of listeners) l(); }

export function useKanjiBookmarks() {
  const bookmarks = useSyncExternalStore(subscribe, readAll);

  const isBookmarked = useCallback((char: string) => bookmarks.some((b) => b.char === char), [bookmarks]);

  const toggle = useCallback((char: string, meaning: string) => {
    const current = readAll();
    const exists = current.some((bookmark) => bookmark.char === char);
    const next = exists
      ? current.filter((bookmark) => bookmark.char !== char)
      : [...current, { char, meaning, addedAt: Date.now() }];
    // useSyncExternalStore publishes by reference. Mutating the cached array in
    // place makes a working bookmark write look static until the next page load.
    writeAll(next);
    notify();
  }, []);

  const remove = useCallback((char: string) => {
    const updated = readAll().filter((b) => b.char !== char);
    writeAll(updated);
    notify();
  }, []);

  const clear = useCallback(() => {
    writeAll([]);
    notify();
  }, []);

  return { bookmarks, isBookmarked, toggle, remove, clear };
}
