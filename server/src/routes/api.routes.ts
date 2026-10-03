import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireOrg } from '../middleware/tenant';
import { requirePermission } from '../middleware/permission';
import { asyncHandler } from '../utils/asyncHandler';
import { upload } from '../services/upload';
import * as orgs from '../controllers/organization.controller';
import * as projects from '../controllers/project.controller';
import * as tasks from '../controllers/task.controller';
import * as misc from '../controllers/misc.controller';
import {
  commentPatchSchema,
  commentSchema,
  inviteSchema,
  labelSchema,
  memberEmailSchema,
  orgSchema,
  projectPatchSchema,
  projectSchema,
  roleSchema,
  taskPatchSchema,
  taskSchema,
} from '../validators/schemas';

export const apiRoutes = Router();

apiRoutes.use(requireAuth);

apiRoutes.get('/organizations', asyncHandler(orgs.list));
apiRoutes.post('/organizations', asyncHandler(async (req, res) => {
  req.body = orgSchema.parse(req.body);
  return orgs.create(req, res);
}));

apiRoutes.post('/invites/:token/accept', asyncHandler(orgs.accept));

const org = Router();
org.use(requireOrg);

org.patch('/organization', requirePermission('organization.update'), asyncHandler(async (req, res) => {
  req.body = orgSchema.parse(req.body);
  return orgs.update(req, res);
}));
org.get('/members', requirePermission('organization.read'), asyncHandler(orgs.members));
org.post('/invites', requirePermission('member.invite'), asyncHandler(async (req, res) => {
  req.body = inviteSchema.parse(req.body);
  return orgs.invite(req, res);
}));
org.patch('/members/:memberId', requirePermission('member.update'), asyncHandler(async (req, res) => {
  req.body = roleSchema.parse(req.body);
  return orgs.changeRole(req, res);
}));
org.delete('/members/:memberId', requirePermission('member.remove'), asyncHandler(orgs.remove));
org.post('/leave', asyncHandler(orgs.leave));

org.get('/dashboard', requirePermission('organization.read'), asyncHandler(misc.dashboard));
org.get('/search', requirePermission('organization.read'), asyncHandler(misc.search));
org.get('/notifications', asyncHandler(misc.notifications));
org.post('/notifications/read-all', asyncHandler(misc.readAll));
org.post('/notifications/:id/read', asyncHandler(misc.readOne));

org.get('/projects', requirePermission('organization.read'), asyncHandler(projects.list));
org.post('/projects', requirePermission('project.create'), asyncHandler(async (req, res) => {
  req.body = projectSchema.parse(req.body);
  return projects.create(req, res);
}));
org.get('/projects/:projectId', requirePermission('organization.read'), asyncHandler(projects.getOne));
org.patch('/projects/:projectId', requirePermission('project.update'), asyncHandler(async (req, res) => {
  req.body = projectPatchSchema.parse(req.body);
  return projects.update(req, res);
}));
org.delete('/projects/:projectId', requirePermission('project.delete'), asyncHandler(projects.remove));
org.post('/projects/:projectId/members', requirePermission('project.member.add'), asyncHandler(async (req, res) => {
  req.body = memberEmailSchema.parse(req.body);
  return projects.addMember(req, res);
}));
org.delete('/projects/:projectId/members/:userId', requirePermission('project.member.add'), asyncHandler(projects.removeMember));
org.post('/projects/:projectId/labels', requirePermission('project.update'), asyncHandler(async (req, res) => {
  req.body = labelSchema.parse(req.body);
  return projects.addLabel(req, res);
}));

org.get('/projects/:projectId/tasks', requirePermission('organization.read'), asyncHandler(tasks.list));
org.post('/projects/:projectId/tasks', requirePermission('task.create'), asyncHandler(async (req, res) => {
  req.body = taskSchema.parse(req.body);
  return tasks.create(req, res);
}));
org.get('/tasks/:taskId', requirePermission('organization.read'), asyncHandler(tasks.getOne));
org.patch('/tasks/:taskId', requirePermission('task.update'), asyncHandler(async (req, res) => {
  req.body = taskPatchSchema.parse(req.body);
  return tasks.update(req, res);
}));
org.delete('/tasks/:taskId', requirePermission('task.delete'), asyncHandler(tasks.remove));

org.post('/tasks/:taskId/comments', requirePermission('comment.create'), asyncHandler(async (req, res) => {
  req.body = commentSchema.parse(req.body);
  return tasks.addComment(req, res);
}));
org.patch('/comments/:commentId', requirePermission('comment.update'), asyncHandler(async (req, res) => {
  req.body = commentPatchSchema.parse(req.body);
  return tasks.updateComment(req, res);
}));
org.delete('/comments/:commentId', requirePermission('comment.delete'), asyncHandler(tasks.removeComment));

org.post(
  '/tasks/:taskId/attachments',
  requirePermission('task.update'),
  upload.single('file'),
  asyncHandler(tasks.uploadFile),
);
org.get('/attachments/:attachmentId', requirePermission('organization.read'), asyncHandler(tasks.download));
org.delete('/attachments/:attachmentId', requirePermission('task.update'), asyncHandler(tasks.removeFile));

apiRoutes.use(org);
