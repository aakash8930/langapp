import { IsString, MaxLength, MinLength } from 'class-validator';

export class DeleteAccountDto {
  @IsString()
  password: string;
}

export class Disable2faDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}
