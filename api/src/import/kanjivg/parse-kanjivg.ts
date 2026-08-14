import { XMLParser } from 'fast-xml-parser';

export interface StrokeData {
  char: string;
  viewBox: string;
  paths: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

const STROKE_NUMBER_RE = /-s(\d+)$/;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface RawPath {
  id: string;
  d: string;
}

/**
 * Recursively collects every `<path>` under a KanjiVG `<svg>` tree, however
 * deeply nested inside `<g>` groups (radical/component groups nest freely).
 *
 * Not returned in document order on purpose — see `parseKanjiVgFile` for why
 * that would be the wrong thing to rely on anyway.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function collectPaths(node: any, out: RawPath[]): void {
  if (node === null || typeof node !== 'object') return;
  for (const p of toArray(node.path)) {
    if (p && typeof p === 'object' && '@_id' in p && '@_d' in p) {
      out.push({ id: String(p['@_id']), d: String(p['@_d']) });
    }
  }
  for (const g of toArray(node.g)) collectPaths(g, out);
}

/** '098df' -> 食 */
export function codepointToChar(hexCodepoint: string): string {
  return String.fromCodePoint(parseInt(hexCodepoint, 16));
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

/**
 * Parses one KanjiVG per-character SVG file (the `repo/kanji/<codepoint>.svg`
 * form — see `data/sources.json#kanjivg`) into the exact shape
 * `strokes.controller.ts` reads back: `{ char, viewBox, paths }`, `paths` in
 * stroke order.
 *
 * **Order is read from each path's own id (`kvg:<codepoint>-sN`), not from
 * its position in the parsed tree.** fast-xml-parser groups same-tag-name
 * siblings into arrays and does not guarantee that reflects each element's
 * position relative to *differently*-named siblings (a `<path>` before a
 * nested `<g>` versus after it, at the same level) — and stroke order is the
 * one thing this data cannot afford to get wrong silently. Every path id in
 * the dataset was confirmed to match `-s<digits>` with no exceptions before
 * relying on this (checked across all 6,703 base-character files).
 */
export function parseKanjiVgFile(hexCodepoint: string, rawXml: string): StrokeData {
  const doc = parser.parse(rawXml);
  const viewBox = doc.svg?.['@_viewBox'];
  if (typeof viewBox !== 'string') {
    throw new Error(`No viewBox found for ${hexCodepoint}`);
  }

  const raw: RawPath[] = [];
  collectPaths(doc.svg, raw);
  if (raw.length === 0) {
    throw new Error(`No stroke paths found for ${hexCodepoint}`);
  }

  const withStrokeNumber = raw.map((p) => {
    const match = STROKE_NUMBER_RE.exec(p.id);
    if (!match) {
      throw new Error(`Path id "${p.id}" for ${hexCodepoint} doesn't match the expected -sN suffix`);
    }
    return { ...p, strokeNumber: Number(match[1]) };
  });
  withStrokeNumber.sort((a, b) => a.strokeNumber - b.strokeNumber);

  return {
    char: codepointToChar(hexCodepoint),
    viewBox,
    paths: withStrokeNumber.map((p) => p.d),
  };
}
