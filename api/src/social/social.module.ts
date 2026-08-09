import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationModule } from '../notification/notification.module';
import { UserModule } from '../user/user.module';
import { LeagueSettleProcessor } from './league-settle.processor';
import { LeagueSettleScheduler } from './league-settle.scheduler';
import { Block, BlockSchema } from './schemas/block.schema';
import { DirectMessage, DirectMessageSchema } from './schemas/direct-message.schema';
import { Friendship, FriendshipSchema } from './schemas/friendship.schema';
import { LeagueStanding, LeagueStandingSchema } from './schemas/league-standing.schema';
import { Report, ReportSchema } from './schemas/report.schema';
import { SocialController } from './social.controller';
import { LeagueService } from './league.service';
import { SocialService } from './social.service';

/**
 * Owns `friendships`, `directMessages`, `blocks` and `reports`.
 *
 * Reads users through `UserService` only — never the `users` collection — which
 * is why `toPublicProfile` lives on that service rather than here. One-way edge:
 * `user` knows nothing about `social`, so no forwardRef.
 *
 * `LeagueSettleProcessor` and `LeagueSettleScheduler` live here (ADR-006): the
 * worker that settles `leagueStandings` belongs to the module owning that
 * collection, and the schedule that triggers it belongs next to the worker.
 * Queue registration itself is central, in `JobsModule`.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Friendship.name, schema: FriendshipSchema },
      { name: DirectMessage.name, schema: DirectMessageSchema },
      { name: Block.name, schema: BlockSchema },
      { name: Report.name, schema: ReportSchema },
      { name: LeagueStanding.name, schema: LeagueStandingSchema },
    ]),
    UserModule,
    NotificationModule,
  ],
  controllers: [SocialController],
  providers: [SocialService, LeagueService, LeagueSettleProcessor, LeagueSettleScheduler],
  exports: [SocialService, LeagueService],
})
export class SocialModule {}
