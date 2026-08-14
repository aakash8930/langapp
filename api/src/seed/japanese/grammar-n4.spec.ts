import { BLANK, GRAMMAR_GROUPS } from './grammar';
import { GRAMMAR_N4_GROUPS, GRAMMAR_N4_LESSONS } from './grammar-n4';

const ALL_POINTS = Object.values(GRAMMAR_N4_GROUPS).flat();
const ALL_EXAMPLES = ALL_POINTS.flatMap((point) => point.examples);

const N5_TITLES = new Set(Object.values(GRAMMAR_GROUPS).flat().map((point) => point.title));
const N5_ANSWERS = new Set(
  Object.values(GRAMMAR_GROUPS)
    .flat()
    .map((point) => point.examples[0].answer),
);

describe('every N4 grammar example is a well-formed question', () => {
  it('marks exactly one gap', () => {
    for (const example of ALL_EXAMPLES) {
      expect([...example.sentence].filter((c) => c === BLANK)).toHaveLength(1);
    }
  });

  it('has a non-empty answer and an English gloss', () => {
    for (const example of ALL_EXAMPLES) {
      expect(example.answer.length).toBeGreaterThan(0);
      expect(example.gloss).toMatch(/[A-Za-z]/);
    }
  });

  it('gives every point at least one example, since the quiz uses the first', () => {
    for (const point of ALL_POINTS) {
      expect(point.examples.length).toBeGreaterThan(0);
    }
  });
});

describe('the N4 grammar unit is internally consistent', () => {
  it('has no duplicate titles — the schema index would reject them', () => {
    const titles = ALL_POINTS.map((point) => point.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('claims no title the N5 unit already owns', () => {
    const collisions = ALL_POINTS.map((point) => point.title).filter((title) =>
      N5_TITLES.has(title),
    );
    expect(collisions).toEqual([]);
  });

  it('has no duplicate answers within the unit, which would make a question unanswerable', () => {
    const answers = ALL_POINTS.map((point) => point.examples[0].answer);
    expect(new Set(answers).size).toBe(answers.length);
  });

  /**
   * Not a hard requirement of the schema, but a quiz that mixes N5 and N4
   * grammar in one distractor pool (a plausible Phase 1+ feature) would have
   * an ambiguous question if the two levels ever answered the same string.
   */
  it('has no answer the N5 unit already uses', () => {
    const collisions = ALL_POINTS.map((point) => point.examples[0].answer).filter((answer) =>
      N5_ANSWERS.has(answer),
    );
    expect(collisions).toEqual([]);
  });

  it('every lesson names a group that exists, and every group is used once', () => {
    const used = GRAMMAR_N4_LESSONS.flatMap((lesson) => lesson.groups);

    for (const group of used) {
      expect(Object.keys(GRAMMAR_N4_GROUPS)).toContain(group);
    }
    expect(new Set(used).size).toBe(used.length);
    expect(new Set(used)).toEqual(new Set(Object.keys(GRAMMAR_N4_GROUPS)));
  });

  it('orders lessons contiguously from zero', () => {
    expect(GRAMMAR_N4_LESSONS.map((lesson) => lesson.order)).toEqual(
      GRAMMAR_N4_LESSONS.map((_, index) => index),
    );
  });

  it('is the unit it was meant to be — 16 points', () => {
    expect(ALL_POINTS.length).toBe(16);
  });
});
