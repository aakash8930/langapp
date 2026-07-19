import { IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(2.0)
  audioSpeed?: number;

  @IsOptional()
  @IsIn(['light', 'dark'])
  theme?: 'light' | 'dark';

  /** IANA zone name, e.g. 'Asia/Kolkata'. Validated against the runtime's tz db. */
  @IsOptional()
  @IsString()
  tz?: string;
}
