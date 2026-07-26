import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/**
 * Declared here, with the storage that constrains it, so the schema enum, the
 * update DTO and the response DTO cannot drift apart.
 */
export const THEMES = ['light', 'dark', 'system'] as const;
export type Theme = (typeof THEMES)[number];

/**
 * Full hearts. Five is Duolingo's number and it is a good one: enough that a
 * careless answer is not fatal, few enough that the fifth mistake in a session
 * actually stings.
 */
export const MAX_HEARTS = 5;

/**
 * §5: embed what is read together and bounded. Profile, gamification and
 * settings are always read with the user, so they are sub-documents, not refs.
 * `_id: false` keeps them plain embedded objects.
 */
@Schema({ _id: false })
export class Profile {
  @Prop({ required: true, trim: true })
  displayName: string;

  @Prop({ required: true, default: 'en' })
  nativeLanguage: string;

  @Prop({ type: String, required: true, enum: ['ja'], default: 'ja' })
  activeTrack: 'ja';

  /**
   * Date of birth, for the age gate that guards the social features.
   *
   * **Optional on the schema, required by `RegisterDto`.** The 32 accounts that
   * existed before the gate landed have no value here, and making the field
   * required would have made every one of them fail validation on next save.
   * Absent therefore means "unknown age", which `meetsMinimumAge` treats as
   * *not* meeting any minimum — so legacy accounts can keep learning and cannot
   * reach messaging until they supply one. Failing closed is the only safe
   * direction for this particular null.
   */
  @Prop({ type: Date, default: null })
  dateOfBirth: Date | null;
}
export const ProfileSchema = SchemaFactory.createForClass(Profile);

@Schema({ _id: false })
export class Gamification {
  @Prop({ required: true, default: 0, min: 0 })
  xp: number;

  @Prop({ required: true, default: 0, min: 0 })
  streakDays: number;

  /** 'YYYY-MM-DD' in the user's own tz — a string, not a Date, on purpose (§5). */
  @Prop({ type: String, default: null })
  lastStudyDate: string | null;

  @Prop({ required: true, default: 50, min: 0 })
  dailyGoalXp: number;

  /**
   * Beyond §5. "Today's XP vs dailyGoalXp" needs a per-day counter, and §5 only
   * stores lifetime `xp`. The alternative — summing today's `xpAwarded` out of
   * the analytics events — would mean reading another module's collection for
   * business logic, and those writes are best-effort (they swallow failures),
   * so the goal ring would silently under-report.
   *
   * Reset to 0 by `awardXp` on the first action of a new local day, alongside
   * `lastStudyDate`. The two are only ever written together.
   */
  @Prop({ required: true, default: 0, min: 0 })
  todayXp: number;

  /**
   * Hearts — the Duolingo loss-aversion mechanic. Beyond §5 entirely; §5's
   * gamification block is xp/streak only.
   *
   * ## How it is stored, and why there is no timer
   *
   * `hearts` is the count at `heartsUpdatedAt`, **not** the count now. Regenerated
   * hearts are computed on read from the elapsed time — exactly the pattern
   * `todayXp` already uses, and for the same reason: nothing rewrites the row
   * while the user is away, so a stored "current" value is stale the moment it is
   * written. A cron job that topped everyone up would be a second source of truth
   * for the same number.
   *
   * ## The tension worth knowing about
   *
   * In Duolingo, running out of hearts is a sales funnel — you buy a refill.
   * Phase 0 excludes in-app purchases, so here it is pure friction with no
   * escape hatch except waiting or spending gems. That is why the regen interval
   * is an env var (`HEARTS_REGEN_MINUTES`) rather than a constant: the right
   * value for a solo learner who wants to grind is very different from the one
   * that maximises revenue, and this app has no revenue to maximise.
   */
  @Prop({ required: true, default: MAX_HEARTS, min: 0 })
  hearts: number;

  /** When `hearts` was last written. Regeneration is measured from here. */
  @Prop({ type: Date, default: null })
  heartsUpdatedAt: Date | null;

  /**
   * Gems — earned by finishing lessons, spent refilling hearts.
   *
   * The pair is deliberate: a currency with no sink is a scoreboard, and hearts
   * with no refill are a wall. Together they are a loop that needs no purchase,
   * which is the only kind this app can have.
   */
  @Prop({ required: true, default: 0, min: 0 })
  gems: number;
}
export const GamificationSchema = SchemaFactory.createForClass(Gamification);

@Schema({ _id: false })
export class Settings {
  @Prop({ required: true, default: 1.0, min: 0.5, max: 2.0 })
  audioSpeed: number;

  /**
   * 'system' means "follow the OS", which is what the client did unconditionally
   * before this was settable. Adding an enum value is backward compatible —
   * existing documents hold 'light' or 'dark' and stay valid.
   */
  /**
   * Defaults to 'system' rather than 'light'. Before the client honoured this
   * field it followed the OS unconditionally, so a 'light' default would have
   * turned respecting the setting into a regression: every dark-mode phone
   * would have snapped to light on upgrade. Rows written before 2026-07-19 hold
   * an explicit 'light' and are unaffected — they have to be changed in
   * Settings once.
   */
  @Prop({ type: String, required: true, enum: THEMES, default: 'system' })
  theme: Theme;

  @Prop({ required: true, default: 'Asia/Kolkata' })
  tz: string;
}
export const SettingsSchema = SchemaFactory.createForClass(Settings);

@Schema({ collection: 'users', timestamps: { createdAt: true, updatedAt: true } })
export class User {
  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  /**
   * `select: false` means every query omits this unless it explicitly opts in.
   * The serializer is the second line of defence; this is the first.
   */
  @Prop({ required: true, select: false })
  passwordHash: string;

  @Prop({ type: ProfileSchema, required: true })
  profile: Profile;

  @Prop({ type: GamificationSchema, required: true, default: () => ({}) })
  gamification: Gamification;

  @Prop({ type: SettingsSchema, required: true, default: () => ({}) })
  settings: Settings;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);

// The lookup behind every login. Unique enforces one account per address.
UserSchema.index({ email: 1 }, { unique: true });
