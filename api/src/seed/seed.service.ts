import { Injectable, Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import { ContentService } from '../content/content.service';
import { ItemRef } from '../content/schemas/lesson.schema';
import { KnowledgeGraphService } from '../knowledge-graph/knowledge-graph.service';
import { HIRAGANA_PACK } from './japanese/hiragana';
import { HIRAGANA_MARKS_PACK } from './japanese/hiragana-marks';
import type { KanaPack } from './japanese/kana-pack';
import { KATAKANA_PACK } from './japanese/katakana';
import { KATAKANA_MARKS_PACK } from './japanese/katakana-marks';
import { VOCAB_GROUPS, VOCAB_LESSONS, VOCAB_UNIT } from './japanese/vocab';

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

export interface SeedSummary {
  kanaItems: number;
  vocabItems: number;
  knowledgeNodes: number;
  knowledgeEdges: number;
  lessons: number;
}

/**
 * §14 step 2, grown into the whole Phase 0 curriculum: five units as Lessons
 * plus KnowledgeNodes — both kana tables, the first words, and the marks.
 *
 * Every write is an upsert on a natural key, so `npm run seed` is idempotent —
 * running it twice leaves the same documents with the same _ids, which matters
 * because SrsCards will reference those ids from the next milestone onward.
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
   * The curriculum, in order. One chain runs through all of it — every unit's
   * first lesson lists the previous unit's last as its prerequisite, so the
   * order below is the order a learner is actually gated through.
   */
  async run(): Promise<SeedSummary> {
    let previousLessonId: Types.ObjectId | null = null;

    previousLessonId = await this.seedKanaPacks(BASE_PACKS, previousLessonId);

    // Vocabulary before the marks: §1's order is Hiragana → Katakana →
    // vocabulary, and every word in the unit was chosen to be readable with
    // only the base tables.
    previousLessonId = await this.seedVocab(previousLessonId);

    await this.seedKanaPacks(MARKS_PACKS, previousLessonId);

    const summary: SeedSummary = {
      kanaItems: await this.contentService.countKana(),
      vocabItems: await this.contentService.countVocab(),
      knowledgeNodes: await this.knowledgeGraph.countNodes(),
      knowledgeEdges: await this.knowledgeGraph.countEdges(),
      lessons: await this.contentService.countLessons(),
    };

    this.logger.log(
      `Seeded ${summary.kanaItems} kana, ${summary.vocabItems} words, ` +
        `${summary.knowledgeNodes} nodes, ${summary.knowledgeEdges} edges, ` +
        `${summary.lessons} lessons`,
    );

    return summary;
  }

  /** Seeds a run of kana packs onto the chain, returning its last lesson id. */
  private async seedKanaPacks(
    packs: KanaPack[],
    carriedLessonId: Types.ObjectId | null,
  ): Promise<Types.ObjectId | null> {
    let previousLessonId = carriedLessonId;

    for (const pack of packs) {
      const kanaIdsByRow = await this.seedKana(pack);
      previousLessonId = await this.seedLessons(pack, kanaIdsByRow, previousLessonId);
      this.logger.log(`Seeded ${pack.unit}: ${countCharacters(pack)} ${pack.script}`);
    }

    return previousLessonId;
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
   * Chains a pack's lessons: each one lists the previous as a prerequisite, and
   * the same dependency is mirrored as `prerequisite` edges between the kana
   * nodes so the graph answers "what must I know first" too.
   *
   * `carriedLessonId` is the last lesson of the *previous* pack, which is how
   * the gate between units is expressed. Returns this pack's last lesson id so
   * the next pack can hang off it.
   */
  private async seedLessons(
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
   * The vocabulary unit: one lesson per theme, chained like the kana units.
   *
   * Unlike kana, no character-level prerequisite edges are written between
   * words. "ほん before やま" is not true — the themes are independent, and the
   * lesson order is a curriculum convenience rather than a dependency. The
   * graph should only assert what is actually a prerequisite.
   */
  private async seedVocab(carriedLessonId: Types.ObjectId | null): Promise<Types.ObjectId | null> {
    const idsByGroup = new Map<string, Types.ObjectId[]>();

    for (const [group, words] of Object.entries(VOCAB_GROUPS)) {
      const ids: Types.ObjectId[] = [];

      for (const word of words) {
        const vocab = await this.contentService.upsertVocab({
          lemma: word.lemma,
          reading: word.reading,
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

    for (const seed of VOCAB_LESSONS) {
      const vocabIds = seed.groups.flatMap((group) => idsByGroup.get(group) ?? []);

      const lesson = await this.contentService.upsertLesson({
        unit: VOCAB_UNIT,
        order: seed.order,
        title: seed.title,
        itemRefs: vocabIds.map((id) => ({ kind: 'vocab', id })),
        exerciseTypes: seed.exerciseTypes,
        prerequisiteLessonIds: previousLessonId ? [previousLessonId] : [],
      });

      previousLessonId = lesson._id;
    }

    this.logger.log(`Seeded ${VOCAB_UNIT}: ${countWords()} words`);
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

function countWords(): number {
  return Object.values(VOCAB_GROUPS).reduce((total, group) => total + group.length, 0);
}
