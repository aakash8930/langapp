import { LeagueSettleScheduler } from './league-settle.scheduler';

/**
 * The pattern is load-bearing: it decides *when* a week is settled, and getting
 * it wrong is the kind of mistake that shows up a week later as "nobody was
 * promoted". Monday 00:05 UTC, matching the ISO-week boundary
 * `gamification/week.ts` computes, with five minutes of slack so the job cannot
 * race midnight and read `isoWeek` on the wrong side of it.
 */
describe('LeagueSettleScheduler (ADR-006)', () => {
  it('schedules league.settle for Monday 00:05 UTC at boot', async () => {
    const schedule = jest.fn(
      (_id: string, _name: string, _pattern: string, _payload: unknown) => Promise.resolve(),
    );
    const scheduler = new LeagueSettleScheduler({ schedule } as never);

    await scheduler.onApplicationBootstrap();

    expect(schedule).toHaveBeenCalledTimes(1);
    const [id, name, pattern, payload] = schedule.mock.calls[0];
    expect(id).toBe('league-settle-weekly');
    expect(name).toBe('league.settle');
    // minute 5, hour 0, any day-of-month, any month, weekday 1 = Monday.
    expect(pattern).toBe('5 0 * * 1');
    // No `now`: a repeatable job's template data is frozen at upsert time, so an
    // instant here would settle against boot time for as long as the app lives.
    expect(payload).toEqual({});
  });

  /**
   * Boot must not depend on Redis being reachable, and this class does nothing to
   * ensure that — it awaits `JobsService.schedule`, which is where the failure is
   * swallowed (pinned in `jobs.service.spec.ts`). Recorded here so the absence of
   * a resilience test at this level reads as deliberate rather than forgotten:
   * catching here as well would duplicate the guarantee and hide it if the one on
   * `JobsService` were ever removed.
   */
  it('delegates rather than defends — one schedule call, no error handling of its own', async () => {
    const schedule = jest.fn(
      (_id: string, _name: string, _pattern: string, _payload: unknown) =>
        Promise.reject(new Error('redis down')),
    );
    const scheduler = new LeagueSettleScheduler({ schedule } as never);

    await expect(scheduler.onApplicationBootstrap()).rejects.toThrow('redis down');
  });
});
