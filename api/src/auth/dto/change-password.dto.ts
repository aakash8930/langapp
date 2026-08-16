import { IsString, MaxLength, MinLength } from 'class-validator';
import { NEW_PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from '../password-policy';

export class ChangePasswordDto {
  @IsString()
  @MinLength(8)
  currentPassword: string;

  @IsString()
  @MinLength(NEW_PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  newPassword: string;
}
