import { ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';

export const ACCESS_COOKIE = 'genko_access';
export const REFRESH_COOKIE = 'genko_refresh';
export const CSRF_COOKIE = 'genko_csrf';
export const CSRF_HEADER = 'x-csrf-token';

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.cookie;
  if (!header) return null;

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    if (key !== name) continue;
    const value = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return null;
    }
  }
  return null;
}

/** Double-submit protection for every unsafe request authenticated by cookies. */
export function assertBrowserCsrf(request: Request): void {
  const cookie = readCookie(request, CSRF_COOKIE);
  const rawHeader = request.headers[CSRF_HEADER];
  const header = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
  if (!cookie || !header || cookie !== header) {
    throw new ForbiddenException('Invalid or missing CSRF token');
  }
}

export function isSafeMethod(method: string): boolean {
  return method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
}
