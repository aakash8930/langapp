import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { PRACTICE_MODES, PRACTICE_SKILLS, PracticeMode, PracticeSkill } from '../schemas/practice-session.schema';

export class CreatePracticeSessionDto {
  @IsEnum(PRACTICE_MODES)
  mode: PracticeMode;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(40)
  questionCount?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(PRACTICE_SKILLS.length)
  @IsEnum(PRACTICE_SKILLS, { each: true })
  skills?: PracticeSkill[];

  /** The current Japanese catalog contains Foundation and N5 material. */
  @IsOptional()
  @IsIn(['all', 'foundation', 'N5'])
  level?: 'all' | 'foundation' | 'N5';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([3, 5, 10, 15])
  timeLimitMinutes?: number;
}

export class AnswerPracticeQuestionDto {
  @ValidateIf((o: AnswerPracticeQuestionDto) => o.text === undefined)
  @IsString()
  @Matches(/^opt-\d{1,2}$/, { message: 'optionId must look like "opt-0"' })
  optionId?: string;

  @ValidateIf((o: AnswerPracticeQuestionDto) => o.optionId === undefined)
  @IsString()
  @Matches(/^.{1,80}$/, { message: 'text must be 1–80 characters' })
  text?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(30 * 60_000)
  responseTimeMs: number;
}
