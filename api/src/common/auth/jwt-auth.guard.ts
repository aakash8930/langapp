import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import {
  ACCESS_COOKIE,
  assertBrowserCsrf,
  isSafeMethod,
  readCookie,
} from './browser-cookie';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  isAdmin: boolean;
  emailVerified?: boolean;
  onboardingComplete?: boolean;
}

/** What the guard attaches to the request once a token checks out. */
export interface AuthenticatedUser {
  userId: string;
  email: string;
  isAdmin: boolean;
  emailVerified?: boolean;
  onboardingComplete?: boolean;
}

export interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
}

/**
 * Lives in `common/` rather than the auth module so the user module can guard
 * its routes without importing auth (which imports user) — no dependency cycle.
 * Verifies against JwtService directly; passport would be three more deps for
 * the same twelve lines.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const bearer = extractBearerToken(request);
    const cookie = bearer ? null : readCookie(request, ACCESS_COOKIE);
    const token = bearer ?? cookie;

    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }

    // Native bearer credentials are explicit and remain unchanged. Browser
    // cookies are ambient, so unsafe requests also require a double-submit token.
    if (cookie && !isSafeMethod(request.method)) assertBrowserCsrf(request);

    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      request.user = {
        userId: payload.sub,
        email: payload.email,
        isAdmin: !!payload.isAdmin,
        emailVerified: payload.emailVerified === true,
        onboardingComplete: payload.onboardingComplete === true,
      };
      return true;
    } catch {
      // Covers expired, malformed, and wrong-secret alike — the client learns
      // nothing more than "this token is no good".
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}

function extractBearerToken(request: Request): string | null {
  const header = request.headers.authorization;
  if (!header) return null;

  const [scheme, value] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && value ? value : null;
}
