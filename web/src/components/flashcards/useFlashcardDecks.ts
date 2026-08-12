import { useCallback, useMemo, useSyncExternalStore } from 'react';

const DECKS_KEY = 'flashcard_decks_v1';
const ACTIVITY_KEY = 'flashcard_activity_v1';

export type CustomCard = {
  id: string;
  front: string;
  back: string;
  reading?: string;
  detail?: string;
  example?: string;
  sourceItemId?: string;
  tags: string[];
};

export type LocalDeck = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  cards: CustomCard[];
  createdAt: number;
  updatedAt: number;
};

export type FlashcardStudySession = {
  id: string;
  deckId: string;
  deckTitle: string;
  startedAt: number;
  completedAt: number;
  seconds: number;
  studied: number;
  grades: { missed: number; hard: number; good: number; easy: number };
};

type Activity = { sessions: FlashcardStudySession[] };

let cachedDeckRaw: string | null = null;
let cachedDecks: LocalDeck[] = [];
let cachedActivityRaw: string | null = null;
let cachedActivity: Activity = { sessions: [] };
let listeners: (() => void)[] = [];

function readDecks(): LocalDeck[] {
  const raw = localStorage.getItem(DECKS_KEY) ?? '';
  if (raw === cachedDeckRaw) return cachedDecks;
  cachedDeckRaw = raw;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cachedDecks = Array.isArray(parsed) ? parsed as LocalDeck[] : [];
  } catch {
    cachedDecks = [];
  }
  return cachedDecks;
}

function readActivity(): Activity {
  const raw = localStorage.getItem(ACTIVITY_KEY) ?? '';
  if (raw === cachedActivityRaw) return cachedActivity;
  cachedActivityRaw = raw;
  try {
    const parsed = raw ? JSON.parse(raw) as Partial<Activity> : { sessions: [] };
    cachedActivity = Array.isArray(parsed.sessions) ? { sessions: parsed.sessions } : { sessions: [] };
  } catch {
    cachedActivity = { sessions: [] };
  }
  return cachedActivity;
}

function notify() { listeners.forEach((listener) => listener()); }
function writeDecks(decks: LocalDeck[]) {
  cachedDecks = decks;
  cachedDeckRaw = JSON.stringify(decks);
  localStorage.setItem(DECKS_KEY, cachedDeckRaw);
  notify();
}
function writeActivity(activity: Activity) {
  cachedActivity = activity;
  cachedActivityRaw = JSON.stringify(activity);
  localStorage.setItem(ACTIVITY_KEY, cachedActivityRaw);
  notify();
}
function subscribe(listener: () => void) {
  listeners = [...listeners, listener];
  return () => { listeners = listeners.filter((entry) => entry !== listener); };
}
function makeId(prefix: string): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? `${prefix}-${crypto.randomUUID()}` : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createCustomCard(input?: Partial<Omit<CustomCard, 'id'>>): CustomCard {
  return { id: makeId('card'), front: input?.front ?? '', back: input?.back ?? '', reading: input?.reading, detail: input?.detail, example: input?.example, sourceItemId: input?.sourceItemId, tags: input?.tags ?? [] };
}

export function useFlashcardDecks() {
  const decks = useSyncExternalStore(subscribe, readDecks);
  const activity = useSyncExternalStore(subscribe, readActivity);
  const createDeck = useCallback((input: { name: string; description: string; tags: string[]; cards: CustomCard[] }) => {
    const now = Date.now();
    const id = makeId('local-deck');
    writeDecks([{ id, ...input, createdAt: now, updatedAt: now }, ...readDecks()]);
    return id;
  }, []);
  const updateDeck = useCallback((id: string, input: { name: string; description: string; tags: string[]; cards: CustomCard[] }) => {
    const current = readDecks();
    writeDecks(current.map((deck) => deck.id === id ? { ...deck, ...input, updatedAt: Date.now() } : deck));
  }, []);
  const deleteDeck = useCallback((id: string) => writeDecks(readDecks().filter((deck) => deck.id !== id)), []);
  const duplicateDeck = useCallback((id: string) => {
    const source = readDecks().find((deck) => deck.id === id);
    if (!source) return null;
    const now = Date.now();
    const nextId = makeId('local-deck');
    writeDecks([{ ...source, id: nextId, name: `${source.name} copy`, cards: source.cards.map((card) => ({ ...card, id: makeId('card') })), createdAt: now, updatedAt: now }, ...readDecks()]);
    return nextId;
  }, []);
  const recordSession = useCallback((input: Omit<FlashcardStudySession, 'id' | 'completedAt'>) => {
    const session: FlashcardStudySession = { ...input, id: makeId('flash-session'), completedAt: Date.now() };
    writeActivity({ sessions: [session, ...readActivity().sessions].slice(0, 1000) });
  }, []);
  const clearActivity = useCallback(() => writeActivity({ sessions: [] }), []);
  const summary = useMemo(() => {
    const studied = activity.sessions.reduce((total, session) => total + session.studied, 0);
    const recalled = activity.sessions.reduce((total, session) => total + session.grades.hard + session.grades.good + session.grades.easy, 0);
    const seconds = activity.sessions.reduce((total, session) => total + session.seconds, 0);
    const uniqueDecks = new Set(activity.sessions.map((session) => session.deckId));
    return { sessions: activity.sessions.length, studied, recalled, accuracy: studied > 0 ? Math.round(recalled / studied * 100) : null, seconds, uniqueDecks: uniqueDecks.size };
  }, [activity.sessions]);
  const lastStudied = useCallback((deckId: string) => activity.sessions.find((session) => session.deckId === deckId)?.completedAt ?? null, [activity.sessions]);
  return { decks, sessions: activity.sessions, summary, createDeck, updateDeck, deleteDeck, duplicateDeck, recordSession, clearActivity, lastStudied };
}
