import { Job } from 'bullmq';
import { LeagueSettleProcessor } from './league-settle.processor';

/**
 * The worker is a thin caller — it hands a `now` to
 * `LeagueService.settleClosedWeeks`. Worth pinning:
 *
 *  - The published `now` reaches the service, parsed from the ISO string the
 *    lazy path sends.
 *  - **An absent `now` falls back to the worker's clock**, which is the
 *    scheduled run's normal case: a repeatable job's template data is frozen at
 *    upsert time, so baking an instant in would settle against boot time
 *    forever.
 *  - A throw inside settlement is swallowed, so the next read or the next
 *    scheduled run retries.
 *  - An unknown job name still throws (mirrors the analytics processor).
 */
describe('LeagueSettleProcessor (ADR-006)', () => {
  function makeJob(name: string, data: unknown): Job {
    return { name, data } as unknown as Job;
  }

  function makeService() {
    return jest.fn((_now: Date) => Promise.resolve());
  }

  it('forwards the published `now` to LeagueService.settleClosedWeeks', async () => {
    const settleClosedWeeks = makeService();
    const processor = new LeagueSettleProcessor({ settleClosedWeeks } as never);

    await processor.process(makeJob('league.settle', { now: '2026-07-28T12:00:00.000Z' }));

    expect(settleClosedWeeks).toHaveBeenCalledTimes(1);
    const arg = settleClosedWeeks.mock.calls[0][0];
    expect(arg).toBeInstanceOf(Date);
    expect(arg.toISOString()).toBe('2026-07-28T12:00:00.000Z');
  });

  it('uses its own clock when the job carries no `now` (the scheduled run)', async () => {
    const settleClosedWeeks = makeService();
    const processor = new LeagueSettleProcessor({ settleClosedWeeks } as never);

    const before = Date.now();
    await processor.process(makeJob('league.settle', {}));
    const after = Date.now();

    const arg = settleClosedWeeks.mock.calls[0][0];
    expect(arg).toBeInstanceOf(Date);
    expect(arg.getTime()).toBeGreaterThanOrEqual(before);
    expect(arg.getTime()).toBeLessThanOrEqual(after);
  });

  it('swallows a settlement failure so the next trigger can retry', async () => {
    const settleClosedWeeks = jest.fn((_now: Date) =>
      Promise.reject(new Error('duplicate key')),
    );
    const processor = new LeagueSettleProcessor({ settleClosedWeeks } as never);

    await expect(
      processor.process(makeJob('league.settle', { now: '2026-07-28T12:00:00.000Z' })),
    ).resolves.toBeUndefined();
  });

  it('throws on an unknown job name', async () => {
    const processor = new LeagueSettleProcessor({
      settleClosedWeeks: makeService(),
    } as never);

    await expect(
      processor.process(makeJob('unknown.name', { now: new Date().toISOString() })),
    ).rejects.toThrow('Unknown job name: unknown.name');
  });
});
