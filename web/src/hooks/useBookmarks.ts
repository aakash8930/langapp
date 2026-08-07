import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'vocab_bookmarks';

interface Bookmark {
  id: string;
  lemma: string;
  reading: string;
  gloss: string;
  addedAt: number;
}

function readAll(): Bookmark[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Bookmark[]) : [];
  } catch {
    return [];
  }
}

function writeAll(bookmarks: Bookmark[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
}

let listeners: (() => void)[] = [];

function subscribe(cb: () => void) {
  listeners = [...listeners, cb];
  return () => { listeners = listeners.filter((l) => l !== cb); };
}

function notify() { for (const l of listeners) l(); }

export function useBookmarks() {
  const bookmarks = useSyncExternalStore(subscribe, readAll, readAll);

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
