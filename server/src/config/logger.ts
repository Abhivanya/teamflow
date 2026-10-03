import pino from 'pino';
import { env } from './env';

export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : 'info',
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'password',
      'passwordHash',
      'token',
      'accessToken',
      'refreshToken',
    ],
    censor: '[redacted]',
  },
});
