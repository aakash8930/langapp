import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { RedisService } from '../redis/redis.service';
import { MailService, type MailHealth } from '../mail/mail.service';

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
    mail: MailHealth;
  };
}

@Injectable()
export class HealthService {
  constructor(
    @InjectConnection() private readonly mongoConnection: Connection,
    private readonly redis: RedisService,
    private readonly mail: MailService,
  ) {}

  async check(): Promise<HealthReport> {
    const [mongo, redis, mail] = await Promise.all([
      this.checkMongo(),
      this.checkRedis(),
      this.mail.health(),
    ]);
    const status =
      mongo.status === 'up' && redis.status === 'up' && mail.status === 'up'
        ? 'ok'
        : 'degraded';

    return {
      status,
      uptimeSeconds: Math.round(process.uptime()),
      checks: { mongo, redis, mail },
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
