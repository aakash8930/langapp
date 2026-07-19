import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class FindExercisesDto {
  /**
   * Bumping this is how a client asks for a fresh shuffle. Same attempt = same
   * questions, which is the whole point. Milestone 4 will own a real per-user
   * attempt counter; until then the client picks.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  attempt?: number;
}

export class AnswerExerciseDto {
  /** One of the option ids from the generated set, e.g. 'opt-2'. */
  @IsString()
  @Matches(/^opt-\d{1,2}$/, { message: 'optionId must look like "opt-0"' })
  optionId: string;
}
