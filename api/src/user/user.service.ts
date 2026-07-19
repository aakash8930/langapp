import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { localDateString, nextStreak } from './gamification/streak';
import { User, UserDocument } from './schemas/user.schema';

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  displayName: string;
  nativeLanguage?: string;
  tz?: string;
}

/**
 * Owns the `users` collection. No other module may touch it — cross-module
 * access comes through this class only.
 */
@Injectable()
export class UserService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

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

    if (!outcome.isNewDay) {
      // Same local day: pure accumulation, no streak or rollover concerns.
      return this.incrementXp(id, amount, { resetToday: false });
    }

    // A new local day. Guard on lastStudyDate still holding the value we read,
    // so two concurrent first-actions-of-the-day can't both roll the streak.
    const rolled = await this.userModel
      .findOneAndUpdate(
        { _id: id, 'gamification.lastStudyDate': previousStudyDate },
        {
          $inc: { 'gamification.xp': amount },
          $set: {
            'gamification.streakDays': outcome.streakDays,
            'gamification.lastStudyDate': today,
            // The day rolled over, so today's counter starts from this award.
            'gamification.todayXp': amount,
          },
        },
        { new: true },
      )
      .exec();

    if (rolled) {
      return rolled;
    }

    // Lost the race: another request already rolled the day. The streak and
    // date are correct as they stand, so only this award still needs applying.
    return this.incrementXp(id, amount, { resetToday: false });
  }

  private async incrementXp(
    id: string,
    amount: number,
    opts: { resetToday: boolean },
  ): Promise<UserDocument> {
    // `$inc` so concurrent awards accumulate instead of overwriting each other;
    // a read-modify-write here would silently lose XP.
    const update = opts.resetToday
      ? { $inc: { 'gamification.xp': amount }, $set: { 'gamification.todayXp': amount } }
      : { $inc: { 'gamification.xp': amount, 'gamification.todayXp': amount } };

    const user = await this.userModel.findByIdAndUpdate(id, update, { new: true }).exec();

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

  async updateSettings(id: string, dto: UpdateSettingsDto): Promise<UserDocument> {
    if (dto.tz !== undefined && !isValidTimeZone(dto.tz)) {
      throw new BadRequestException(`Unknown time zone: ${dto.tz}`);
    }

    // Dotted paths so a partial update never clobbers the sibling settings.
    const patch: Record<string, unknown> = {};
    if (dto.audioSpeed !== undefined) patch['settings.audioSpeed'] = dto.audioSpeed;
    if (dto.theme !== undefined) patch['settings.theme'] = dto.theme;
    if (dto.tz !== undefined) patch['settings.tz'] = dto.tz;

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
