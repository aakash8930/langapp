import { IsOptional, IsString, MaxLength } from 'class-validator';

export class FindLessonsDto {
  /** Omitted means "every unit", which is fine at Phase 0 content volume. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  unit?: string;
}
