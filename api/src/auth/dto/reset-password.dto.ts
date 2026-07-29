import { IsEmail, IsString, Length, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  /** Six digits, as issued by `/auth/forgot-password`. */
  @IsString()
  @Length(6, 6)
  code: string;

  // Same bounds as RegisterDto — a reset must not be a way around them.
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword: string;
}
