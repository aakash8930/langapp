import { Module } from '@nestjs/common';
import { RedisThrottlerStorage } from './redis-throttler.storage';

/**
 * Exists so ThrottlerModule.forRootAsync has something to import — its
 * `inject` list resolves inside its own module context, not AppModule's.
 * RedisService comes from the global RedisModule.
 */
@Module({
  providers: [RedisThrottlerStorage],
  exports: [RedisThrottlerStorage],
})
export class ThrottlerStorageModule {}
