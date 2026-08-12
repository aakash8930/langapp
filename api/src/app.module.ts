import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { AiOrchestratorModule } from './ai-orchestrator/ai-orchestrator.module';
import { AdminModule } from './admin/admin.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { ChatModule } from './chat/chat.module';
import { ContentModule } from './content/content.module';
import { JobsModule } from './jobs/jobs.module';
import { LearningModule } from './learning/learning.module';
import { KnowledgeGraphModule } from './knowledge-graph/knowledge-graph.module';
import { MailModule } from './mail/mail.module';
import { NotificationModule } from './notification/notification.module';
import { StorageModule } from './common/storage/storage.module';
import { RedisThrottlerStorage } from './common/throttler/redis-throttler.storage';
import { ThrottlerStorageModule } from './common/throttler/throttler-storage.module';
import { validateEnv } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { RedisModule } from './redis/redis.module';
import { AccountDeletionModule } from './user/account-deletion.module';
import { LegalModule } from './legal/legal.module';
import { SocialModule } from './social/social.module';
import { UserModule } from './user/user.module';
import { PracticeModule } from './practice/practice.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validateEnv,
      cache: true,
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGO_URI'),
        // Keep this short so a dead Mongo surfaces on /health instead of hanging.
        serverSelectionTimeoutMS: 3000,
      }),
    }),
    RedisModule,
    JobsModule,
    StorageModule,
    // Global so the guard in common/ can verify tokens without importing
    // AuthModule — which imports UserModule, which would close the cycle.
    // Secrets are passed per-call, since access and refresh use different ones.
    JwtModule.register({ global: true }),
    ThrottlerModule.forRootAsync({
      imports: [ThrottlerStorageModule],
      inject: [ConfigService, RedisThrottlerStorage],
      useFactory: (config: ConfigService, storage: RedisThrottlerStorage) => ({
        // Named throttlers: ThrottlerGuard applies every entry to a guarded
        // route, so each controller @SkipThrottle()s the one that isn't its —
        // auth skips 'chat', chat skips 'auth'. ttl is milliseconds; the env
        // vars are in seconds for readability.
        throttlers: [
          {
            name: 'auth',
            ttl: config.getOrThrow<number>('AUTH_THROTTLE_TTL_SECONDS') * 1000,
            limit: config.getOrThrow<number>('AUTH_THROTTLE_LIMIT'),
          },
          {
            // §10: chat is rate limited as a cost guard — it's the only
            // surface that spends LLM quota per request.
            name: 'chat',
            ttl: config.getOrThrow<number>('CHAT_THROTTLE_TTL_SECONDS') * 1000,
            limit: config.getOrThrow<number>('CHAT_THROTTLE_LIMIT'),
          },
        ],
        storage,
      }),
    }),
    HealthModule,
    UserModule,
    AuthModule,
    BillingModule,
    NotificationModule,
    MailModule,
    ContentModule,
    KnowledgeGraphModule,
    LearningModule,
    AnalyticsModule,
    AiOrchestratorModule,
    AdminModule,
    ChatModule,
    SocialModule,
    PracticeModule,
    // Account deletion — must come after all owning modules it depends on.
    AccountDeletionModule,
    LegalModule,
  ],
})
export class AppModule {}
