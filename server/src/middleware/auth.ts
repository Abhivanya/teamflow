import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { User } from '../models/User';
import { ApiError } from '../utils/errors';

export function readUserId(token: string, secret: string) {
  const payload = jwt.verify(token, secret);
  if (typeof payload === 'string' || !payload.sub) {
    throw new ApiError(401, 'Login required');
  }
  return payload.sub;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.get('authorization');
    const bearer = header?.startsWith('Bearer ') ? header.slice(7) : '';
    const token = req.cookies?.accessToken || bearer;
    if (!token) throw new ApiError(401, 'Login required');

    const userId = readUserId(token, env.JWT_ACCESS_SECRET);
    const user = await User.findById(userId).select('name email');
    if (!user) throw new ApiError(401, 'Login required');

    req.user = { id: user.id, name: user.name, email: user.email };
    next();
  } catch (error) {
    if (error instanceof ApiError) return next(error);
    next(new ApiError(401, 'Login required'));
  }
}
