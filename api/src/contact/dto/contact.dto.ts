import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Public support request. `website` is a honeypot hidden from real visitors. */
export class ContactDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;

  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(10)
  @MaxLength(4_000)
  message: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
