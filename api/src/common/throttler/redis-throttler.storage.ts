import { Injectable } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import { RedisService } from '../../redis/redis.service';

/**
 * Redis-backed ThrottlerStorage (§10 — Stage A puts this API on the public
 * internet via Funnel, so the limit must survive a restart and hold across
 * however many processes are running).
 *
 * The counter lives in Redis rather than process memory, which is the whole
 * point; the trade-off is that a Redis outage disables rate limiting (see
 * `increment`'s catch).
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly redis: RedisService) {}

  /**
   * One round trip, evaluated atomically inside Redis — INCR and the limit
   * comparison cannot interleave, so concurrent requests can't both slip
   * through on the boundary.
   *
   * `ttl` and `blockDuration` arrive in milliseconds; the record wants seconds.
   */
  private static readonly SCRIPT = `
    local hitsKey = KEYS[1]
    local blockKey = KEYS[2]
    local ttlMs = tonumber(ARGV[1])
    local limit = tonumber(ARGV[2])
    local blockMs = tonumber(ARGV[3])

    -- Already blocked: report remaining block time without extending the count.
    local blockTtl = redis.call('PTTL', blockKey)
    if blockTtl > 0 then
      local current = tonumber(redis.call('GET', hitsKey)) or 0
      local currentTtl = redis.call('PTTL', hitsKey)
      if currentTtl < 0 then currentTtl = 0 end
      return { current, currentTtl, 1, blockTtl }
    end

    local hits = redis.call('INCR', hitsKey)
    if hits == 1 then
      redis.call('PEXPIRE', hitsKey, ttlMs)
    end
    local timeToExpire = redis.call('PTTL', hitsKey)
    if timeToExpire < 0 then timeToExpire = 0 end

    if hits > limit then
      redis.call('SET', blockKey, 1, 'PX', blockMs)
      return { hits, timeToExpire, 1, blockMs }
    end

    return { hits, timeToExpire, 0, 0 }
  `;

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const hitsKey = `throttle:${throttlerName}:${key}`;
    const blockKey = `throttle:${throttlerName}:${key}:blocked`;

    try {
      const result = (await this.redis.client.eval(
        RedisThrottlerStorage.SCRIPT,
        2,
        hitsKey,
        blockKey,
        ttl,
        limit,
        blockDuration,
      )) as [number, number, number, number];

      const [totalHits, timeToExpireMs, isBlocked, timeToBlockExpireMs] = result;

      return {
        totalHits,
        timeToExpire: Math.ceil(timeToExpireMs / 1000),
        isBlocked: isBlocked === 1,
        timeToBlockExpire: Math.ceil(timeToBlockExpireMs / 1000),
      };
    } catch {
      // Fail open: a Redis outage must not lock every user out of logging in.
      // /health already reports Redis down, which is where that gets noticed.
      return { totalHits: 0, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 };
    }
  }
}
