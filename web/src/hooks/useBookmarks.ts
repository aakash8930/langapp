import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'vocab_bookmarks';

interface Bookmark {
  id: string;
  lemma: string;
  reading: string;
  gloss: string;
  addedAt: number;
}

let cachedRaw: string | null = null;
let cachedValue: Bookmark[] = [];

function readAll(): Bookmark[] {
  const raw = localStorage.getItem(STORAGE_KEY) ?? '';
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  try {
    cachedValue = raw ? (JSON.parse(raw) as Bookmark[]) : [];
  } catch {
    cachedValue = [];
  }
  return cachedValue;
}

function writeAll(bookmarks: Bookmark[]): void {
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

export function useBookmarks() {
  const bookmarks = useSyncExternalStore(subscribe, readAll);

  const isBookmarked = useCallback((id: string) => bookmarks.some((b) => b.id === id), [bookmarks]);

  const toggle = useCallback((id: string, lemma: string, reading: string, gloss: string) => {
    const current = readAll();
    const existing = current.findIndex((b) => b.id === id);
    if (existing >= 0) {
      current.splice(existing, 1);
    } else {
      current.push({ id, lemma, reading, gloss, addedAt: Date.now() });
    }
    writeAll(current);
    notify();
  }, []);

  const remove = useCallback((id: string) => {
    const updated = readAll().filter((b) => b.id !== id);
    writeAll(updated);
    notify();
  }, []);

  return { bookmarks, isBookmarked, toggle, remove };
}
