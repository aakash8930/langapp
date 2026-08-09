import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { AuthenticatedUser, JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { NotificationService } from './notification.service';
import type { NotificationType } from './schemas/notification.schema';

@Controller('me/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async list(
    @CurrentUser() current: AuthenticatedUser,
    @Query('type') type?: string,
    @Query('read') read?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const filter: { type?: NotificationType; read?: boolean } = {};
    if (type) filter.type = type as NotificationType;
    if (read === 'true') filter.read = true;
    else if (read === 'false') filter.read = false;

    const pageNum = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit ?? '20', 10) || 20));

    const { items, total } = await this.notificationService.findAll(
      current.userId,
      filter,
      pageNum,
      limitNum,
    );

    return {
      items: items.map((n) => ({
        id: n._id.toString(),
        type: n.type,
        title: n.title,
        body: n.body,
        metadata: n.metadata,
        read: n.read,
        readAt: n.readAt,
        createdAt: (n as any).createdAt,
      })),
      total,
      page: pageNum,
      limit: limitNum,
    };
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() current: AuthenticatedUser) {
    const count = await this.notificationService.unreadCount(current.userId);
    return { count };
  }

  @Patch(':id/read')
  async markRead(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const updated = await this.notificationService.markRead(current.userId, id);
    if (!updated) {
      throw new NotFoundException('Notification not found');
    }
    return { success: true };
  }

  @Post('mark-all-read')
  async markAllRead(@CurrentUser() current: AuthenticatedUser) {
    const count = await this.notificationService.markAllRead(current.userId);
    return { marked: count };
  }
}
