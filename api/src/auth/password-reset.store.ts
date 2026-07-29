import { Injectable } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { RedisService } from '../redis/redis.service';

/** How long a reset code stays redeemable. */
export const RESET_CODE_TTL_SECONDS = 15 * 60;

/**
 * Wrong guesses a code survives before it is thrown away. A six-digit code is
 * only 10^6 wide, so the budget — not the width — is what makes guessing
 * hopeless: five tries out of a million, and the code is gone.
 */
const MAX_ATTEMPTS = 5;

/**
 * §10: password-reset codes, held in Redis for exactly as long as they are
 * valid. Same shape as `RefreshTokenStore` — the key expires on its own, so
 * there is nothing to sweep and an unused code simply stops existing.
 *
 * Keyed by email rather than by user id, because the address is all the
 * forgot-password request carries and looking a user up first would make the
 * store's behaviour depend on whether the account exists.
 */
@Injectable()
export class PasswordResetStore {
  constructor(private readonly redis: RedisService) {}

  private key(email: string): string {
    return `reset:${email.toLowerCase()}`;
  }

  private attemptsKey(email: string): string {
    return `reset-attempts:${email.toLowerCase()}`;
  }

  /** Replaces any code already outstanding for this address. */
  async store(email: string, code: string): Promise<void> {
    await this.redis.client.set(this.key(email), code, 'EX', RESET_CODE_TTL_SECONDS);
    await this.redis.client.del(this.attemptsKey(email));
  }

  /**
   * True once, for the right code. Consumes on success so a code cannot be
   * replayed, and discards it after `MAX_ATTEMPTS` wrong guesses.
   */
  async verify(email: string, code: string): Promise<boolean> {
    const stored = await this.redis.client.get(this.key(email));
    if (stored === null) return false;

    if (!equalInConstantTime(stored, code)) {
      const attempts = await this.redis.client.incr(this.attemptsKey(email));
      // The counter must not outlive the code it guards, or the next code
      // issued to this address inherits a spent budget.
      if (attempts === 1) {
        await this.redis.client.expire(this.attemptsKey(email), RESET_CODE_TTL_SECONDS);
      }
      if (attempts >= MAX_ATTEMPTS) await this.discard(email);
      return false;
    }

    await this.discard(email);
    return true;
  }

  private async discard(email: string): Promise<void> {
    await this.redis.client.del(this.key(email), this.attemptsKey(email));
  }
}

/**
 * `timingSafeEqual` throws on a length mismatch, which would leak the length
 * through an exception — so compare lengths first and only then the bytes.
 * The length of a reset code is a constant we publish anyway.
 */
function equalInConstantTime(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
