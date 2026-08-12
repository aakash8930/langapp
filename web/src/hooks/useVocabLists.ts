import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'vocab_lists';

interface ListEntry {
  id: string;
  lemma: string;
  reading: string;
  gloss: string;
  pos: string;
  jlpt: string;
  addedAt: number;
}

export interface VocabList {
  id: string;
  name: string;
  createdAt: number;
  entries: ListEntry[];
}

let cachedRaw: string | null = null;
let cachedValue: VocabList[] = [];

function readAll(): VocabList[] {
  const raw = localStorage.getItem(STORAGE_KEY) ?? '';
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cachedValue = Array.isArray(parsed) ? parsed as VocabList[] : [];
  } catch {
    cachedValue = [];
  }
  return cachedValue;
}

function writeAll(lists: VocabList[]): void {
  cachedRaw = JSON.stringify(lists);
  cachedValue = lists;
  localStorage.setItem(STORAGE_KEY, cachedRaw);
}

let listeners: (() => void)[] = [];

function subscribe(cb: () => void) {
  listeners = [...listeners, cb];
  return () => { listeners = listeners.filter((l) => l !== cb); };
}

function notify() { for (const l of listeners) l(); }

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function useVocabLists() {
  const lists = useSyncExternalStore(subscribe, readAll);

  const create = useCallback((name: string) => {
    const current = readAll();
    writeAll([...current, { id: genId(), name, createdAt: Date.now(), entries: [] }]);
    notify();
  }, []);

  const remove = useCallback((listId: string) => {
    writeAll(readAll().filter((l) => l.id !== listId));
    notify();
  }, []);

  const addEntry = useCallback((listId: string, entry: ListEntry) => {
    const current = readAll();
    const list = current.find((candidate) => candidate.id === listId);
    if (!list || list.entries.some((candidate) => candidate.id === entry.id)) return;
    writeAll(current.map((candidate) => candidate.id === listId
      ? { ...candidate, entries: [...candidate.entries, entry] }
      : candidate));
    notify();
  }, []);

  const removeEntry = useCallback((listId: string, entryId: string) => {
    const current = readAll();
    if (!current.some((candidate) => candidate.id === listId)) return;
    writeAll(current.map((candidate) => candidate.id === listId
      ? { ...candidate, entries: candidate.entries.filter((entry) => entry.id !== entryId) }
      : candidate));
    notify();
  }, []);

  const isInList = useCallback((listId: string, entryId: string) => {
    const list = lists.find((l) => l.id === listId);
    return list ? list.entries.some((e) => e.id === entryId) : false;
  }, [lists]);

  return { lists, create, remove, addEntry, removeEntry, isInList };
}
