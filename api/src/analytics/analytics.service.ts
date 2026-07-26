import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { localDateString } from '../user/gamification/streak';
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

  /**
   * How many events of each given type the user logged on *their* local today —
   * the read behind /me/progress's daily summary (T1.8).
   *
   * ## Why it fetches a window and filters in memory
   *
   * "Today" here means the same thing it means everywhere else in this app: the
   * user's local calendar date, compared as a `'YYYY-MM-DD'` string by
   * `localDateString`. A Mongo range query would instead need the *instant* of
   * local midnight, which means deriving a UTC offset for an IANA zone — and
   * getting that subtly wrong across a DST boundary is exactly the class of bug
   * OPEN-ITEMS #18 already documents on the streak.
   *
   * So this pulls a 48-hour window (wide enough to contain local today for every
   * zone, UTC-12 through UTC+14) and applies the same tested helper the streak
   * uses. A day's events for one learner is a handful of rows, and the
   * `{ userId: 1, ts: -1 }` index serves the window directly.
   *
   * The cost is that this does not scale to an analytics dashboard — it is a
   * per-user daily count, nothing more. §13's funnel reads are still [Later] and
   * will want a real aggregation.
   */
  async countTodayByType(
    userId: string,
    types: string[],
    timeZone: string,
    now: Date,
  ): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    for (const type of types) {
      counts[type] = 0;
    }

    if (types.length === 0) {
      return counts;
    }

    const windowStart = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const today = localDateString(now, timeZone);

    const rows = await this.eventModel
      .find({
        userId: new Types.ObjectId(userId),
        type: { $in: types },
        ts: { $gte: windowStart },
      })
      .select('type ts')
      .lean<{ type: string; ts: Date }[]>()
      .exec();

    for (const row of rows) {
      if (localDateString(row.ts, timeZone) === today) {
        counts[row.type] = (counts[row.type] ?? 0) + 1;
      }
    }

    return counts;
  }
}
