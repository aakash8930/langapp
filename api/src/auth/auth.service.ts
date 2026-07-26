import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { toUserResponse } from '../user/dto/user-response.dto';
import { meetsMinimumAge, MIN_AGE_TO_REGISTER } from '../user/gamification/age';
import { UserDocument } from '../user/schemas/user.schema';
import { UserService } from '../user/user.service';
import { AuthResponse, TokenPair } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenStore } from './refresh-token.store';

interface RefreshTokenPayload {
  sub: string;
  jti: string;
  exp: number;
}

/**
 * A real argon2id hash of a random string, computed once on first use.
 * Verifying against it when no user exists keeps failed-login timing roughly
 * constant, so response time doesn't leak which addresses are registered.
 * It has to be a genuine hash — a fake string would throw on parse and return
 * far too fast, which is the exact leak this is meant to close.
 */
let dummyHash: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  dummyHash ??= argon2.hash(randomUUID(), { type: argon2.argon2id });
  return dummyHash;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly refreshTokens: RefreshTokenStore,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    // Age gate first: refuse before spending an argon2 hash on the password, and
    // before the email lookup tells an under-age visitor whether an address is
    // taken. `meetsMinimumAge` refuses an unparseable date rather than defaulting
    // to allow — the DTO already validated the format, this is the value check.
    if (!meetsMinimumAge(new Date(dto.dateOfBirth), new Date())) {
      throw new BadRequestException(
        `You must be at least ${MIN_AGE_TO_REGISTER} to create an account.`,
      );
    }

    const existing = await this.userService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });

    const user = await this.userService.create({
      email: dto.email,
      passwordHash,
      displayName: dto.displayName,
      dateOfBirth: new Date(dto.dateOfBirth),
      nativeLanguage: dto.nativeLanguage,
      tz: dto.tz,
    });

    // null means the unique index rejected it — someone registered the same
    // address between our check and this write.
    if (!user) {
      throw new ConflictException('Email already registered');
    }

    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.userService.findByEmailWithPassword(dto.email);

    if (!user) {
      await argon2.verify(await getDummyHash(), dto.password).catch(() => false);
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await argon2.verify(user.passwordHash, dto.password).catch(() => false);
    if (!passwordMatches) {
      // Same message as the unknown-email case: never confirm an address exists.
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildAuthResponse(user);
  }

  /**
   * Rotation: the presented token is verified, consumed, and replaced. Replaying
   * a token that was already exchanged fails at the Redis check even though its
   * signature is still valid.
   */
  async refresh(dto: RefreshDto): Promise<TokenPair> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(dto.refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      // Expired, tampered with, or signed with the access secret.
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const consumed = await this.refreshTokens.consume(payload.sub, payload.jti);
    if (!consumed) {
      throw new UnauthorizedException('Refresh token has been used or revoked');
    }

    const user = await this.userService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    return this.issueTokens(user);
  }

  private async buildAuthResponse(user: UserDocument): Promise<AuthResponse> {
    const tokens = await this.issueTokens(user);
    // toUserResponse is an allowlist — passwordHash cannot ride along.
    return { user: toUserResponse(user), tokens };
  }

  private async issueTokens(user: UserDocument): Promise<TokenPair> {
    const userId = user._id.toString();
    const jti = randomUUID();

    const accessToken = await this.jwtService.signAsync(
      { sub: userId, email: user.email },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: ttl(this.config.getOrThrow<string>('JWT_ACCESS_TTL')),
      },
    );

    const refreshToken = await this.jwtService.signAsync(
      { sub: userId, jti },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: ttl(this.config.getOrThrow<string>('JWT_REFRESH_TTL')),
      },
    );

    // Read the lifetimes back off the tokens instead of parsing '15m'/'7d'
    // ourselves — the Redis key then expires exactly when the token does.
    const accessExpiresIn = secondsUntilExpiry(this.jwtService.decode(accessToken));
    const refreshExpiresIn = secondsUntilExpiry(this.jwtService.decode(refreshToken));

    await this.refreshTokens.store(userId, jti, refreshExpiresIn);

    return { accessToken, refreshToken, expiresIn: accessExpiresIn };
  }
}

/**
 * jsonwebtoken types `expiresIn` as ms's `StringValue` template literal, which
 * a runtime env var can never satisfy statically. A bad value throws at the
 * first sign() call, and boot signs nothing, so this is checked at startup by
 * the smoke path rather than by the compiler.
 */
function ttl(value: string): JwtSignOptions['expiresIn'] {
  return value as JwtSignOptions['expiresIn'];
}

function secondsUntilExpiry(decoded: unknown): number {
  const exp = (decoded as { exp?: number } | null)?.exp;
  if (typeof exp !== 'number') {
    throw new Error('Signed token is missing an exp claim');
  }
  return Math.max(1, exp - Math.floor(Date.now() / 1000));
}
