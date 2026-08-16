import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { JobsOptions, Queue } from 'bullmq';
import {
  JOB_QUEUE,
  JobName,
  JobPayloads,
  QUEUE_ANALYTICS,
  QUEUE_LEAGUE,
  QUEUE_MAIL,
  QUEUE_NOTIFICATIONS,
  QueueName,
} from './queues';

export interface EnqueueResult {
  accepted: boolean;
  jobId?: string;
  error?: string;
}

export interface QueueSnapshot {
  status: 'up' | 'down';
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  completed: number;
  error?: string;
}

/**
 * Producer side of the in-process queues (ADR-006).
 *
 * `enqueue` is what every module calls when it has work it wants off the
 * request path. Two contracts:
 *
 * 1. **It does not throw.** A Redis outage, a misconfigured queue or a
 *    serialisation error logs and returns. Call sites stay simple because they
 *    do not have to defend against this failing — the same guarantee
 *    `AnalyticsService.record` documented when it wrote to Mongo inline.
 * 2. **It returns before the worker runs.** BullMQ resolves once Redis has
 *    accepted the job; the work happens later, on the worker. That is the whole
 *    point, and also the one thing callers must keep in mind — a read issued
 *    immediately afterwards may not see the write yet.
 *
 * The queue a job rides on comes from `JOB_QUEUE`, so callers name the job and
 * never the queue.
 */
@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);
  private readonly queues: Record<QueueName, Queue>;

  constructor(
    @InjectQueue(QUEUE_ANALYTICS) analytics: Queue,
    @InjectQueue(QUEUE_LEAGUE) league: Queue,
    @InjectQueue(QUEUE_NOTIFICATIONS) notifications: Queue,
    @InjectQueue(QUEUE_MAIL) mail: Queue,
  ) {
    this.queues = {
      [QUEUE_ANALYTICS]: analytics,
      [QUEUE_LEAGUE]: league,
      [QUEUE_NOTIFICATIONS]: notifications,
      [QUEUE_MAIL]: mail,
    };
  }

  /**
   * Put a job on its queue.
   *
   * `opts` covers the per-call cases a queue default cannot express — most
   * usefully `jobId`, which BullMQ treats as a dedup key: adding a job whose id
   * is already waiting is a no-op rather than a duplicate. That is how the
   * leaderboard coalesces many readers into one settlement.
   */
  async enqueue<N extends JobName>(
    name: N,
    payload: JobPayloads[N],
    opts?: JobsOptions,
  ): Promise<EnqueueResult> {
    try {
      const job = await this.queues[JOB_QUEUE[name]].add(name, payload, opts);
      return {
        accepted: true,
        ...(job?.id === undefined ? {} : { jobId: String(job.id) }),
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      // Callers that do not need delivery guarantees may ignore the result;
      // critical producers such as MailService surface `accepted: false`.
      this.logger.warn(`Dropped job '${name}': ${error}`);
      return { accepted: false, error };
    }
  }

  /** Operational queue counts for `/health`; no payload or PII is exposed. */
  async inspectQueue(name: QueueName): Promise<QueueSnapshot> {
    try {
      const counts = await this.queues[name].getJobCounts(
        'waiting',
        'active',
        'delayed',
        'failed',
        'completed',
      );
      return {
        status: 'up',
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        delayed: counts.delayed ?? 0,
        failed: counts.failed ?? 0,
        completed: counts.completed ?? 0,
      };
    } catch (err) {
      return {
        status: 'down',
        waiting: 0,
        active: 0,
        delayed: 0,
        failed: 0,
        completed: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Register (or update) a repeating job.
   *
   * `upsertJobScheduler` is keyed on `schedulerId`, so calling this on every
   * boot is correct rather than duplicative — the schedule is replaced, not
   * appended, and changing the pattern in code changes it in Redis on the next
   * restart.
   *
   * **A missed occurrence does not fire late.** BullMQ computes the next run
   * from the pattern, so a laptop that was off at the boundary skips that
   * occurrence entirely (§11 — Stage A is a laptop). Anything scheduled here
   * therefore needs a second path that still reaches it: for settlement that is
   * the lazy enqueue on the first leaderboard read.
   *
   * Does not throw, for the same reason `enqueue` does not — a queue that cannot
   * be reached at boot must not stop the API from serving.
   */
  async schedule<N extends JobName>(
    schedulerId: string,
    name: N,
    pattern: string,
    payload: JobPayloads[N],
  ): Promise<void> {
    try {
      await this.queues[JOB_QUEUE[name]].upsertJobScheduler(
        schedulerId,
        { pattern, tz: 'UTC' },
        { name, data: payload },
      );
      this.logger.log(`Scheduled '${name}' as '${schedulerId}' (${pattern} UTC)`);
    } catch (err) {
      this.logger.warn(
        `Could not schedule '${name}' as '${schedulerId}': ` +
          `${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
