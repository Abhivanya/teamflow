import { Notification } from '../models/Notification';
import { emitToUser } from '../sockets/io';
import { ApiError } from '../utils/errors';
import { pageMeta, readPage } from '../utils/pagination';

type Input = {
  userId: string;
  organizationId: string;
  type: string;
  title: string;
  body: string;
  link?: string;
};

export async function createNotification(input: Input) {
  if (!input.userId) return null;
  const doc = await Notification.create({ ...input, link: input.link ?? '', read: false });
  emitToUser(input.userId, 'notification:new', { id: doc.id });
  return doc;
}

export async function listNotifications(userId: string, query: { page?: unknown; limit?: unknown; unread?: unknown }) {
  const { page, limit, skip } = readPage(query, 20);
  const filter: { userId: string; read?: boolean } = { userId };
  if (query.unread === '1' || query.unread === 'true') filter.read = false;

  const [rows, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ userId, read: false }),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      organizationId: String(row.organizationId),
      type: row.type,
      title: row.title,
      body: row.body,
      link: row.link,
      read: row.read,
      createdAt: row.createdAt,
    })),
    unread,
    meta: pageMeta(page, limit, total),
  };
}

export async function markRead(userId: string, notificationId: string) {
  const row = await Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { read: true },
    { new: true },
  );
  if (!row) throw new ApiError(404, 'Notification not found');
  return { id: row.id, read: true };
}

export async function markAllRead(userId: string) {
  await Notification.updateMany({ userId, read: false }, { read: true });
}
