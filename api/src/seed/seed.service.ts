import { Injectable, Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import { decomposeIntoKana } from '../common/kana/decompose';
import { ContentService, LessonGraphRow } from '../content/content.service';
import { ItemRef } from '../content/schemas/lesson.schema';
import { KnowledgeGraphService } from '../knowledge-graph/knowledge-graph.service';
import { ContentKind } from '../knowledge-graph/schemas/knowledge-node.schema';
import { CONTRASTS, ContrastRef, rowConcepts } from './japanese/concepts';
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
import { VOCAB_ENRICHMENTS } from './japanese/vocab-enrichment';

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

    // Enrich vocab with examples, synonyms, antonyms
    let enriched = 0;
    for (const entry of VOCAB_ENRICHMENTS) {
      const ok = await this.contentService.enrichVocab(entry.lemma, {
        examples: entry.examples,
        synonyms: entry.synonyms,
        antonyms: entry.antonyms,
      });
      if (ok) enriched++;
    }
    this.logger.log(`Enriched ${enriched} vocab items with examples, synonyms and antonyms`);

    // Indexes first: ADR-005 replaced a unique index with a partial one, and the
    // concept pass below cannot write a second concept until the old index is
    // gone. See `KnowledgeGraphService.syncIndexes` for why this is safe here.
    await this.knowledgeGraph.syncIndexes();

    // Then clear the derived edge types and rebuild them below. Per-node
    // declaration cannot remove an edge written by an *earlier* scheme — the
    // 1614 kana→kana `prerequisite` edges the graph used to hold sit between
    // nodes no current pass mentions, so they would survive for ever. Found by
    // simulating a live database rather than a fresh one; see
    // `clearEdgesOfTypes`.
    const cleared = await this.knowledgeGraph.clearEdgesOfTypes([
      'prerequisite',
      'contains',
      'contrasts-with',
      'usesKanji',
    ]);
    this.logger.log(`Graph: cleared ${cleared} derived edges before rebuilding`);

    const graph = await this.syncLessonGraph();
    this.logger.log(
      `Graph: ${graph.lessonNodes} lesson nodes, ${graph.containsEdges} contains, ` +
        `${graph.prerequisiteEdges} prerequisite`,
    );

    const concepts = await this.syncConceptGraph();
    this.logger.log(
      `Concepts: ${concepts.conceptNodes} rows, ${concepts.memberEdges} contains, ` +
        `${concepts.contrastEdges} contrasts-with (${concepts.unresolvedContrasts} unresolved)`,
    );

    const kanjiUse = await this.syncUsesKanji();
    this.logger.log(
      `Kanji use: ${kanjiUse.edges} usesKanji edges across ${kanjiUse.words} words`,
    );

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

  /**
   * Derives the whole lesson layer of the knowledge graph from the lessons that
   * exist (ADR-005): one `lesson` node each, `contains` edges to their items, and
   * `prerequisite` edges read straight off `prerequisiteLessonIds`.
   *
   * ## Why one pass at the end rather than per pack
   *
   * Because the per-pack version was only ever written once. Kana lessons built
   * their nodes inline and vocab, grammar and kanji never got the equivalent, so
   * the graph held **22 lesson nodes for 90 lessons** and `contains` edges for
   * kana only — measured, not guessed. Deriving from the content means a unit
   * cannot be forgotten: adding a pack adds lessons, and lessons are what this
   * reads.
   *
   * It also makes `prerequisiteLessonIds` the single source of dependency truth.
   * The old code re-derived the chain from its own loop variable, so the graph and
   * the lesson documents could disagree and nothing would notice.
   *
   * ## Why `setEdges*` and not `upsertEdge`
   *
   * So the pass can *remove*. An upsert-only rebuild leaves the edges of a lesson
   * that lost an item behind for ever, and a graph that asserts stale
   * containment is the failure ADR-005 is about — arriving from the other
   * direction. These two edge types are wholly derived, so declaring the complete
   * set is both correct and safe.
   *
   * Idempotent: same content in, same graph out, which the CI seed step checks by
   * running twice and comparing counts.
   */
  private async syncLessonGraph(): Promise<{
    lessonNodes: number;
    containsEdges: number;
    prerequisiteEdges: number;
  }> {
    const lessons = await this.contentService.findLessonsForGraph();

    // Pass 1: a node per lesson. Every lesson needs one to exist before any edge
    // can reference it, including prerequisites pointing backwards.
    const lessonNodeIdByLessonId = new Map<string, Types.ObjectId>();
    for (const lesson of lessons) {
      const node = await this.knowledgeGraph.upsertNode({
        kind: 'lesson',
        refId: lesson.id,
        label: lesson.title,
      });
      lessonNodeIdByLessonId.set(lesson.id.toString(), node._id);
    }

    // Item node lookups batched by kind: one query per kind for the whole
    // course, rather than one per item as the kana-only code did.
    const itemNodeIdByRef = await this.mapItemNodesByRef(lessons);

    let containsEdges = 0;
    let prerequisiteEdges = 0;

    for (const lesson of lessons) {
      const lessonNodeId = lessonNodeIdByLessonId.get(lesson.id.toString());
      if (!lessonNodeId) continue;

      const itemNodeIds = lesson.itemRefs
        .map((ref) => itemNodeIdByRef.get(`${ref.kind}:${ref.id.toString()}`))
        .filter((id): id is Types.ObjectId => id !== undefined);

      await this.knowledgeGraph.setEdgesFrom(lessonNodeId, 'contains', itemNodeIds);
      containsEdges += itemNodeIds.length;

      const prerequisiteNodeIds = lesson.prerequisiteLessonIds
        .map((id) => lessonNodeIdByLessonId.get(id.toString()))
        .filter((id): id is Types.ObjectId => id !== undefined);

      await this.knowledgeGraph.setEdgesTo(lessonNodeId, 'prerequisite', prerequisiteNodeIds);
      prerequisiteEdges += prerequisiteNodeIds.length;
    }

    return { lessonNodes: lessons.length, containsEdges, prerequisiteEdges };
  }

  /**
   * The concept layer (ADR-005 / §5.3): a `concept` node per kana row, `contains`
   * edges to its characters, and `contrasts-with` edges for every authored pair.
   *
   * Row concepts are **derived** from the packs, so a row added to a pack becomes
   * a concept with nobody remembering to. Contrasts are **authored** in
   * `concepts.ts` and gated by `concepts.spec.ts`, because no table encodes that
   * シ and ツ look alike.
   *
   * `contrasts-with` is symmetric and edges are directed, so both directions are
   * written. That keeps "what does this contrast with" one indexed lookup on
   * `from`, and it is why the edges are grouped by node before being declared —
   * `setEdgesFrom` states a node's *complete* set, so a pair removed from the list
   * disappears on the next seed.
   *
   * An unresolved reference is counted and skipped rather than throwing. The spec
   * already refuses pairs the packs do not teach, so reaching this means the
   * content is seeded inconsistently with itself; failing the whole seed over one
   * edge would be a worse trade than a logged count.
   */
  private async syncConceptGraph(): Promise<{
    conceptNodes: number;
    memberEdges: number;
    contrastEdges: number;
    unresolvedContrasts: number;
  }> {
    const kana = await this.contentService.findKanaForGraph();
    const kanaIdByKey = new Map(kana.map((item) => [`${item.script}:${item.kana}`, item.id]));
    const kanaNodeIdByRefId = await this.nodeIdsByRefId(
      'kana',
      kana.map((item) => item.id),
    );

    // 1. One concept per row, containing that row's characters.
    let memberEdges = 0;
    const concepts = rowConcepts([...BASE_PACKS, ...MARKS_PACKS]);

    for (const concept of concepts) {
      const node = await this.knowledgeGraph.upsertConcept({
        slug: concept.slug,
        label: concept.label,
      });

      const memberNodeIds = concept.kana
        .map((character) => kanaIdByKey.get(`${concept.script}:${character}`))
        .map((refId) => (refId ? kanaNodeIdByRefId.get(refId.toString()) : undefined))
        .filter((id): id is Types.ObjectId => id !== undefined);

      await this.knowledgeGraph.setEdgesFrom(node._id, 'contains', memberNodeIds);
      memberEdges += memberNodeIds.length;
    }

    // 2. Contrast pairs, resolved to node ids and grouped by node.
    const grammar = await this.contentService.findGrammarForGraph();
    const grammarIdByTitle = new Map(grammar.map((point) => [point.title, point.id]));
    const grammarNodeIdByRefId = await this.nodeIdsByRefId(
      'grammar',
      grammar.map((point) => point.id),
    );

    const resolve = (ref: ContrastRef): Types.ObjectId | undefined => {
      if (ref.kind === 'kana') {
        const refId = kanaIdByKey.get(`${ref.script}:${ref.kana}`);
        return refId ? kanaNodeIdByRefId.get(refId.toString()) : undefined;
      }
      const refId = grammarIdByTitle.get(ref.title);
      return refId ? grammarNodeIdByRefId.get(refId.toString()) : undefined;
    };

    const contrastsByNode = new Map<string, Map<string, Types.ObjectId>>();
    const add = (from: Types.ObjectId, to: Types.ObjectId) => {
      const key = from.toString();
      const existing = contrastsByNode.get(key) ?? new Map<string, Types.ObjectId>();
      existing.set(to.toString(), to);
      contrastsByNode.set(key, existing);
    };

    let unresolvedContrasts = 0;
    for (const contrast of CONTRASTS) {
      const a = resolve(contrast.a);
      const b = resolve(contrast.b);
      if (!a || !b) {
        unresolvedContrasts++;
        continue;
      }
      add(a, b);
      add(b, a);
    }

    let contrastEdges = 0;
    for (const [nodeId, targets] of contrastsByNode) {
      await this.knowledgeGraph.setEdgesFrom(
        new Types.ObjectId(nodeId),
        'contrasts-with',
        [...targets.values()],
      );
      contrastEdges += targets.size;
    }

    return {
      conceptNodes: concepts.length,
      memberEdges,
      contrastEdges,
      unresolvedContrasts,
    };
  }

  /**
   * `usesKanji`: a word points at each kanji that writes it (ADR-005).
   *
   * ## Where the relation comes from, and why not the lemma
   *
   * The obvious derivation — scan a lemma for kanji characters — finds **nothing**
   * here, and that is by design rather than by accident: this course teaches
   * vocabulary in kana and the kanji unit is a *re-reading* of words already
   * known, so やま is stored as やま and 山 arrives later as the way it is really
   * written. Tried it first; it produced zero edges across 802 words.
   *
   * The relation is instead authored, on `KanjiSeed.writes` — the kana words each
   * character writes some part of — and `kanji.spec.ts` already checks every entry
   * against the actual vocabulary. Its own doc comment notes it is "not persisted"
   * because §5's `KanjiEntry` has nowhere to put it and inventing a field would be
   * a third documented departure from §5.
   *
   * **This is that home.** A relation between two content documents is what the
   * graph is for, so `writes` stops being seed-only authoring scaffolding and
   * becomes queryable — without any schema departure.
   *
   * Edges run word → kanji, matching the name: the word is what uses the kanji.
   */
  private async syncUsesKanji(): Promise<{ edges: number; words: number }> {
    const [vocab, kanji] = await Promise.all([
      this.contentService.findVocabForGraph(),
      this.contentService.findKanjiForGraph(),
    ]);

    const vocabIdByLemma = new Map(vocab.map((word) => [word.lemma, word.id]));
    const kanjiIdByChar = new Map(kanji.map((entry) => [entry.char, entry.id]));
    const kanjiNodeIdByRefId = await this.nodeIdsByRefId(
      'kanji',
      kanji.map((entry) => entry.id),
    );
    const vocabNodeIdByRefId = await this.nodeIdsByRefId(
      'vocab',
      vocab.map((word) => word.id),
    );

    // Grouped by word, because `setEdgesFrom` declares a node's complete set and
    // one word can be written by several characters (かざん by 火 and 山).
    const kanjiNodesByVocabNode = new Map<string, Map<string, Types.ObjectId>>();

    for (const group of Object.values(KANJI_GROUPS)) {
      for (const entry of group) {
        const kanjiRefId = kanjiIdByChar.get(entry.char);
        const kanjiNodeId = kanjiRefId
          ? kanjiNodeIdByRefId.get(kanjiRefId.toString())
          : undefined;
        if (!kanjiNodeId) continue;

        for (const lemma of entry.writes) {
          const vocabRefId = vocabIdByLemma.get(lemma);
          const vocabNodeId = vocabRefId
            ? vocabNodeIdByRefId.get(vocabRefId.toString())
            : undefined;
          if (!vocabNodeId) continue;

          const key = vocabNodeId.toString();
          const targets = kanjiNodesByVocabNode.get(key) ?? new Map<string, Types.ObjectId>();
          targets.set(kanjiNodeId.toString(), kanjiNodeId);
          kanjiNodesByVocabNode.set(key, targets);
        }
      }
    }

    let edges = 0;
    for (const [vocabNodeId, targets] of kanjiNodesByVocabNode) {
      await this.knowledgeGraph.setEdgesFrom(new Types.ObjectId(vocabNodeId), 'usesKanji', [
        ...targets.values(),
      ]);
      edges += targets.size;
    }

    return { edges, words: kanjiNodesByVocabNode.size };
  }

  /** `refId -> node id` for one kind, in one query. */
  private async nodeIdsByRefId(
    kind: ContentKind,
    refIds: Types.ObjectId[],
  ): Promise<Map<string, Types.ObjectId>> {
    const nodes = await this.knowledgeGraph.findNodesByRefs(kind, refIds);
    const byRefId = new Map<string, Types.ObjectId>();
    for (const node of nodes) {
      // `refId` is optional on the schema now that concepts exist, and these are
      // content-backed nodes, so it is always present here — narrowed rather than
      // asserted.
      if (node.refId) byRefId.set(node.refId.toString(), node._id);
    }
    return byRefId;
  }

  /**
   * `"{kind}:{refId}" -> node id` for every item any lesson references.
   *
   * Keyed by kind *and* id because `ItemRef` is polymorphic and the graph's own
   * uniqueness is `{kind, refId}` — two collections could in principle hand out
   * the same ObjectId, and a bare id key would silently collapse them.
   */
  private async mapItemNodesByRef(
    lessons: LessonGraphRow[],
  ): Promise<Map<string, Types.ObjectId>> {
    const refIdsByKind = new Map<ContentKind, Types.ObjectId[]>();
    for (const lesson of lessons) {
      for (const ref of lesson.itemRefs) {
        refIdsByKind.set(ref.kind, [...(refIdsByKind.get(ref.kind) ?? []), ref.id]);
      }
    }

    const nodeIdByRef = new Map<string, Types.ObjectId>();
    for (const [kind, refIds] of refIdsByKind) {
      const nodes = await this.knowledgeGraph.findNodesByRefs(kind, refIds);
      for (const node of nodes) {
        // Optional on the schema since concepts exist; always set on the
        // content-backed nodes this queries for.
        if (node.refId) nodeIdByRef.set(`${kind}:${node.refId.toString()}`, node._id);
      }
    }

    return nodeIdByRef;
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
   * Chains a kana pack's lessons: each one lists the previous as a prerequisite.
   *
   * `carriedLessonId` is the last lesson of the *previous* pack, which is how
   * the gate between units is expressed. Returns this pack's last lesson id so
   * the next pack can hang off it.
   *
   * The graph is no longer written here — `syncLessonGraph` derives it from
   * `prerequisiteLessonIds` after every pack has been seeded.
   */
  private async seedKanaLessons(
    pack: KanaPack,
    kanaIdsByRow: Map<string, Types.ObjectId[]>,
    carriedLessonId: Types.ObjectId | null,
  ): Promise<Types.ObjectId | null> {
    let previousLessonId = carriedLessonId;

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

      // Keep the character curriculum self-contained: the reader and the
      // public curriculum endpoint can identify the teaching lesson without
      // joining through every lesson's itemRefs. The Phase 0 migration covers
      // pre-existing databases; this keeps fresh and repeated seeds correct.
      await this.contentService.setKanaTaughtInLesson(kanaIds, seed.order);

      // No graph writes here any more (ADR-005). `syncLessonGraph` derives the
      // whole lesson layer from the lessons themselves once everything is
      // seeded, which is why kana used to be the only unit with a lesson node:
      // this block existed and the vocab, grammar and kanji equivalents did not.
      previousLessonId = lesson._id;
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
        // Phase 3 #15: each example carries its own `constituentKana` so the
        // sentence reader can do the same subset filter the vocab reader does
        // without re-walking the sentence on every request. Projected from
        // the sentence text via the same `decomposeIntoKana` the vocab
        // migration uses, so the "what counts as known kana" rule stays in
        // one place (see `common/kana/decompose.ts`).
        const examples = point.examples.map((example) => ({
          ...example,
          constituentKana: [...decomposeIntoKana(example.sentence)],
        }));

        const grammar = await this.contentService.upsertGrammar({
          title: point.title,
          explanation: point.explanation,
          jlpt: 'N5',
          examples,
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
