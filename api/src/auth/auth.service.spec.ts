import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { UserDocument } from '../user/schemas/user.schema';
import { UserService } from '../user/user.service';
import { AuthService } from './auth.service';
import { RefreshTokenStore } from './refresh-token.store';

const ACCESS_SECRET = 'test-access-secret-that-is-long-enough-32';
const REFRESH_SECRET = 'test-refresh-secret-that-is-long-enough-32';

const config = new ConfigService({
  JWT_ACCESS_SECRET: ACCESS_SECRET,
  JWT_REFRESH_SECRET: REFRESH_SECRET,
  JWT_ACCESS_TTL: '15m',
  JWT_REFRESH_TTL: '7d',
});

// A real JwtService — signing is pure CPU, and using the real thing means the
// expiry test exercises actual verification rather than a mock's opinion of it.
const jwtService = new JwtService({});

function makeUser(overrides: Partial<{ id: string; email: string; passwordHash: string }> = {}) {
  const id = overrides.id ?? '507f1f77bcf86cd799439011';
  return {
    _id: { toString: () => id },
    email: overrides.email ?? 'learner@example.com',
    passwordHash: overrides.passwordHash ?? '',
    profile: { displayName: 'Learner', nativeLanguage: 'en', activeTrack: 'ja' as const },
    gamification: { xp: 0, streakDays: 0, lastStudyDate: null, dailyGoalXp: 50 },
    settings: { audioSpeed: 1, theme: 'light' as const, tz: 'Asia/Kolkata' },
    get: (key: string) => (key === 'createdAt' ? new Date('2026-07-18T00:00:00Z') : undefined),
  } as unknown as UserDocument;
}

interface Mocks {
  userService: jest.Mocked<Pick<UserService, 'create' | 'findById' | 'findByEmail' | 'findByEmailWithPassword'>>;
  store: jest.Mocked<Pick<RefreshTokenStore, 'store' | 'consume'>>;
}

function build(): { service: AuthService; mocks: Mocks } {
  const mocks: Mocks = {
    userService: {
      create: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findByEmailWithPassword: jest.fn(),
    },
    store: {
      store: jest.fn().mockResolvedValue(undefined),
      consume: jest.fn().mockResolvedValue(true),
    },
  };

  const service = new AuthService(
    mocks.userService as unknown as UserService,
    jwtService,
    config,
    mocks.store as unknown as RefreshTokenStore,
  );

  return { service, mocks };
}

/** Comfortably over the age gate, so these tests exercise everything past it. */
const ADULT_DOB = '1995-06-15';

describe('AuthService', () => {
  describe('register', () => {
    it('creates the user, hashes with argon2id, and returns tokens without the hash', async () => {
      const { service, mocks } = build();
      mocks.userService.findByEmail.mockResolvedValue(null);
      mocks.userService.create.mockResolvedValue(makeUser());

      const result = await service.register({
        email: 'learner@example.com',
        password: 'correct-horse-battery',
        displayName: 'Learner',
        dateOfBirth: ADULT_DOB,
      });

      expect(result.user.email).toBe('learner@example.com');
      expect(result.tokens.accessToken).toEqual(expect.any(String));
      expect(result.tokens.refreshToken).toEqual(expect.any(String));
      expect(result.tokens.expiresIn).toBeGreaterThan(0);

      // The password was hashed with argon2id, not stored or hashed with bcrypt.
      const created = mocks.userService.create.mock.calls[0][0];
      expect(created.passwordHash).toMatch(/^\$argon2id\$/);
      expect(created.passwordHash).not.toContain('correct-horse-battery');

      // The response shape has no route to the hash at all.
      expect(JSON.stringify(result)).not.toContain('argon2');
      expect(result.user).not.toHaveProperty('passwordHash');

      // The refresh jti was persisted so it can be revoked later.
      expect(mocks.store.store).toHaveBeenCalledTimes(1);
    });

    it('rejects a duplicate email with 409 and never writes', async () => {
      const { service, mocks } = build();
      mocks.userService.findByEmail.mockResolvedValue(makeUser());

      await expect(
        service.register({
          email: 'learner@example.com',
          password: 'correct-horse-battery',
          displayName: 'Learner',
          dateOfBirth: ADULT_DOB,
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(mocks.userService.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('rejects a wrong password with 401 and issues no tokens', async () => {
      const { service, mocks } = build();
      const passwordHash = await argon2.hash('the-real-password', { type: argon2.argon2id });
      mocks.userService.findByEmailWithPassword.mockResolvedValue(makeUser({ passwordHash }));

      await expect(
        service.login({ email: 'learner@example.com', password: 'not-the-password' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(mocks.store.store).not.toHaveBeenCalled();
    });

    it('accepts the correct password', async () => {
      const { service, mocks } = build();
      const passwordHash = await argon2.hash('the-real-password', { type: argon2.argon2id });
      mocks.userService.findByEmailWithPassword.mockResolvedValue(makeUser({ passwordHash }));

      const result = await service.login({
        email: 'learner@example.com',
        password: 'the-real-password',
      });

      expect(result.tokens.accessToken).toEqual(expect.any(String));
      expect(result.user).not.toHaveProperty('passwordHash');
    });
  });

  describe('refresh', () => {
    it('rejects an expired refresh token with 401 and does not consume the jti', async () => {
      const { service, mocks } = build();

      // Genuinely expired: signed with a negative lifetime, so verification
      // fails on exp rather than on a mocked-out branch.
      const expiredToken = await jwtService.signAsync(
        { sub: '507f1f77bcf86cd799439011', jti: 'some-jti' },
        { secret: REFRESH_SECRET, expiresIn: '-10s' },
      );

      await expect(service.refresh({ refreshToken: expiredToken })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      expect(mocks.store.consume).not.toHaveBeenCalled();
    });

    it('rotates a valid token: consumes the old jti and stores a new one', async () => {
      const { service, mocks } = build();
      mocks.userService.findById.mockResolvedValue(makeUser());

      const token = await jwtService.signAsync(
        { sub: '507f1f77bcf86cd799439011', jti: 'original-jti' },
        { secret: REFRESH_SECRET, expiresIn: '7d' },
      );

      const tokens = await service.refresh({ refreshToken: token });

      expect(mocks.store.consume).toHaveBeenCalledWith('507f1f77bcf86cd799439011', 'original-jti');
      expect(tokens.refreshToken).not.toBe(token);

      const newJti = mocks.store.store.mock.calls[0][1];
      expect(newJti).not.toBe('original-jti');
    });

    it('rejects a replayed token whose jti is already consumed', async () => {
      const { service, mocks } = build();
      mocks.store.consume.mockResolvedValue(false);

      const token = await jwtService.signAsync(
        { sub: '507f1f77bcf86cd799439011', jti: 'already-used' },
        { secret: REFRESH_SECRET, expiresIn: '7d' },
      );

      await expect(service.refresh({ refreshToken: token })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects a refresh token signed with the access secret', async () => {
      const { service } = build();

      const wrongSecretToken = await jwtService.signAsync(
        { sub: '507f1f77bcf86cd799439011', jti: 'some-jti' },
        { secret: ACCESS_SECRET, expiresIn: '7d' },
      );

      await expect(service.refresh({ refreshToken: wrongSecretToken })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });
});

describe('AuthService.register — the age gate', () => {
  /**
   * Under-13 registration is refused outright. The gate runs *before* the email
   * lookup and before argon2, which matters twice: it does not spend a hash on a
   * request that cannot succeed, and it does not tell an under-age visitor
   * whether an address is already taken.
   */
  it('refuses someone under the minimum age, without touching the database', async () => {
    const { service, mocks } = build();
    const tooYoung = new Date();
    tooYoung.setFullYear(tooYoung.getFullYear() - 12);

    await expect(
      service.register({
        email: 'kid@example.com',
        password: 'correct-horse-battery',
        displayName: 'Kid',
        dateOfBirth: tooYoung.toISOString().slice(0, 10),
      }),
    ).rejects.toThrow(/at least 13/);

    expect(mocks.userService.findByEmail).not.toHaveBeenCalled();
    expect(mocks.userService.create).not.toHaveBeenCalled();
  });

  it('admits someone over the minimum age', async () => {
    const { service, mocks } = build();
    mocks.userService.findByEmail.mockResolvedValue(null);
    mocks.userService.create.mockResolvedValue(makeUser());

    const result = await service.register({
      email: 'learner@example.com',
      password: 'correct-horse-battery',
      displayName: 'Learner',
      dateOfBirth: ADULT_DOB,
    });

    expect(result.user.email).toBe('learner@example.com');
  });

  it('persists the birth date, since it cannot be retrofitted later', async () => {
    const { service, mocks } = build();
    mocks.userService.findByEmail.mockResolvedValue(null);
    mocks.userService.create.mockResolvedValue(makeUser());

    await service.register({
      email: 'learner@example.com',
      password: 'correct-horse-battery',
      displayName: 'Learner',
      dateOfBirth: ADULT_DOB,
    });

    expect(mocks.userService.create).toHaveBeenCalledWith(
      expect.objectContaining({ dateOfBirth: new Date(ADULT_DOB) }),
    );
  });

  /** An unparseable date is an unknown age, and unknown must never pass. */
  it('refuses an unusable birth date rather than defaulting to allow', async () => {
    const { service, mocks } = build();

    await expect(
      service.register({
        email: 'learner@example.com',
        password: 'correct-horse-battery',
        displayName: 'Learner',
        dateOfBirth: 'not-a-date',
      }),
    ).rejects.toThrow(/at least 13/);

    expect(mocks.userService.create).not.toHaveBeenCalled();
  });
});
