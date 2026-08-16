import { ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { assertBrowserCsrf, readCookie } from './browser-cookie';

function request(cookie = '', csrf?: string): Request {
  return {
    headers: {
      cookie,
      ...(csrf === undefined ? {} : { 'x-csrf-token': csrf }),
    },
  } as Request;
}

describe('browser cookie authentication helpers', () => {
  it('reads an encoded cookie without confusing similarly named cookies', () => {
    const req = request('genko_access_old=no; genko_access=a%2Eb%2Ec; theme=dark');
    expect(readCookie(req, 'genko_access')).toBe('a.b.c');
    expect(readCookie(req, 'missing')).toBeNull();
  });

  it('accepts only matching cookie and header CSRF values', () => {
    expect(() => assertBrowserCsrf(request('genko_csrf=proof', 'proof'))).not.toThrow();
    expect(() => assertBrowserCsrf(request('genko_csrf=proof', 'other'))).toThrow(
      ForbiddenException,
    );
    expect(() => assertBrowserCsrf(request('genko_csrf=proof'))).toThrow(ForbiddenException);
  });
});
