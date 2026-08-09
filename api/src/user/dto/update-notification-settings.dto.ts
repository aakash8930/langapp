import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationSettingsDto {
  @IsOptional()
  @IsBoolean()
  studyReminders?: boolean;

  @IsOptional()
  @IsBoolean()
  achievements?: boolean;

  @IsOptional()
  @IsBoolean()
  community?: boolean;

  @IsOptional()
  @IsBoolean()
  eventsUpdates?: boolean;

  @IsOptional()
  @IsBoolean()
  marketing?: boolean;

  @IsOptional()
  @IsBoolean()
  emailDailyGoal?: boolean;

  @IsOptional()
  @IsBoolean()
  emailWeeklyDigest?: boolean;

  @IsOptional()
  @IsBoolean()
  emailMarketing?: boolean;
}
