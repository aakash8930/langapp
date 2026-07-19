import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Event, EventDocument } from './schemas/event.schema';

export interface RecordEventInput {
  userId: string;
  type: string;
  payload?: Record<string, unknown>;
}

/**
 * Owns the `events` collection. Write path only in Phase 0 (§4).
 */
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(@InjectModel(Event.name) private readonly eventModel: Model<EventDocument>) {}

  /**
   * Never throws.
   *
   * §7 puts analytics off the request path precisely so a failure here can't
   * affect the user's action — losing an analytics row is always preferable to
   * failing the lesson completion that produced it. Until BullMQ exists this is
   * a synchronous write that swallows its own errors; the queue is the [Later]
   * version of the same guarantee.
   */
  async record(input: RecordEventInput): Promise<void> {
    try {
      await this.eventModel.create({
        userId: new Types.ObjectId(input.userId),
        type: input.type,
        payload: input.payload ?? {},
        ts: new Date(),
      });
    } catch (err) {
      this.logger.warn(
        `Dropped '${input.type}' event for user ${input.userId}: ` +
          `${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /** Read side is [Later] — this exists so tests and the seed can assert. */
  async countForUser(userId: string, type?: string): Promise<number> {
    const filter: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
    if (type) {
      filter.type = type;
    }
    return this.eventModel.countDocuments(filter).exec();
  }
}
