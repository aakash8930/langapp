import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobsService } from './jobs.service';
import { QUEUE_ANALYTICS, QUEUE_LEAGUE } from './queues';

/**
 * Background jobs behind the existing Redis (ADR-006).
 *
 * `JobsModule` is **only** infrastructure: the BullMQ connection, the queue
 * registrations, and the producer (`JobsService`). The *work* lives in the
 * module that owns the collection it writes — `AnalyticsProcessor` is in
 * `analytics/` because it writes `events`; `LeagueSettleProcessor` is in
 * `social/` because it settles `leagueStandings`. Nothing here touches another
 * module's data, so the one rule that matters still holds.
 *
 * **One queue per concern, not one queue for everything.** A BullMQ worker
 * consumes every job on its queue regardless of name, so two processors sharing
 * a queue name means two workers each receiving the other's jobs — on a race,
 * silently. Per-queue options are the second reason: analytics is
 * fire-and-forget and replaceable, settlement is idempotent but not disposable,
 * and the §6.14 jobs still to come (AI generation, speech scoring, TTS
 * pre-generation) each want their own concurrency and backoff. A shared queue
 * forces one policy on all of them.
 *
 * Workers run **in-process** — the same Nest app as the API. The
 * solo-maintained Stage A deployment (§11) gets one process and one Redis, and
 * a separate worker process is operational surface that only pays back under
 * load this does not have yet. When it does, the queues are already the seam:
 * a worker entrypoint imports the owning modules and skips the HTTP layer.
 *
 * Failure semantics: `JobsService.enqueue` does **not** throw. The point of
 * moving work off the request path is that a user's action cannot fail because
 * the queue is in a bad state. A job that never lands is logged; the request
 * still succeeds.
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          // The same Redis the throttler and the refresh-token store already
          // share; BullMQ keeps its own connections to it.
          url: config.getOrThrow<string>('REDIS_URL'),
          // Fail the enqueue rather than buffer it. The default (`true`) makes
          // `queue.add` wait for a reconnect, which would park a request on the
          // very outage this queue exists to survive — `JobsService` would sit
          // there instead of logging the rejection and returning.
          //
          // Deliberately no `maxRetriesPerRequest`: BullMQ overrides it to
          // `null` on a worker's blocking connection and prints an error to
          // stderr if it was set, so pinning it here buys a startup warning and
          // changes nothing.
          enableOfflineQueue: false,
          connectTimeout: 2000,
        },
      }),
    }),
    // Registered centrally because `JobsService` is the only producer, so it is
    // the only thing that needs a queue token. Owning modules provide their
    // processor and nothing else — the explorer finds it through the global
    // connection, and `@Global()` is what puts these tokens in reach.
    BullModule.registerQueue(
      {
        name: QUEUE_ANALYTICS,
        defaultJobOptions: {
          // One retry, then drop. An analytics row is append-only and
          // replaceable, and the processor already swallows permanent failures
          // rather than spending the budget on a malformed userId.
          attempts: 2,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: { count: 1000 },
          removeOnFail: { count: 1000 },
        },
      },
      {
        name: QUEUE_LEAGUE,
        defaultJobOptions: {
          // No retry. Settlement is idempotent — the unique index on
          // `leagueStandings {week, tier}` makes a second attempt a no-op —
          // but a 1s backoff is a worse retry than what already exists: the
          // next leaderboard read re-enqueues, and the scheduled run comes
          // round again. Failures are kept longer relative to volume because
          // there is one settlement a week, not one per lesson.
          attempts: 1,
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 100 },
        },
      },
    ),
  ],
  providers: [JobsService],
  exports: [JobsService, BullModule],
})
export class JobsModule {}
