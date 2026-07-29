import { PasswordResetStore, RESET_CODE_TTL_SECONDS } from './password-reset.store';
import { RedisService } from '../redis/redis.service';

/**
 * Just enough Redis to exercise the store: the four commands it uses, over a
 * Map. Expiry is recorded rather than enforced — TTL is Redis's job, and what
 * these tests need to pin is that a TTL is set at all and on which key.
 */
function fakeRedis() {
  const values = new Map<string, string>();
  const expiries = new Map<string, number>();

  const client = {
    async set(key: string, value: string, _mode: 'EX', seconds: number) {
      values.set(key, value);
      expiries.set(key, seconds);
      return 'OK';
    },
    async get(key: string) {
      return values.get(key) ?? null;
    },
    async del(...keys: string[]) {
      let removed = 0;
      for (const key of keys) {
        if (values.delete(key)) removed++;
        expiries.delete(key);
      }
      return removed;
    },
    async incr(key: string) {
      const next = Number(values.get(key) ?? 0) + 1;
      values.set(key, String(next));
      return next;
    },
    async expire(key: string, seconds: number) {
      expiries.set(key, seconds);
      return 1;
    },
  };

  return { values, expiries, service: { client } as unknown as RedisService };
}

const EMAIL = 'learner@example.com';

describe('PasswordResetStore', () => {
  it('accepts the code it stored, exactly once', async () => {
    const redis = fakeRedis();
    const store = new PasswordResetStore(redis.service);

    await store.store(EMAIL, '123456');

    await expect(store.verify(EMAIL, '123456')).resolves.toBe(true);
    // Consumed on success: a replay of the same code must not work.
    await expect(store.verify(EMAIL, '123456')).resolves.toBe(false);
  });

  it('sets a TTL, so an unused code expires on its own', async () => {
    const redis = fakeRedis();
    const store = new PasswordResetStore(redis.service);

    await store.store(EMAIL, '123456');

    expect(redis.expiries.get(`reset:${EMAIL}`)).toBe(RESET_CODE_TTL_SECONDS);
  });

  it('rejects when nothing was ever issued', async () => {
    const redis = fakeRedis();
    const store = new PasswordResetStore(redis.service);

    await expect(store.verify(EMAIL, '123456')).resolves.toBe(false);
  });

  it('throws the code away after five wrong guesses', async () => {
    const redis = fakeRedis();
    const store = new PasswordResetStore(redis.service);
    await store.store(EMAIL, '123456');

    for (let i = 0; i < 5; i++) {
      await expect(store.verify(EMAIL, '000000')).resolves.toBe(false);
    }

    // The budget is what makes a six-digit code safe — once spent, even the
    // right code is gone and the learner must request a new one.
    await expect(store.verify(EMAIL, '123456')).resolves.toBe(false);
  });

  it('still accepts the right code on the last try of the budget', async () => {
    const redis = fakeRedis();
    const store = new PasswordResetStore(redis.service);
    await store.store(EMAIL, '123456');

    for (let i = 0; i < 4; i++) {
      await expect(store.verify(EMAIL, '000000')).resolves.toBe(false);
    }

    await expect(store.verify(EMAIL, '123456')).resolves.toBe(true);
  });

  it('gives a newly issued code a fresh budget', async () => {
    const redis = fakeRedis();
    const store = new PasswordResetStore(redis.service);

    await store.store(EMAIL, '111111');
    for (let i = 0; i < 4; i++) await store.verify(EMAIL, '000000');

    // Re-issuing must not hand the new code a spent budget, or a learner who
    // fumbled once could never reset at all.
    await store.store(EMAIL, '222222');
    for (let i = 0; i < 4; i++) {
      await expect(store.verify(EMAIL, '000000')).resolves.toBe(false);
    }
    await expect(store.verify(EMAIL, '222222')).resolves.toBe(true);
  });

  it('issuing a second code invalidates the first', async () => {
    const redis = fakeRedis();
    const store = new PasswordResetStore(redis.service);

    await store.store(EMAIL, '111111');
    await store.store(EMAIL, '222222');

    await expect(store.verify(EMAIL, '111111')).resolves.toBe(false);
  });

  it('is case-insensitive about the address, as the user lookup is', async () => {
    const redis = fakeRedis();
    const store = new PasswordResetStore(redis.service);

    await store.store('Learner@Example.com', '123456');

    // `UserService.findByEmail` lowercases; if this store did not, a reset
    // requested as typed could never be redeemed as typed differently.
    await expect(store.verify('learner@example.com', '123456')).resolves.toBe(true);
  });

  it('rejects a code of the wrong length without throwing', async () => {
    const redis = fakeRedis();
    const store = new PasswordResetStore(redis.service);
    await store.store(EMAIL, '123456');

    // timingSafeEqual throws on a length mismatch — the length guard is what
    // turns that into a plain false.
    await expect(store.verify(EMAIL, '12345')).resolves.toBe(false);
    await expect(store.verify(EMAIL, '')).resolves.toBe(false);
  });
});
