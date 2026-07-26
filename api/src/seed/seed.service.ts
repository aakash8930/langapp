import { Injectable, Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import { ContentService } from '../content/content.service';
import { ItemRef } from '../content/schemas/lesson.schema';
import { KnowledgeGraphService } from '../knowledge-graph/knowledge-graph.service';
import { GRAMMAR_GROUPS, GRAMMAR_LESSONS, GRAMMAR_UNIT } from './japanese/grammar';
import { HIRAGANA_PACK } from './japanese/hiragana';
import { HIRAGANA_MARKS_PACK } from './japanese/hiragana-marks';
import { KANJI_GROUPS, KANJI_LESSONS, KANJI_UNIT } from './japanese/kanji';
import type { KanaPack } from './japanese/kana-pack';
import { KATAKANA_PACK } from './japanese/katakana';
import { KATAKANA_MARKS_PACK } from './japanese/katakana-marks';
import {
  HIRAGANA_MARKS_EXTRA_LESSONS,
  HIRAGANA_MARKS_EXTRA_UNIT,
  KATAKANA_MARKS_EXTRA_LESSONS,
  KATAKANA_MARKS_EXTRA_UNIT,
  MARKS_GROUPS,
} from './japanese/marks-words';
import type { VocabLessonSeed } from './japanese/vocab';
import { VOCAB_GROUPS, VOCAB_LESSONS, VOCAB_UNIT } from './japanese/vocab';
import { VOCAB_N5_GROUPS, VOCAB_N5_LESSONS, VOCAB_N5_UNIT } from './japanese/vocab-n5';
import {
  VOCAB_EVERYDAY_GROUPS,
  VOCAB_EVERYDAY_LESSONS,
  VOCAB_EVERYDAY_UNIT,
} from './japanese/vocab-everyday';

/** The base gojūon, both scripts. Everything else assumes these. */
const BASE_PACKS: KanaPack[] = [HIRAGANA_PACK, KATAKANA_PACK];

/**
 * Dakuten, handakuten and yōon — taught *after* the first words rather than
 * before them.
 *
 * The alternative was to fold these into the base units, so a learner finishes
 * hiragana completely before starting katakana. Better in the abstract, worse
 * here: it would put twelve more lessons between someone and the first Japanese
 * word they can read, and the vocabulary unit was deliberately built to need
 * none of it. Words first, then the marks that unlock the rest of the language.
 */
const MARKS_PACKS: KanaPack[] = [HIRAGANA_MARKS_PACK, KATAKANA_MARKS_PACK];

/**
 * A vocab-shaped pack: words grouped thematically, one or more lessons
 * hanging off them. The first words unit and the two marks-words units all
 * fit this shape, which is the whole reason `seedVocabPack` exists once
 * rather than being three near-identical copies.
 */
interface VocabPack {
  unit: string;
  groups: Record<string, { lemma: string; reading: string; romaji: string; gloss: string; pos: string }[]>;
  lessons: VocabLessonSeed[];
}

const HIRAGANA_MARKS_EXTRA_PACK: VocabPack = {
  unit: HIRAGANA_MARKS_EXTRA_UNIT,
  // The "hiragana" key is meaningful here: it matches the `groups` key on
  // the lesson seed below, and `seedVocabPack` expects a single-key object
  // to keep tagging simple.
  groups: { hiragana: MARKS_GROUPS.hiragana },
  lessons: HIRAGANA_MARKS_EXTRA_LESSONS,
};

const KATAKANA_MARKS_EXTRA_PACK: VocabPack = {
  unit: KATAKANA_MARKS_EXTRA_UNIT,
  groups: { katakana: MARKS_GROUPS.katakana },
  lessons: KATAKANA_MARKS_EXTRA_LESSONS,
};

/**
 * The second words unit — 220 words, and the first one that is not constrained
 * by what the kana units have got to yet. It comes last of the vocab packs
 * because it assumes every mark: たべる needs べ, ぎゅうにゅう needs both a
 * dakuten and two yōon, きっぷ needs っ.
 */
/**
 * The 512 words that finish N5, and the **last** unit in the course.
 *
 * Placed after grammar and kanji rather than beside the other vocabulary, which
 * is a pedagogical call rather than a technical one. Slotting 32 lessons in
 * before grammar would push the first grammar lesson from 49 to 81 — a learner
 * would meet eight hundred words before being shown how to put two of them in a
 * sentence. This unit is depth on top of a complete course, so it goes last,
 * where the learner already has the grammar and the kanji to use it with.
 */
const VOCAB_N5_PACK: VocabPack = {
  unit: VOCAB_N5_UNIT,
  groups: VOCAB_N5_GROUPS,
  lessons: VOCAB_N5_LESSONS,
};

const VOCAB_EVERYDAY_PACK: VocabPack = {
  unit: VOCAB_EVERYDAY_UNIT,
  groups: VOCAB_EVERYDAY_GROUPS,
  lessons: VOCAB_EVERYDAY_LESSONS,
};

/**
 * A pack-with-exercise-type union. `seed.run` walks this in order, so the
 * chain below *is* the curriculum order. Pack instances are concrete rather
 * than polymorphic because the seed only needs to call one of three
 * helpers on each — a tagged union would add a layer of indirection for no
 * payoff here.
 */
interface OrderedPack {
  kind: 'kana' | 'vocab';
  kana?: KanaPack;
  vocab?: VocabPack;
}

/**
 * The order in which units are chained. The chain — every unit's first
 * lesson prereqs the previous unit's last lesson — is set up by `seed.run`
 * below; the array here just declares who follows whom.
 *
 * Concretely:
 *
 *   hiragana-basics → katakana-basics → vocab-basics →
 *   hiragana-marks → katakana-marks →
 *   hiragana-marks-extra → katakana-marks-extra →
 *   vocab-everyday → grammar → kanji → vocab-n5
 */
const ORDERED_PACKS: OrderedPack[] = [
  ...BASE_PACKS.map((p) => ({ kind: 'kana' as const, kana: p })),
  { kind: 'vocab', vocab: { unit: VOCAB_UNIT, groups: VOCAB_GROUPS, lessons: VOCAB_LESSONS } },
  ...MARKS_PACKS.map((p) => ({ kind: 'kana' as const, kana: p })),
  { kind: 'vocab', vocab: HIRAGANA_MARKS_EXTRA_PACK },
  { kind: 'vocab', vocab: KATAKANA_MARKS_EXTRA_PACK },
  { kind: 'vocab', vocab: VOCAB_EVERYDAY_PACK },
];

export interface SeedSummary {
  kanaItems: number;
  vocabItems: number;
  grammarPoints: number;
  kanjiEntries: number;
  knowledgeNodes: number;
  knowledgeEdges: number;
  lessons: number;
}

/**
 * §14 step 2, grown into the whole Phase 0 curriculum: eleven units as
 * Lessons plus KnowledgeNodes — both kana tables, the marks, the first words,
 * the marks-words, a second and much larger words unit, the grammar that
 * turns them into sentences, and finally the kanji that rewrite the lot.
 *
 * Every write is an upsert on a natural key, so `npm run seed` is idempotent —
 * running it twice leaves the same documents with the same _ids, which matters
 * because SrsCards reference those ids from the next milestone onward.
 *
 * Note it goes through ContentService and KnowledgeGraphService rather than
 * touching collections directly: the seed obeys the same module boundary as
 * everything else.
 */
@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly contentService: ContentService,
    private readonly knowledgeGraph: KnowledgeGraphService,
  ) {}

  /**
   * Walks the ordered pack list, seeding each onto the chain, then grammar and
   * finally kanji.
   *
   * Grammar comes after all the words because its example sentences are built
   * from them. Kanji comes after *everything*: the unit is deliberately a
   * re-reading of words the learner already knows in kana, so it depends on the
   * whole vocabulary above it (see `kanji.ts`, and `kanji.spec.ts` enforces the
   * dependency word by word).
   */
  async run(): Promise<SeedSummary> {
    let previousLessonId: Types.ObjectId | null = null;

    for (const pack of ORDERED_PACKS) {
      if (pack.kind === 'kana' && pack.kana) {
        const kanaIdsByRow = await this.seedKana(pack.kana);
        previousLessonId = await this.seedKanaLessons(pack.kana, kanaIdsByRow, previousLessonId);
        this.logger.log(
          `Seeded ${pack.kana.unit}: ${countCharacters(pack.kana)} ${pack.kana.script}`,
        );
      } else if (pack.kind === 'vocab' && pack.vocab) {
        previousLessonId = await this.seedVocabPack(pack.vocab, previousLessonId);
        this.logger.log(
          `Seeded ${pack.vocab.unit}: ${countWordsIn(pack.vocab)} words`,
        );
      }
    }

    previousLessonId = await this.seedGrammar(previousLessonId);
    previousLessonId = await this.seedKanji(previousLessonId);
    await this.seedVocabPack(VOCAB_N5_PACK, previousLessonId);
    this.logger.log(`Seeded ${VOCAB_N5_UNIT}: ${countWordsIn(VOCAB_N5_PACK)} words`);

    const summary: SeedSummary = {
      kanaItems: await this.contentService.countKana(),
      vocabItems: await this.contentService.countVocab(),
      grammarPoints: await this.contentService.countGrammar(),
      kanjiEntries: await this.contentService.countKanji(),
      knowledgeNodes: await this.knowledgeGraph.countNodes(),
      knowledgeEdges: await this.knowledgeGraph.countEdges(),
      lessons: await this.contentService.countLessons(),
    };

    this.logger.log(
      `Seeded ${summary.kanaItems} kana, ${summary.vocabItems} words, ` +
        `${summary.grammarPoints} grammar points, ${summary.kanjiEntries} kanji, ` +
        `${summary.knowledgeNodes} nodes, ` +
        `${summary.knowledgeEdges} edges, ${summary.lessons} lessons`,
    );

    return summary;
  }

  /** Each character gets a content doc and a graph node, linked both ways. */
  private async seedKana(pack: KanaPack): Promise<Map<string, Types.ObjectId[]>> {
    const idsByRow = new Map<string, Types.ObjectId[]>();

    for (const [row, characters] of Object.entries(pack.rows)) {
      const ids: Types.ObjectId[] = [];

      for (const character of characters) {
        const kana = await this.contentService.upsertKana({
          kana: character.kana,
          romaji: character.romaji,
          script: pack.script,
          row: character.row,
          order: character.order,
        });

        const node = await this.knowledgeGraph.upsertNode({
          kind: 'kana',
          refId: kana._id,
          // Script-qualified: あ and ア share a romaji, and a graph label that
          // read "a (a)" for both would make the two indistinguishable in any
          // view that shows labels rather than glyphs.
          label: `${character.kana} (${character.romaji}, ${pack.script})`,
        });

        // content -> node, completing the pair (the node already has refId).
        await this.contentService.setKanaConceptId(kana._id, node._id);
        ids.push(kana._id);
      }

      idsByRow.set(row, ids);
    }

    return idsByRow;
  }

  /**
   * Chains a kana pack's lessons: each one lists the previous as a prerequisite,
   * and the same dependency is mirrored as `prerequisite` edges between the kana
   * nodes so the graph answers "what must I know first" too.
   *
   * `carriedLessonId` is the last lesson of the *previous* pack, which is how
   * the gate between units is expressed. Returns this pack's last lesson id so
   * the next pack can hang off it.
   */
  private async seedKanaLessons(
    pack: KanaPack,
    kanaIdsByRow: Map<string, Types.ObjectId[]>,
    carriedLessonId: Types.ObjectId | null,
  ): Promise<Types.ObjectId | null> {
    let previousLessonId = carriedLessonId;
    // Starts empty on purpose. The character-level edges stay *inside* a unit:
    // "ん before ア" is not a claim about characters, it is a claim about
    // stages, and the lesson prerequisite above already makes it. Linking
    // across the boundary would add 55 edges asserting something the graph
    // does not mean.
    let previousKanaIds: Types.ObjectId[] = [];

    for (const seed of pack.lessons) {
      const kanaIds = seed.rows.flatMap((row) => kanaIdsByRow.get(row) ?? []);

      const itemRefs: ItemRef[] = kanaIds.map((id) => ({ kind: 'kana', id }));

      const lesson = await this.contentService.upsertLesson({
        unit: pack.unit,
        order: seed.order,
        title: seed.title,
        itemRefs,
        exerciseTypes: seed.exerciseTypes,
        prerequisiteLessonIds: previousLessonId ? [previousLessonId] : [],
      });

      await this.linkPrerequisiteNodes(previousKanaIds, kanaIds);

      previousLessonId = lesson._id;
      previousKanaIds = kanaIds;
    }

    return previousLessonId;
  }

  /**
   * One vocab pack onto the chain. Each lesson's first prereqs `carriedLessonId`,
   * subsequent lessons chain off each other.
   *
   * No character-level prerequisite edges between words. A unit is a themed
   * pile, and "ほん before やま" is not true — the lesson order is a curriculum
   * convenience rather than a dependency.
   */
  private async seedVocabPack(
    pack: VocabPack,
    carriedLessonId: Types.ObjectId | null,
  ): Promise<Types.ObjectId | null> {
    const idsByGroup = new Map<string, Types.ObjectId[]>();

    for (const [group, words] of Object.entries(pack.groups)) {
      const ids: Types.ObjectId[] = [];

      for (const word of words) {
        const vocab = await this.contentService.upsertVocab({
          lemma: word.lemma,
          reading: word.reading,
          romaji: word.romaji,
          gloss: word.gloss,
          pos: word.pos,
          jlpt: 'N5',
          tags: [group],
        });

        const node = await this.knowledgeGraph.upsertNode({
          kind: 'vocab',
          refId: vocab._id,
          label: `${word.lemma} (${word.gloss})`,
        });

        await this.contentService.setVocabConceptId(vocab._id, node._id);
        ids.push(vocab._id);
      }

      idsByGroup.set(group, ids);
    }

    let previousLessonId = carriedLessonId;

    for (const seed of pack.lessons) {
      const vocabIds = seed.groups.flatMap((group) => idsByGroup.get(group) ?? []);

      const lesson = await this.contentService.upsertLesson({
        unit: pack.unit,
        order: seed.order,
        title: seed.title,
        itemRefs: vocabIds.map((id) => ({ kind: 'vocab', id })),
        exerciseTypes: seed.exerciseTypes,
        prerequisiteLessonIds: previousLessonId ? [previousLessonId] : [],
      });

      previousLessonId = lesson._id;
    }

    return previousLessonId;
  }

  /**
   * The grammar unit: one lesson per theme, chained like the rest.
   *
   * No prerequisite edges between points, for the same reason vocabulary has
   * none — は does not require です, they are simply taught together.
   */
  private async seedGrammar(
    carriedLessonId: Types.ObjectId | null,
  ): Promise<Types.ObjectId | null> {
    const idsByGroup = new Map<string, Types.ObjectId[]>();

    for (const [group, points] of Object.entries(GRAMMAR_GROUPS)) {
      const ids: Types.ObjectId[] = [];

      for (const point of points) {
        const grammar = await this.contentService.upsertGrammar({
          title: point.title,
          explanation: point.explanation,
          jlpt: 'N5',
          examples: point.examples,
        });

        const node = await this.knowledgeGraph.upsertNode({
          kind: 'grammar',
          refId: grammar._id,
          label: point.title,
        });

        await this.contentService.setGrammarConceptId(grammar._id, node._id);
        ids.push(grammar._id);
      }

      idsByGroup.set(group, ids);
    }

    let previousLessonId = carriedLessonId;

    for (const seed of GRAMMAR_LESSONS) {
      const grammarIds = seed.groups.flatMap((group) => idsByGroup.get(group) ?? []);

      const lesson = await this.contentService.upsertLesson({
        unit: GRAMMAR_UNIT,
        order: seed.order,
        title: seed.title,
        itemRefs: grammarIds.map((id) => ({ kind: 'grammar', id })),
        exerciseTypes: seed.exerciseTypes,
        prerequisiteLessonIds: previousLessonId ? [previousLessonId] : [],
      });

      previousLessonId = lesson._id;
    }

    this.logger.log(`Seeded ${GRAMMAR_UNIT}: ${countGrammarPoints()} points`);

    return previousLessonId;
  }

  /**
   * The kanji unit, chained onto the end of everything.
   *
   * No prerequisite edges between characters, for the same reason vocabulary has
   * none: 山 does not require 海, they are simply taught in the same lesson.
   * That is also the mistake OPEN-ITEMS #9 records the kana units making — and
   * with 104 characters, linking them pairwise would add over a thousand edges
   * asserting relationships that do not exist.
   *
   * What *would* be true here is an edge from each kanji to the words it writes
   * (山 → やま), which is a genuine dependency rather than lesson packaging. Not
   * built: `upsertEdge` takes a relation type and there is no `writes` relation
   * in the graph yet, and inventing one is a knowledge-graph decision rather than
   * a seeding one.
   */
  private async seedKanji(
    carriedLessonId: Types.ObjectId | null,
  ): Promise<Types.ObjectId | null> {
    const idsByGroup = new Map<string, Types.ObjectId[]>();

    for (const [group, entries] of Object.entries(KANJI_GROUPS)) {
      const ids: Types.ObjectId[] = [];

      for (const entry of entries) {
        const kanji = await this.contentService.upsertKanji({
          char: entry.char,
          on: entry.on,
          kun: entry.kun,
          meanings: entry.meanings,
          strokes: entry.strokes,
          radical: entry.radical,
          jlpt: 'N5',
        });

        const node = await this.knowledgeGraph.upsertNode({
          kind: 'kanji',
          refId: kanji._id,
          label: `${entry.char} (${entry.meanings.join(', ')})`,
        });

        await this.contentService.setKanjiConceptId(kanji._id, node._id);
        ids.push(kanji._id);
      }

      idsByGroup.set(group, ids);
    }

    let previousLessonId = carriedLessonId;

    for (const seed of KANJI_LESSONS) {
      const kanjiIds = seed.groups.flatMap((group) => idsByGroup.get(group) ?? []);

      const lesson = await this.contentService.upsertLesson({
        unit: KANJI_UNIT,
        order: seed.order,
        title: seed.title,
        itemRefs: kanjiIds.map((id) => ({ kind: 'kanji', id })),
        exerciseTypes: seed.exerciseTypes,
        prerequisiteLessonIds: previousLessonId ? [previousLessonId] : [],
      });

      previousLessonId = lesson._id;
    }

    this.logger.log(`Seeded ${KANJI_UNIT}: ${countKanji()} kanji`);

    return previousLessonId;
  }

  /**
   * Edge per (previous character -> current character), within a unit only.
   * Quadratic, and the curve is now unmistakable: **1614 edges for 208
   * characters**, up from 150 for 25 four milestones ago. The marks units are
   * the worst offenders — their lessons are larger, and 12×12 for the last one
   * alone is 144 edges asserting that ぴょ requires りょ.
   *
   * That last sentence is the actual argument against this design, not the
   * count. The fix is a node per *row* rather than per character
   * (OPEN-ITEMS #9), which turns 1614 into 42.
   */
  private async linkPrerequisiteNodes(
    previousKanaIds: Types.ObjectId[],
    currentKanaIds: Types.ObjectId[],
  ): Promise<void> {
    if (previousKanaIds.length === 0) {
      return;
    }

    for (const currentId of currentKanaIds) {
      const currentNode = await this.knowledgeGraph.findNodeByRef('kana', currentId);
      if (!currentNode) continue;

      for (const previousId of previousKanaIds) {
        const previousNode = await this.knowledgeGraph.findNodeByRef('kana', previousId);
        if (!previousNode) continue;

        await this.knowledgeGraph.upsertEdge(previousNode._id, currentNode._id, 'prerequisite');
      }
    }
  }
}

function countCharacters(pack: KanaPack): number {
  return Object.values(pack.rows).reduce((total, row) => total + row.length, 0);
}

function countGrammarPoints(): number {
  return Object.values(GRAMMAR_GROUPS).reduce((total, group) => total + group.length, 0);
}

function countKanji(): number {
  return Object.values(KANJI_GROUPS).reduce((total, group) => total + group.length, 0);
}

function countWordsIn(pack: VocabPack): number {
  return Object.values(pack.groups).reduce((total, group) => total + group.length, 0);
}
