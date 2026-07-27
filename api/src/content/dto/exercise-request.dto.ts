import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

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

/**
 * Discriminated by the exercise type the client is answering:
 *
 *   - `multipleChoice` — the learner picks one of four options. The body is
 *     `{ optionId: 'opt-N' }`.
 *   - `wordReading` — the learner types the romaji. The body is `{ text: '...' }`.
 *
 * Validation is conditional: the field that matches the lesson's type is
 * required, the other is forbidden. The server knows the lesson's type when
 * it grades an answer, so the **service** is what enforces "exactly one of
 * these fields, and it matches the lesson's exercise type" — the DTO only
 * keeps the *body* shape valid.
 *
 * Practically: a learner on a multipleChoice lesson cannot accidentally
 * answer with `{ text: 'foo' }` (the service rejects it as a 400), and a
 * learner on a wordReading lesson cannot accidentally send `{ optionId: 'opt-0' }`
 * (same).
 */
export class AnswerExerciseDto {
  /**
   * `opt-N` for option N in the question. Required for multipleChoice lessons,
   * forbidden for wordReading lessons.
   */
  @ValidateIf((o: AnswerExerciseDto) => o.text === undefined)
  @IsString()
  @Matches(/^opt-\d{1,2}$/, { message: 'optionId must look like "opt-0"' })
  optionId?: string;

  /**
   * The learner's typed romaji. Required for wordReading lessons, forbidden
   * for multipleChoice lessons. Whitespace is collapsed and the case is
   * lowered inside the service, so the validator only enforces "non-empty".
   */
  @ValidateIf((o: AnswerExerciseDto) => o.optionId === undefined)
  @IsString()
  @Matches(/^.{1,40}$/, { message: 'text must be 1–40 characters' })
  text?: string;

  /** Time taken to answer in milliseconds (optional). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  responseTimeMs?: number;
}
