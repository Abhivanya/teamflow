import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authRateLimit } from '../middleware/rateLimit';
import { requireAuth } from '../middleware/auth';
import * as auth from '../controllers/auth.controller';
import {
  emailOnlySchema,
  loginSchema,
  profileSchema,
  registerSchema,
  resetSchema,
  tokenSchema,
} from '../validators/schemas';

export const authRoutes = Router();

authRoutes.post('/register', authRateLimit, asyncHandler(async (req, res) => {
  req.body = registerSchema.parse(req.body);
  return auth.register(req, res);
}));

authRoutes.post('/login', authRateLimit, asyncHandler(async (req, res) => {
  req.body = loginSchema.parse(req.body);
  return auth.login(req, res);
}));

authRoutes.post('/refresh', asyncHandler(auth.refresh));
authRoutes.post('/logout', asyncHandler(auth.logout));
authRoutes.post('/forgot-password', authRateLimit, asyncHandler(async (req, res) => {
  req.body = emailOnlySchema.parse(req.body);
  return auth.forgot(req, res);
}));
authRoutes.post('/reset-password', asyncHandler(async (req, res) => {
  req.body = resetSchema.parse(req.body);
  return auth.reset(req, res);
}));
authRoutes.post('/verify-email', asyncHandler(async (req, res) => {
  req.body = tokenSchema.parse(req.body);
  return auth.verify(req, res);
}));

authRoutes.get('/me', requireAuth, asyncHandler(auth.me));
authRoutes.patch('/me', requireAuth, asyncHandler(async (req, res) => {
  req.body = profileSchema.parse(req.body);
  return auth.updateMe(req, res);
}));
authRoutes.get('/sessions', requireAuth, asyncHandler(auth.sessions));
authRoutes.post('/logout-all', requireAuth, asyncHandler(auth.logoutAll));
authRoutes.post('/resend-verification', requireAuth, asyncHandler(auth.resend));
