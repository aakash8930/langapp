import { HIRAGANA_PACK } from './japanese/hiragana';
import { HIRAGANA_MARKS_PACK } from './japanese/hiragana-marks';
import { KATAKANA_PACK } from './japanese/katakana';
import { KATAKANA_MARKS_PACK } from './japanese/katakana-marks';
import { KANJI_GROUPS, KANJI_LESSONS, KANJI_UNIT } from './japanese/kanji';
import { KANJI_N4_GROUPS, KANJI_N4_LESSONS, KANJI_N4_UNIT } from './japanese/kanji-n4';
import { GRAMMAR_GROUPS, GRAMMAR_LESSONS, GRAMMAR_UNIT } from './japanese/grammar';
import { GRAMMAR_N4_GROUPS, GRAMMAR_N4_LESSONS, GRAMMAR_N4_UNIT } from './japanese/grammar-n4';
import { VOCAB_GROUPS, VOCAB_LESSONS, VOCAB_UNIT } from './japanese/vocab';
import { VOCAB_EVERYDAY_GROUPS, VOCAB_EVERYDAY_LESSONS, VOCAB_EVERYDAY_UNIT } from './japanese/vocab-everyday';
import { VOCAB_N5_GROUPS, VOCAB_N5_LESSONS, VOCAB_N5_UNIT } from './japanese/vocab-n5';
import { VOCAB_N4_GROUPS, VOCAB_N4_LESSONS, VOCAB_N4_UNIT } from './japanese/vocab-n4';
import {
  HIRAGANA_MARKS_EXTRA_LESSONS,
  HIRAGANA_MARKS_EXTRA_UNIT,
  KATAKANA_MARKS_EXTRA_LESSONS,
  KATAKANA_MARKS_EXTRA_UNIT,
  MARKS_GROUPS,
} from './japanese/marks-words';

const kanaPacks = [HIRAGANA_PACK, KATAKANA_PACK, HIRAGANA_MARKS_PACK, KATAKANA_MARKS_PACK];
const kanjiGroups = [KANJI_GROUPS, KANJI_N4_GROUPS];

export const REQUIRED_STROKE_CHARACTERS = [...new Set([
  ...kanaPacks.flatMap((pack) =>
    Object.values(pack.rows).flatMap((row) => row.flatMap((item) => [...item.kana])),
  ),
  ...kanjiGroups.flatMap((groups) =>
    Object.values(groups).flatMap((group) => group.map((item) => item.char)),
  ),
])].sort((a, b) => a.codePointAt(0)! - b.codePointAt(0)!);

export const REQUIRED_SEED_BASELINE = {
  kana: kanaPacks.reduce(
    (total, pack) => total + Object.values(pack.rows).reduce((sum, row) => sum + row.length, 0),
    0,
  ),
  vocab:
    Object.values(VOCAB_GROUPS).flat().length
    + Object.values(MARKS_GROUPS).flat().length
    + Object.values(VOCAB_EVERYDAY_GROUPS).flat().length
    + Object.values(VOCAB_N5_GROUPS).flat().length
    + Object.values(VOCAB_N4_GROUPS).flat().length,
  grammar: Object.values(GRAMMAR_GROUPS).flat().length + Object.values(GRAMMAR_N4_GROUPS).flat().length,
  kanji: Object.values(KANJI_GROUPS).flat().length + Object.values(KANJI_N4_GROUPS).flat().length,
  lessons:
    kanaPacks.reduce((total, pack) => total + pack.lessons.length, 0)
    + VOCAB_LESSONS.length
    + HIRAGANA_MARKS_EXTRA_LESSONS.length
    + KATAKANA_MARKS_EXTRA_LESSONS.length
    + VOCAB_EVERYDAY_LESSONS.length
    + GRAMMAR_LESSONS.length
    + KANJI_LESSONS.length
    + VOCAB_N5_LESSONS.length
    + VOCAB_N4_LESSONS.length
    + GRAMMAR_N4_LESSONS.length
    + KANJI_N4_LESSONS.length,
} as const;

export const REQUIRED_UNIT_SLUGS = [
  HIRAGANA_PACK.unit,
  KATAKANA_PACK.unit,
  VOCAB_UNIT,
  HIRAGANA_MARKS_PACK.unit,
  KATAKANA_MARKS_PACK.unit,
  HIRAGANA_MARKS_EXTRA_UNIT,
  KATAKANA_MARKS_EXTRA_UNIT,
  VOCAB_EVERYDAY_UNIT,
  GRAMMAR_UNIT,
  KANJI_UNIT,
  VOCAB_N5_UNIT,
  VOCAB_N4_UNIT,
  GRAMMAR_N4_UNIT,
  KANJI_N4_UNIT,
] as const;
