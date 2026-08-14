import { XMLParser } from 'fast-xml-parser';
import { expandCustomEntities } from './custom-entities';

export interface ParsedKanjiForm {
  text: string;
  info: string[];
  priority: string[];
}

export interface ParsedReading {
  text: string;
  noKanji: boolean;
  restrictedTo: string[];
  info: string[];
  priority: string[];
}

export interface ParsedSense {
  partOfSpeech: string[];
  fields: string[];
  misc: string[];
  dialects: string[];
  glosses: string[];
  note?: string;
  appliesToKanji: string[];
  appliesToReading: string[];
}

export interface ParsedDictionaryEntry {
  jmdictSeq: number;
  kanjiForms: ParsedKanjiForm[];
  readings: ParsedReading[];
  senses: ParsedSense[];
  isCommon: boolean;
}

/** fast-xml-parser gives a bare value for a single occurrence, an array for repeats. Always want an array. */
function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/** A tag with only text content parses as a string; one with attributes parses as `{ '#text': ... }`. */
function textOf(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (value && typeof value === 'object' && '#text' in (value as Record<string, unknown>)) {
    return String((value as Record<string, unknown>)['#text']);
  }
  return '';
}

/**
 * Maps one already-parsed `<entry>` element (fast-xml-parser's object shape,
 * post entity-expansion) to this app's `ParsedDictionaryEntry`. Kept separate
 * from file I/O and XML parsing so it can be tested against small inline
 * fixtures instead of the full 218k-entry file.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapEntryElement(entry: any): ParsedDictionaryEntry {
  const kanjiForms: ParsedKanjiForm[] = toArray(entry.k_ele).map((k) => ({
    text: textOf(k.keb),
    info: toArray(k.ke_inf).map(textOf),
    priority: toArray(k.ke_pri).map(textOf),
  }));

  const readings: ParsedReading[] = toArray(entry.r_ele).map((r) => ({
    text: textOf(r.reb),
    noKanji: r.re_nokanji !== undefined,
    restrictedTo: toArray(r.re_restr).map(textOf),
    info: toArray(r.re_inf).map(textOf),
    priority: toArray(r.re_pri).map(textOf),
  }));

  const senses: ParsedSense[] = toArray(entry.sense).map((s) => ({
    partOfSpeech: toArray(s.pos).map(textOf),
    fields: toArray(s.field).map(textOf),
    misc: toArray(s.misc).map(textOf),
    dialects: toArray(s.dial).map(textOf),
    glosses: toArray(s.gloss).map(textOf).filter((g) => g.length > 0),
    note: s.s_inf !== undefined ? textOf(s.s_inf) : undefined,
    appliesToKanji: toArray(s.stagk).map(textOf),
    appliesToReading: toArray(s.stagr).map(textOf),
  }));

  const isCommon =
    kanjiForms.some((k) => k.priority.length > 0) || readings.some((r) => r.priority.length > 0);

  return {
    jmdictSeq: Number(textOf(entry.ent_seq)),
    kanjiForms,
    readings,
    senses,
    isCommon,
  };
}

const parser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
});

/** Full pipeline: raw JMdict_e file contents -> parsed entries. Entity expansion happens first, see custom-entities.ts. */
export function parseJMdict(rawXml: string): ParsedDictionaryEntry[] {
  const expanded = expandCustomEntities(rawXml);
  const doc = parser.parse(expanded);
  const entries = toArray(doc.JMdict?.entry);
  return entries.map(mapEntryElement);
}
