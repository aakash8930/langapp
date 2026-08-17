/**
 * Mirrors ResolvedItem in api/src/content/dto/lesson-response.dto.ts.
 *
 * Its own module because two unrelated endpoints embed it — a lesson's `items`
 * and a review card's `item` — and neither should have to import the other.
 *
 * The earliest release created only kana cards. The current curriculum also uses the other
 * arms are here because the server can return them and a `kind` the client has
 * not considered would render as a blank card, which is the worst possible
 * failure on the screen someone uses every morning.
 */
export type ResolvedItem =
  | {
      kind: 'kana';
      id: string;
      kana: string;
      romaji: string;
      script: string;
      row: string;
      order: number;
    }
  | {
      kind: 'vocab';
      id: string;
      lemma: string;
      reading: string;
      /** Latin script, present up to N4. */
      romaji?: string;
      gloss: string;
      pos: string;
      jlpt: string;
    }
  | {
      kind: 'grammar';
      id: string;
      title: string;
      jlpt: string;
      explanation: string;
      /** Worked examples — the sentence carries a ＿ where `answer` belongs. */
      examples: { sentence: string; answer: string; romaji?: string; gloss: string }[];
    }
  | {
      kind: 'kanji';
      id: string;
      char: string;
      on: string[];
      kun: string[];
      meanings: string[];
      strokes: number;
    };
