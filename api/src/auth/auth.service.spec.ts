import {
  ConflictException,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { UserDocument } from '../user/schemas/user.schema';
import { UserService } from '../user/user.service';
import { AuthService } from './auth.service';
import { PasswordResetStore } from './password-reset.store';
import { RefreshTokenStore } from './refresh-token.store';
import { RedisService } from '../redis/redis.service';
import { MailService } from '../mail/mail.service';

jest.mock('otplib', () => ({
  generateSecret: jest.fn(() => 'TESTSECRET'),
  verify: jest.fn(() => Promise.resolve(true)),
}));

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
  userService: jest.Mocked<
    Pick<
      UserService,
      | 'create'
      | 'findById'
      | 'findByEmail'
      | 'findByEmailWithPassword'
      | 'updatePassword'
      | 'setVerificationToken'
      | 'getVerificationToken'
      | 'verifyEmail'
    >
  >;
  store: jest.Mocked<Pick<RefreshTokenStore, 'store' | 'consume' | 'revokeAll'>>;
  resets: jest.Mocked<Pick<PasswordResetStore, 'store' | 'verify'>>;
  redis: { client: { set: jest.Mock; get: jest.Mock; del: jest.Mock } };
  mail: jest.Mocked<Pick<MailService, 'enqueue'>>;
}

function build(): { service: AuthService; mocks: Mocks } {
  const mocks: Mocks = {
    userService: {
      create: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findByEmailWithPassword: jest.fn(),
      updatePassword: jest.fn().mockResolvedValue(undefined),
      setVerificationToken: jest.fn().mockResolvedValue(undefined),
      getVerificationToken: jest.fn().mockResolvedValue('123456'),
      verifyEmail: jest.fn().mockResolvedValue(undefined),
    },
    store: {
      store: jest.fn().mockResolvedValue(undefined),
      consume: jest.fn().mockResolvedValue(true),
      revokeAll: jest.fn().mockResolvedValue(1),
    },
    resets: {
      store: jest.fn().mockResolvedValue(undefined),
      verify: jest.fn().mockResolvedValue(true),
    },
    redis: {
      client: {
        set: jest.fn().mockResolvedValue('OK'),
        get: jest.fn().mockResolvedValue(null),
        del: jest.fn().mockResolvedValue(1),
      },
    },
    mail: {
      enqueue: jest.fn().mockResolvedValue({
        status: 'queued',
        deliveryId: '00000000-0000-4000-8000-000000000001',
      }),
    },
  };

  const service = new AuthService(
    mocks.userService as unknown as UserService,
    jwtService,
    config,
    mocks.store as unknown as RefreshTokenStore,
    mocks.resets as unknown as PasswordResetStore,
    mocks.redis as unknown as RedisService,
    mocks.mail as unknown as MailService,
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
      expect(result.emailDelivery).toEqual({
        status: 'queued',
        deliveryId: '00000000-0000-4000-8000-000000000001',
      });
      expect(mocks.mail.enqueue).toHaveBeenCalledWith(
        'learner@example.com',
        'Verify your GENKŌ account',
        expect.stringContaining('verification code'),
        'verification',
      );

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

    it('keeps the created account successful but reports when verification mail was not queued', async () => {
      const { service, mocks } = build();
      mocks.userService.findByEmail.mockResolvedValue(null);
      mocks.userService.create.mockResolvedValue(makeUser());
      mocks.mail.enqueue.mockResolvedValue({
        status: 'unavailable',
        deliveryId: '00000000-0000-4000-8000-000000000002',
        error: 'redis down',
      });

      const result = await service.register({
        email: 'learner@example.com',
        password: 'correct-horse-battery',
        displayName: 'Learner',
        dateOfBirth: ADULT_DOB,
      });

      expect(result.user.email).toBe('learner@example.com');
      expect(result.emailDelivery).toEqual({
        status: 'unavailable',
        deliveryId: '00000000-0000-4000-8000-000000000002',
      });
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

    it('rejects a replayed token whose jti is already consumed and revokes token family', async () => {
      const { service, mocks } = build();
      mocks.store.consume.mockResolvedValue(false);

      const token = await jwtService.signAsync(
        { sub: '507f1f77bcf86cd799439011', jti: 'already-used' },
        { secret: REFRESH_SECRET, expiresIn: '7d' },
      );

      await expect(service.refresh({ refreshToken: token })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      // OPEN-ITEMS #4: Token reuse revokes full token family!
      expect(mocks.store.revokeAll).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
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

  describe('forgotPassword', () => {
    // The service logs every code it issues — that is the delivery mechanism,
    // not debug noise. Silence it here so 300 draws don't bury the report.
    let logged: jest.SpyInstance;
    beforeEach(() => {
      logged = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    });
    afterEach(() => logged.mockRestore());

    it('answers identically for a registered and an unknown address', async () => {
      const { service, mocks } = build();

      mocks.userService.findByEmail.mockResolvedValue(makeUser());
      const known = await service.forgotPassword('learner@example.com');

      mocks.userService.findByEmail.mockResolvedValue(null);
      const unknown = await service.forgotPassword('nobody@example.com');

      // Anti-enumeration: the reply must not distinguish the two cases.
      expect(unknown).toEqual(known);
    });

    it('keeps the generic response when the registered account email cannot be queued', async () => {
      const { service, mocks } = build();
      mocks.userService.findByEmail.mockResolvedValue(makeUser());
      mocks.mail.enqueue.mockResolvedValue({
        status: 'unavailable',
        deliveryId: '00000000-0000-4000-8000-000000000004',
        error: 'redis down',
      });

      await expect(service.forgotPassword('learner@example.com')).resolves.toEqual({
        message: 'If that email is registered, a reset code has been sent.',
      });
    });

    it('issues a six-digit code only when the account exists', async () => {
      const { service, mocks } = build();
      mocks.userService.findByEmail.mockResolvedValue(makeUser());

      await service.forgotPassword('learner@example.com');

      expect(mocks.resets.store).toHaveBeenCalledTimes(1);
      const [, code] = mocks.resets.store.mock.calls[0];
      expect(code).toMatch(/^\d{6}$/);

      mocks.userService.findByEmail.mockResolvedValue(null);
      await service.forgotPassword('nobody@example.com');
      expect(mocks.resets.store).toHaveBeenCalledTimes(1);
    });

    it('zero-pads, so a low draw is still six digits', async () => {
      const { service, mocks } = build();
      mocks.userService.findByEmail.mockResolvedValue(makeUser());

      // randomInt(0, 1e6) can legitimately return 7, and unpadded that is a
      // one-digit code the DTO's Length(6, 6) would reject as malformed. 300
      // draws miss the sub-100000 tenth of the range with probability 0.9^300,
      // about 2e-14 — so a regression here fails essentially every run.
      for (let i = 0; i < 300; i++) {
        await service.forgotPassword('learner@example.com');
      }

      const codes = mocks.resets.store.mock.calls.map(([, code]) => code);
      expect(codes.every((code) => /^\d{6}$/.test(code))).toBe(true);
      // And they are not all the same number.
      expect(new Set(codes).size).toBeGreaterThan(1);
    });
  });

  describe('resetPassword', () => {
    it('rehashes the password with argon2id and kills every session', async () => {
      const { service, mocks } = build();
      mocks.resets.verify.mockResolvedValue(true);
      mocks.userService.findByEmail.mockResolvedValue(makeUser());

      await service.resetPassword('learner@example.com', '123456', 'correct-horse-battery');

      expect(mocks.userService.updatePassword).toHaveBeenCalledTimes(1);
      const [userId, hash] = mocks.userService.updatePassword.mock.calls[0];
      expect(userId).toBe('507f1f77bcf86cd799439011');
      expect(hash.startsWith('$argon2id$')).toBe(true);
      await expect(argon2.verify(hash, 'correct-horse-battery')).resolves.toBe(true);

      // Whoever forced the reset, the other party must not keep a live session.
      expect(mocks.store.revokeAll).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    });

    it('refuses a rejected code without touching the password', async () => {
      const { service, mocks } = build();
      mocks.resets.verify.mockResolvedValue(false);

      await expect(
        service.resetPassword('learner@example.com', '000000', 'correct-horse-battery'),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(mocks.userService.updatePassword).not.toHaveBeenCalled();
      expect(mocks.store.revokeAll).not.toHaveBeenCalled();
    });

    it('refuses an accepted code for an account that no longer exists', async () => {
      const { service, mocks } = build();
      mocks.resets.verify.mockResolvedValue(true);
      mocks.userService.findByEmail.mockResolvedValue(null);

      await expect(
        service.resetPassword('gone@example.com', '123456', 'correct-horse-battery'),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(mocks.userService.updatePassword).not.toHaveBeenCalled();
    });
  });
});

describe('AuthService.resendVerification', () => {
  it('surfaces queue unavailability instead of claiming a message was sent', async () => {
    const { service, mocks } = build();
    mocks.userService.findById.mockResolvedValue(makeUser());
    mocks.mail.enqueue.mockResolvedValue({
      status: 'unavailable',
      deliveryId: '00000000-0000-4000-8000-000000000003',
      error: 'redis down',
    });

    await expect(service.resendVerification('507f1f77bcf86cd799439011'))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(mocks.userService.setVerificationToken).toHaveBeenCalled();
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
