import { Global, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { JobsService } from '../jobs/jobs.service';
import { validateEnv } from '../config/env.validation';
import { SeedModule } from './seed.module';
import { SeedService } from './seed.service';

/**
 * Stands in for the BullMQ producer, which the seed has no way to satisfy: the
 * real `JobsService` needs queue tokens from `JobsModule`, and `JobsModule` opens
 * Redis — which this root module deliberately does not have.
 *
 * It is reachable but never used: `SeedModule -> ContentModule ->
 * forwardRef(LearningModule) -> AnalyticsModule` puts `AnalyticsService` in the
 * graph, so Nest must resolve its dependencies to instantiate the module at all,
 * even though seeding writes content and records no events. Logging rather than
 * silently dropping, so that if a future seed step *does* enqueue something, the
 * output says why nothing happened.
 *
 * Typed as a `Pick` rather than cast, so a change to either signature fails the
 * build here instead of at runtime.
 */
const seedJobsStub: Pick<JobsService, 'enqueue' | 'schedule'> = {
  enqueue: async (name) => {
    new Logger('Seed').warn(`Ignored background job '${name}' — the seed has no Redis.`);
    return { accepted: false, error: 'Redis is unavailable in seed context' };
  },
  schedule: async (schedulerId) => {
    new Logger('Seed').warn(`Ignored schedule '${schedulerId}' — the seed has no Redis.`);
  },
};

/**
 * `@Global()` for the same reason the real `JobsModule` is: `AnalyticsService`
 * lives in `AnalyticsModule`, which imports no jobs module of its own, so the
 * provider has to be visible app-wide. A provider declared on the root module is
 * *not* — that resolves for the root's own providers only, which is what made the
 * first attempt at this fix fail with the identical error.
 */
@Global()
@Module({
  providers: [{ provide: JobsService, useValue: seedJobsStub }],
  exports: [JobsService],
})
class SeedJobsModule {}

/**
 * A cut-down root module: Mongo and the two content modules, nothing else.
 * The seed has no reason to open Redis, bind a port, or boot the HTTP layer.
 *
 * **The cost of that is this file drifting from `AppModule`.** Twice now a module
 * in the seed's transitive graph has gained a dependency that only `AppModule`
 * registered, and `npm run seed` stopped booting: `JwtService` (OPEN-ITEMS #20)
 * and now `JobsService` (ADR-006). Neither was caught by typecheck, build or the
 * unit suite, because the seed has its own module graph and nothing exercised it
 * — which is why CI now runs the seed against a real Mongo.
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
    // Not because the seed authenticates anything — it doesn't. ContentModule
    // declares JwtAuthGuard on its controllers, so Nest must be able to resolve
    // JwtService to instantiate that module at all. AppModule registers this
    // globally and the seed inherited the assumption without the registration,
    // which is why `npm run seed` could not boot (OPEN-ITEMS #20).
    JwtModule.register({ global: true }),
    SeedJobsModule,
    SeedModule,
  ],
})
class SeedRootModule {}

async function bootstrap(): Promise<void> {
  const logger = new Logger('Seed');
  // No HTTP server — createApplicationContext gives DI without a listener.
  const app = await NestFactory.createApplicationContext(SeedRootModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const summary = await app.get(SeedService).run();
    logger.log(`Done: ${JSON.stringify(summary)}`);
    await app.close();
    process.exit(0);
  } catch (err) {
    logger.error(`Seed failed: ${err instanceof Error ? err.message : String(err)}`);
    await app.close();
    process.exit(1);
  }
}

void bootstrap();
