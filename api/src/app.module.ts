import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { ContentModule } from './content/content.module';
import { LearningModule } from './learning/learning.module';
import { KnowledgeGraphModule } from './knowledge-graph/knowledge-graph.module';
import { RedisThrottlerStorage } from './common/throttler/redis-throttler.storage';
import { ThrottlerStorageModule } from './common/throttler/throttler-storage.module';
import { validateEnv } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { RedisModule } from './redis/redis.module';
import { UserModule } from './user/user.module';

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
    // Global so the guard in common/ can verify tokens without importing
    // AuthModule — which imports UserModule, which would close the cycle.
    // Secrets are passed per-call, since access and refresh use different ones.
    JwtModule.register({ global: true }),
    ThrottlerModule.forRootAsync({
      imports: [ThrottlerStorageModule],
      inject: [ConfigService, RedisThrottlerStorage],
      useFactory: (config: ConfigService, storage: RedisThrottlerStorage) => ({
        throttlers: [
          {
            // ttl is milliseconds; the env var is in seconds for readability.
            ttl: config.getOrThrow<number>('AUTH_THROTTLE_TTL_SECONDS') * 1000,
            limit: config.getOrThrow<number>('AUTH_THROTTLE_LIMIT'),
          },
        ],
        storage,
      }),
    }),
    HealthModule,
    UserModule,
    AuthModule,
    ContentModule,
    KnowledgeGraphModule,
    LearningModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
