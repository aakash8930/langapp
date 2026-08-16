import {
  Equals,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { NEW_PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from '../password-policy';

export class RegisterDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  /**
   * argon2 has no bcrypt-style 72-byte truncation, but an upper bound still
   * matters: hashing cost scales with input, so it's a cheap DoS guard.
   */
  @IsString()
  @MinLength(NEW_PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
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

  /** Explicit evidence; the server stamps the canonical policy versions. */
  @IsBoolean()
  @Equals(true, { message: 'Terms of Service and Privacy Policy acknowledgement is required' })
  acceptedTerms: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  nativeLanguage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  tz?: string;
}
