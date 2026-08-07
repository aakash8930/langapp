interface Elem {
  lemma: string;
  reading: string;
  gloss: string;
  addedAt?: number;
}

export function exportAsJson(items: Elem[]): string {
  return JSON.stringify(items, null, 2);
}

export function exportAsCsv(items: Elem[]): string {
  const header = 'lemma,reading,gloss';
  const rows = items.map((e) =>
    [quoteCsv(e.lemma), quoteCsv(e.reading), quoteCsv(e.gloss)].join(','),
  );
  return [header, ...rows].join('\n');
}

function quoteCsv(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
