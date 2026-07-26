import { IsIn, IsMongoId, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { MAX_MESSAGE_LENGTH } from '../schemas/direct-message.schema';
import { REPORT_REASONS, ReportReason } from '../schemas/report.schema';

export class SearchUsersDto {
  /**
   * Two characters minimum. A one-character prefix search over a user base is a
   * directory listing, not a search — the service enforces the same floor, this
   * just fails it earlier and with a clearer message.
   */
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  q: string;
}

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_MESSAGE_LENGTH)
  text: string;
}

export class ReportUserDto {
  @IsMongoId()
  userId: string;

  @IsIn(REPORT_REASONS)
  reason: ReportReason;

  /**
   * Optional free text. Capped, and the service truncates again — the cap is
   * about storage, and a report with a novel attached is not a better report.
   */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  /** The specific message being reported, if any. Snapshotted at file time. */
  @IsOptional()
  @IsMongoId()
  messageId?: string;
}

export class TargetUserDto {
  @IsMongoId()
  userId: string;
}
