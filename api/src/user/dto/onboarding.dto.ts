import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

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
  @IsIn(['beginner', 'n5', 'n4', 'n3', 'n2', 'n1'])
  proficiencyLevel?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1)
  @IsIn(['conversation', 'reading', 'travel', 'jlpt', 'work'], { each: true })
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
