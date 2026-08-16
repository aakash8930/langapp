import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { JwtAuthGuard, type RequestWithUser } from './jwt-auth.guard';

const payload = {
  sub: 'user-1',
  email: 'learner@example.com',
  isAdmin: false,
  emailVerified: true,
  onboardingComplete: true,
};

function setup(request: Partial<Request>) {
  const jwt = { verifyAsync: jest.fn().mockResolvedValue(payload) } as unknown as JwtService;
  const config = { getOrThrow: jest.fn().mockReturnValue('secret') } as unknown as ConfigService;
  const guard = new JwtAuthGuard(jwt, config);
  const req = request as RequestWithUser;
  const context = {
    switchToHttp: () => ({ getRequest: () => req }),
  } as ExecutionContext;
  return { guard, jwt, req, context };
}

describe('JwtAuthGuard browser and native credentials', () => {
  it('keeps native bearer requests independent of CSRF', async () => {
    const { guard, jwt, req, context } = setup({
      method: 'POST',
      headers: { authorization: 'Bearer native-token' },
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(jwt.verifyAsync).toHaveBeenCalledWith('native-token', { secret: 'secret' });
    expect(req.user?.userId).toBe('user-1');
  });

  it('accepts an access cookie on safe browser requests', async () => {
    const { guard, jwt, context } = setup({
      method: 'GET',
      headers: { cookie: 'genko_access=browser-token' },
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(jwt.verifyAsync).toHaveBeenCalledWith('browser-token', { secret: 'secret' });
  });

  it('requires CSRF proof for unsafe cookie-authenticated requests', async () => {
    const rejected = setup({
      method: 'PATCH',
      headers: { cookie: 'genko_access=browser-token; genko_csrf=proof' },
    });
    await expect(rejected.guard.canActivate(rejected.context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    const accepted = setup({
      method: 'PATCH',
      headers: {
        cookie: 'genko_access=browser-token; genko_csrf=proof',
        'x-csrf-token': 'proof',
      },
    });
    await expect(accepted.guard.canActivate(accepted.context)).resolves.toBe(true);
  });

  it('rejects requests without either credential source', async () => {
    const { guard, context } = setup({ method: 'GET', headers: {} });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
