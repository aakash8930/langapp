import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { THEMES, Theme } from '../schemas/user.schema';

/**
 * Floor and ceiling on the daily goal. A review is worth 2 XP and a first
 * lesson completion 10, so 10 is about the smallest goal that isn't met by
 * accident and 1000 is far past what a Phase 0 day can produce — wide enough
 * not to argue with, narrow enough that a fat-fingered 50000 is rejected
 * rather than making the goal ring permanently unreachable.
 */
export const MIN_DAILY_GOAL_XP = 10;
export const MAX_DAILY_GOAL_XP = 1000;

export class UpdateSettingsDto {
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(2.0)
  audioSpeed?: number;

  @IsOptional()
  @IsIn(THEMES)
  theme?: Theme;

  /** IANA zone name, e.g. 'Asia/Kolkata'. Validated against the runtime's tz db. */
  @IsOptional()
  @IsString()
  tz?: string;

  /**
   * Lives on `gamification`, not `settings` — it is the target the daily
   * progress ring is measured against, and /me/progress reads it from there.
   * It is patched through this DTO anyway because "daily goal" is a setting to
   * everyone except the schema.
   */
  @IsOptional()
  @IsInt()
  @Min(MIN_DAILY_GOAL_XP)
  @Max(MAX_DAILY_GOAL_XP)
  dailyGoalXp?: number;
}
