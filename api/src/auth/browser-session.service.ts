import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import type { TokenPair } from './dto/auth-response.dto';
import {
  ACCESS_COOKIE,
  CSRF_COOKIE,
  REFRESH_COOKIE,
  readCookie,
} from '../common/auth/browser-cookie';

const DEFAULT_REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class BrowserSessionService {
  constructor(private readonly config: ConfigService) {}

  establish(response: Response, tokens: TokenPair): void {
    const secure = this.config.get<string>('NODE_ENV') === 'production';
    const base = { secure, sameSite: 'strict' as const, path: '/' };

    const refreshMaxAge = durationMs(
      this.config.get<string>('JWT_REFRESH_TTL', '7d'),
      DEFAULT_REFRESH_TTL_MS,
    );
    response.cookie(ACCESS_COOKIE, tokens.accessToken, {
      ...base,
      httpOnly: true,
      maxAge: tokens.expiresIn * 1000,
    });
    response.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      ...base,
      httpOnly: true,
      maxAge: refreshMaxAge,
    });
    response.cookie(CSRF_COOKIE, randomBytes(32).toString('base64url'), {
      ...base,
      httpOnly: false,
      maxAge: refreshMaxAge,
    });
  }

  clear(response: Response): void {
    const secure = this.config.get<string>('NODE_ENV') === 'production';
    const base = { secure, sameSite: 'strict' as const, path: '/' };
    response.clearCookie(ACCESS_COOKIE, { ...base, httpOnly: true });
    response.clearCookie(REFRESH_COOKIE, { ...base, httpOnly: true });
    response.clearCookie(CSRF_COOKIE, { ...base, httpOnly: false });
  }

  refreshToken(request: Request): string | null {
    return readCookie(request, REFRESH_COOKIE);
  }
}

function durationMs(value: string, fallback: number): number {
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(value.trim());
  if (!match) return fallback;
  const amount = Number(match[1]);
  const unit = match[2];
  const multiplier = unit === 'ms' ? 1
    : unit === 's' ? 1_000
      : unit === 'm' ? 60_000
        : unit === 'h' ? 3_600_000
          : 86_400_000;
  return amount * multiplier;
}
