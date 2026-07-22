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
import { GrammarPoint, GrammarPointDocument } from './schemas/grammar-point.schema';
import { KanaItem, KanaItemDocument } from './schemas/kana-item.schema';
import { KanjiEntry, KanjiEntryDocument } from './schemas/kanji-entry.schema';
import { ItemRef, Lesson, LessonDocument } from './schemas/lesson.schema';
import { JlptLevel, VocabItem, VocabItemDocument } from './schemas/vocab-item.schema';

/**
 * Owns the content collections: kana, vocab, grammar, kanji and lessons.
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
  ) {}

  async findLessons(unit?: string): Promise<LessonSummary[]> {
    const filter: Record<string, unknown> = { lang: 'ja' };
    if (unit) {
      filter.unit = unit;
    }

    const lessons = await this.lessonModel.find(filter).sort({ unit: 1, order: 1 }).exec();
    return lessons.map(toLessonSummary);
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
    }
  }

  // ---- Seed support. Upserts keyed on the natural key so re-running is safe. ----

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

  async upsertVocab(input: {
    lemma: string;
    reading: string;
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

  async setVocabConceptId(vocabId: Types.ObjectId, conceptId: Types.ObjectId): Promise<void> {
    await this.vocabModel.updateOne({ _id: vocabId }, { $set: { conceptId } }).exec();
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

  async countLessons(): Promise<number> {
    return this.lessonModel.countDocuments().exec();
  }
}
