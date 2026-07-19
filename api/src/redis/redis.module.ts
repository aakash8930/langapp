import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

/**
 * Global so any feature module can inject RedisService without re-importing.
 * Redis is infrastructure (cache, sessions, rate limits, queue), not a domain module.
 */
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
