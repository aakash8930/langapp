import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserModule } from '../user/user.module';
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
  ],
  controllers: [SocialController],
  providers: [SocialService, LeagueService],
  exports: [SocialService, LeagueService],
})
export class SocialModule {}
