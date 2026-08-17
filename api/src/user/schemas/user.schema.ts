import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/**
 * Declared here, with the storage that constrains it, so the schema enum, the
 * update DTO and the response DTO cannot drift apart.
 */
export const THEMES = ['light', 'dark', 'system'] as const;
export type Theme = (typeof THEMES)[number];

export const FONT_SIZES = ['small', 'medium', 'large'] as const;
export type FontSize = (typeof FONT_SIZES)[number];

/**
 * §5: embed what is read together and bounded. Profile, gamification and
 * settings are always read with the user, so they are sub-documents, not refs.
 * `_id: false` keeps them plain embedded objects.
 */
@Schema({ _id: false })
export class Profile {
  @Prop({ required: true, trim: true })
  displayName: string;

  @Prop({ type: String, default: '', maxlength: 500 })
  bio: string;

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
   * XP earned this **UTC** week, and which week that is.
   *
   * The same shape as `todayXp`/`lastStudyDate` — a counter plus the period it
   * belongs to, corrected on read — but on a *global* boundary rather than the
   * learner's local one. That difference is the point: `todayXp` answers "have I
   * studied today", which is a question about the learner's own day, while
   * weekly XP feeds a leaderboard that compares people to each other and
   * therefore needs one shared clock. See `gamification/week.ts`.
   *
   * Null week means "never earned any", which reads as 0.
   */
  @Prop({ required: true, default: 0, min: 0 })
  weeklyXp: number;

  /** ISO week identifier, e.g. '2026-W31'. */
  @Prop({ type: String, default: null })
  weeklyXpWeek: string | null;

  /**
   * Which league this learner competes in, as an index into `LEAGUE_TIERS`.
   *
   * Everyone starts in the lowest. Promotion and relegation are settled when a
   * week closes — see `LeagueService`.
   */
  @Prop({ required: true, default: 0, min: 0 })
  leagueTier: number;

  // Hearts and gems were removed in Phase 2 Stage 0 (§3.1). The "where a
  // learner errs" signal they collected is being rebuilt inside
  // `LearnerItemState`; that migration is Stage 1, and until it lands, an
  // exercise attempt record is the only signal that survives.
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

  /**
   * Off by default. The weekly leaderboard is opt-in since Phase 2 §3.2 — a
   * learner who does not want a competitive surface does not have to see one.
   * Reads of `/social/leaderboard` filter opted-out learners out of the table
   * entirely, and a viewer who is themselves opted out is excluded from their
   * own tier's rows rather than shown a table with their name missing.
   */
  @Prop({ required: true, default: false })
  leaderboardOptIn: boolean;

  @Prop({ type: String, required: true, enum: FONT_SIZES, default: 'medium' })
  fontSize: FontSize;
}
export const SettingsSchema = SchemaFactory.createForClass(Settings);

/**
 * Phase 0 — Data foundation: the aggregate character-mastery state that
 * gates what content the user is allowed to see. Deliberately separate from
 * `LearnerItemState` — the two answer different questions:
 *
 *  - `LearnerItemState` is per-item exercise evidence used by adaptive practice.
 *  - `knownKana` is the *set* of characters the user has been *taught*; it
 *    answers "what characters may appear on the learner's screen right now",
 *    which is what the constrained content filter (Phase 1 #5) and the bare
 *    reading screen (Phase 0 #4) actually need.
 *
 * The split matters because per-item evidence changes on exercise answers while
 * `knownKana` changes only on lesson completion. Conflating them would either
 * force a join on every vocabulary read or duplicate the completion signal. Embedding a tiny `learningState` follows the §5 rule
 * ("read together, bounded") and keeps `/me` as the single round trip.
 *
 * `knownKana` is the union across every completed lesson's `Lesson.itemRefs`
 * of kind `'kana'`. Computed on `recordCompletion`; never read from raw
 * scheduler state. Written server-side, never accepted from the client.
 */
@Schema({ _id: false })
export class LearningState {
  /**
   * Unique kana characters the learner has been taught. Updated on lesson
   * completion by `LearningService.completeLesson`. Empty array means
   * "no kana yet" — the bare reading screen treats that as "nothing
   * readable" and surfaces an explainer rather than a broken empty list.
   */
  @Prop({ type: [String], default: [] })
  knownKana: string[];
}
export const LearningStateSchema = SchemaFactory.createForClass(LearningState);

@Schema({ _id: false })
export class OnboardingState {
  @Prop({ type: Boolean, default: false })
  onboardingComplete: boolean;

  @Prop({ required: true, default: 0 })
  onboardingStep: number;

  @Prop({ type: String, default: 'ja' })
  targetLanguage: string;

  @Prop({ type: String, default: '' })
  proficiencyLevel: string;

  @Prop({ type: [String], default: [] })
  learningGoals: string[];

  @Prop({ type: String, default: '' })
  learningStyle: string;

  @Prop({ type: String, default: '' })
  preferredStudyTime: string;

  @Prop({ type: Boolean, default: false })
  notificationsEnabled: boolean;

  @Prop({ type: Number, default: 15, min: 5, max: 120 })
  studyTimeMinutes: number;

  @Prop({ type: Boolean, default: false })
  placementTestCompleted: boolean;

  @Prop({ type: Number, default: null })
  placementTestScore: number | null;

  @Prop({ type: String, default: '' })
  placementTestLevel: string;
}
export const OnboardingStateSchema = SchemaFactory.createForClass(OnboardingState);

@Schema({ _id: false })
export class NotificationSettings {
  // Reminders are opt-in during onboarding. A new account must not receive
  // scheduled nudges before the learner has made that choice.
  @Prop({ type: Boolean, default: false })
  studyReminders: boolean;

  @Prop({ type: Boolean, default: true })
  achievements: boolean;

  @Prop({ type: Boolean, default: true })
  community: boolean;

  @Prop({ type: Boolean, default: true })
  eventsUpdates: boolean;

  @Prop({ type: Boolean, default: false })
  marketing: boolean;

  @Prop({ type: Boolean, default: false })
  emailDailyGoal: boolean;

  @Prop({ type: Boolean, default: false })
  emailWeeklyDigest: boolean;

  @Prop({ type: Boolean, default: false })
  emailMarketing: boolean;
}
export const NotificationSettingsSchema = SchemaFactory.createForClass(NotificationSettings);

@Schema({ _id: false })
export class Subscription {
  @Prop({ type: String, enum: ['free', 'pro', 'enterprise'], default: 'free' })
  plan: 'free' | 'pro' | 'enterprise';

  @Prop({ type: String, enum: ['active', 'canceled', 'past_due', 'trialing'], default: 'active' })
  status: 'active' | 'canceled' | 'past_due' | 'trialing';

  @Prop({ type: Date, default: null })
  currentPeriodEnd: Date | null;

  @Prop({ type: Boolean, default: false })
  cancelAtPeriodEnd: boolean;

  @Prop({ type: String, default: null })
  gatewaySubscriptionId: string | null;

  @Prop({ type: String, default: null })
  gatewayCustomerId: string | null;
}
export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);

@Schema({ _id: false })
export class LegalConsent {
  @Prop({ type: Date, required: true })
  acceptedAt: Date;

  @Prop({ type: String, required: true })
  termsVersion: string;

  @Prop({ type: String, required: true })
  privacyVersion: string;
}
export const LegalConsentSchema = SchemaFactory.createForClass(LegalConsent);

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

  @Prop({ type: LearningStateSchema, required: true, default: () => ({}) })
  learningState: LearningState;

  @Prop({ type: OnboardingStateSchema, required: true, default: () => ({}) })
  onboardingState: OnboardingState;

  @Prop({ type: NotificationSettingsSchema, required: true, default: () => ({}) })
  notificationSettings: NotificationSettings;

  @Prop({ type: SubscriptionSchema, required: true, default: () => ({}) })
  subscription: Subscription;

  /** Registration evidence; excluded from ordinary user reads and responses. */
  @Prop({ type: LegalConsentSchema, required: false, select: false })
  legalConsent?: LegalConsent;

  @Prop({ type: Boolean, required: true, default: false })
  isAdmin: boolean;

  /** Storage key for the user's avatar image. Null means no avatar. */
  @Prop({ type: String, default: null })
  avatarUrl: string | null;

  @Prop({ type: String, default: null, select: false })
  totpSecret: string | null;

  @Prop({ type: Boolean, default: false })
  totpEnabled: boolean;

  @Prop({ type: Boolean, default: false })
  emailVerified: boolean;

  @Prop({ type: String, default: null, select: false })
  emailVerificationToken: string | null;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);

// The lookup behind every login. Unique enforces one account per address.
UserSchema.index({ email: 1 }, { unique: true });
