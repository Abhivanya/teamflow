import type { Request, Response } from 'express';
import * as auth from '../services/auth.service';
import { clearAuthCookies, setAuthCookies } from '../utils/cookies';

function agent(req: Request) {
  return req.get('user-agent') || '';
}

export async function register(req: Request, res: Response) {
  const result = await auth.register(req.body, agent(req));
  setAuthCookies(res, result.tokens);
  res.status(201).json({ data: result.user });
}

export async function login(req: Request, res: Response) {
  const result = await auth.login(req.body.email, req.body.password, agent(req));
  setAuthCookies(res, result.tokens);
  res.json({ data: result.user });
}

export async function refresh(req: Request, res: Response) {
  const result = await auth.refreshSession(req.cookies?.refreshToken || '', agent(req));
  setAuthCookies(res, result.tokens);
  res.json({ data: result.user });
}

export async function logout(req: Request, res: Response) {
  await auth.logout(req.cookies?.refreshToken);
  clearAuthCookies(res);
  res.json({ data: { ok: true } });
}

export async function logoutAll(req: Request, res: Response) {
  await auth.logoutAll(req.user!.id);
  clearAuthCookies(res);
  res.json({ data: { ok: true } });
}

export async function me(req: Request, res: Response) {
  res.json({ data: await auth.getMe(req.user!.id) });
}

export async function updateMe(req: Request, res: Response) {
  res.json({ data: await auth.updateProfile(req.user!.id, req.body.name) });
}

export async function sessions(req: Request, res: Response) {
  res.json({ data: await auth.listSessions(req.user!.id) });
}

export async function resend(req: Request, res: Response) {
  await auth.resendVerification(req.user!.id);
  res.json({ data: { ok: true } });
}

export async function verify(req: Request, res: Response) {
  await auth.verifyEmail(req.body.token);
  res.json({ data: { ok: true } });
}

export async function forgot(req: Request, res: Response) {
  await auth.forgotPassword(req.body.email);
  res.json({ data: { ok: true } });
}

export async function reset(req: Request, res: Response) {
  await auth.resetPassword(req.body.token, req.body.password);
  res.json({ data: { ok: true } });
}
