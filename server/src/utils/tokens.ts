import { createHash, randomBytes } from 'crypto';

export function newToken() {
  return randomBytes(32).toString('hex');
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function slugify(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${base || 'org'}-${randomBytes(2).toString('hex')}`;
}

export function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function readCookie(header: string | undefined, name: string) {
  if (!header) return '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return '';
}
