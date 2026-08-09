import { Controller, Get, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AdminGuard } from '../admin.guard';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { User, UserDocument } from '../../user/schemas/user.schema';
import { Event, EventDocument } from '../../analytics/schemas/event.schema';
import {
  ContentReport,
  ContentReportDocument,
} from '../../content/schemas/content-report.schema';
import { Report, ReportDocument } from '../../social/schemas/report.schema';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminDashboardController {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Event.name) private readonly eventModel: Model<EventDocument>,
    @InjectModel(ContentReport.name) private readonly contentReportModel: Model<ContentReportDocument>,
    @InjectModel(Report.name) private readonly userReportModel: Model<ReportDocument>,
  ) {}

  @Get('stats')
  async stats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalUsers, activeToday, contentReports, userReports] = await Promise.all([
      this.userModel.countDocuments().exec(),
      this.eventModel.distinct('userId', { ts: { $gte: today } }).exec(),
      this.contentReportModel.countDocuments({ status: 'open' }).exec(),
      this.userReportModel.countDocuments().exec(),
    ]);

    return {
      totalUsers,
      activeToday: activeToday.length,
      pendingContentReports: contentReports,
      pendingUserReports: userReports,
    };
  }
}
