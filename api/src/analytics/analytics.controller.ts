import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { AuthenticatedUser, JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { Event, EventDocument } from './schemas/event.schema';

@Controller('me/history')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(
    @InjectModel(Event.name) private readonly eventModel: Model<EventDocument>,
  ) {}

  @Get()
  async history(
    @CurrentUser() current: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit ?? '20', 10) || 20));

    const query: Record<string, unknown> = { userId: new Types.ObjectId(current.userId) };
    if (type) query.type = type;

    const skip = (pageNum - 1) * limitNum;
    const [items, total] = await Promise.all([
      this.eventModel
        .find(query)
        .sort({ ts: -1 })
        .skip(skip)
        .limit(limitNum)
        .select('type payload ts')
        .exec(),
      this.eventModel.countDocuments(query).exec(),
    ]);

    return {
      items: items.map((e) => ({
        type: e.type,
        payload: e.payload,
        ts: e.ts,
      })),
      total,
      page: pageNum,
    };
  }
}
