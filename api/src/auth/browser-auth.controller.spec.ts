jest.mock('otplib', () => ({
  generateSecret: jest.fn(() => 'TESTSECRET'),
  verify: jest.fn(() => Promise.resolve(true)),
}));

import { UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { AuthService } from './auth.service';
import { BrowserAuthController } from './browser-auth.controller';
import type { BrowserSessionService } from './browser-session.service';

const user = { id: 'u1', email: 'learner@example.com' };
const tokens = { accessToken: 'access', refreshToken: 'refresh', expiresIn: 900 };

function setup(refreshToken: string | null = 'refresh') {
  const auth = {
    register: jest.fn().mockResolvedValue({ user, tokens, emailDelivery: { status: 'queued', deliveryId: 'd1' } }),
    login: jest.fn().mockResolvedValue({ user, tokens }),
    refresh: jest.fn().mockResolvedValue(tokens),
    logout: jest.fn().mockResolvedValue(undefined),
  } as unknown as AuthService;
  const sessions = {
    establish: jest.fn(),
    clear: jest.fn(),
    refreshToken: jest.fn().mockReturnValue(refreshToken),
  } as unknown as BrowserSessionService;
  return { controller: new BrowserAuthController(auth, sessions), auth, sessions };
}

const response = {} as Response;
const request = {
  headers: { cookie: 'genko_csrf=proof; genko_refresh=refresh', 'x-csrf-token': 'proof' },
} as unknown as Request;

describe('BrowserAuthController', () => {
  it('establishes registration cookies without serialising either token', async () => {
    const { controller, sessions } = setup();
    const result = await controller.register({} as never, response);

    expect(sessions.establish).toHaveBeenCalledWith(response, tokens);
    expect(result).toEqual({
      user,
      emailDelivery: { status: 'queued', deliveryId: 'd1' },
    });
    expect(JSON.stringify(result)).not.toContain('access');
    expect(JSON.stringify(result)).not.toContain('refresh');
  });

  it('rotates refresh cookies only with valid CSRF proof', async () => {
    const { controller, auth, sessions } = setup();
    await controller.refresh(request, response);
    expect(auth.refresh).toHaveBeenCalledWith({ refreshToken: 'refresh' });
    expect(sessions.establish).toHaveBeenCalledWith(response, tokens);
  });

  it('rejects refresh when the HttpOnly cookie is absent', async () => {
    const { controller } = setup(null);
    await expect(controller.refresh(request, response)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('revokes refresh state and clears all browser cookies on logout', async () => {
    const { controller, auth, sessions } = setup();
    await controller.logout(request, response);
    expect(auth.logout).toHaveBeenCalledWith({ refreshToken: 'refresh' });
    expect(sessions.clear).toHaveBeenCalledWith(response);
  });
});
