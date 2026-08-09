import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsProcessor } from './analytics.processor';
import { AnalyticsService } from './analytics.service';
import { Event, EventSchema } from './schemas/event.schema';

/**
 * Owns `events`. Provides `AnalyticsProcessor` so the worker that writes here
 * sits next to the schema it writes — the same module that already owns
 * `countTodayByType` and `deleteAllForUser`.
 *
 * No `BullModule.registerQueue` here: the queues are registered once in
 * `JobsModule`, which is `@Global()`, and a processor needs the connection
 * rather than the queue token. Registering the same queue in two modules would
 * mean two `Queue` instances and two more Redis connections for nothing.
 */
@Module({
  imports: [MongooseModule.forFeature([{ name: Event.name, schema: EventSchema }])],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsProcessor],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
