import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Min, ValidateIf } from 'class-validator';

/**
 * The checkpoint answer body — the same discriminated union
 * `AnswerExerciseDto` uses, and deliberately so: a client that can render a
 * lesson question can answer a checkpoint question with the same call shape.
 *
 * `@ValidateIf` rather than two DTOs because a union body cannot be expressed
 * to `class-validator` directly: each field is required only when the other is
 * absent, so sending neither fails both and sending both fails neither. The
 * service is what decides which one the *question* wanted, and rejects the
 * mismatch — the validator only enforces "exactly one shape arrived".
 */
export class AnswerCheckpointDto {
  /** `opt-N`. Required for multipleChoice questions, forbidden for wordReading. */
  @ValidateIf((o: AnswerCheckpointDto) => o.text === undefined)
  @IsString()
  @Matches(/^opt-\d{1,2}$/, { message: 'optionId must look like "opt-0"' })
  optionId?: string;

  /** The typed romaji. Required for wordReading questions, forbidden otherwise. */
  @ValidateIf((o: AnswerCheckpointDto) => o.optionId === undefined)
  @IsString()
  @Matches(/^.{1,40}$/, { message: 'text must be 1–40 characters' })
  text?: string;

  /**
   * How long the learner took, in milliseconds.
   *
   * Optional on the wire, but a checkpoint is the surface most likely to send
   * it: it is a timed test, and the speed term is a quarter of the learner
   * model's confidence calculation.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  responseTimeMs?: number;
}
