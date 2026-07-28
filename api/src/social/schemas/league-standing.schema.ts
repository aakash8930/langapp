import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/**
 * A finished week's final table for one tier.
 *
 * ## Why this exists at all
 *
 * Weekly XP is a counter that gets **reset** when the week turns, so the moment
 * a week closes its standings are gone. Without a snapshot there is no way to
 * tell a learner how they finished, and no way to make settlement idempotent —
 * a second settle pass would read the new week's (empty) totals and either
 * promote or fail to move everybody depending on the mechanic.
 *
 * ## Why settlement is lazy rather than scheduled
 *
 * There is no job runner here — §7 wants BullMQ and it does not exist yet. So a
 * week is settled by the first request that notices it has closed, and the
 * unique index on `{ week, tier }` is what makes "first" mean exactly one: a
 * concurrent second attempt hits a duplicate key and backs off rather than
 * settling twice.
 *
 * The cost is that a week nobody looks at is never settled, and settles late
 * whenever someone finally does. For a leaderboard that is acceptable — the
 * standings are correct whenever they are read, just computed on demand.
 */
@Schema({ collection: 'leagueStandings', timestamps: { createdAt: true, updatedAt: false } })
export class LeagueStanding {
  /** ISO week identifier, e.g. '2026-W30'. */
  @Prop({ type: String, required: true })
  week: string;

  @Prop({ type: Number, required: true })
  tier: number;

  /**
   * The final table, best first. Denormalised — the display name is copied in
   * so a past week still reads correctly after someone renames themselves or
   * deletes their account.
   */
  @Prop({
    type: [
      {
        _id: false,
        userId: { type: Types.ObjectId, required: true },
        displayName: { type: String, required: true },
        weeklyXp: { type: Number, required: true },
        rank: { type: Number, required: true },
        movedTo: { type: Number, required: true },
      },
    ],
    default: [],
  })
  rows: {
    userId: Types.ObjectId;
    displayName: string;
    weeklyXp: number;
    rank: number;
    /** The tier they were moved to — equal to `tier` when they stayed put. */
    movedTo: number;
  }[];
}

export type LeagueStandingDocument = HydratedDocument<LeagueStanding>;
export const LeagueStandingSchema = SchemaFactory.createForClass(LeagueStanding);

/** One settlement per (week, tier). This is what makes lazy settling safe. */
LeagueStandingSchema.index({ week: 1, tier: 1 }, { unique: true });
