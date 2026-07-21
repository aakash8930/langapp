/**
 * The shape a kana script is seeded in.
 *
 * Hiragana and katakana are the same table with different glyphs, so they are
 * the same data structure with different contents — one pack per script rather
 * than one file that knows about both.
 */

export interface KanaSeed {
  kana: string;
  romaji: string;
  row: string;
  /** Position within the row, so あいうえお never renders scrambled. */
  order: number;
}

export interface LessonSeed {
  order: number;
  title: string;
  /** Keys into the pack's `rows`. */
  rows: string[];
  exerciseTypes: string[];
}

export interface KanaPack {
  /** Unit slug, e.g. 'hiragana-basics'. One unit per pack. */
  unit: string;
  script: 'hiragana' | 'katakana';
  rows: Record<string, KanaSeed[]>;
  lessons: LessonSeed[];
}
