import { IsIn, IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';
import { CONTENT_REPORT_ISSUES, ContentReportIssue } from '../schemas/content-report.schema';

export class ReportMistakeDto {
  @IsString()
  @IsIn(['kana', 'vocab', 'grammar', 'kanji', 'lesson'])
  itemKind: string;

  @IsMongoId()
  itemId: string;

  @IsString()
  @IsIn(CONTENT_REPORT_ISSUES)
  issueType: ContentReportIssue;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}
