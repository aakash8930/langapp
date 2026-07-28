import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Job } from 'bullmq';
import { Model, Types } from 'mongoose';
import {
  AnalyticsRecordPayload,
  JOB_ANALYTICS_RECORD,
  QUEUE_ANALYTICS,
} from '../jobs/queues';
import { Event, EventDocument } from './schemas/event.schema';

/**
 * Worker for the `analytics` queue (ADR-006).
 *
 * The write is exactly what the inline `AnalyticsService.record` used to do,
 * lifted onto a queue so the request path no longer pays the Mongo round trip.
 * It lives in `analytics/` rather than `jobs/` because it writes `events`, and
 * a module never touches another module's collections.
 *
 * Errors are swallowed rather than rethrown, which deliberately declines the
 * retry BullMQ would give: the failures this sees are permanent (a malformed
 * userId, a validation error), so a second attempt fails the same way. A
 * transient Mongo outage loses the row, and that is the trade §7 already made —
 * an analytics row is replaceable, the lesson completion that produced it is
 * not.
 */
@Injectable()
@Processor(QUEUE_ANALYTICS)
export class AnalyticsProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalyticsProcessor.name);

  constructor(
    @InjectModel(Event.name) private readonly eventModel: Model<EventDocument>,
  ) {
    super();
  }

  async process(job: Job<AnalyticsRecordPayload>): Promise<void> {
    if (job.name !== JOB_ANALYTICS_RECORD) {
      // Defensive, and it should never fire: this queue carries one job name.
      // A future job added to this queue without a handler must look like a
      // failure, not like a silent no-op.
      throw new Error(`Unknown job name: ${job.name}`);
    }

    const { userId, type, payload } = job.data;
    try {
      await this.eventModel.create({
        userId: new Types.ObjectId(userId),
        type,
        payload: payload ?? {},
        ts: new Date(),
      });
    } catch (err) {
      this.logger.warn(
        `Dropped '${type}' event for user ${userId}: ` +
          `${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
