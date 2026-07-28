import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { JOB_LEAGUE_SETTLE, LeagueSettlePayload, QUEUE_LEAGUE } from '../jobs/queues';
import { LeagueService } from './league.service';

/**
 * Worker for the `league` queue (ADR-006).
 *
 * Settlement logic stays on `LeagueService` — its dedup is the unique index on
 * `leagueStandings {week, tier}`, and that property belongs with the data
 * rather than duplicated here. This is a thin caller, and it lives in `social/`
 * because that is the module that owns the collection.
 *
 * `now` is taken from the job when the lazy path published one and from the
 * worker's own clock otherwise — the scheduled run has no useful `now` to carry,
 * since a repeatable job's template data is frozen at upsert time.
 *
 * Errors do not propagate. The request that triggered the job already returned,
 * so there is nothing left to fail; a failure logs, and both the next
 * leaderboard read and the next scheduled run try again.
 */
@Injectable()
@Processor(QUEUE_LEAGUE)
export class LeagueSettleProcessor extends WorkerHost {
  private readonly logger = new Logger(LeagueSettleProcessor.name);

  constructor(private readonly leagueService: LeagueService) {
    super();
  }

  async process(job: Job<LeagueSettlePayload>): Promise<void> {
    if (job.name !== JOB_LEAGUE_SETTLE) {
      throw new Error(`Unknown job name: ${job.name}`);
    }

    const now = job.data.now ? new Date(job.data.now) : new Date();
    try {
      await this.leagueService.settleClosedWeeks(now);
    } catch (err) {
      this.logger.warn(
        `league.settle failed at ${now.toISOString()}: ` +
          `${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
