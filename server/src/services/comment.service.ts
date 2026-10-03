import { OrganizationMember } from '../models/OrganizationMember';
import { Task } from '../models/Task';
import { Comment } from '../models/Comment';
import type { Role } from '../permissions/permissions';
import { ApiError } from '../utils/errors';
import { person } from '../utils/serialize';
import { recordActivity } from './activity.service';
import { createNotification } from './notification.service';
import { assertProjectAccess } from './project.service';

type Actor = { id: string; name: string; role: Role };

async function loadTask(orgId: string, taskId: string, actor: Actor) {
  const task = await Task.findOne({ _id: taskId, organizationId: orgId, deletedAt: null });
  if (!task) throw new ApiError(404, 'Task not found');
  await assertProjectAccess(orgId, String(task.projectId), actor.id, actor.role);
  return task;
}

async function notifyMentions(orgId: string, actor: Actor, taskId: string, projectId: string, title: string, body: string) {
  const tokens = new Set((body.match(/@([a-zA-Z0-9._-]+)/g) ?? []).map((token) => token.slice(1).toLowerCase()));
  if (!tokens.size) return;

  const members = await OrganizationMember.find({ organizationId: orgId }).populate('userId', 'name email');
  for (const member of members) {
    const user = member.userId as unknown as { _id: unknown; name: string; email: string };
    const userId = String(user._id);
    if (userId === actor.id) continue;
    const local = user.email.split('@')[0].toLowerCase();
    const first = user.name.split(' ')[0].toLowerCase();
    if (!tokens.has(local) && !tokens.has(first)) continue;
    await createNotification({
      userId,
      organizationId: orgId,
      type: 'mention',
      title: 'You were mentioned',
      body: `${actor.name} mentioned you on "${title}"`,
      link: `/projects/${projectId}?task=${taskId}`,
    });
  }
}

export async function addComment(
  orgId: string,
  taskId: string,
  actor: Actor,
  body: string,
  parentId?: string | null,
) {
  const task = await loadTask(orgId, taskId, actor);
  if (parentId) {
    const parent = await Comment.findOne({ _id: parentId, taskId, organizationId: orgId });
    if (!parent) throw new ApiError(404, 'Comment not found');
  }

  const comment = await Comment.create({
    organizationId: orgId,
    taskId,
    authorId: actor.id,
    body: body.trim(),
    parentId: parentId || null,
  });

  await recordActivity({
    organizationId: orgId,
    projectId: String(task.projectId),
    taskId,
    actorId: actor.id,
    actorName: actor.name,
    type: 'comment.created',
    text: `${actor.name} commented on "${task.title}"`,
  });

  const recipients = new Set<string>();
  if (task.assigneeId) recipients.add(String(task.assigneeId));
  recipients.add(String(task.reporterId));
  recipients.delete(actor.id);

  for (const userId of recipients) {
    await createNotification({
      userId,
      organizationId: orgId,
      type: 'comment',
      title: 'New comment',
      body: `${actor.name} commented on "${task.title}"`,
      link: `/projects/${task.projectId}?task=${taskId}`,
    });
  }

  await notifyMentions(orgId, actor, taskId, String(task.projectId), task.title, body);

  const populated = await comment.populate('authorId', 'name email');
  return {
    id: populated.id,
    body: populated.body,
    parentId: populated.parentId ? String(populated.parentId) : null,
    createdAt: populated.createdAt,
    updatedAt: populated.updatedAt,
    author: person(populated.authorId),
  };
}

export async function updateComment(orgId: string, commentId: string, actor: Actor, body: string) {
  const comment = await Comment.findOne({ _id: commentId, organizationId: orgId });
  if (!comment) throw new ApiError(404, 'Comment not found');
  await loadTask(orgId, String(comment.taskId), actor);

  const isAuthor = String(comment.authorId) === actor.id;
  const isAdmin = actor.role === 'OWNER' || actor.role === 'ADMIN';
  if (!isAuthor && !isAdmin) throw new ApiError(403, 'You can only edit your own comments');

  comment.body = body.trim();
  await comment.save();
  return { id: comment.id, body: comment.body, updatedAt: comment.updatedAt };
}

export async function deleteComment(orgId: string, commentId: string, actor: Actor) {
  const comment = await Comment.findOne({ _id: commentId, organizationId: orgId });
  if (!comment) throw new ApiError(404, 'Comment not found');
  await loadTask(orgId, String(comment.taskId), actor);

  const isAuthor = String(comment.authorId) === actor.id;
  const canModerate = actor.role === 'OWNER' || actor.role === 'ADMIN' || actor.role === 'MANAGER';
  if (!isAuthor && !canModerate) throw new ApiError(403, 'You cannot delete this comment');
  await comment.deleteOne();
}
