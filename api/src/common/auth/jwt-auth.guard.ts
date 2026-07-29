import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  isAdmin: boolean;
}

/** What the guard attaches to the request once a token checks out. */
export interface AuthenticatedUser {
  userId: string;
  email: string;
  isAdmin: boolean;
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
    const token = extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      request.user = { userId: payload.sub, email: payload.email, isAdmin: !!payload.isAdmin };
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
