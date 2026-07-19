import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis;

  constructor(config: ConfigService) {
    const url = config.getOrThrow<string>('REDIS_URL');

    this.client = new Redis(url, {
      // Fail commands fast when Redis is down instead of queueing them forever —
      // this is what lets /health report "down" rather than hang.
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      retryStrategy: (times) => Math.min(times * 500, 5000),
    });

    // ioredis throws on unhandled 'error' events, so always keep a listener.
    this.client.on('error', (err: Error) => {
      this.logger.warn(`Redis error: ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit().catch(() => this.client.disconnect());
  }
}
