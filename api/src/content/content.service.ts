import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';
import { ContentKind } from '../knowledge-graph/schemas/knowledge-node.schema';
import {
  grammarToResolved,
  kanaToResolved,
  kanjiToResolved,
  LessonDetail,
  LessonSummary,
  ResolvedItem,
  toLessonSummary,
  vocabToResolved,
} from './dto/lesson-response.dto';
import {
  KanaCurriculumRow,
  toCurriculumRow,
} from './dto/curriculum-response.dto';
import {
  toVocabReadabilityRow,
  VocabReadabilityRow,
} from './dto/vocab-readability-response.dto';
import {
  SentenceReadabilityRow,
  toSentenceReadabilityRow,
} from './dto/sentence-readability-response.dto';
import { GrammarPoint, GrammarPointDocument } from './schemas/grammar-point.schema';
import { KanaItem, KanaItemDocument } from './schemas/kana-item.schema';
import { KanjiEntry, KanjiEntryDocument } from './schemas/kanji-entry.schema';
import { ItemRef, Lesson, LessonDocument } from './schemas/lesson.schema';
import { JlptLevel, VocabItem, VocabItemDocument } from './schemas/vocab-item.schema';

import { ContentReport, ContentReportDocument } from './schemas/content-report.schema';
import { ReportMistakeDto } from './dto/report-mistake.dto';
import { UserService } from '../user/user.service';

/**
 * One lesson as the knowledge graph needs to see it (ADR-005): ids, not
 * resolved content. Returned by `findLessonsForGraph`.
 */
export interface LessonGraphRow {
  id: Types.ObjectId;
  title: string;
  itemRefs: ItemRef[];
  prerequisiteLessonIds: Types.ObjectId[];
}

/**
 * A whole unit's teachable content, flattened — what the checkpoint generator
 * needs and no route serialises directly.
 *
 * `exerciseTypes` is the **union** across the unit's lessons. Every seeded unit
 * is homogeneous (one pack produces one unit), so in practice this is one
 * value; taking the union rather than the first lesson's means a mixed unit
 * degrades to "the unit offers both" instead of silently following whichever
 * lesson happened to sort first.
 */
export interface UnitContent {
  unit: string;
  lessonIds: string[];
  items: ResolvedItem[];
  exerciseTypes: string[];
}

/**
 * Owns the content collections: kana, vocab, grammar, kanji, lessons and contentReports.
 * Other modules (learning, later the AI orchestrator) come through here.
 */
@Injectable()
export class ContentService {
  constructor(
    @InjectModel(Lesson.name) private readonly lessonModel: Model<LessonDocument>,
    @InjectModel(KanaItem.name) private readonly kanaModel: Model<KanaItemDocument>,
    @InjectModel(VocabItem.name) private readonly vocabModel: Model<VocabItemDocument>,
    @InjectModel(GrammarPoint.name) private readonly grammarModel: Model<GrammarPointDocument>,
    @InjectModel(KanjiEntry.name) private readonly kanjiModel: Model<KanjiEntryDocument>,
    @InjectModel(ContentReport.name) private readonly reportModel: Model<ContentReportDocument>,
    /**
     * Phase 0 — Data foundation. Used *only* by `findVocabByKnownKana`, which
     * needs the learner's `learningState.knownKana` to compute the readability
     * filter. Pulled in here rather than letting the controller read the user
     * and pass `knownKana` across the boundary so the service stays the
     * authority on "what does the learner know" — controllers never see the
     * sub-document shape.
     */
    private readonly userService: UserService,
  ) {}

  async findLessons(unit?: string): Promise<LessonSummary[]> {
    const filter: Record<string, unknown> = { lang: 'ja' };
    if (unit) {
      filter.unit = unit;
    }

    const lessons = await this.lessonModel.find(filter).sort({ unit: 1, order: 1 }).exec();
    return lessons.map(toLessonSummary);
  }

  /**
   * Resolve learner-evidence item refs back to the lessons that can exercise
   * them. Practice owns the selection policy; Content owns knowledge of the
   * Lesson collection shape.
   */
  async findLessonsContainingItems(refs: ItemRef[]): Promise<LessonSummary[]> {
    if (refs.length === 0) return [];
    const lessons = await this.lessonModel
      .find({
        lang: 'ja',
        $or: refs.map((ref) => ({
          itemRefs: { $elemMatch: { kind: ref.kind, id: ref.id } },
        })),
      })
      .sort({ unit: 1, order: 1 })
      .exec();
    return lessons.map(toLessonSummary);
  }

  /**
   * Phase 0 — Data foundation. The canonical kana curriculum.
   *
   * Reads every kana item in teaching order `(script, taughtInLesson, order)`
   * and projects each row through
   * `toCurriculumRow`. There is no filter on `taughtInLesson`: absent is a
   * valid state (pre-migration or for an unattributable character), and the
   * response serialises it as `null` rather than dropping the row, so the
   * client-side list keeps stable identity across migration state.
   *
   * The endpoint is unauthenticated for the same reason `/lessons` is: kana
   * ordering is shared reference content. OPEN-ITEMS Phase 0 #3 notes the
   * same scraping trade-off and the same one-line `JwtAuthGuard` fix.
   */
  async findKanaCurriculum(): Promise<KanaCurriculumRow[]> {
    const rows = await this.kanaModel
      .find({ lang: 'ja' })
      .sort({ script: 1, taughtInLesson: 1, order: 1, kana: 1 })
      .exec();
    return rows.map(toCurriculumRow);
  }

  /**
   * Phase 0 — Data foundation. Vocab filtered by `constituentKana ⊆ knownKana`.
   *
   * Returns words the learner can read *right now* — every kana they have
   * been taught appears in the word's composition. The query is intentionally
   * simple: `$all` against the partial multikey index on `constituentKana`
   * gives every row whose constituent array contains every requested
   * character; the constraint is then `$not` any character *not* in
   * `knownKana`, which is the intersection in code (Mongo has no `$subset`).
   *
   * Three deliberate limits, all protective against Phase-0 misuse:
   *  - `cap` defaults to 200 and is bounded — the bare reading screen is the
   *    only caller today and pulls one row; a future caller that wants the
   *    entire readable corpus should request explicitly because pagination
   *    is the next conversation we have.
   *  - An empty `knownKana` set returns `[]`, not "everything" — a brand-new
   *    learner has not been taught anything, so any readable word would be
   *    a lie. The bare reading screen surfaces this as an explainer.
   *  - The endpoint is bearer-protected; `UserService.findById` is the only
   *    way the response DTO gets a learner id, and the bearer is the gate.
   */
  async findVocabByKnownKana(
    userId: Types.ObjectId,
    cap: number,
  ): Promise<VocabReadabilityRow[]> {
    const user = await this.userService.findById(userId.toString());
    if (!user) {
      // Bearer-protected route — a valid token always resolves a user, so a
      // missing document is a server-side inconsistency rather than a 401.
      throw new NotFoundException('User not found');
    }
    const knownKana = user.learningState?.knownKana ?? [];
    if (knownKana.length === 0) {
      return [];
    }
    if (cap <= 0) {
      return [];
    }

    // `$not + $elemMatch + $nin` is Mongo's subset query: it rejects a word
    // as soon as one of its component characters is not in `knownKana`.
    // `$all: knownKana` would mean the opposite (a word has *every character
    // the learner knows*) and is especially harmful early in the course: a
    // learner who knows あいうえお would be shown only five-vowel words.
    // Keep the small in-memory check below as the final guarantee and to
    // protect documents written before the migration.
    const candidates = await this.vocabModel
      .find({
        lang: 'ja',
        constituentKana: {
          $exists: true,
          $not: { $elemMatch: { $nin: knownKana } },
        },
      })
      .lean<VocabItemDocument[]>()
      .exec();

    const filtered = candidates.filter((vocab) => {
      const kana = vocab.constituentKana ?? [];
      if (kana.length === 0) {
        return false;
      }
      for (const ch of kana) {
        if (!knownKana.includes(ch)) {
          return false;
        }
      }
      return true;
    });

    // Stable order so the bare reading screen fetches in a deterministic shape
    // — by `lemma` ascending, with `_id` as a tiebreaker so a same-lemma
    // vocabulary set never reorders between calls.
    filtered.sort((a, b) => {
      if (a.lemma < b.lemma) return -1;
      if (a.lemma > b.lemma) return 1;
      return a._id.toString().localeCompare(b._id.toString());
    });

    return filtered.slice(0, cap).map(toVocabReadabilityRow);
  }

  /**
   * Phase 3 #15 — Sentence-level reading. Parallel to `findVocabByKnownKana`
   * for grammar examples: return every example whose `constituentKana` is a
   * subset of the learner's `knownKana`.
   *
   * The filter is the same shape as the vocab one — `$not + $elemMatch +
   * $nin` rejects an example as soon as one of its kana is not in the known
   * set, with a final in-memory check to keep documents written before the
   * `constituentKana` field existed (or whose sentence contained no kana)
   * from silently matching. The query is in JS rather than in the Mongo
   * expression because the projection is per-element inside an array-of-
   * arrays, and the corpus is small — the grammar unit has on the order of
   * a dozen points with one example each.
   *
   * Stable order is by `(grammarPointId, exampleIndex)` so a re-fetch on
   * the same day yields the same list, which is the same property the vocab
   * reader provides by sorting on `lemma`.
   *
   * `cap` is the total number of *examples* returned, not the number of
   * grammar points — a point with three examples can supply three rows.
   */
  async findSentencesByKnownKana(
    userId: Types.ObjectId,
    cap: number,
  ): Promise<SentenceReadabilityRow[]> {
    const user = await this.userService.findById(userId.toString());
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const knownKana = user.learningState?.knownKana ?? [];
    if (knownKana.length === 0) {
      return [];
    }
    if (cap <= 0) {
      return [];
    }

    const known = new Set(knownKana);
    const docs = await this.grammarModel
      .find({ lang: 'ja', 'examples.0': { $exists: true } })
      .lean<GrammarPointDocument[]>()
      .exec();

    const rows: SentenceReadabilityRow[] = [];
    for (const doc of docs) {
      const examples = doc.examples ?? [];
      for (let index = 0; index < examples.length; index += 1) {
        const example = examples[index];
        const kana = example.constituentKana ?? [];
        if (kana.length === 0) {
          // No kana to test against — either a sentence made entirely of
          // kanji/punctuation, or a pre-seed doc whose field was never
          // backfilled. Skip rather than return it as everything-the-learner-
          // knows: the constrained filter is the safety here, and an empty
          // `constituentKana` would silently pass for any learner.
          continue;
        }
        let readable = true;
        for (const ch of kana) {
          if (!known.has(ch)) {
            readable = false;
            break;
          }
        }
        if (!readable) continue;
        rows.push(toSentenceReadabilityRow(doc, index));
        if (rows.length >= cap) break;
      }
      if (rows.length >= cap) break;
    }

    return rows;
  }

  async findLessonById(id: string): Promise<LessonDetail> {
    if (!isValidObjectId(id)) {
      // Without this, Mongoose throws a CastError that surfaces as a 500.
      throw new BadRequestException(`Malformed lesson id: ${id}`);
    }

    const lesson = await this.lessonModel.findById(id).exec();
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    return { ...toLessonSummary(lesson), items: await this.resolveItemRefs(lesson.itemRefs) };
  }

  /**
   * Every item taught anywhere in a unit, resolved, in curriculum order.
   *
   * Two queries regardless of unit size, the same shape as the pool reads
   * below: one for the unit's lessons, one batched resolve across every kind.
   * Reading the lessons and then calling `findLessonById` per lesson would be
   * 33 round trips for `vocab-n5`.
   *
   * Items are **deduplicated by `(kind, id)`**. Nothing in the seeded content
   * teaches one item in two lessons of the same unit today, but a checkpoint
   * that asked about the same word twice because a future unit reinforces it
   * would be a strange test, and the dedupe is one line.
   *
   * An unknown unit returns empty rather than throwing — the caller decides
   * whether that is a 404, and `findLessons` has the same behaviour.
   */
  async findUnitContent(unit: string): Promise<UnitContent> {
    const lessons = await this.lessonModel
      .find({ lang: 'ja', unit })
      .sort({ order: 1 })
      .exec();

    const seen = new Set<string>();
    const itemRefs: ItemRef[] = [];
    for (const lesson of lessons) {
      for (const ref of lesson.itemRefs) {
        const key = `${ref.kind}:${ref.id.toString()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        itemRefs.push(ref);
      }
    }

    return {
      unit,
      lessonIds: lessons.map((lesson) => lesson._id.toString()),
      items: await this.resolveItemRefs(itemRefs),
      exerciseTypes: [...new Set(lessons.flatMap((lesson) => lesson.exerciseTypes))],
    };
  }

  /**
   * Every kana character taught anywhere in a unit — the distractor pool for
   * exercise generation. Drawing from the unit (rather than the single lesson)
   * means a question about あ can be confused with こ, which is the point: a
   * distractor is only useful if it's plausible.
   *
   * Two queries regardless of how many lessons the unit has.
   */
  async findUnitKanaPool(unit: string): Promise<KanaItemDocument[]> {
    const lessons = await this.lessonModel.find({ lang: 'ja', unit }).exec();

    const kanaIds = lessons.flatMap((lesson) =>
      lesson.itemRefs.filter((ref) => ref.kind === 'kana').map((ref) => ref.id),
    );

    if (kanaIds.length === 0) {
      return [];
    }

    return this.kanaModel.find({ _id: { $in: kanaIds } }).exec();
  }

  /**
   * Resolve the concrete kana documents represented by a displayed word.
   *
   * Phase 1 uses this only after a missed vocabulary/reading answer: a word
   * miss is useful evidence about each character the learner had to decode,
   * not just the vocabulary card. Keeping this lookup in ContentService means
   * ExerciseService does not reach into the content collection directly.
   */
  async findKanaByCharacters(characters: readonly string[]): Promise<KanaItemDocument[]> {
    const unique = [...new Set(characters)];
    if (unique.length === 0) return [];
    return this.kanaModel.find({ lang: 'ja', kana: { $in: unique } }).exec();
  }

  /**
   * The same idea as `findUnitKanaPool`, for words: every vocab item taught
   * anywhere in the unit, so a question about ねこ can be confused with いぬ
   * rather than with something from a lesson the learner has never opened.
   */
  async findUnitVocabPool(unit: string): Promise<VocabItemDocument[]> {
    const lessons = await this.lessonModel.find({ lang: 'ja', unit }).exec();

    const vocabIds = lessons.flatMap((lesson) =>
      lesson.itemRefs.filter((ref) => ref.kind === 'vocab').map((ref) => ref.id),
    );

    if (vocabIds.length === 0) {
      return [];
    }

    return this.vocabModel.find({ _id: { $in: vocabIds } }).exec();
  }

  /**
   * Every grammar point taught in the unit. The distractors this yields are
   * other particles and endings, which is precisely the set a learner has to
   * choose between — a fill-in-the-blank question whose wrong answers came from
   * anywhere else would be trivial.
   */
  async findUnitGrammarPool(unit: string): Promise<GrammarPointDocument[]> {
    const lessons = await this.lessonModel.find({ lang: 'ja', unit }).exec();

    const grammarIds = lessons.flatMap((lesson) =>
      lesson.itemRefs.filter((ref) => ref.kind === 'grammar').map((ref) => ref.id),
    );

    if (grammarIds.length === 0) {
      return [];
    }

    return this.grammarModel.find({ _id: { $in: grammarIds } }).exec();
  }

  /**
   * Words from the taught vocabulary that appear anywhere in `texts`.
   *
   * This is the lookup §7 step 7 needs to turn a chat correction into something
   * schedulable: a correction's `span` and `fix` are free text, and the only
   * words worth scheduling are ones the course actually teaches. Substring match
   * against the lemma, which works because these lemmas are kana-only and
   * Japanese does not space its words — there is no token boundary to align to.
   *
   * **Single-character lemmas are excluded, and that is the important part.**
   * The vocabulary contains に ("two"), ご ("five"), め ("eye") and て ("hand"),
   * and に/ご are also two of the commonest particles in the language. A
   * correction about a particle に would otherwise schedule the *number* に for
   * review, which is not merely useless — it teaches the wrong thing. Requiring
   * two characters costs those four words and removes the whole class of false
   * positive. See OPEN-ITEMS #23.
   *
   * Reads the lemmas rather than building a Mongo regex: the collection is ~290
   * documents, the match is a substring test, and a regex alternation of 290
   * branches is both slower and unindexable.
   */
  async findVocabInTexts(texts: string[]): Promise<VocabItemDocument[]> {
    const haystack = texts.filter((text) => text.length > 0);
    if (haystack.length === 0) {
      return [];
    }

    const candidates = await this.vocabModel.find({ lang: 'ja' }).exec();

    return candidates.filter(
      (doc) => doc.lemma.length > 1 && haystack.some((text) => text.includes(doc.lemma)),
    );
  }

  /**
   * Every kanji taught in the unit. The distractors are other kanji from the
   * same unit, which is the set worth confusing: 日 and 目 differ by one stroke
   * and mean "sun" and "eye", so a meaning question is only a real test when the
   * wrong answers are neighbours rather than words from a different lesson.
   */
  async findUnitKanjiPool(unit: string): Promise<KanjiEntryDocument[]> {
    const lessons = await this.lessonModel.find({ lang: 'ja', unit }).exec();

    const kanjiIds = lessons.flatMap((lesson) =>
      lesson.itemRefs.filter((ref) => ref.kind === 'kanji').map((ref) => ref.id),
    );

    if (kanjiIds.length === 0) {
      return [];
    }

    return this.kanjiModel.find({ _id: { $in: kanjiIds } }).exec();
  }

  /**
   * Turns polymorphic itemRefs into full documents.
   *
   * One query per *kind* rather than one per item, and the result is re-sorted
   * back into the caller's order — for a lesson that order is pedagogical
   * (あいうえお), so it must not degrade into whatever order Mongo returns.
   *
   * Public because the learning module resolves SRS card items through it —
   * cards store the same `{ kind, id }` ref, and content stays the only module
   * that touches content collections.
   */
  async resolveItemRefs(itemRefs: ItemRef[]): Promise<ResolvedItem[]> {
    if (itemRefs.length === 0) {
      return [];
    }

    const idsByKind = new Map<ContentKind, Types.ObjectId[]>();
    for (const ref of itemRefs) {
      const ids = idsByKind.get(ref.kind) ?? [];
      ids.push(ref.id);
      idsByKind.set(ref.kind, ids);
    }

    const resolvedById = new Map<string, ResolvedItem>();

    await Promise.all(
      [...idsByKind.entries()].map(async ([kind, ids]) => {
        const items = await this.loadByKind(kind, ids);
        for (const item of items) {
          resolvedById.set(item.id, item);
        }
      }),
    );

    // Drop refs that no longer resolve rather than emitting nulls — a deleted
    // content doc shouldn't break the whole lesson response.
    return itemRefs
      .map((ref) => resolvedById.get(ref.id.toString()))
      .filter((item): item is ResolvedItem => item !== undefined);
  }

  private async loadByKind(kind: ContentKind, ids: Types.ObjectId[]): Promise<ResolvedItem[]> {
    switch (kind) {
      case 'kana': {
        const docs = await this.kanaModel.find({ _id: { $in: ids } }).exec();
        return docs.map(kanaToResolved);
      }
      case 'vocab': {
        const docs = await this.vocabModel.find({ _id: { $in: ids } }).exec();
        return docs.map(vocabToResolved);
      }
      case 'grammar': {
        const docs = await this.grammarModel.find({ _id: { $in: ids } }).exec();
        return docs.map(grammarToResolved);
      }
      case 'kanji': {
        const docs = await this.kanjiModel.find({ _id: { $in: ids } }).exec();
        return docs.map(kanjiToResolved);
      }
      case 'lesson': {
        return [];
      }
    }
  }

  // ---- Seed support. Upserts keyed on the natural key so re-running is safe. ----

  async findVocabById(id: string): Promise<Extract<ResolvedItem, { kind: 'vocab' }> | null> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException(`Malformed vocab id: ${id}`);
    }
    const doc = await this.vocabModel.findById(id).exec();
    if (!doc) return null;
    return vocabToResolved(doc);
  }

  async importVocabBatch(
    entries: { lemma: string; reading: string; romaji?: string; gloss: string; pos: string; jlpt?: string; examples?: { sentence: string; reading?: string; romaji?: string; gloss: string }[]; synonyms?: string[]; antonyms?: string[] }[],
  ): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;
    for (const entry of entries) {
      const existing = await this.vocabModel.findOne({ lang: 'ja', lemma: entry.lemma }).exec();
      if (existing) {
        skipped++;
        continue;
      }
      await this.vocabModel.create({
        lang: 'ja',
        lemma: entry.lemma,
        reading: entry.reading,
        romaji: entry.romaji ?? '',
        gloss: entry.gloss,
        pos: entry.pos,
        jlpt: (entry.jlpt as JlptLevel) ?? 'N5',
        tags: [],
        examples: entry.examples ?? [],
        synonyms: entry.synonyms ?? [],
        antonyms: entry.antonyms ?? [],
      });
      created++;
    }
    return { created, skipped };
  }

  async upsertKana(input: {
    kana: string;
    romaji: string;
    script: 'hiragana' | 'katakana';
    row: string;
    order: number;
  }): Promise<KanaItemDocument> {
    return this.kanaModel
      .findOneAndUpdate(
        { lang: 'ja', script: input.script, kana: input.kana },
        { $set: { romaji: input.romaji, row: input.row, order: input.order } },
        { new: true, upsert: true },
      )
      .exec();
  }

  async setKanaConceptId(kanaId: Types.ObjectId, conceptId: Types.ObjectId): Promise<void> {
    await this.kanaModel.updateOne({ _id: kanaId }, { $set: { conceptId } }).exec();
  }

  /** Stamp the source lesson's order on every character it introduces. */
  async setKanaTaughtInLesson(kanaIds: Types.ObjectId[], lessonOrder: number): Promise<void> {
    if (kanaIds.length === 0) return;
    await this.kanaModel
      .updateMany(
        { _id: { $in: kanaIds } },
        { $set: { taughtInLesson: lessonOrder } },
      )
      .exec();
  }

  async upsertVocab(input: {
    lemma: string;
    reading: string;
    romaji: string;
    gloss: string;
    pos: string;
    jlpt: JlptLevel;
    tags: string[];
  }): Promise<VocabItemDocument> {
    return this.vocabModel
      .findOneAndUpdate(
        // `lemma` is the natural key — the schema's unique index is on it.
        { lang: 'ja', lemma: input.lemma },
        {
          $set: {
            reading: input.reading,
            romaji: input.romaji,
            gloss: input.gloss,
            pos: input.pos,
            jlpt: input.jlpt,
            tags: input.tags,
          },
        },
        { new: true, upsert: true },
      )
      .exec();
  }

  async enrichVocab(lemma: string, data: {
    examples?: { sentence: string; reading?: string; romaji?: string; gloss: string }[];
    synonyms?: string[];
    antonyms?: string[];
  }): Promise<boolean> {
    const result = await this.vocabModel.updateOne(
      { lang: 'ja', lemma },
      {
        $set: {
          examples: data.examples ?? [],
          synonyms: data.synonyms ?? [],
          antonyms: data.antonyms ?? [],
        },
      },
    ).exec();
    return result.modifiedCount > 0;
  }

  async setVocabConceptId(vocabId: Types.ObjectId, conceptId: Types.ObjectId): Promise<void> {
    await this.vocabModel.updateOne({ _id: vocabId }, { $set: { conceptId } }).exec();
  }

  async upsertGrammar(input: {
    title: string;
    explanation: string;
    jlpt: JlptLevel;
    examples: {
      sentence: string;
      answer: string;
      romaji: string;
      gloss: string;
      constituentKana: string[];
    }[];
    usage?: string;
    commonMistakes?: { mistake: string; correction: string; note: string }[];
  }): Promise<GrammarPointDocument> {
    return this.grammarModel
      .findOneAndUpdate(
        // `title` is the natural key — the schema's unique index is on it.
        { lang: 'ja', title: input.title },
        {
          $set: {
            explanation: input.explanation,
            jlpt: input.jlpt,
            examples: input.examples,
            usage: input.usage,
            commonMistakes: input.commonMistakes ?? [],
          },
        },
        { new: true, upsert: true },
      )
      .exec();
  }

  async setGrammarConceptId(grammarId: Types.ObjectId, conceptId: Types.ObjectId): Promise<void> {
    await this.grammarModel.updateOne({ _id: grammarId }, { $set: { conceptId } }).exec();
  }

  async upsertKanji(input: {
    char: string;
    on: string[];
    kun: string[];
    meanings: string[];
    strokes: number;
    radical: string;
    jlpt: JlptLevel;
  }): Promise<KanjiEntryDocument> {
    return this.kanjiModel
      .findOneAndUpdate(
        // `char` is the natural key — the schema's unique index is on it.
        { lang: 'ja', char: input.char },
        {
          $set: {
            on: input.on,
            kun: input.kun,
            meanings: input.meanings,
            strokes: input.strokes,
            radical: input.radical,
            jlpt: input.jlpt,
          },
        },
        { new: true, upsert: true },
      )
      .exec();
  }

  async setKanjiConceptId(kanjiId: Types.ObjectId, conceptId: Types.ObjectId): Promise<void> {
    await this.kanjiModel.updateOne({ _id: kanjiId }, { $set: { conceptId } }).exec();
  }

  async upsertLesson(input: {
    unit: string;
    order: number;
    title: string;
    itemRefs: ItemRef[];
    exerciseTypes: string[];
    prerequisiteLessonIds: Types.ObjectId[];
  }): Promise<LessonDocument> {
    return this.lessonModel
      .findOneAndUpdate(
        { lang: 'ja', unit: input.unit, order: input.order },
        {
          $set: {
            title: input.title,
            itemRefs: input.itemRefs,
            exerciseTypes: input.exerciseTypes,
            prerequisiteLessonIds: input.prerequisiteLessonIds,
          },
        },
        { new: true, upsert: true },
      )
      .exec();
  }

  async countKana(): Promise<number> {
    return this.kanaModel.countDocuments().exec();
  }

  async countVocab(): Promise<number> {
    return this.vocabModel.countDocuments().exec();
  }

  async countGrammar(): Promise<number> {
    return this.grammarModel.countDocuments().exec();
  }

  async countKanji(): Promise<number> {
    return this.kanjiModel.countDocuments().exec();
  }

  async countLessons(): Promise<number> {
    return this.lessonModel.countDocuments().exec();
  }

  /**
   * The four lookups the concept layer of the graph is derived from (ADR-005).
   * Seed support — none of these are request paths, and each returns ids plus the
   * one field the graph keys on, never whole documents.
   *
   * They exist because the concept pass runs *after* all content is seeded, so it
   * cannot reuse the ids the seeding functions held: a contrast names a character
   * (`シ`) or a grammar point by title, and something has to turn that into an id.
   */
  async findKanaForGraph(): Promise<{ id: Types.ObjectId; kana: string; script: string }[]> {
    const items = await this.kanaModel.find({}, { kana: 1, script: 1 }).exec();
    return items.map((item) => ({ id: item._id, kana: item.kana, script: item.script }));
  }

  async findGrammarForGraph(): Promise<{ id: Types.ObjectId; title: string }[]> {
    const points = await this.grammarModel.find({}, { title: 1 }).exec();
    return points.map((point) => ({ id: point._id, title: point.title }));
  }

  async findVocabForGraph(): Promise<{ id: Types.ObjectId; lemma: string }[]> {
    const words = await this.vocabModel.find({}, { lemma: 1 }).exec();
    return words.map((word) => ({ id: word._id, lemma: word.lemma }));
  }

  async findKanjiForGraph(): Promise<{ id: Types.ObjectId; char: string }[]> {
    const entries = await this.kanjiModel.find({}, { char: 1 }).exec();
    return entries.map((entry) => ({ id: entry._id, char: entry.char }));
  }

  /**
   * Every lesson, in the raw shape the knowledge graph is derived from
   * (ADR-005). Seed support — not a request path.
   *
   * Deliberately not `findLessons()`: that returns `LessonSummary`, which carries
   * `itemCount` rather than `itemRefs` and stringified prerequisite ids, and the
   * graph needs the ObjectIds themselves. Deliberately not `findLessonById` in a
   * loop either: that resolves every item document, which is 90 lessons' worth of
   * content fetched to read ids that are already on the lesson.
   *
   * Ordered by unit then order so a rebuilt graph is written in a stable
   * sequence, which keeps seed logs diffable between runs.
   */
  async findLessonsForGraph(): Promise<LessonGraphRow[]> {
    const lessons = await this.lessonModel
      .find({ lang: 'ja' })
      .sort({ unit: 1, order: 1 })
      .exec();

    return lessons.map((lesson) => ({
      id: lesson._id,
      title: lesson.title,
      itemRefs: lesson.itemRefs,
      prerequisiteLessonIds: lesson.prerequisiteLessonIds,
    }));
  }

  /**
   * OPEN-ITEMS #8: "Report a mistake" affordance.
   * File a report on a content item (kana, vocab, grammar, kanji, lesson).
   */
  async reportMistake(
    userId: string,
    dto: ReportMistakeDto,
  ): Promise<{ id: string; status: string }> {
    const report = await this.reportModel.create({
      reporterId: new Types.ObjectId(userId),
      itemKind: dto.itemKind,
      itemId: new Types.ObjectId(dto.itemId),
      issueType: dto.issueType,
      description: dto.description ?? '',
    });

    return { id: report._id.toString(), status: report.status };
  }
}
