import { Injectable, Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import { ContentService } from '../content/content.service';
import { ItemRef } from '../content/schemas/lesson.schema';
import { KnowledgeGraphService } from '../knowledge-graph/knowledge-graph.service';
import { HIRAGANA_LESSONS, HIRAGANA_ROWS, HIRAGANA_UNIT } from './japanese/hiragana';

export interface SeedSummary {
  kanaItems: number;
  knowledgeNodes: number;
  knowledgeEdges: number;
  lessons: number;
}

/**
 * §14 step 2: one unit of Hiragana as Lessons plus KnowledgeNodes.
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

  async run(): Promise<SeedSummary> {
    const kanaIdsByRow = await this.seedKana();
    await this.seedLessons(kanaIdsByRow);

    const summary: SeedSummary = {
      kanaItems: await this.contentService.countKana(),
      knowledgeNodes: await this.knowledgeGraph.countNodes(),
      knowledgeEdges: await this.knowledgeGraph.countEdges(),
      lessons: await this.contentService.countLessons(),
    };

    this.logger.log(
      `Seeded ${summary.kanaItems} kana, ${summary.knowledgeNodes} nodes, ` +
        `${summary.knowledgeEdges} edges, ${summary.lessons} lessons`,
    );

    return summary;
  }

  /** Each character gets a content doc and a graph node, linked both ways. */
  private async seedKana(): Promise<Map<string, Types.ObjectId[]>> {
    const idsByRow = new Map<string, Types.ObjectId[]>();

    for (const [row, characters] of Object.entries(HIRAGANA_ROWS)) {
      const ids: Types.ObjectId[] = [];

      for (const character of characters) {
        const kana = await this.contentService.upsertKana({
          kana: character.kana,
          romaji: character.romaji,
          script: 'hiragana',
          row: character.row,
          order: character.order,
        });

        const node = await this.knowledgeGraph.upsertNode({
          kind: 'kana',
          refId: kana._id,
          label: `${character.kana} (${character.romaji})`,
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
   * Chains the three lessons: each one lists the previous as a prerequisite,
   * and the same dependency is mirrored as `prerequisite` edges between the
   * kana nodes so the graph answers "what must I know first" too.
   */
  private async seedLessons(kanaIdsByRow: Map<string, Types.ObjectId[]>): Promise<void> {
    let previousLessonId: Types.ObjectId | null = null;
    let previousKanaIds: Types.ObjectId[] = [];

    for (const seed of HIRAGANA_LESSONS) {
      const kanaIds = seed.rows.flatMap((row) => kanaIdsByRow.get(row) ?? []);

      const itemRefs: ItemRef[] = kanaIds.map((id) => ({ kind: 'kana', id }));

      const lesson = await this.contentService.upsertLesson({
        unit: HIRAGANA_UNIT,
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
  }

  /**
   * Edge per (previous character -> current character). Fine at this size:
   * 5 x 10 + 10 x 10 = 150 edges for the unit. If a later unit makes this
   * quadratic blowup uncomfortable, introduce a node per *row* and link rows
   * instead of characters.
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
