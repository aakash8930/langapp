import type { ResolvedItem } from '../../api';

export function reviewItemCopy(item: ResolvedItem): { front: string; reading?: string; back: string; kind: string } {
  if (item.kind === 'kana') return { front: item.kana, back: item.romaji, kind: item.script };
  if (item.kind === 'vocab') return { front: item.lemma, reading: item.reading === item.lemma ? undefined : item.reading, back: item.gloss, kind: 'vocabulary' };
  if (item.kind === 'kanji') return { front: item.char, reading: [...item.on, ...item.kun].join('、'), back: item.meanings.join(', '), kind: 'kanji' };
  return { front: item.title, back: item.explanation, kind: 'grammar' };
}

export function formatDurationMs(milliseconds: number | null): string {
  if (milliseconds === null) return '—';
  if (milliseconds < 1_000) return `${Math.round(milliseconds)}ms`;
  return `${(milliseconds / 1_000).toFixed(1)}s`;
}

export function formatInterval(minutes: number | null): string {
  if (minutes === null) return 'Not recorded';
  if (minutes < 60) return `${Math.max(1, minutes)} min`;
  if (minutes < 1_440) return `${Math.round(minutes / 60)} hr`;
  if (minutes < 10_080) return `${Math.round(minutes / 1_440)} days`;
  return `${Math.round(minutes / 10_080)} weeks`;
}

export function formatDueDistance(value: string): string {
  const difference = new Date(value).getTime() - Date.now();
  const absoluteMinutes = Math.max(0, Math.round(Math.abs(difference) / 60_000));
  if (difference <= 0) {
    if (absoluteMinutes < 1) return 'Due now';
    if (absoluteMinutes < 60) return `${absoluteMinutes}m overdue`;
    if (absoluteMinutes < 1_440) return `${Math.floor(absoluteMinutes / 60)}h overdue`;
    return `${Math.floor(absoluteMinutes / 1_440)}d overdue`;
  }
  if (absoluteMinutes < 60) return `Due in ${absoluteMinutes}m`;
  if (absoluteMinutes < 1_440) return `Due in ${Math.round(absoluteMinutes / 60)}h`;
  return `Due in ${Math.round(absoluteMinutes / 1_440)}d`;
}

export function reviewKindLabel(kind: string): string {
  if (kind === 'vocab') return 'Vocabulary';
  return kind.charAt(0).toLocaleUpperCase() + kind.slice(1);
}
