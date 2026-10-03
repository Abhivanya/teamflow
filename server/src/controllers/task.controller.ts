import type { Request, Response } from 'express';
import * as comments from '../services/comment.service';
import * as tasks from '../services/task.service';
import * as files from '../services/attachment.service';
import { routeParam } from '../utils/routeParam';

function actor(req: Request) {
  return { id: req.user!.id, name: req.user!.name, role: req.role! };
}

export async function list(req: Request, res: Response) {
  const result = await tasks.listTasks(req.orgId!, routeParam(req.params.projectId), actor(req), {
    q: typeof req.query.q === 'string' ? req.query.q : undefined,
    status: typeof req.query.status === 'string' ? req.query.status : undefined,
    priority: typeof req.query.priority === 'string' ? req.query.priority : undefined,
    assigneeId: typeof req.query.assigneeId === 'string' ? req.query.assigneeId : undefined,
    page: req.query.page,
    limit: req.query.limit,
  });
  res.json({ data: result.items, meta: result.meta });
}

export async function create(req: Request, res: Response) {
  const task = await tasks.createTask(req.orgId!, routeParam(req.params.projectId), actor(req), req.body);
  res.status(201).json({ data: task });
}

export async function getOne(req: Request, res: Response) {
  res.json({ data: await tasks.getTask(req.orgId!, routeParam(req.params.taskId), actor(req)) });
}

export async function update(req: Request, res: Response) {
  res.json({ data: await tasks.updateTask(req.orgId!, routeParam(req.params.taskId), actor(req), req.body) });
}

export async function remove(req: Request, res: Response) {
  await tasks.deleteTask(req.orgId!, routeParam(req.params.taskId), actor(req));
  res.json({ data: { ok: true } });
}

export async function addComment(req: Request, res: Response) {
  const comment = await comments.addComment(
    req.orgId!,
    routeParam(req.params.taskId),
    actor(req),
    req.body.body,
    req.body.parentId,
  );
  res.status(201).json({ data: comment });
}

export async function updateComment(req: Request, res: Response) {
  res.json({
    data: await comments.updateComment(req.orgId!, routeParam(req.params.commentId), actor(req), req.body.body),
  });
}

export async function removeComment(req: Request, res: Response) {
  await comments.deleteComment(req.orgId!, routeParam(req.params.commentId), actor(req));
  res.json({ data: { ok: true } });
}

export async function uploadFile(req: Request, res: Response) {
  if (!req.file) {
    res.status(400).json({ error: { message: 'Choose a file' } });
    return;
  }
  const file = await files.saveAttachment(req.orgId!, routeParam(req.params.taskId), actor(req), req.file);
  res.status(201).json({ data: file });
}

export async function download(req: Request, res: Response) {
  const file = await files.getAttachmentFile(
    req.orgId!,
    routeParam(req.params.attachmentId),
    req.user!.id,
    req.role!,
  );
  res.download(file.fullPath, file.originalName);
}

export async function removeFile(req: Request, res: Response) {
  await files.deleteAttachment(req.orgId!, routeParam(req.params.attachmentId), actor(req));
  res.json({ data: { ok: true } });
}
