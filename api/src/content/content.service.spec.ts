import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ContentService } from './content.service';
import { KanaItemDocument } from './schemas/kana-item.schema';
import { LessonDocument } from './schemas/lesson.schema';

function oid(hex: string): Types.ObjectId {
  return new Types.ObjectId(hex.padStart(24, '0'));
}

function kanaDoc(id: Types.ObjectId, kana: string, romaji: string, order: number) {
  return {
    _id: id,
    kana,
    romaji,
    script: 'hiragana',
    row: 'a',
    order,
  } as unknown as KanaItemDocument;
}

/** Only the model methods ContentService actually calls. */
function makeService(opts: {
  lesson?: LessonDocument | null;
  kanaDocs?: KanaItemDocument[];
}): ContentService {
  const lessonModel = {
    findById: () => ({ exec: () => Promise.resolve(opts.lesson ?? null) }),
    find: () => ({ sort: () => ({ exec: () => Promise.resolve([]) }) }),
  };
  const kanaModel = {
    // Mongo returns $in matches in arbitrary order — simulate that by
    // reversing, so a service that just echoes the query result will fail.
    find: () => ({ exec: () => Promise.resolve([...(opts.kanaDocs ?? [])].reverse()) }),
  };
  const empty = { find: () => ({ exec: () => Promise.resolve([]) }) };

  return new ContentService(
    lessonModel as never,
    kanaModel as never,
    empty as never,
    empty as never,
    empty as never,
  );
}

describe('ContentService.findLessonById', () => {
  const a = oid('a1');
  const i = oid('a2');
  const u = oid('a3');

  function lessonWith(refIds: Types.ObjectId[]): LessonDocument {
    return {
      _id: oid('1'),
      lang: 'ja',
      unit: 'hiragana-basics',
      order: 0,
      title: 'Hiragana: the five vowels (あ row)',
      exerciseTypes: ['multipleChoice'],
      prerequisiteLessonIds: [],
      itemRefs: refIds.map((id) => ({ kind: 'kana' as const, id })),
    } as unknown as LessonDocument;
  }

  it('resolves kana items in the lesson order, not the order Mongo returns them', async () => {
    const service = makeService({
      lesson: lessonWith([a, i, u]),
      kanaDocs: [kanaDoc(a, 'あ', 'a', 0), kanaDoc(i, 'い', 'i', 1), kanaDoc(u, 'う', 'u', 2)],
    });

    const detail = await service.findLessonById(oid('1').toString());

    // The order is pedagogical — あいうえお must not come back scrambled.
    expect(detail.items.map((item) => 'kana' in item && item.kana)).toEqual(['あ', 'い', 'う']);
  });

  it('drops refs whose content document no longer exists instead of emitting nulls', async () => {
    const service = makeService({
      lesson: lessonWith([a, oid('dead'), u]),
      kanaDocs: [kanaDoc(a, 'あ', 'a', 0), kanaDoc(u, 'う', 'u', 2)],
    });

    const detail = await service.findLessonById(oid('1').toString());

    expect(detail.items).toHaveLength(2);
    expect(detail.items.every((item) => item !== null && item !== undefined)).toBe(true);
  });

  it('returns an empty item list for a lesson with no refs', async () => {
    const service = makeService({ lesson: lessonWith([]), kanaDocs: [] });

    const detail = await service.findLessonById(oid('1').toString());

    expect(detail.items).toEqual([]);
    expect(detail.itemCount).toBe(0);
  });

  it('rejects a malformed id with 400 rather than letting a CastError become a 500', async () => {
    const service = makeService({});

    await expect(service.findLessonById('not-an-objectid')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('throws 404 when the lesson is absent', async () => {
    const service = makeService({ lesson: null });

    await expect(service.findLessonById(oid('1').toString())).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

/**
 * The lookup §7 step 7 needs: turn a chat correction's free text into the
 * taught words it mentions. Built with a real vocabulary slice, because the
 * behaviour worth pinning is which words match — not that a mock was called.
 */
function vocabDoc(id: Types.ObjectId, lemma: string) {
  return { _id: id, lemma } as unknown as never;
}

function makeVocabService(lemmas: [string, string][]): ContentService {
  const docs = lemmas.map(([id, lemma]) => vocabDoc(oid(id), lemma));
  const vocabModel = { find: () => ({ exec: () => Promise.resolve(docs) }) };
  const empty = { find: () => ({ exec: () => Promise.resolve([]) }) };

  return new ContentService(
    empty as never,
    empty as never,
    vocabModel as never,
    empty as never,
    empty as never,
  );
}

describe('ContentService.findVocabInTexts (T1.5)', () => {
  const VOCAB: [string, string][] = [
    ['b1', 'わたし'],
    ['b2', 'がっこう'],
    ['b3', 'せんせい'],
    // Single-character lemmas: real words, and also two of the commonest
    // particles in the language.
    ['b4', 'に'],
    ['b5', 'て'],
  ];

  it('finds a taught word inside a correction fragment', async () => {
    const service = makeVocabService(VOCAB);

    const found = await service.findVocabInTexts(['がっこう']);

    expect(found.map((d) => d.lemma)).toEqual(['がっこう']);
  });

  it('matches mid-string, since Japanese does not space its words', async () => {
    const service = makeVocabService(VOCAB);

    const found = await service.findVocabInTexts(['わたしはがっこうにいきます']);

    expect(found.map((d) => d.lemma).sort()).toEqual(['がっこう', 'わたし']);
  });

  /**
   * The important one. に is both the number "two" and the commonest particle
   * in the language, so matching it would schedule the *number* for review every
   * time the tutor corrected a particle — teaching the wrong thing, not merely
   * a useless card. OPEN-ITEMS #23.
   */
  it('never matches a single-character lemma, however often it appears', async () => {
    const service = makeVocabService(VOCAB);

    const found = await service.findVocabInTexts(['がっこうにいきます', 'てにもって']);

    expect(found.map((d) => d.lemma)).toEqual(['がっこう']);
  });

  it('searches every fragment it is given, deduplicated by document', async () => {
    const service = makeVocabService(VOCAB);

    // The learner's misspelling and the tutor's fix, which is how the caller
    // passes them. わたし appears in both and must be returned once.
    const found = await service.findVocabInTexts(['わたしわ', 'わたしは']);

    expect(found.map((d) => d.lemma)).toEqual(['わたし']);
  });

  it('returns nothing for text that mentions no taught word', async () => {
    const service = makeVocabService(VOCAB);

    expect(await service.findVocabInTexts(['ねこ'])).toEqual([]);
  });

  it('skips the query entirely when there is nothing to search', async () => {
    const service = makeVocabService(VOCAB);

    expect(await service.findVocabInTexts([])).toEqual([]);
    expect(await service.findVocabInTexts(['', ''])).toEqual([]);
  });
});
