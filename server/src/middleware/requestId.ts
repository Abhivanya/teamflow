import { randomBytes } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

export function requestId(req: Request, res: Response, next: NextFunction) {
  const incoming = req.get('x-request-id');
  const id = incoming && incoming.length < 80 ? incoming : randomBytes(8).toString('hex');
  req.requestId = id;
  res.setHeader('x-request-id', id);
  next();
}
