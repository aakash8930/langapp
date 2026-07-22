import { ContentKind } from '../../knowledge-graph/schemas/knowledge-node.schema';
import { GrammarPointDocument } from '../schemas/grammar-point.schema';
import { KanaItemDocument } from '../schemas/kana-item.schema';
import { KanjiEntryDocument } from '../schemas/kanji-entry.schema';
import { LessonDocument } from '../schemas/lesson.schema';
import { VocabItemDocument } from '../schemas/vocab-item.schema';

/** The item payloads a resolved lesson can contain, discriminated by `kind`. */
export type ResolvedItem =
  | { kind: 'kana'; id: string; kana: string; romaji: string; script: string; row: string; order: number }
  | {
      kind: 'vocab';
      id: string;
      lemma: string;
      reading: string;
      /** Latin script, up to N4. Absent beyond it. */
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
      /** Worked examples, gap and all. The quiz asks about the first. */
      examples: { sentence: string; answer: string; romaji?: string; gloss: string }[];
    }
  | { kind: 'kanji'; id: string; char: string; on: string[]; kun: string[]; meanings: string[]; strokes: number };

export interface LessonSummary {
  id: string;
  lang: 'ja';
  unit: string;
  order: number;
  title: string;
  exerciseTypes: string[];
  itemCount: number;
  prerequisiteLessonIds: string[];
}

export interface LessonDetail extends LessonSummary {
  items: ResolvedItem[];
}

export function toLessonSummary(lesson: LessonDocument): LessonSummary {
  return {
    id: lesson._id.toString(),
    lang: lesson.lang,
    unit: lesson.unit,
    order: lesson.order,
    title: lesson.title,
    exerciseTypes: lesson.exerciseTypes,
    itemCount: lesson.itemRefs.length,
    prerequisiteLessonIds: lesson.prerequisiteLessonIds.map((id) => id.toString()),
  };
}

export function kanaToResolved(doc: KanaItemDocument): Extract<ResolvedItem, { kind: 'kana' }> {
  return {
    kind: 'kana',
    id: doc._id.toString(),
    kana: doc.kana,
    romaji: doc.romaji,
    script: doc.script,
    row: doc.row,
    order: doc.order,
  };
}

export function vocabToResolved(doc: VocabItemDocument): Extract<ResolvedItem, { kind: 'vocab' }> {
  return {
    kind: 'vocab',
    id: doc._id.toString(),
    lemma: doc.lemma,
    reading: doc.reading,
    romaji: doc.romaji,
    gloss: doc.gloss,
    pos: doc.pos,
    jlpt: doc.jlpt,
  };
}

export function grammarToResolved(
  doc: GrammarPointDocument,
): Extract<ResolvedItem, { kind: 'grammar' }> {
  return {
    kind: 'grammar',
    id: doc._id.toString(),
    title: doc.title,
    jlpt: doc.jlpt,
    explanation: doc.explanation,
    // Explicit field copy rather than passing the subdocuments through, so a
    // field added to the schema later cannot leak into a response by accident.
    examples: doc.examples.map((example) => ({
      sentence: example.sentence,
      answer: example.answer,
      romaji: example.romaji,
      gloss: example.gloss,
    })),
  };
}

export function kanjiToResolved(doc: KanjiEntryDocument): Extract<ResolvedItem, { kind: 'kanji' }> {
  return {
    kind: 'kanji',
    id: doc._id.toString(),
    char: doc.char,
    on: doc.on,
    kun: doc.kun,
    meanings: doc.meanings,
    strokes: doc.strokes,
  };
}

export const RESOLVABLE_KINDS: ContentKind[] = ['kana', 'vocab', 'grammar', 'kanji'];
