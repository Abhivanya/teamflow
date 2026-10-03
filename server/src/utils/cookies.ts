import type { Response } from 'express';
import { env } from '../config/env';

const base = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: env.CLIENT_URL.startsWith('https'),
  path: '/',
};

export function setAuthCookies(res: Response, tokens: { accessToken: string; refreshToken: string }) {
  res.cookie('accessToken', tokens.accessToken, { ...base, maxAge: 15 * 60 * 1000 });
  res.cookie('refreshToken', tokens.refreshToken, { ...base, maxAge: 7 * 24 * 60 * 60 * 1000 });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/' });
}
