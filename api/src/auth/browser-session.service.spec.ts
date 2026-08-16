import type { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { BrowserSessionService } from './browser-session.service';

function setup(nodeEnv = 'test') {
  const config = {
    get: jest.fn((key: string, fallback?: string) => {
      if (key === 'NODE_ENV') return nodeEnv;
      if (key === 'JWT_REFRESH_TTL') return '7d';
      return fallback;
    }),
  } as unknown as ConfigService;
  const response = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  } as unknown as Response;
  return { service: new BrowserSessionService(config), response };
}

describe('BrowserSessionService', () => {
  it('sets HttpOnly auth cookies plus a readable same-site CSRF cookie', () => {
    const { service, response } = setup('production');
    service.establish(response, {
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresIn: 900,
    });

    expect(response.cookie).toHaveBeenCalledWith(
      'genko_access',
      'access',
      expect.objectContaining({ httpOnly: true, secure: true, sameSite: 'strict', maxAge: 900_000 }),
    );
    expect(response.cookie).toHaveBeenCalledWith(
      'genko_refresh',
      'refresh',
      expect.objectContaining({ httpOnly: true, maxAge: 604_800_000 }),
    );
    expect(response.cookie).toHaveBeenCalledWith(
      'genko_csrf',
      expect.stringMatching(/^[A-Za-z0-9_-]{40,}$/),
      expect.objectContaining({ httpOnly: false, sameSite: 'strict' }),
    );
  });

  it('clears every cookie with the same production attributes', () => {
    const { service, response } = setup('production');
    service.clear(response);
    expect(response.clearCookie).toHaveBeenCalledTimes(3);
    expect(response.clearCookie).toHaveBeenCalledWith(
      'genko_refresh',
      expect.objectContaining({ httpOnly: true, secure: true, path: '/' }),
    );
  });
});
