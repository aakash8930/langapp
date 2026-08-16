import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { validateEnv } from '../config/env.validation';
import { JobsService } from '../jobs/jobs.service';
import { LearnerItemStateService } from '../learning/learner-item-state.service';
import { LearningModule } from '../learning/learning.module';

/**
 * **Additive migration** (ADR-003, §5.2): create a `LearnerItemState` for every
 * existing `SrsCard`, carrying over the review evidence the card already holds.
 *
 * Run with `npm run migrate:learner-item-state`.
 *
 * ## What this does not do
 *
 * It does **not** remove `totalReviews` / `correctReviews` from `SrsCard`, and it
 * does not `$unset` the inert `gamification.hearts` / `heartsUpdatedAt` / `gems`
 * fields (OPEN-ITEMS P2-2). §5.4 rule 2 is explicit — *additive first, destructive
 * later, **never in the same commit***: add the field, backfill it, ship the code
 * that reads it, verify, then drop the old one in a separate change. Nothing reads
 * `learnerItemStates` yet, so the destructive half is at least two slices away.
 *
 * ## Before running it against real data
 *
 * §5.4 rule 1: **take a verified backup first** — `scripts/backup.sh` restores and
 * counts every archive before accepting it, so it is one command. This migration
 * only inserts into a new collection and touches nothing existing, which makes it
 * about as safe as a migration gets; the backup is cheap and the rule exists so
 * that "safe" is never a judgement made in the moment.
 *
 * Idempotent: re-running skips cards that already have a state.
 */
const seedJobsStub: Pick<JobsService, 'enqueue' | 'schedule'> = {
  enqueue: async (name) => {
    new Logger('Migration').warn(`Ignored background job '${name}' — no Redis here.`);
    return { accepted: false, error: 'Redis is unavailable in migration context' };
  },
  schedule: async (schedulerId) => {
    new Logger('Migration').warn(`Ignored schedule '${schedulerId}' — no Redis here.`);
  },
};

/**
 * `@Global()` for the reason `seed.ts` documents: `AnalyticsModule` imports no
 * jobs module of its own, so a provider on the root module is not visible to it.
 */
@Global()
@Module({
  providers: [{ provide: JobsService, useValue: seedJobsStub }],
  exports: [JobsService],
})
class MigrationJobsModule {}

/**
 * Mongo and `LearningModule`, nothing else — no Redis, no HTTP. The same
 * cut-down-root-module shape as `seed.ts`, and the same hazard: it duplicates
 * `AppModule`'s wiring by hand and will drift when a module in this graph gains a
 * dependency (OPEN-ITEMS #37). Booting it is part of the CI seed step's job.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env', validate: validateEnv }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGO_URI'),
        serverSelectionTimeoutMS: 3000,
      }),
    }),
    JwtModule.register({ global: true }),
    MigrationJobsModule,
    LearningModule,
  ],
})
class MigrationRootModule {}

async function bootstrap(): Promise<void> {
  const logger = new Logger('Migration');
  const app = await NestFactory.createApplicationContext(MigrationRootModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const service = app.get(LearnerItemStateService);

    // Before anything is inserted: the unique index on `{userId, itemRef}` is what
    // guarantees one state per item, and Mongoose does not await index creation,
    // so a short-lived process can exit before it finishes. Verified necessary —
    // the first run against a copy of the real database left one of the two
    // indexes unbuilt.
    await service.ensureIndexes();

    const before = await service.count();
    const report = await service.backfillFromSrsCards();
    const after = await service.count();

    logger.log(
      `learnerItemStates: ${before} -> ${after} ` +
        `(${report.created} created, ${report.skipped} already present, ` +
        `${report.cards} cards scanned)`,
    );
    await app.close();
    process.exit(0);
  } catch (err) {
    logger.error(
      `Migration failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    await app.close();
    process.exit(1);
  }
}

void bootstrap();
