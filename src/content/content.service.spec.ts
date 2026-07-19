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
