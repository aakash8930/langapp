import { BLANK, GRAMMAR_GROUPS, GRAMMAR_LESSONS } from './grammar';
import { HIRAGANA_ROWS } from './hiragana';
import { HIRAGANA_MARKS_ROWS } from './hiragana-marks';
import { KATAKANA_ROWS } from './katakana';
import { KATAKANA_MARKS_ROWS } from './katakana-marks';
import { VOCAB_GROUPS } from './vocab';

/** Every character taught anywhere before this unit. */
const TAUGHT = new Set(
  [
    ...Object.values(HIRAGANA_ROWS),
    ...Object.values(KATAKANA_ROWS),
    ...Object.values(HIRAGANA_MARKS_ROWS),
    ...Object.values(KATAKANA_MARKS_ROWS),
  ]
    .flat()
    .flatMap((character) => [...character.kana]),
);

/** Punctuation and the gap marker are not kana and are not taught as such. */
const ALLOWED_NON_KANA = new Set(['。', '、', BLANK]);

const ALL_POINTS = Object.values(GRAMMAR_GROUPS).flat();
const ALL_EXAMPLES = ALL_POINTS.flatMap((point) => point.examples);

/** Word stems the vocabulary unit teaches, longest first for greedy matching. */
const VOCAB_STEMS = Object.values(VOCAB_GROUPS)
  .flat()
  .map((word) => word.lemma)
  // Verbs are taught in dictionary form (よむ) but conjugate here (よみます),
  // so the stem is what survives: drop the final mora of a verb.
  .flatMap((lemma) => [lemma, lemma.slice(0, -1)])
  .sort((a, b) => b.length - a.length);

/** Everything this unit itself teaches, plus the endings it attaches. */
const GRAMMAR_TOKENS = ALL_POINTS.map((point) => point.examples[0].answer).concat([
  'ます',
  'ません',
  'ました',
  'です',
  'は',
  'を',
  'に',
  'で',
  'の',
  'も',
  'と',
  'か',
]);

describe('every example sentence is readable at this point in the course', () => {
  it.each(ALL_EXAMPLES.map((e) => [e.sentence, e.gloss] as const))(
    '%s (%s) uses only taught characters',
    (sentence) => {
      const untaught = [...sentence].filter(
        (character) => !TAUGHT.has(character) && !ALLOWED_NON_KANA.has(character),
      );
      expect(untaught).toEqual([]);
    },
  );

  it('uses no っ or ー, which are still untaught (OPEN-ITEMS #25)', () => {
    for (const example of ALL_EXAMPLES) {
      expect(example.sentence).not.toMatch(/[っッー]/);
    }
  });

  it('builds every sentence from vocabulary words and grammar this unit teaches', () => {
    for (const example of ALL_EXAMPLES) {
      // Strip the gap, punctuation, then every known word and particle. What is
      // left is vocabulary the learner has never met.
      let remaining = example.sentence.replace(BLANK, '').replace(/[。、]/g, '');

      for (const token of [...VOCAB_STEMS, ...GRAMMAR_TOKENS].sort(
        (a, b) => b.length - a.length,
      )) {
        remaining = remaining.split(token).join('');
      }

      expect({ sentence: example.sentence, unknown: remaining }).toEqual({
        sentence: example.sentence,
        unknown: '',
      });
    }
  });

  it('keeps sentences short — Japanese has no spaces to parse by', () => {
    for (const example of ALL_EXAMPLES) {
      expect(example.sentence.length).toBeLessThanOrEqual(16);
    }
  });
});

describe('every example is a well-formed question', () => {
  it('marks exactly one gap', () => {
    for (const example of ALL_EXAMPLES) {
      expect([...example.sentence].filter((c) => c === BLANK)).toHaveLength(1);
    }
  });

  it('has a non-empty answer and an English gloss', () => {
    for (const example of ALL_EXAMPLES) {
      expect(example.answer.length).toBeGreaterThan(0);
      // The gloss is load-bearing: 「わたしはいき＿。」 is grammatical with ます,
      // ません and ました alike, so without it the question has three right
      // answers.
      expect(example.gloss).toMatch(/[A-Za-z]/);
    }
  });

  /**
   * Only for multi-character answers. A single-kana particle turning up inside
   * a word is unavoidable in Japanese — いもうと contains も — and is not a
   * giveaway, because it is read as part of that word. But です or ました
   * appearing elsewhere really would let someone copy the answer without
   * understanding the sentence.
   */
  it('never leaves a multi-character answer visible elsewhere in the sentence', () => {
    for (const example of ALL_EXAMPLES.filter((e) => e.answer.length > 1)) {
      const withoutGap = example.sentence.replace(BLANK, '');
      expect(withoutGap).not.toContain(example.answer);
    }
  });

  it('gives every point at least one example, since the quiz uses the first', () => {
    for (const point of ALL_POINTS) {
      expect(point.examples.length).toBeGreaterThan(0);
    }
  });
});

describe('the grammar unit is internally consistent', () => {
  it('has no duplicate titles — the schema index would reject them', () => {
    const titles = ALL_POINTS.map((point) => point.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('has no duplicate answers, which would make a question unanswerable', () => {
    // Distractors are drawn from the whole unit, so two points answering 「は」
    // would collide even from different lessons.
    const answers = ALL_POINTS.map((point) => point.examples[0].answer);
    expect(new Set(answers).size).toBe(answers.length);
  });

  it('every lesson names a group that exists, and every group is used once', () => {
    const used = GRAMMAR_LESSONS.flatMap((lesson) => lesson.groups);

    for (const group of used) {
      expect(Object.keys(GRAMMAR_GROUPS)).toContain(group);
    }
    expect(new Set(used).size).toBe(used.length);
    expect(new Set(used)).toEqual(new Set(Object.keys(GRAMMAR_GROUPS)));
  });

  it('orders lessons contiguously from zero', () => {
    expect(GRAMMAR_LESSONS.map((lesson) => lesson.order)).toEqual(
      GRAMMAR_LESSONS.map((_, index) => index),
    );
  });
});
