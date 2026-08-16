import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserService } from '../../user/user.service';
import { AccountStateGuard, type RequiredAccountState } from './account-state.guard';

function makeGuard(required: RequiredAccountState, persisted: unknown) {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(required),
  } as unknown as Reflector;
  const users = {
    findById: jest.fn().mockResolvedValue(persisted),
  } as unknown as UserService;
  return { guard: new AccountStateGuard(users, reflector), users };
}

function context(user: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
  } as unknown as ExecutionContext;
}

describe('AccountStateGuard', () => {
  it('allows authenticated-only account/profile routes without a state lookup', async () => {
    const { guard, users } = makeGuard('authenticated', null);

    await expect(guard.canActivate(context({ userId: 'u1' }))).resolves.toBe(true);
    expect(users.findById).not.toHaveBeenCalled();
  });

  it('rejects an unverified account from verified routes with a machine-readable code', async () => {
    const { guard } = makeGuard('verified', {
      emailVerified: false,
      onboardingState: { onboardingComplete: false },
    });

    try {
      await guard.canActivate(context({ userId: 'u1' }));
      throw new Error('expected guard to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        code: 'EMAIL_VERIFICATION_REQUIRED',
      });
    }
  });

  it('allows onboarding to a verified account but blocks learning until completion', async () => {
    const persisted = {
      emailVerified: true,
      onboardingState: { onboardingComplete: false },
    };
    const verified = makeGuard('verified', persisted);
    const onboarded = makeGuard('onboarded', persisted);

    await expect(verified.guard.canActivate(context({ userId: 'u1' }))).resolves.toBe(true);
    await expect(onboarded.guard.canActivate(context({ userId: 'u1' })))
      .rejects.toMatchObject({ response: { code: 'ONBOARDING_REQUIRED' } });
  });

  it('trusts only monotonic true claims and avoids a database lookup for completed accounts', async () => {
    const { guard, users } = makeGuard('onboarded', null);

    await expect(
      guard.canActivate(
        context({ userId: 'u1', emailVerified: true, onboardingComplete: true }),
      ),
    ).resolves.toBe(true);
    expect(users.findById).not.toHaveBeenCalled();
  });
});
