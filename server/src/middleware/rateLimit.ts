import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { hitRateLimit } from '../config/redis';
import { ApiError } from '../utils/errors';

export function authRateLimit(req: Request, _res: Response, next: NextFunction) {
  if (env.NODE_ENV === 'test') return next();

  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  hitRateLimit(`auth:${ip}`, 20, 15 * 60)
    .then((allowed) => {
      if (!allowed) return next(new ApiError(429, 'Too many attempts. Try again in a few minutes.'));
      next();
    })
    .catch(next);
}
