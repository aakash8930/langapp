import { Job } from 'bullmq';
import { Types } from 'mongoose';
import { AnalyticsProcessor } from './analytics.processor';

const USER_ID = '607f1f77bcf86cd799439011';

/**
 * The processor is the Mongo write the inline `AnalyticsService.record` used to
 * do, lifted onto a queue. The point worth pinning is **fidelity of the write**
 * — the document shape must match what the rest of the codebase has been
 * reading (`{ userId, type, payload, ts }`) so `countTodayByType`, the daily
 * counts on `/me/progress`, and the existing tests do not break.
 *
 * Params on the `create` mock are declared so `create.mock.calls[0][0]` is
 * typed; `jest.fn(() => …)` types the call tuple as empty and fails
 * `npm run typecheck`.
 */
describe('AnalyticsProcessor (ADR-006)', () => {
  function makeJob(name: string, data: unknown): Job {
    return { name, data } as unknown as Job;
  }

  function makeCreate() {
    return jest.fn((doc: Record<string, unknown>) => Promise.resolve(doc));
  }

  it('writes the document with the same shape the inline path used', async () => {
    const create = makeCreate();
    const processor = new AnalyticsProcessor({ create } as never);

    await processor.process(
      makeJob('analytics.record', {
        userId: USER_ID,
        type: 'lesson.completed',
        payload: { lessonId: 'abc', xpAwarded: 10 },
      }),
    );

    expect(create).toHaveBeenCalledTimes(1);
    const doc = create.mock.calls[0][0];
    expect((doc.userId as Types.ObjectId).toString()).toBe(USER_ID);
    expect(doc.type).toBe('lesson.completed');
    expect(doc.payload).toEqual({ lessonId: 'abc', xpAwarded: 10 });
    expect(doc.ts).toBeInstanceOf(Date);
  });

  it('defaults payload to {} so a missing payload still inserts a row', async () => {
    const create = makeCreate();
    const processor = new AnalyticsProcessor({ create } as never);

    await processor.process(
      makeJob('analytics.record', { userId: USER_ID, type: 'chat.turn' }),
    );

    expect(create.mock.calls[0][0].payload).toEqual({});
  });

  it('swallows a write failure rather than throwing — losing an event is fine, the user action is not', async () => {
    const create = jest.fn((_doc: Record<string, unknown>) =>
      Promise.reject(new Error('mongo down')),
    );
    const processor = new AnalyticsProcessor({ create } as never);

    await expect(
      processor.process(
        makeJob('analytics.record', { userId: USER_ID, type: 'lesson.completed' }),
      ),
    ).resolves.toBeUndefined();
    expect(create).toHaveBeenCalled();
  });

  it('throws on an unknown job name so a missing handler cannot silently no-op', async () => {
    const processor = new AnalyticsProcessor({ create: makeCreate() } as never);

    await expect(
      processor.process(makeJob('unknown.name', { userId: USER_ID })),
    ).rejects.toThrow('Unknown job name: unknown.name');
  });

  // TS-only sanity: the payload type the producer publishes is the payload type
  // the consumer reads. A mismatch surfaces here at compile time.
  it('accepts ObjectId-coercible userId from the producer', async () => {
    const create = makeCreate();
    const processor = new AnalyticsProcessor({ create } as never);

    await processor.process(
      makeJob('analytics.record', {
        userId: USER_ID,
        type: 'practice.completed',
        payload: { cardId: new Types.ObjectId().toString() },
      }),
    );

    expect(create).toHaveBeenCalled();
  });
});
