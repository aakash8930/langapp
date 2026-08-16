import { IsEmail, IsString, Length, MaxLength, MinLength } from 'class-validator';
import { NEW_PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from '../password-policy';

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
  @MinLength(NEW_PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  newPassword: string;
}
