import { ContentKind } from '../../knowledge-graph/schemas/knowledge-node.schema';
import { ExerciseOption, PromptKind } from '../dto/exercise-response.dto';
import { ResolvedItem } from '../dto/lesson-response.dto';
import { shuffle } from './deterministic-random';

/**
 * The pure half of question generation, shared by the lesson exercises and the
 * unit checkpoint.
 *
 * It lives apart from `ExerciseService` because the checkpoint needs exactly
 * these rules over a different input — a whole unit's items rather than one
 * lesson's — and a second copy of "how a kanji becomes a question" is how the
 * two would drift into asking different things about the same content. Nothing
 * here touches the database or a service; the pools are passed in.
 */

export const OPTIONS_PER_QUESTION = 4;

/**
 * One answerable item, flattened out of whatever kind it came from.
 *
 * `answer` is both the correct option's text and the key distractors are
 * deduped on — two options reading the same thing make a question
 * unanswerable, whichever kind produced them.
 *
 * For typing exercises, `answer` is also what the learner is supposed to type
 * and what the typed input is checked against.
 */
export interface Choice {
  id: string;
  prompt: string;
  /** For multipleChoice: the option's value (e.g. `a`). For wordReading: the canonical romaji. */
  answer: string;
  /**
   * Extra context the question text needs. Only grammar uses it, to carry the
   * English gloss — 「わたしはいき＿。」 is grammatical with ます, ません and ました
   * alike, so without the gloss the question has three right answers.
   */
  hint?: string;
}

/** What a question of this content kind asks, and how a client should size it. */
export interface KindQuestion {
  promptKind: PromptKind;
  /**
   * A function rather than a constant because grammar's question changes per
   * item — it has to state which meaning is wanted. The others ignore the
   * argument and return the same sentence every time.
   */
  question: (choice: Choice) => string;
}

export const KANA_QUESTION: KindQuestion = {
  promptKind: 'kana',
  question: () => 'Which romaji matches this character?',
};

export const VOCAB_QUESTION: KindQuestion = {
  promptKind: 'vocab',
  question: () => 'What does this word mean?',
};

/**
 * Kanji → English meaning, and deliberately *not* kanji → reading. A kanji has
 * several readings and which applies depends on the word: 山 is やま alone and
 * サン in 火山. "Which reading is this?" therefore has two right answers — the
 * same defect the grammar gap has without its gloss.
 */
export const KANJI_QUESTION: KindQuestion = {
  promptKind: 'kanji',
  question: () => 'What does this kanji mean?',
};

export const GRAMMAR_QUESTION: KindQuestion = {
  promptKind: 'grammar',
  question: (choice) =>
    choice.hint ? `Which fills the gap? — “${choice.hint}”` : 'Which fills the gap?',
};

export const WORD_READING_QUESTION: KindQuestion = {
  promptKind: 'wordReading',
  question: () => 'How do you read this word?',
};

export function isKana(item: ResolvedItem): item is Extract<ResolvedItem, { kind: 'kana' }> {
  return item.kind === 'kana';
}

export function isVocab(item: ResolvedItem): item is Extract<ResolvedItem, { kind: 'vocab' }> {
  return item.kind === 'vocab';
}

export function isGrammar(item: ResolvedItem): item is Extract<ResolvedItem, { kind: 'grammar' }> {
  return item.kind === 'grammar';
}

export function isKanji(item: ResolvedItem): item is Extract<ResolvedItem, { kind: 'kanji' }> {
  return item.kind === 'kanji';
}

export function kanaChoice(item: Extract<ResolvedItem, { kind: 'kana' }>): Choice {
  return { id: item.id, prompt: item.kana, answer: item.romaji };
}

/**
 * The word is the prompt and the meaning is the answer — recognition, the same
 * direction as kana → romaji. `lemma`, not `reading`: when kanji arrive the
 * written form is what a learner needs to recognise.
 */
export function vocabChoice(item: Extract<ResolvedItem, { kind: 'vocab' }>): Choice {
  return { id: item.id, prompt: item.lemma, answer: item.gloss };
}

/**
 * The glyph is the prompt and its meanings are the answer.
 *
 * Returns an array so a kanji with no meanings drops out instead of producing
 * an option with an empty label — `meanings` is `default: []` on the schema.
 */
export function toKanjiChoice(item: Extract<ResolvedItem, { kind: 'kanji' }>): Choice[] {
  if (item.meanings.length === 0) {
    return [];
  }

  return [{ id: item.id, prompt: item.char, answer: item.meanings.join(', ') }];
}

/**
 * The first example becomes the question: the gapped sentence is the prompt and
 * what fills the gap is the answer.
 *
 * Returns an array so a point with no examples drops out instead of producing a
 * question with an empty prompt — a grammar point is still valid content
 * without one, it just cannot be quizzed this way.
 */
export function toGrammarChoice(item: {
  id: string;
  examples: { sentence: string; answer: string; gloss: string }[];
}): Choice[] {
  const example = item.examples[0];
  if (!example) return [];

  return [
    { id: item.id, prompt: example.sentence, answer: example.answer, hint: example.gloss },
  ];
}

/**
 * Distractors come from real items, never generated strings.
 *
 * Deduped by answer because Japanese genuinely has distinct kana that share a
 * reading — じ and ぢ are both "ji", づ and ず both "zu" — and two words can
 * share a gloss. Two identical options would make a question unanswerable.
 */
export function distractorPool(pool: Choice[], correct: Choice): Choice[] {
  const seen = new Set<string>([correct.answer]);
  const unique: Choice[] = [];

  for (const candidate of pool) {
    if (seen.has(candidate.answer)) continue;
    seen.add(candidate.answer);
    unique.push(candidate);
  }

  return unique;
}

/**
 * Assemble one question's options: the right answer plus up to three
 * distractors, shuffled.
 *
 * Distractors are preferred from `preferredPool` and only then drawn from
 * `fallbackPool`. That two-tier order is the fix for OPEN-ITEMS #29 — a
 * question about チーズ should be confused with other food words, not with
 * "library" and "two" from a different themed lesson in the same unit. The
 * seen-set spans both passes, so a fallback item that duplicates a preferred
 * item's *answer text* is also excluded.
 *
 * Degrading quietly is deliberate: a pool too small to supply three distractors
 * yields a question with fewer options rather than an error. An easy question
 * is better than a unit that cannot be tested at all (OPEN-ITEMS #10c).
 */
export function assembleOptions(
  correct: Choice,
  preferredPool: Choice[],
  fallbackPool: Choice[],
  random: () => number,
): { options: ExerciseOption[]; correctOptionId: string } {
  const needed = OPTIONS_PER_QUESTION - 1;
  const taken = shuffle(distractorPool(preferredPool, correct), random).slice(0, needed);

  if (taken.length < needed) {
    const seen = new Set<string>([correct.answer, ...taken.map((choice) => choice.answer)]);
    for (const candidate of shuffle(distractorPool(fallbackPool, correct), random)) {
      if (seen.has(candidate.answer)) continue;
      seen.add(candidate.answer);
      taken.push(candidate);
      if (taken.length >= needed) break;
    }
  }

  const options: ExerciseOption[] = shuffle([correct, ...taken], random).map(
    (choice, position) => ({ id: `opt-${position}`, value: choice.answer }),
  );

  const correctOption = options.find((option) => option.value === correct.answer);
  if (!correctOption) {
    // Unreachable — the correct choice is always in the shuffled array.
    throw new Error(`Correct answer ${correct.answer} vanished during option assembly`);
  }

  return { options, correctOptionId: correctOption.id };
}

/**
 * The three normalisations applied to a typed answer.
 *
 * `toLowerCase` and collapsing whitespace together make "  Gak Kou " and
 * "gakkou" land on the same canonical answer, while keeping the doubled
 * consonant unambiguous — a learner who wrote "gakou" is still wrong on
 * purpose, because that is exactly what the lesson teaches.
 */
export function normaliseAnswer(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, '');
}

/**
 * Maps the prompt kind (how the question is displayed) to the content item kind
 * (how the card is stored). Mostly identical, but `wordReading` is a
 * display-level concept — the underlying item is always a vocabulary word.
 */
export function promptKindToContentKind(promptKind: PromptKind): ContentKind {
  if (promptKind === 'wordReading') return 'vocab';
  return promptKind as ContentKind;
}
