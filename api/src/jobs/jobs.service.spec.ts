import { JobsService } from './jobs.service';

/**
 * The producer's job is to put the right job on the *right queue*, and to never
 * throw doing it. Routing is the part worth pinning: job names do not route in
 * BullMQ, `JOB_QUEUE` does, so a job on the wrong queue reaches a worker that
 * cannot handle it.
 */
describe('JobsService (ADR-006)', () => {
  // Params are declared so `add.mock.calls[0][n]` is typed — the same reason
  // the learning specs declare them.
  function makeQueues() {
    const analyticsAdd = jest.fn((_name: string, _data: unknown, _opts?: unknown) =>
      Promise.resolve(),
    );
    const leagueAdd = jest.fn((_name: string, _data: unknown, _opts?: unknown) =>
      Promise.resolve(),
    );
    const analyticsUpsert = jest.fn((_id: string, _repeat: unknown, _template?: unknown) =>
      Promise.resolve(),
    );
    const leagueUpsert = jest.fn((_id: string, _repeat: unknown, _template?: unknown) =>
      Promise.resolve(),
    );

    const service = new JobsService(
      { add: analyticsAdd, upsertJobScheduler: analyticsUpsert } as never,
      { add: leagueAdd, upsertJobScheduler: leagueUpsert } as never,
      {} as never,
      {} as never,
    );

    return { service, analyticsAdd, leagueAdd, analyticsUpsert, leagueUpsert };
  }

  it('puts an analytics job on the analytics queue and nothing on the league queue', async () => {
    const { service, analyticsAdd, leagueAdd } = makeQueues();

    await service.enqueue('analytics.record', {
      userId: '607f1f77bcf86cd799439011',
      type: 'lesson.completed',
      payload: { lessonId: 'abc' },
    });

    expect(analyticsAdd).toHaveBeenCalledTimes(1);
    expect(analyticsAdd).toHaveBeenCalledWith(
      'analytics.record',
      {
        userId: '607f1f77bcf86cd799439011',
        type: 'lesson.completed',
        payload: { lessonId: 'abc' },
      },
      undefined,
    );
    expect(leagueAdd).not.toHaveBeenCalled();
  });

  it('puts a settle job on the league queue and nothing on the analytics queue', async () => {
    const { service, analyticsAdd, leagueAdd } = makeQueues();

    await service.enqueue('league.settle', { now: '2026-07-28T12:00:00.000Z' });

    expect(leagueAdd).toHaveBeenCalledTimes(1);
    expect(leagueAdd.mock.calls[0][0]).toBe('league.settle');
    expect(analyticsAdd).not.toHaveBeenCalled();
  });

  /**
   * `jobId` is how the leaderboard coalesces a Monday morning's readers into a
   * single settlement, so it has to survive the trip through `enqueue`.
   */
  it('passes per-call options (the dedup jobId) through to the queue', async () => {
    const { service, leagueAdd } = makeQueues();

    await service.enqueue(
      'league.settle',
      { now: '2026-07-28T12:00:00.000Z' },
      { jobId: 'settle:2026-W30' },
    );

    expect(leagueAdd.mock.calls[0][2]).toEqual({ jobId: 'settle:2026-W30' });
  });

  /**
   * The whole point of moving work off the request path: a queue failure must
   * not turn into a 500 on the caller's action. Logging only.
   */
  it('does not throw when BullMQ rejects the add', async () => {
    const add = jest.fn((_name: string, _data: unknown, _opts?: unknown) =>
      Promise.reject(new Error('redis down')),
    );
    const service = new JobsService(
      { add } as never,
      { add } as never,
      { add } as never,
      { add } as never,
    );

    await expect(
      service.enqueue('analytics.record', { userId: 'u', type: 'x' }),
    ).resolves.toEqual({ accepted: false, error: 'redis down' });
    expect(add).toHaveBeenCalled();
  });

  it('reports retained mail queue lifecycle counts for health tooling', async () => {
    const getJobCounts = jest.fn().mockResolvedValue({
      waiting: 2,
      active: 1,
      delayed: 3,
      failed: 4,
      completed: 5,
    });
    const service = new JobsService(
      {} as never,
      {} as never,
      {} as never,
      { getJobCounts } as never,
    );

    await expect(service.inspectQueue('mail')).resolves.toEqual({
      status: 'up',
      waiting: 2,
      active: 1,
      delayed: 3,
      failed: 4,
      completed: 5,
    });
    expect(getJobCounts).toHaveBeenCalledWith(
      'waiting',
      'active',
      'delayed',
      'failed',
      'completed',
    );
  });

  it('returns a down snapshot instead of throwing when queue inspection fails', async () => {
    const getJobCounts = jest.fn().mockRejectedValue(new Error('redis down'));
    const service = new JobsService(
      {} as never,
      {} as never,
      {} as never,
      { getJobCounts } as never,
    );

    await expect(service.inspectQueue('mail')).resolves.toMatchObject({
      status: 'down',
      failed: 0,
      error: 'redis down',
    });
  });

  it('upserts a schedule on the queue the job belongs to, pinned to UTC', async () => {
    const { service, leagueUpsert, analyticsUpsert } = makeQueues();

    await service.schedule('league-settle-weekly', 'league.settle', '5 0 * * 1', {});

    expect(leagueUpsert).toHaveBeenCalledTimes(1);
    expect(leagueUpsert.mock.calls[0][0]).toBe('league-settle-weekly');
    expect(leagueUpsert.mock.calls[0][1]).toEqual({ pattern: '5 0 * * 1', tz: 'UTC' });
    expect(leagueUpsert.mock.calls[0][2]).toEqual({ name: 'league.settle', data: {} });
    expect(analyticsUpsert).not.toHaveBeenCalled();
  });

  /**
   * Scheduling runs at boot, so a Redis that is not up yet must still leave the
   * API serving — the lazy path settles instead.
   */
  it('does not throw when the schedule upsert fails at boot', async () => {
    const upsertJobScheduler = jest.fn(
      (_id: string, _repeat: unknown, _template?: unknown) =>
        Promise.reject(new Error('redis down')),
    );
    const service = new JobsService(
      { upsertJobScheduler } as never,
      { upsertJobScheduler } as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.schedule('league-settle-weekly', 'league.settle', '5 0 * * 1', {}),
    ).resolves.toBeUndefined();
  });
});
