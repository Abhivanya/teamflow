import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/errors';

// Cookie auth plus a custom header forces a CORS preflight, so a random
// site cannot submit a form that uses the browser's cookies.
export function requireClientHeader(req: Request, _res: Response, next: NextFunction) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  if (req.path === '/api/health') return next();
  if (req.get('x-teamflow-client') !== 'web') {
    return next(new ApiError(403, 'Missing client header'));
  }
  next();
}
