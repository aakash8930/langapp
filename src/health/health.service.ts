import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { RedisService } from '../redis/redis.service';

export interface DependencyCheck {
  status: 'up' | 'down';
  latencyMs: number;
  error?: string;
}

export interface HealthReport {
  status: 'ok' | 'degraded';
  uptimeSeconds: number;
  checks: {
    mongo: DependencyCheck;
    redis: DependencyCheck;
  };
}

@Injectable()
export class HealthService {
  constructor(
    @InjectConnection() private readonly mongoConnection: Connection,
    private readonly redis: RedisService,
  ) {}

  async check(): Promise<HealthReport> {
    const [mongo, redis] = await Promise.all([this.checkMongo(), this.checkRedis()]);
    const status = mongo.status === 'up' && redis.status === 'up' ? 'ok' : 'degraded';

    return {
      status,
      uptimeSeconds: Math.round(process.uptime()),
      checks: { mongo, redis },
    };
  }

  /** Round-trips an actual `ping` to the server — not just the cached connection state. */
  private async checkMongo(): Promise<DependencyCheck> {
    const startedAt = Date.now();
    try {
      const db = this.mongoConnection.db;
      if (!db) {
        throw new Error('no active mongo connection');
      }
      await db.admin().ping();
      return { status: 'up', latencyMs: Date.now() - startedAt };
    } catch (err) {
      return {
        status: 'down',
        latencyMs: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async checkRedis(): Promise<DependencyCheck> {
    const startedAt = Date.now();
    try {
      const pong = await this.redis.client.ping();
      if (pong !== 'PONG') {
        throw new Error(`unexpected ping reply: ${pong}`);
      }
      return { status: 'up', latencyMs: Date.now() - startedAt };
    } catch (err) {
      return {
        status: 'down',
        latencyMs: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
