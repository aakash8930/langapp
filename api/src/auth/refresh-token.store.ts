import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

export interface SessionInfo {
  jti: string;
  device: string;
  ip: string;
  createdAt: string;
}

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

  private sessionKey(userId: string, jti: string): string {
    return `session:${userId}:${jti}`;
  }

  async store(
    userId: string,
    jti: string,
    ttlSeconds: number,
    meta?: { device?: string; ip?: string },
  ): Promise<void> {
    await this.redis.client.set(this.key(userId, jti), '1', 'EX', ttlSeconds);

    if (meta) {
      const fields: Record<string, string> = {
        device: meta.device || 'Unknown',
        ip: meta.ip || 'Unknown',
        createdAt: new Date().toISOString(),
      };
      await this.redis.client.hset(this.sessionKey(userId, jti), fields);
      await this.redis.client.expire(this.sessionKey(userId, jti), ttlSeconds);
    }
  }

  /**
   * Single-use: DEL both checks existence and consumes in one atomic step, so
   * two simultaneous refreshes with the same token can't both succeed.
   * Returns false if the jti was already used, revoked, or expired.
   */
  async consume(userId: string, jti: string): Promise<boolean> {
    const deleted = await this.redis.client.del(this.key(userId, jti));
    // Clean up session info too
    await this.redis.client.del(this.sessionKey(userId, jti));
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

    // Also clean session info keys
    const sessionPattern = this.sessionKey(userId, '*');
    cursor = '0';
    do {
      const [next, keys] = await this.redis.client.scan(cursor, 'MATCH', sessionPattern, 'COUNT', 100);
      cursor = next;
      if (keys.length > 0) {
        await this.redis.client.del(...keys);
      }
    } while (cursor !== '0');

    return removed;
  }

  async listSessions(userId: string): Promise<SessionInfo[]> {
    const pattern = this.sessionKey(userId, '*');
    const sessions: SessionInfo[] = [];
    let cursor = '0';

    do {
      const [next, keys] = await this.redis.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = next;
      for (const key of keys) {
        const jti = key.slice(key.lastIndexOf(':') + 1);
        const data = await this.redis.client.hgetall(key);
        sessions.push({
          jti,
          device: data.device ?? 'Unknown',
          ip: data.ip ?? 'Unknown',
          createdAt: data.createdAt ?? new Date().toISOString(),
        });
      }
    } while (cursor !== '0');

    return sessions;
  }

  async removeSession(userId: string, jti: string): Promise<void> {
    await this.redis.client.del(this.key(userId, jti));
    await this.redis.client.del(this.sessionKey(userId, jti));
  }
}
