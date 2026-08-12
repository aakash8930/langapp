import { useCallback, useMemo, useSyncExternalStore } from 'react';

import type { Correction } from '../../api';
import type { WritingLevel, WritingPromptKind } from './writingData';

const STORAGE_KEY = 'writing_workspace_v1';

export type WritingFeedback = {
  id: string;
  sessionId: string;
  reply: string;
  corrections: Correction[];
  reviewedAt: number;
};

export type WritingRecord = {
  id: string;
  kind: WritingPromptKind;
  promptId: string;
  title: string;
  promptJapanese: string;
  topic: string;
  level: WritingLevel;
  text: string;
  status: 'draft' | 'submitted' | 'reviewed';
  createdAt: number;
  updatedAt: number;
  submittedAt?: number;
  feedback: WritingFeedback[];
};

export type BuilderAttempt = {
  id: string;
  sentence: string;
  correct: boolean;
  attemptedAt: number;
};

type WritingWorkspace = {
  records: WritingRecord[];
  builderAttempts: BuilderAttempt[];
};

type RecordInput = Omit<WritingRecord, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'submittedAt' | 'feedback'> & { id?: string };

const EMPTY: WritingWorkspace = { records: [], builderAttempts: [] };
let cachedRaw: string | null = null;
let cachedValue: WritingWorkspace = EMPTY;
let listeners: (() => void)[] = [];

function validWorkspace(value: unknown): value is WritingWorkspace {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<WritingWorkspace>;
  return Array.isArray(candidate.records) && Array.isArray(candidate.builderAttempts);
}

function readWorkspace(): WritingWorkspace {
  const raw = localStorage.getItem(STORAGE_KEY) ?? '';
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : EMPTY;
    cachedValue = validWorkspace(parsed) ? parsed : EMPTY;
  } catch {
    cachedValue = EMPTY;
  }
  return cachedValue;
}

function writeWorkspace(next: WritingWorkspace) {
  cachedRaw = JSON.stringify(next);
  cachedValue = next;
  localStorage.setItem(STORAGE_KEY, cachedRaw);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners = [...listeners, listener];
  return () => { listeners = listeners.filter((entry) => entry !== listener); };
}

function makeId(prefix: string): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? `${prefix}-${crypto.randomUUID()}` : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function saveRecord(input: RecordInput, status: WritingRecord['status']): string {
  const current = readWorkspace();
  const now = Date.now();
  const existing = input.id ? current.records.find((record) => record.id === input.id) : undefined;
  const id = existing?.id ?? makeId('writing');
  const textChanged = existing !== undefined && existing.text !== input.text;
  const feedback = textChanged ? [] : existing?.feedback ?? [];
  const effectiveStatus = status !== 'draft' && feedback.length > 0 ? 'reviewed' : status;
  const record: WritingRecord = {
    id,
    kind: input.kind,
    promptId: input.promptId,
    title: input.title,
    promptJapanese: input.promptJapanese,
    topic: input.topic,
    level: input.level,
    text: input.text,
    status: effectiveStatus,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    submittedAt: status === 'draft' ? existing?.submittedAt : now,
    feedback,
  };
  writeWorkspace({ ...current, records: [record, ...current.records.filter((candidate) => candidate.id !== id)] });
  return id;
}

export function useWritingStore() {
  const workspace = useSyncExternalStore(subscribe, readWorkspace);
  const saveDraft = useCallback((input: RecordInput) => saveRecord(input, 'draft'), []);
  const submit = useCallback((input: RecordInput) => saveRecord(input, 'submitted'), []);
  const addFeedback = useCallback((recordId: string, feedback: Omit<WritingFeedback, 'id' | 'reviewedAt'>) => {
    const current = readWorkspace();
    const now = Date.now();
    writeWorkspace({
      ...current,
      records: current.records.map((record) => record.id === recordId ? {
        ...record,
        status: 'reviewed',
        updatedAt: now,
        feedback: [{ ...feedback, id: makeId('feedback'), reviewedAt: now }, ...record.feedback],
      } : record),
    });
  }, []);
  const removeRecord = useCallback((recordId: string) => {
    const current = readWorkspace();
    writeWorkspace({ ...current, records: current.records.filter((record) => record.id !== recordId) });
  }, []);
  const recordBuilderAttempt = useCallback((sentence: string, correct: boolean) => {
    const current = readWorkspace();
    writeWorkspace({ ...current, builderAttempts: [{ id: makeId('builder'), sentence, correct, attemptedAt: Date.now() }, ...current.builderAttempts].slice(0, 500) });
  }, []);
  const clear = useCallback(() => writeWorkspace(EMPTY), []);
  const summary = useMemo(() => {
    const submitted = workspace.records.filter((record) => record.status !== 'draft');
    const corrections = workspace.records.flatMap((record) => record.feedback.flatMap((feedback) => feedback.corrections));
    return {
      drafts: workspace.records.filter((record) => record.status === 'draft').length,
      submitted: submitted.length,
      reviewed: workspace.records.filter((record) => record.feedback.length > 0).length,
      japaneseCharacters: submitted.reduce((total, record) => total + [...record.text].filter((character) => /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}々ー]/u.test(character)).length, 0),
      corrections: corrections.length,
      builderAttempts: workspace.builderAttempts.length,
      builderCorrect: workspace.builderAttempts.filter((attempt) => attempt.correct).length,
    };
  }, [workspace]);

  return { ...workspace, summary, saveDraft, submit, addFeedback, removeRecord, recordBuilderAttempt, clear };
}
