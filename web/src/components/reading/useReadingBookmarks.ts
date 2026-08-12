import { useCallback, useSyncExternalStore } from 'react';

import type { ReadingEntry } from './readingData';

const STORAGE_KEY = 'reading_bookmarks_v1';

export type ReadingBookmark = Pick<ReadingEntry, 'id' | 'kind' | 'sourceId' | 'sourceTitle' | 'sentence' | 'translation' | 'jlpt'> & { addedAt: number };

let cachedRaw: string | null = null;
let cachedValue: ReadingBookmark[] = [];
let listeners: (() => void)[] = [];

function readAll(): ReadingBookmark[] {
  const raw = localStorage.getItem(STORAGE_KEY) ?? '';
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cachedValue = Array.isArray(parsed) ? parsed as ReadingBookmark[] : [];
  } catch {
    cachedValue = [];
  }
  return cachedValue;
}

function writeAll(next: ReadingBookmark[]) {
  cachedRaw = JSON.stringify(next);
  cachedValue = next;
  localStorage.setItem(STORAGE_KEY, cachedRaw);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners = [...listeners, listener];
  return () => { listeners = listeners.filter((entry) => entry !== listener); };
}

export function useReadingBookmarks() {
  const bookmarks = useSyncExternalStore(subscribe, readAll);
  const isBookmarked = useCallback((id: string) => bookmarks.some((bookmark) => bookmark.id === id), [bookmarks]);
  const toggle = useCallback((entry: ReadingEntry) => {
    const current = readAll();
    const exists = current.some((bookmark) => bookmark.id === entry.id);
    writeAll(exists
      ? current.filter((bookmark) => bookmark.id !== entry.id)
      : [{ id: entry.id, kind: entry.kind, sourceId: entry.sourceId, sourceTitle: entry.sourceTitle, sentence: entry.sentence, translation: entry.translation, jlpt: entry.jlpt, addedAt: Date.now() }, ...current]);
  }, []);
  const remove = useCallback((id: string) => writeAll(readAll().filter((bookmark) => bookmark.id !== id)), []);
  const clear = useCallback(() => writeAll([]), []);
  return { bookmarks, isBookmarked, toggle, remove, clear };
}
