import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../config/logger';

export type EmailPayload = {
  to: string;
  subject: string;
  text: string;
};

export async function deliverEmail(payload: EmailPayload) {
  if (!env.SMTP_HOST) {
    if (env.NODE_ENV === 'development') {
      logger.info({ to: payload.to, subject: payload.subject, text: payload.text }, 'email (no smtp)');
    } else if (env.NODE_ENV !== 'test') {
      logger.warn({ to: payload.to, subject: payload.subject }, 'email skipped, smtp is not configured');
    }
    return;
  }

  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ?? 587,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });

  await transport.sendMail({
    from: env.SMTP_FROM,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
  });
}
