import { IsDateString, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  /**
   * argon2 has no bcrypt-style 72-byte truncation, but an upper bound still
   * matters: hashing cost scales with input, so it's a cheap DoS guard.
   */
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  displayName: string;

  /**
   * ISO date, e.g. '2005-03-14'. **Required**, because the age gate cannot be
   * retrofitted: an account created without one can never be verified later
   * without asking, and asking after the fact is the step everyone skips.
   *
   * Registration is refused below `MIN_AGE_TO_REGISTER`. Accounts that predate
   * this field keep working — see the note on the schema.
   */
  @IsDateString()
  dateOfBirth: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  nativeLanguage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  tz?: string;
}
