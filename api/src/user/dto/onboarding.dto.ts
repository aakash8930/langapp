import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class OnboardingDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  step?: number;

  @IsOptional()
  @IsString()
  nativeLanguage?: string;

  @IsOptional()
  @IsString()
  proficiencyLevel?: string;

  @IsOptional()
  @IsArray()
  learningGoals?: string[];

  @IsOptional()
  @IsString()
  learningStyle?: string;

  @IsOptional()
  @IsString()
  preferredStudyTime?: string;

  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(120)
  studyTimeMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(1000)
  dailyGoalXp?: number;

  @IsOptional()
  @IsBoolean()
  onboardingComplete?: boolean;
}
