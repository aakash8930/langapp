import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

/**
 * §10: refresh tokens are revocable in Redis. The signed JWT proves the token
 * is ours; this store decides whether it is *still* valid.
 *
 * Key: refresh:{userId}:{jti} — expires on its own at the token's own exp, so
 * there is nothing to sweep.
 */
@Injectable()
export class RefreshTokenStore {
  constructor(private readonly redis: RedisService) {}

  private key(userId: string, jti: string): string {
    return `refresh:${userId}:${jti}`;
  }

  async store(userId: string, jti: string, ttlSeconds: number): Promise<void> {
    await this.redis.client.set(this.key(userId, jti), '1', 'EX', ttlSeconds);
  }

  /**
   * Single-use: DEL both checks existence and consumes in one atomic step, so
   * two simultaneous refreshes with the same token can't both succeed.
   * Returns false if the jti was already used, revoked, or expired.
   */
  async consume(userId: string, jti: string): Promise<boolean> {
    const deleted = await this.redis.client.del(this.key(userId, jti));
    return deleted === 1;
  }

  /** Logout-everywhere. Not wired to an endpoint yet — the store is ready for it. */
  async revokeAll(userId: string): Promise<number> {
    const pattern = this.key(userId, '*');
    let cursor = '0';
    let removed = 0;

    // SCAN, not KEYS — KEYS blocks the server, and this runs on a shared Redis.
    do {
      const [next, keys] = await this.redis.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = next;
      if (keys.length > 0) {
        removed += await this.redis.client.del(...keys);
      }
    } while (cursor !== '0');

    return removed;
  }
}
