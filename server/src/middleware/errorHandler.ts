import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import { logger } from '../config/logger';
import { ApiError } from '../utils/errors';

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: { message: 'Invalid input', details: err.flatten() },
    });
    return;
  }

  if (err instanceof Error && err.message === 'File type is not allowed') {
    res.status(400).json({ error: { message: err.message } });
    return;
  }

  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'File is larger than 5MB' : err.message;
    res.status(400).json({ error: { message } });
    return;
  }

  if (err instanceof Error && err.name === 'CastError') {
    res.status(400).json({ error: { message: 'Invalid id' } });
    return;
  }

  const status = err instanceof ApiError ? err.status : 500;
  if (status >= 500) {
    logger.error({ err, requestId: req.requestId }, 'request failed');
  }

  const message = status >= 500 ? 'Something went wrong' : err instanceof Error ? err.message : 'Request failed';
  const body: { error: { message: string; details?: unknown } } = { error: { message } };
  if (err instanceof ApiError && err.details) body.error.details = err.details;
  res.status(status).json(body);
}
