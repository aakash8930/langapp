import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type JlptLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
export const JLPT_LEVELS: JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];

/** §5 verbatim: shared, language-scoped, immutable-ish content. */
@Schema({ collection: 'vocabItems', timestamps: true })
export class VocabItem {
  @Prop({ type: String, required: true, enum: ['ja'], default: 'ja' })
  lang: 'ja';

  /** 食べる */
  @Prop({ required: true, trim: true })
  lemma: string;

  /** たべる */
  @Prop({ required: true, trim: true })
  reading: string;

  /**
   * `taberu` — the reading in latin script, for learners who are still
   * decoding kana.
   *
   * Authored rather than derived. Transliterating `reading` mechanically is
   * wrong in exactly the cases that matter: は is "wa" when it is a particle,
   * を is "o", へ is "e", and こんにちは is "konnichiwa" — a table lookup gives
   * "konnichiha" and quietly contradicts the lesson that teaches the rule.
   *
   * Optional at the schema level so content beyond N4 can omit it; the display
   * rule (romaji up to N4, none after) lives with the clients.
   */
  @Prop({ type: String, required: false, trim: true })
  romaji?: string;

  /** to eat */
  @Prop({ required: true, trim: true })
  gloss: string;

  @Prop({ required: true, trim: true })
  pos: string;

  @Prop({ type: String, required: true, enum: JLPT_LEVELS })
  jlpt: JlptLevel;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({
    type: [{ sentence: String, reading: String, romaji: String, gloss: String }],
    default: [],
  })
  examples: { sentence: string; reading?: string; romaji?: string; gloss: string }[];

  @Prop({ type: [String], default: [] })
  synonyms: string[];

  @Prop({ type: [String], default: [] })
  antonyms: string[];

  @Prop({ type: Types.ObjectId, required: false })
  conceptId?: Types.ObjectId;

  /**
   * Phase 0 — Data foundation: the distinct kana characters that compose this
   * word's *lemma* (the display form), in original order, with duplicates
   * collapsed. Katakana forms get their katakana entry, not the hiragana one
   * — "always look up the kana you actually see" is the rule (see also OPEN-ITEMS
   * P0-1 about kanji and mixed-script words, which we do not address here).
   *
   * Why lemma, not `reading`: the constrained content filter — "never show a
   * character the user hasn't been taught" — runs against the form the learner
   * will see on the screen. Once kanji land (Phase 3+), only `lemma` carries
   * them, so the filter's input is one stable field across the whole platform.
   *
   * Empty for kanji-only words in their introducing lesson; the filter returns
   * an empty set rather than throwing, and the surface that asks "give me
   * readable words" simply gets no result back, which is the right answer when
   * the corpus genuinely has nothing readable yet.
   *
   * `required: false` because every existing document predates the field. The
   * Phase 0 migration (`npm run migrate:phase0-data`) backfills it via
   * `decomposeIntoKana`; absent therefore means "not yet backfilled".
   */
  @Prop({ type: [String], default: undefined })
  constituentKana?: string[];
}

export type VocabItemDocument = HydratedDocument<VocabItem>;
export const VocabItemSchema = SchemaFactory.createForClass(VocabItem);

VocabItemSchema.index({ lang: 1, lemma: 1 }, { unique: true });
VocabItemSchema.index({ lang: 1, jlpt: 1 });
VocabItemSchema.index({ tags: 1 });
// Phase 0: "give me words whose every character is in `knownKana`".
// Multikey index on `constituentKana` so Mongo can use the index for
// `constituentKana: { $all: [...] }` and intersect individual `$in` matches;
// the constraint filter does the *intersection* in code because there is no
// `$subset` operator. Partial index because backfill leaves the field unset
// pre-migration, and we never query against unset entries.
VocabItemSchema.index(
  { lang: 1, constituentKana: 1 },
  { partialFilterExpression: { constituentKana: { $exists: true, $ne: null } } },
);
