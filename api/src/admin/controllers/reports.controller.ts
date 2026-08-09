import {
  Body, Controller, Get, Param, Patch, Query, UseGuards,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/jwt-auth.guard';
import { AdminGuard } from '../admin.guard';
import { AuditService } from '../audit.service';
import { ContentReport, ContentReportDocument } from '../../content/schemas/content-report.schema';
import { Report, ReportDocument } from '../../social/schemas/report.schema';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminReportsController {
  constructor(
    @InjectModel(ContentReport.name) private readonly contentReportModel: Model<ContentReportDocument>,
    @InjectModel(Report.name) private readonly userReportModel: Model<ReportDocument>,
    private readonly audit: AuditService,
  ) {}

  @Get('reports/content')
  async contentReports(@Query('status') status?: string) {
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    const items = await this.contentReportModel.find(filter).sort({ createdAt: -1 }).limit(50).exec();
    return { items, total: items.length };
  }

  @Patch('reports/content/:id')
  async resolveContentReport(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { status: string; note?: string },
  ) {
    await this.contentReportModel.findByIdAndUpdate(id, {
      $set: { status: body.status },
    }).exec();
    await this.audit.log({
      adminId: admin.userId, email: admin.email,
      action: 'report.resolve', resource: 'content_report',
      resourceId: id, details: body,
    });
    return { resolved: true };
  }

  @Get('reports/users')
  async userReports() {
    const items = await this.userReportModel.find().sort({ createdAt: -1 }).limit(50).exec();
    return { items, total: items.length };
  }

  @Patch('reports/users/:id')
  async resolveUserReport(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    await this.userReportModel.findByIdAndUpdate(id, {
      $set: { status: body.status },
    }).exec();
    await this.audit.log({
      adminId: admin.userId, email: admin.email,
      action: 'report.resolve', resource: 'user_report',
      resourceId: id,
    });
    return { resolved: true };
  }
}
