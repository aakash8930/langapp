import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { AdminGuard } from '../admin.guard';
import { AuditService } from '../audit.service';
import { User, UserDocument } from '../../user/schemas/user.schema';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/jwt-auth.guard';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminUsersController {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly audit: AuditService,
  ) {}

  @Get('users')
  async list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit ?? '20', 10) || 20));

    const filter: Record<string, unknown> = {};
    if (search) {
      filter.$or = [
        { email: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        { 'profile.displayName': new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
      ];
    }

    const skip = (pageNum - 1) * limitNum;
    const [items, total] = await Promise.all([
      this.userModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).exec(),
      this.userModel.countDocuments(filter).exec(),
    ]);

    return {
      items: items.map((u) => ({
        id: u._id,
        email: u.email,
        displayName: u.profile.displayName,
        isAdmin: u.isAdmin,
        createdAt: u.get('createdAt'),
        plan: u.subscription?.plan ?? 'free',
        status: u.subscription?.status ?? 'active',
      })),
      total,
      page: pageNum,
    };
  }

  @Patch('users/:id')
  async updateUser(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { isAdmin?: boolean; suspended?: boolean },
  ) {
    if (body.isAdmin !== undefined && admin.userId === id) {
      throw new BadRequestException('Cannot change your own admin status');
    }

    const patch: Record<string, unknown> = {};
    if (body.isAdmin !== undefined) patch.isAdmin = body.isAdmin;
    if (body.suspended !== undefined) patch.suspended = body.suspended;

    const user = await this.userModel
      .findByIdAndUpdate(id, { $set: patch }, { new: true })
      .exec();

    if (!user) throw new NotFoundException('User not found');

    await this.audit.log({
      adminId: admin.userId,
      email: admin.email,
      action: 'user.update',
      resource: 'user',
      resourceId: id,
      details: body,
    });

    return {
      id: user._id,
      email: user.email,
      displayName: user.profile.displayName,
      isAdmin: user.isAdmin,
    };
  }
}
