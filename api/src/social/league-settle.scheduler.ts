import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { JobsService } from '../jobs/jobs.service';
import { JOB_LEAGUE_SETTLE } from '../jobs/queues';

/**
 * Fires `league.settle` just after the UTC week boundary (ADR-006).
 *
 * Settlement used to happen inline on the first `/social/leaderboard` request
 * after a week closed. Moving it to a job took it off the request path but
 * would have made the *first* reader of the new week see their old tier —
 * the job runs after the response is written. A boundary schedule closes that
 * window: by the time anyone opens the app on Monday, promotion has already
 * happened.
 *
 * **The lazy enqueue in `LeagueService.leaderboard` stays**, and this does not
 * replace it. BullMQ skips a missed occurrence rather than firing it late, and
 * Stage A is a laptop (§11) that is regularly asleep at 00:05 UTC — so the
 * schedule is the fast path and the read is the safety net. Both are idempotent
 * against the unique index on `leagueStandings {week, tier}`, so running both is
 * harmless.
 *
 * 00:05 rather than 00:00: a few minutes of slack means the job cannot race the
 * boundary itself and compute `isoWeek` on the wrong side of midnight.
 */
@Injectable()
export class LeagueSettleScheduler implements OnApplicationBootstrap {
  private static readonly SCHEDULER_ID = 'league-settle-weekly';
  private static readonly PATTERN = '5 0 * * 1';

  constructor(private readonly jobs: JobsService) {}

  async onApplicationBootstrap(): Promise<void> {
    // No `now` in the payload: the template data of a repeatable job is frozen
    // when it is upserted, so a baked-in instant would be boot time forever.
    // The worker uses its own clock instead.
    await this.jobs.schedule(
      LeagueSettleScheduler.SCHEDULER_ID,
      JOB_LEAGUE_SETTLE,
      LeagueSettleScheduler.PATTERN,
      {},
    );
  }
}
