import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/jwt-auth.guard';
import { AdminGuard } from '../admin.guard';
import { AuditService } from '../audit.service';
import { Coupon, CouponDocument } from '../schemas/coupon.schema';
import { AppSetting, AppSettingDocument } from '../schemas/app-setting.schema';
import { Role, RoleDocument } from '../schemas/role.schema';
import { User, UserDocument } from '../../user/schemas/user.schema';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminSettingsController {
  constructor(
    private readonly audit: AuditService,
    @InjectModel(Coupon.name) private readonly couponModel: Model<CouponDocument>,
    @InjectModel(AppSetting.name) private readonly settingModel: Model<AppSettingDocument>,
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  // ---- Coupons ----
  @Get('coupons')
  async listCoupons() {
    const items = await this.couponModel.find().sort({ createdAt: -1 }).exec();
    return { items, total: items.length };
  }

  @Post('coupons')
  async createCoupon(@CurrentUser() admin: AuthenticatedUser, @Body() body: any) {
    const coupon = await this.couponModel.create(body);
    await this.audit.log({
      adminId: admin.userId, email: admin.email,
      action: 'coupon.create', resource: 'coupon',
      resourceId: coupon.code,
    });
    return coupon;
  }

  @Delete('coupons/:id')
  async deleteCoupon(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string) {
    await this.couponModel.findByIdAndDelete(id).exec();
    await this.audit.log({
      adminId: admin.userId, email: admin.email,
      action: 'coupon.delete', resource: 'coupon', resourceId: id,
    });
    return { deleted: true };
  }

  // ---- System Settings ----
  @Get('settings')
  async getSettings() {
    const items = await this.settingModel.find().exec();
    const result: Record<string, unknown> = {};
    for (const item of items) result[item.key] = item.value;
    return result;
  }

  @Post('settings')
  async updateSettings(@CurrentUser() admin: AuthenticatedUser, @Body() body: Record<string, unknown>) {
    for (const [key, value] of Object.entries(body)) {
      await this.settingModel.updateOne(
        { key },
        { $set: { key, value } },
        { upsert: true },
      ).exec();
    }
    await this.audit.log({
      adminId: admin.userId, email: admin.email,
      action: 'settings.update', resource: 'system_settings',
    });
    return { updated: true };
  }

  // ---- Roles ----
  @Get('roles')
  async listRoles() {
    const items = await this.roleModel.find().exec();
    return { items, total: items.length };
  }

  @Post('roles')
  async createRole(@CurrentUser() admin: AuthenticatedUser, @Body() body: any) {
    const role = await this.roleModel.create(body);
    await this.audit.log({
      adminId: admin.userId, email: admin.email,
      action: 'role.create', resource: 'role', resourceId: role._id.toString(),
    });
    return role;
  }

  @Patch('roles/:id')
  async updateRole(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string, @Body() body: any) {
    const role = await this.roleModel.findByIdAndUpdate(id, { $set: body }, { new: true }).exec();
    await this.audit.log({
      adminId: admin.userId, email: admin.email,
      action: 'role.update', resource: 'role', resourceId: id,
    });
    return role;
  }

  @Delete('roles/:id')
  async deleteRole(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string) {
    await this.roleModel.findByIdAndDelete(id).exec();
    await this.audit.log({
      adminId: admin.userId, email: admin.email,
      action: 'role.delete', resource: 'role', resourceId: id,
    });
    return { deleted: true };
  }

  // ---- Audit Logs ----
  @Get('audit-logs')
  async auditLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('action') action?: string,
  ) {
    return this.audit.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
      action,
    });
  }

  // ---- Analytics ----
  @Get('analytics')
  async analytics() {
    const totalUsers = await this.userModel.countDocuments().exec();
    const proUsers = await this.userModel.countDocuments({ 'subscription.plan': 'pro' }).exec();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return {
      totalUsers,
      proUsers,
      freeUsers: totalUsers - proUsers,
    };
  }
}
