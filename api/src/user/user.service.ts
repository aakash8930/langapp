import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import {
  DEFAULT_HEARTS_REGEN_MINUTES,
  GEM_COST_HEART_REFILL,
  heartsNow,
  nextHeartAt,
  spendHeart,
} from './gamification/hearts';
import { levelFromXp } from './gamification/level';
import { localDateString, nextStreak } from './gamification/streak';
import { isoWeek } from './gamification/week';
import { MAX_HEARTS, User, UserDocument } from './schemas/user.schema';

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  displayName: string;
  dateOfBirth?: Date;
  nativeLanguage?: string;
  tz?: string;
}

/**
 * Owns the `users` collection. No other module may touch it — cross-module
 * access comes through this class only.
 */
@Injectable()
export class UserService {
  private readonly heartsRegenMinutes: number;

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    config: ConfigService,
  ) {
    this.heartsRegenMinutes =
      config.get<number>('HEARTS_REGEN_MINUTES') ?? DEFAULT_HEARTS_REGEN_MINUTES;
  }

  /**
   * Hearts and gems as they should be read — hearts regenerated from elapsed
   * time, the same shape `todayXpFor` has for XP.
   */
  heartsFor(user: UserDocument, now: Date = new Date()) {
    const state = {
      hearts: user.gamification.hearts,
      heartsUpdatedAt: user.gamification.heartsUpdatedAt,
    };

    return {
      hearts: heartsNow(state, this.heartsRegenMinutes, now),
      maxHearts: MAX_HEARTS,
      nextHeartAt: nextHeartAt(state, this.heartsRegenMinutes, now),
      gems: user.gamification.gems,
    };
  }

  /**
   * Take a heart for a wrong answer, and report what is left.
   *
   * Writes the regenerated count rather than the stored one, so time that passed
   * while the learner was away is banked before the deduction — see
   * `spendHeart`. Returns the new count so the answer response can carry it
   * without a second read.
   */
  async loseHeart(id: string, now: Date = new Date()): Promise<{ hearts: number }> {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const next = spendHeart(
      { hearts: user.gamification.hearts, heartsUpdatedAt: user.gamification.heartsUpdatedAt },
      this.heartsRegenMinutes,
      now,
    );

    await this.userModel
      .updateOne(
        { _id: user._id },
        {
          $set: {
            'gamification.hearts': next.hearts,
            'gamification.heartsUpdatedAt': next.heartsUpdatedAt,
          },
        },
      )
      .exec();

    return { hearts: next.hearts };
  }

  /** Gems for finishing a lesson. Never negative — callers pass the award, not a delta. */
  async awardGems(id: string, amount: number): Promise<void> {
    if (amount <= 0) {
      return;
    }
    await this.userModel
      .updateOne({ _id: id }, { $inc: { 'gamification.gems': amount } })
      .exec();
  }

  /**
   * Spend gems to refill hearts to full.
   *
   * The only sink for gems and the only escape from an empty heart bar, which is
   * what makes the pair a loop rather than two separate counters. Phase 0 has no
   * in-app purchases, so this is deliberately the *whole* economy.
   *
   * Conditional on both the gem balance and on not already being full, in a single
   * `updateOne` — two taps racing must not both deduct. A 409 on either, because
   * both are "your state doesn't allow this" rather than a bad request.
   */
  async refillHearts(id: string, now: Date = new Date()): Promise<{ hearts: number; gems: number }> {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const current = this.heartsFor(user, now);
    if (current.hearts >= MAX_HEARTS) {
      throw new ConflictException('Your hearts are already full');
    }
    if (current.gems < GEM_COST_HEART_REFILL) {
      throw new ConflictException(
        `Refilling costs ${GEM_COST_HEART_REFILL} gems — you have ${current.gems}`,
      );
    }

    // The gem check is repeated in the filter so a concurrent refill cannot
    // overdraw: whichever write lands second matches nothing.
    const result = await this.userModel
      .updateOne(
        { _id: user._id, 'gamification.gems': { $gte: GEM_COST_HEART_REFILL } },
        {
          $inc: { 'gamification.gems': -GEM_COST_HEART_REFILL },
          $set: { 'gamification.hearts': MAX_HEARTS, 'gamification.heartsUpdatedAt': null },
        },
      )
      .exec();

    if (result.modifiedCount === 0) {
      throw new ConflictException('Not enough gems to refill');
    }

    return { hearts: MAX_HEARTS, gems: current.gems - GEM_COST_HEART_REFILL };
  }

  /** Returns null when the email is already taken, so callers decide the error shape. */
  async create(input: CreateUserInput): Promise<UserDocument | null> {
    try {
      return await this.userModel.create({
        email: input.email,
        passwordHash: input.passwordHash,
        profile: {
          displayName: input.displayName,
          nativeLanguage: input.nativeLanguage ?? 'en',
          activeTrack: 'ja',
          // Null for accounts created before the age gate existed. Absent means
          // "unknown age", which every age check treats as a refusal.
          dateOfBirth: input.dateOfBirth ?? null,
        },
        settings: input.tz ? { tz: input.tz } : {},
      });
    } catch (err) {
      // 11000 = duplicate key on the unique email index. Racing registrations
      // land here even when the pre-check passed, so it must be handled.
      if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
        return null;
      }
      throw err;
    }
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  /**
   * Everyone competing in one league tier.
   *
   * Unpaginated on purpose at this scale — a tier holds tens of people, and the
   * leaderboard shows all of them. This is the read that will need sharding
   * first if the user base ever grows: Duolingo splits a tier into cohorts of
   * about 30, and that is the concept to add here rather than a `limit`.
   */
  async findByLeagueTier(tier: number): Promise<UserDocument[]> {
    // A schema default is applied on *write*, so every account created before
    // `leagueTier` existed has no such field and matches `{ leagueTier: 0 }`
    // nowhere. Without this the entire pre-league user base would be invisible
    // to the leaderboard forever — caught on the live API, where Bronze showed
    // one player out of 33.
    //
    // Treating absent as Bronze in the query rather than backfilling once keeps
    // it correct after a restore from an old backup too, which a migration would
    // not.
    const filter =
      tier === 0
        ? {
            $or: [
              { 'gamification.leagueTier': 0 },
              { 'gamification.leagueTier': { $exists: false } },
            ],
          }
        : { 'gamification.leagueTier': tier };

    return this.userModel.find(filter).exec();
  }

  /** Move a learner between tiers when a week settles. */
  async setLeagueTier(id: string, tier: number): Promise<void> {
    await this.userModel
      .updateOne({ _id: id }, { $set: { 'gamification.leagueTier': tier } })
      .exec();
  }

  /** Bulk lookup for the social module's friend and block lists. */
  async findManyByIds(ids: string[]): Promise<UserDocument[]> {
    const valid = ids.filter((id) => Types.ObjectId.isValid(id));
    if (valid.length === 0) {
      return [];
    }
    return this.userModel.find({ _id: { $in: valid.map((id) => new Types.ObjectId(id)) } }).exec();
  }

  /**
   * Find learners by display name, for the friend search.
   *
   * **Display name only, never email.** Searching by address would make this an
   * oracle for "does this email have an account" — precisely the enumeration
   * `login` burns a dummy argon2 verify to prevent.
   *
   * The query is escaped before it becomes a regex: an unescaped `.*` would
   * match every user, and a pathological pattern is a cheap CPU attack. Anchored
   * with `^` so it is a prefix search, which is both what someone typing a name
   * expects and index-friendly.
   */
  async searchByDisplayName(
    query: string,
    excludeIds: string[],
    limit: number,
  ): Promise<UserDocument[]> {
    const pattern = new RegExp(`^${escapeRegex(query)}`, 'i');
    const excluded = excludeIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    return this.userModel
      .find({ 'profile.displayName': pattern, _id: { $nin: excluded } })
      .limit(limit)
      .exec();
  }

  /**
   * The only shape another learner may see of a user.
   *
   * An allowlist for the same reason `toUserResponse` is one, but a much shorter
   * one: this is shown to *strangers*, so it carries no email, no settings, no
   * date of birth and no lesson history — a display name and the public-facing
   * numbers that make a leaderboard meaningful, and nothing else.
   */
  toPublicProfile(user: UserDocument): {
    id: string;
    displayName: string;
    level: number;
    xp: number;
    streakDays: number;
  } {
    return {
      id: user._id.toString(),
      displayName: user.profile.displayName,
      level: levelFromXp(user.gamification.xp).level,
      xp: user.gamification.xp,
      streakDays: user.gamification.streakDays,
    };
  }

  /**
   * The one path that loads the hash. Only the auth module calls it, and only
   * to verify a password — the document must never reach a response body.
   */
  async findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: email.toLowerCase() })
      .select('+passwordHash')
      .exec();
  }

  /**
   * The only way another module may change a user's XP — the learning module
   * calls this rather than reaching into `users` itself.
   *
   * This is also where the streak advances, because "the first XP-earning
   * action of a new day" is precisely this call. Keeping both here means a
   * future XP source (chat, a new exercise type) gets streak handling for free
   * instead of having to remember to ask for it.
   */
  async awardXp(id: string, amount: number, now: Date = new Date()): Promise<UserDocument> {
    if (!Number.isInteger(amount) || amount < 0) {
      throw new BadRequestException(`XP award must be a non-negative integer, got ${amount}`);
    }

    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const today = localDateString(now, user.settings.tz);
    const previousStudyDate = user.gamification.lastStudyDate;
    const outcome = nextStreak(user.gamification.streakDays, previousStudyDate, today);

    // The weekly counter rolls on a *different* boundary from the daily one —
    // UTC weeks against local days — so it is checked separately. A UTC week can
    // turn without the learner's local day turning, and vice versa.
    const week = isoWeek(now);
    const resetWeek = user.gamification.weeklyXpWeek !== week;

    if (!outcome.isNewDay) {
      // Same local day: pure accumulation, no streak concerns — but the week may
      // still have rolled underneath it.
      return this.incrementXp(id, amount, { resetToday: false, resetWeek, week });
    }

    // A new local day. Guard on lastStudyDate still holding the value we read,
    // so two concurrent first-actions-of-the-day can't both roll the streak.
    const rolled = await this.userModel
      .findOneAndUpdate(
        { _id: id, 'gamification.lastStudyDate': previousStudyDate },
        {
          // Built rather than spread: an `...(cond ? {$inc: …} : {})` after a
          // literal `$inc` *replaces* it, which silently dropped lifetime XP on
          // every day-roll. A test caught it; the shape below cannot do that.
          $inc: {
            'gamification.xp': amount,
            ...(resetWeek ? {} : { 'gamification.weeklyXp': amount }),
          },
          $set: {
            'gamification.streakDays': outcome.streakDays,
            'gamification.lastStudyDate': today,
            // The day rolled over, so today's counter starts from this award.
            'gamification.todayXp': amount,
            'gamification.weeklyXpWeek': week,
            ...(resetWeek ? { 'gamification.weeklyXp': amount } : {}),
          },
        },
        { new: true },
      )
      .exec();

    if (rolled) {
      return rolled;
    }

    // Lost the race: another request already rolled the day. The streak and
    // date are correct as they stand, so only this award still needs applying —
    // and the winner already rolled the week too, so this must not reset it.
    return this.incrementXp(id, amount, { resetToday: false, resetWeek: false, week });
  }

  private async incrementXp(
    id: string,
    amount: number,
    opts: { resetToday: boolean; resetWeek: boolean; week: string },
  ): Promise<UserDocument> {
    // `$inc` so concurrent awards accumulate instead of overwriting each other;
    // a read-modify-write here would silently lose XP. A counter whose period
    // just rolled is `$set` to this award instead — incrementing would carry
    // last period's total forward.
    const inc: Record<string, number> = { 'gamification.xp': amount };
    const set: Record<string, unknown> = { 'gamification.weeklyXpWeek': opts.week };

    if (opts.resetToday) set['gamification.todayXp'] = amount;
    else inc['gamification.todayXp'] = amount;

    if (opts.resetWeek) set['gamification.weeklyXp'] = amount;
    else inc['gamification.weeklyXp'] = amount;

    const user = await this.userModel
      .findByIdAndUpdate(id, { $inc: inc, $set: set }, { new: true })
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  /**
   * Today's XP as it should be *read*, which isn't always what's stored: if the
   * user hasn't earned anything yet today, the persisted counter still holds
   * yesterday's total. Nothing rewrites it until the next award, so the read
   * path has to notice the day has turned.
   */
  todayXpFor(user: UserDocument, now: Date = new Date()): number {
    const today = localDateString(now, user.settings.tz);
    return user.gamification.lastStudyDate === today ? user.gamification.todayXp : 0;
  }

  /**
   * This week's XP as it should be *read* — same correction as `todayXpFor`, on
   * the UTC week boundary instead of the learner's local day.
   *
   * Without it, the first leaderboard read after a Monday would rank everyone by
   * last week's totals, because nothing rewrites a user's row until their next
   * award. Reading `gamification.weeklyXp` directly is a bug.
   */
  weeklyXpFor(user: UserDocument, now: Date = new Date()): number {
    return user.gamification.weeklyXpWeek === isoWeek(now) ? user.gamification.weeklyXp : 0;
  }

  async updateSettings(id: string, dto: UpdateSettingsDto): Promise<UserDocument> {
    if (dto.tz !== undefined && !isValidTimeZone(dto.tz)) {
      throw new BadRequestException(`Unknown time zone: ${dto.tz}`);
    }

    // Dotted paths so a partial update never clobbers the sibling settings.
    const patch: Record<string, unknown> = {};
    if (dto.audioSpeed !== undefined) patch['settings.audioSpeed'] = dto.audioSpeed;
    if (dto.theme !== undefined) patch['settings.theme'] = dto.theme;
    if (dto.tz !== undefined) patch['settings.tz'] = dto.tz;
    // The one field on this DTO that does not live under `settings` — the daily
    // goal is what /me/progress measures the day against, so it sits with the
    // rest of the gamification state it is compared to.
    if (dto.dailyGoalXp !== undefined) patch['gamification.dailyGoalXp'] = dto.dailyGoalXp;

    const user = await this.userModel
      .findByIdAndUpdate(id, { $set: patch }, { new: true, runValidators: true })
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
}

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Escape a user-supplied string for use inside a RegExp.
 *
 * Without this, a search for `.*` matches every account and a nested quantifier
 * is a cheap way to burn CPU on the database. Both are reachable from an
 * unauthenticated-looking text box.
 */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
