import fs from 'fs';
import path from 'path';
import { Attachment } from '../models/Attachment';
import { Task } from '../models/Task';
import type { Role } from '../permissions/permissions';
import { ApiError } from '../utils/errors';
import { recordActivity } from './activity.service';
import { assertProjectAccess } from './project.service';
import { uploadDir } from './upload';

type Actor = { id: string; name: string; role: Role };

export async function saveAttachment(
  orgId: string,
  taskId: string,
  actor: Actor,
  file: Express.Multer.File,
) {
  const task = await Task.findOne({ _id: taskId, organizationId: orgId, deletedAt: null });
  if (!task) {
    fs.unlink(file.path, () => undefined);
    throw new ApiError(404, 'Task not found');
  }
  try {
    await assertProjectAccess(orgId, String(task.projectId), actor.id, actor.role);
  } catch (error) {
    fs.unlink(file.path, () => undefined);
    throw error;
  }

  const attachment = await Attachment.create({
    organizationId: orgId,
    taskId,
    uploadedBy: actor.id,
    originalName: path.basename(file.originalname).slice(0, 180),
    storedName: file.filename,
    mimeType: file.mimetype,
    size: file.size,
  });

  await recordActivity({
    organizationId: orgId,
    projectId: String(task.projectId),
    taskId,
    actorId: actor.id,
    actorName: actor.name,
    type: 'attachment.added',
    text: `${actor.name} attached ${attachment.originalName}`,
  });

  return {
    id: attachment.id,
    originalName: attachment.originalName,
    mimeType: attachment.mimeType,
    size: attachment.size,
    createdAt: attachment.createdAt,
  };
}

export async function getAttachmentFile(orgId: string, attachmentId: string, userId: string, role: Role) {
  const file = await Attachment.findOne({ _id: attachmentId, organizationId: orgId });
  if (!file) throw new ApiError(404, 'File not found');
  const task = await Task.findOne({ _id: file.taskId, organizationId: orgId });
  if (!task) throw new ApiError(404, 'File not found');
  await assertProjectAccess(orgId, String(task.projectId), userId, role);

  if (file.storedName.includes('..') || file.storedName.includes('/') || file.storedName.includes('\\')) {
    throw new ApiError(400, 'Bad file name');
  }

  const fullPath = path.join(uploadDir(), file.storedName);
  if (!fs.existsSync(fullPath)) throw new ApiError(404, 'File not found');
  return { fullPath, originalName: file.originalName };
}

export async function deleteAttachment(orgId: string, attachmentId: string, actor: Actor) {
  const file = await Attachment.findOne({ _id: attachmentId, organizationId: orgId });
  if (!file) throw new ApiError(404, 'File not found');
  const task = await Task.findOne({ _id: file.taskId, organizationId: orgId, deletedAt: null });
  if (!task) throw new ApiError(404, 'File not found');
  await assertProjectAccess(orgId, String(task.projectId), actor.id, actor.role);

  const isOwner = String(file.uploadedBy) === actor.id;
  const canModerate = actor.role === 'OWNER' || actor.role === 'ADMIN' || actor.role === 'MANAGER';
  if (!isOwner && !canModerate) throw new ApiError(403, 'You cannot delete this file');

  const fullPath = path.join(uploadDir(), file.storedName);
  fs.unlink(fullPath, () => undefined);
  await file.deleteOne();
}
