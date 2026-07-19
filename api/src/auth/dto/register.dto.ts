import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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

  @IsOptional()
  @IsString()
  @MaxLength(20)
  nativeLanguage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  tz?: string;
}
