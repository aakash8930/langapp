export type JLPTSection = 'Vocabulary' | 'Grammar & Reading' | 'Listening';

export interface JLPTResult {
  id: string;
  date: string;
  score: number;
  total: number;
  passed: boolean;
  level: string;
  sections: Record<JLPTSection, { correct: number; total: number }>;
}

export const JLPT_RESULTS_KEY = 'jlpt_results';

export function loadJlptResults(): JLPTResult[] {
  try {
    const raw = localStorage.getItem(JLPT_RESULTS_KEY);
    return raw ? JSON.parse(raw) as JLPTResult[] : [];
  } catch {
    return [];
  }
}

export function saveJlptResult(result: JLPTResult) {
  const results = loadJlptResults();
  localStorage.setItem(JLPT_RESULTS_KEY, JSON.stringify([...results, result]));
}

export const jlptLevels = [
  { level: 'N5', label: 'Foundation', description: 'Everyday phrases, basic kana, and simple sentences.', readiness: 68, status: 'Active' },
  { level: 'N4', label: 'Elementary', description: 'Familiar daily topics and connected sentences.', readiness: 41, status: 'Build next' },
  { level: 'N3', label: 'Intermediate', description: 'Everyday Japanese at a more natural speed.', readiness: 18, status: 'Plan ahead' },
  { level: 'N2', label: 'Upper-intermediate', description: 'Japanese used in broad real-world situations.', readiness: 0, status: 'Plan ahead' },
  { level: 'N1', label: 'Advanced', description: 'Complex Japanese used in a wide range of contexts.', readiness: 0, status: 'Plan ahead' },
] as const;

export const n5Blueprint = [
  { section: 'Vocabulary', time: '20 min', items: 'Kanji reading, orthography, contextual expressions', action: 'Practice vocabulary' },
  { section: 'Grammar & Reading', time: '40 min', items: 'Sentential grammar, sentence composition, text grammar, reading', action: 'Practice grammar' },
  { section: 'Listening', time: '30 min', items: 'Task-based comprehension and short conversational responses', action: 'Practice listening' },
] as const;
