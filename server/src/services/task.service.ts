import { Types } from 'mongoose';
import { cacheDel } from '../config/redis';
import { Activity } from '../models/Activity';
import { Attachment } from '../models/Attachment';
import { Comment } from '../models/Comment';
import { OrganizationMember } from '../models/OrganizationMember';
import { Task, type TASK_STATUSES } from '../models/Task';
import type { Role } from '../permissions/permissions';
import { ApiError } from '../utils/errors';
import { pageMeta, readPage } from '../utils/pagination';
import { person } from '../utils/serialize';
import { escapeRegex } from '../utils/tokens';
import { recordActivity } from './activity.service';
import { createNotification } from './notification.service';
import { assertProjectAccess } from './project.service';

type Actor = { id: string; name: string; role: Role };
type Status = (typeof TASK_STATUSES)[number];

const STATUS_LABEL: Record<Status, string> = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  IN_REVIEW: 'In review',
  DONE: 'Done',
};

function serializeTask(task: {
  id: string;
  projectId: unknown;
  title: string;
  description?: string;
  status: string;
  priority: string;
  assigneeId?: unknown;
  reporterId?: unknown;
  dueDate?: unknown;
  labels?: string[];
  position: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}) {
  return {
    id: task.id,
    projectId: String(task.projectId),
    title: task.title,
    description: task.description ?? '',
    status: task.status,
    priority: task.priority,
    assignee: person(task.assigneeId),
    reporter: person(task.reporterId),
    dueDate: task.dueDate ?? null,
    labels: task.labels ?? [],
    position: task.position,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

async function loadTask(orgId: string, taskId: string) {
  if (!Types.ObjectId.isValid(taskId)) throw new ApiError(400, 'Invalid id');
  const task = await Task.findOne({ _id: taskId, organizationId: orgId, deletedAt: null })
    .populate('assigneeId', 'name email')
    .populate('reporterId', 'name email');
  if (!task) throw new ApiError(404, 'Task not found');
  return task;
}

async function assertAssignee(orgId: string, assigneeId: string | null) {
  if (!assigneeId) return;
  if (!Types.ObjectId.isValid(assigneeId)) throw new ApiError(400, 'Invalid assignee');
  const member = await OrganizationMember.exists({ organizationId: orgId, userId: assigneeId });
  if (!member) throw new ApiError(400, 'Assignee is not in this organization');
}

export async function listTasks(
  orgId: string,
  projectId: string,
  actor: Actor,
  query: {
    q?: string;
    status?: string;
    priority?: string;
    assigneeId?: string;
    page?: unknown;
    limit?: unknown;
  },
) {
  await assertProjectAccess(orgId, projectId, actor.id, actor.role);
  const { page, limit, skip } = readPage(query, 100);
  const filter: Record<string, unknown> = { organizationId: orgId, projectId, deletedAt: null };
  if (query.status) filter.status = query.status;
  if (query.priority) filter.priority = query.priority;
  if (query.assigneeId) filter.assigneeId = query.assigneeId;
  if (query.q) filter.title = { $regex: escapeRegex(query.q), $options: 'i' };

  const [rows, total] = await Promise.all([
    Task.find(filter)
      .populate('assigneeId', 'name email')
      .populate('reporterId', 'name email')
      .sort({ position: 1, createdAt: 1 })
      .skip(skip)
      .limit(limit),
    Task.countDocuments(filter),
  ]);

  return { items: rows.map((row) => serializeTask(row)), meta: pageMeta(page, limit, total) };
}

export async function createTask(
  orgId: string,
  projectId: string,
  actor: Actor,
  input: {
    title: string;
    description?: string;
    status?: Status;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    assigneeId?: string | null;
    dueDate?: string | null;
    labels?: string[];
  },
) {
  await assertProjectAccess(orgId, projectId, actor.id, actor.role);
  const status = input.status ?? 'TODO';
  await assertAssignee(orgId, input.assigneeId ?? null);

  const last = await Task.findOne({ organizationId: orgId, projectId, status, deletedAt: null }).sort({
    position: -1,
  });

  const task = await Task.create({
    organizationId: orgId,
    projectId,
    title: input.title.trim(),
    description: input.description?.trim() ?? '',
    status,
    priority: input.priority ?? 'MEDIUM',
    assigneeId: input.assigneeId || null,
    reporterId: actor.id,
    dueDate: input.dueDate ? new Date(input.dueDate) : null,
    labels: input.labels ?? [],
    position: (last?.position ?? 0) + 1024,
  });

  await recordActivity({
    organizationId: orgId,
    projectId,
    taskId: task.id,
    actorId: actor.id,
    actorName: actor.name,
    type: 'task.created',
    text: `${actor.name} created "${task.title}"`,
  });

  if (input.assigneeId && input.assigneeId !== actor.id) {
    await createNotification({
      userId: input.assigneeId,
      organizationId: orgId,
      type: 'assignment',
      title: 'Task assigned to you',
      body: `${actor.name} assigned you "${task.title}"`,
      link: `/projects/${projectId}?task=${task.id}`,
    });
  }

  await cacheDel(`dash:${orgId}`);
  const fresh = await loadTask(orgId, task.id);
  return serializeTask(fresh);
}

export async function getTask(orgId: string, taskId: string, actor: Actor) {
  const task = await loadTask(orgId, taskId);
  await assertProjectAccess(orgId, String(task.projectId), actor.id, actor.role);

  const [comments, activity, attachments] = await Promise.all([
    Comment.find({ taskId, organizationId: orgId }).populate('authorId', 'name email').sort({ createdAt: 1 }),
    Activity.find({ taskId, organizationId: orgId }).sort({ createdAt: -1 }).limit(40),
    Attachment.find({ taskId, organizationId: orgId }).sort({ createdAt: -1 }),
  ]);

  return {
    ...serializeTask(task),
    comments: comments.map((comment) => ({
      id: comment.id,
      body: comment.body,
      parentId: comment.parentId ? String(comment.parentId) : null,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      author: person(comment.authorId),
    })),
    activity: activity.map((item) => ({
      id: item.id,
      type: item.type,
      text: item.text,
      actorName: item.actorName,
      createdAt: item.createdAt,
    })),
    attachments: attachments.map((file) => ({
      id: file.id,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
      createdAt: file.createdAt,
    })),
  };
}

export async function updateTask(
  orgId: string,
  taskId: string,
  actor: Actor,
  input: {
    title?: string;
    description?: string;
    status?: Status;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    assigneeId?: string | null;
    dueDate?: string | null;
    labels?: string[];
    position?: number;
    updatedAt?: string;
  },
) {
  const task = await loadTask(orgId, taskId);
  await assertProjectAccess(orgId, String(task.projectId), actor.id, actor.role);

  if (input.updatedAt && new Date(input.updatedAt).getTime() !== task.updatedAt.getTime()) {
    throw new ApiError(409, 'This task was updated by someone else. Refresh and try again.');
  }

  const previousStatus = task.status;
  const previousAssignee = task.assigneeId ? String((task.assigneeId as { _id?: unknown })._id ?? task.assigneeId) : null;
  const previousPriority = task.priority;

  if (input.title) task.title = input.title.trim();
  if (input.description !== undefined) task.description = input.description;
  if (input.status) task.status = input.status;
  if (input.priority) task.priority = input.priority;
  if (input.labels) task.labels = input.labels;
  if (typeof input.position === 'number') task.position = input.position;
  if (input.dueDate !== undefined) {
    task.dueDate = input.dueDate ? new Date(input.dueDate) : null;
    task.dueReminderSent = false;
  }
  if (input.assigneeId !== undefined) {
    await assertAssignee(orgId, input.assigneeId);
    task.assigneeId = input.assigneeId ? new Types.ObjectId(input.assigneeId) : null;
  }

  if (input.status && input.status !== previousStatus) {
    const last = await Task.findOne({
      organizationId: orgId,
      projectId: task.projectId,
      status: input.status,
      deletedAt: null,
      _id: { $ne: task._id },
    }).sort({ position: -1 });
    if (typeof input.position !== 'number') task.position = (last?.position ?? 0) + 1024;
  }

  await task.save();

  const projectId = String(task.projectId);
  if (input.status && input.status !== previousStatus) {
    await recordActivity({
      organizationId: orgId,
      projectId,
      taskId: task.id,
      actorId: actor.id,
      actorName: actor.name,
      type: 'task.status',
      text: `${actor.name} moved "${task.title}" to ${STATUS_LABEL[input.status]}`,
    });
    const assignee = task.assigneeId ? String((task.assigneeId as { _id?: unknown })._id ?? task.assigneeId) : '';
    if (assignee && assignee !== actor.id) {
      await createNotification({
        userId: assignee,
        organizationId: orgId,
        type: 'status',
        title: 'Task status changed',
        body: `${actor.name} moved "${task.title}" to ${STATUS_LABEL[input.status]}`,
        link: `/projects/${projectId}?task=${task.id}`,
      });
    }
  } else if (input.priority && input.priority !== previousPriority) {
    await recordActivity({
      organizationId: orgId,
      projectId,
      taskId: task.id,
      actorId: actor.id,
      actorName: actor.name,
      type: 'task.priority',
      text: `${actor.name} set "${task.title}" to ${input.priority.toLowerCase()} priority`,
    });
  } else if (input.assigneeId !== undefined && input.assigneeId !== previousAssignee) {
    await recordActivity({
      organizationId: orgId,
      projectId,
      taskId: task.id,
      actorId: actor.id,
      actorName: actor.name,
      type: 'task.assigned',
      text: `${actor.name} changed the assignee on "${task.title}"`,
    });
    if (input.assigneeId && input.assigneeId !== actor.id) {
      await createNotification({
        userId: input.assigneeId,
        organizationId: orgId,
        type: 'assignment',
        title: 'Task assigned to you',
        body: `${actor.name} assigned you "${task.title}"`,
        link: `/projects/${projectId}?task=${task.id}`,
      });
    }
  } else {
    await recordActivity({
      organizationId: orgId,
      projectId,
      taskId: task.id,
      actorId: actor.id,
      actorName: actor.name,
      type: 'task.updated',
      text: `${actor.name} updated "${task.title}"`,
    });
  }

  await cacheDel(`dash:${orgId}`);
  const fresh = await loadTask(orgId, task.id);
  return serializeTask(fresh);
}

export async function deleteTask(orgId: string, taskId: string, actor: Actor) {
  const task = await loadTask(orgId, taskId);
  await assertProjectAccess(orgId, String(task.projectId), actor.id, actor.role);
  task.deletedAt = new Date();
  await task.save();
  await recordActivity({
    organizationId: orgId,
    projectId: String(task.projectId),
    taskId: task.id,
    actorId: actor.id,
    actorName: actor.name,
    type: 'task.deleted',
    text: `${actor.name} deleted "${task.title}"`,
  });
  await cacheDel(`dash:${orgId}`);
}
