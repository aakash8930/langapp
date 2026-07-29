import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomInt, randomUUID } from 'node:crypto';
import { toUserResponse } from '../user/dto/user-response.dto';
import { meetsMinimumAge, MIN_AGE_TO_REGISTER } from '../user/gamification/age';
import { UserDocument } from '../user/schemas/user.schema';
import { UserService } from '../user/user.service';
import { AuthResponse, TokenPair } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { PasswordResetStore, RESET_CODE_TTL_SECONDS } from './password-reset.store';
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
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly refreshTokens: RefreshTokenStore,
    private readonly passwordResets: PasswordResetStore,
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
      // Re-use detection (OPEN-ITEMS #4): RFC 6819 §5.2.2.3 — if a refresh token
      // is re-used after already being consumed, assume it was stolen and revoke
      // all active refresh tokens for this user.
      await this.refreshTokens.revokeAll(payload.sub);
      throw new UnauthorizedException('Refresh token has been used or revoked');
    }

    const user = await this.userService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    return this.issueTokens(user);
  }

  /** Revoke a single refresh token (standard logout). */
  async logout(dto: RefreshDto): Promise<void> {
    try {
      const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(dto.refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
      await this.refreshTokens.consume(payload.sub, payload.jti);
    } catch {
      // Token is already invalid, expired, or malformed — logout is idempotent.
    }
  }

  /** Revoke all active refresh tokens for the user (logout everywhere). */
  async logoutAll(userId: string): Promise<number> {
    return this.refreshTokens.revokeAll(userId);
  }

  /**
   * Issues a reset code and **writes it to the server log**, because Stage A has
   * no mail service (§8: nothing that bills per message). That is a deliberate,
   * documented trade and it is the whole security model of this flow: anyone who
   * can read the API's log can reset any account. On a laptop whose only operator
   * is the sole administrator that is already true of the database itself; it
   * stops being acceptable the moment logs are shipped anywhere, at which point
   * this needs a real mail transport rather than a wider log.
   *
   * The reply is identical whether or not the address is registered — the same
   * anti-enumeration property `login` burns a dummy argon2 verify to keep. There
   * is no dummy work to do here: both paths are one indexed lookup, and the code
   * is generated after the branch, so the timings already match.
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.userService.findByEmail(email);

    if (user) {
      // randomInt, not Math.random — this is a credential, and Math.random is a
      // predictable PRNG. Zero-padded so every code is the same six digits.
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      await this.passwordResets.store(email, code);
      this.logger.warn(
        `Password reset code for ${email}: ${code} ` +
          `(valid ${RESET_CODE_TTL_SECONDS / 60} minutes)`,
      );
    }

    return {
      message:
        'If that email is registered, a reset code has been generated. ' +
        'It is in the API server log.',
    };
  }

  /**
   * Redeems a reset code. A wrong code, an expired one and an unknown address
   * are one indistinguishable 401, for the same reason `login` has one message:
   * telling a stranger which part was wrong tells them the other part was right.
   */
  async resetPassword(email: string, code: string, newPassword: string): Promise<{ message: string }> {
    const accepted = await this.passwordResets.verify(email, code);
    if (!accepted) throw new UnauthorizedException('Invalid or expired reset code.');

    const user = await this.userService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid or expired reset code.');

    const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });
    await this.userService.updatePassword(user._id.toString(), passwordHash);

    // Every existing session dies with the old password. Whoever forced the
    // reset — the owner locked out, or an attacker who read the log — the other
    // party must not keep a live refresh token across the change.
    await this.refreshTokens.revokeAll(user._id.toString());

    return { message: 'Password reset. Sign in with your new password.' };
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
      { sub: userId, email: user.email, isAdmin: user.isAdmin },
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
