import { Types } from 'mongoose';

export function idOf(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value instanceof Types.ObjectId) return String(value);
  if (typeof value === 'object' && value && '_id' in value) {
    return String((value as { _id: unknown })._id);
  }
  return String(value);
}

export function person(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  if (value instanceof Types.ObjectId) return { id: String(value), name: '' };
  if (!('_id' in value)) return null;
  const row = value as { _id: unknown; name?: string; email?: string };
  return { id: String(row._id), name: row.name ?? '', email: row.email };
}
