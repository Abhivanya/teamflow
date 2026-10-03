import { Types } from 'mongoose';
import { cacheDel } from '../config/redis';
import { Label } from '../models/Label';
import { OrganizationMember } from '../models/OrganizationMember';
import { Project } from '../models/Project';
import { ProjectMember } from '../models/ProjectMember';
import { User } from '../models/User';
import type { Role } from '../permissions/permissions';
import { ApiError } from '../utils/errors';
import { pageMeta, readPage } from '../utils/pagination';
import { escapeRegex } from '../utils/tokens';
import { recordActivity } from './activity.service';

type Actor = { id: string; name: string; role: Role };

function serializeProject(project: {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  startDate?: unknown;
  dueDate?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}) {
  return {
    id: project.id,
    name: project.name,
    description: project.description ?? '',
    status: project.status,
    startDate: project.startDate ?? null,
    dueDate: project.dueDate ?? null,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

async function visibleProjectIds(orgId: string, userId: string, role: Role) {
  if (role === 'OWNER' || role === 'ADMIN') return null;
  const rows = await ProjectMember.find({ organizationId: orgId, userId }).select('projectId');
  return rows.map((row) => row.projectId);
}

export async function assertProjectAccess(orgId: string, projectId: string, userId: string, role: Role) {
  if (!Types.ObjectId.isValid(projectId)) throw new ApiError(400, 'Invalid id');
  const project = await Project.findOne({ _id: projectId, organizationId: orgId, deletedAt: null });
  if (!project) throw new ApiError(404, 'Project not found');
  if (role === 'OWNER' || role === 'ADMIN') return project;

  const member = await ProjectMember.exists({ projectId, userId, organizationId: orgId });
  if (!member) throw new ApiError(403, 'You do not have access to this project');
  return project;
}

export async function createProject(
  orgId: string,
  actor: Actor,
  input: { name: string; description?: string; startDate?: string | null; dueDate?: string | null },
) {
  const project = await Project.create({
    organizationId: orgId,
    name: input.name.trim(),
    description: input.description?.trim() ?? '',
    startDate: input.startDate ? new Date(input.startDate) : null,
    dueDate: input.dueDate ? new Date(input.dueDate) : null,
    createdBy: actor.id,
    status: 'active',
  });
  await ProjectMember.create({ organizationId: orgId, projectId: project._id, userId: actor.id });
  await recordActivity({
    organizationId: orgId,
    projectId: project.id,
    actorId: actor.id,
    actorName: actor.name,
    type: 'project.created',
    text: `${actor.name} created project "${project.name}"`,
  });
  await cacheDel(`dash:${orgId}`);
  return serializeProject(project);
}

export async function listProjects(
  orgId: string,
  userId: string,
  role: Role,
  query: { q?: string; status?: string; page?: unknown; limit?: unknown },
) {
  const { page, limit, skip } = readPage(query, 20);
  const filter: Record<string, unknown> = { organizationId: orgId, deletedAt: null };

  if (query.status === 'active' || query.status === 'completed' || query.status === 'archived') {
    filter.status = query.status;
  } else if (query.status !== 'all') {
    filter.status = { $ne: 'archived' };
  }

  if (query.q) filter.name = { $regex: escapeRegex(query.q), $options: 'i' };

  const visible = await visibleProjectIds(orgId, userId, role);
  if (visible) filter._id = { $in: visible };

  const [rows, total] = await Promise.all([
    Project.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit),
    Project.countDocuments(filter),
  ]);

  return { items: rows.map((row) => serializeProject(row)), meta: pageMeta(page, limit, total) };
}

export async function getProject(orgId: string, projectId: string, userId: string, role: Role) {
  const project = await assertProjectAccess(orgId, projectId, userId, role);
  const [members, labels] = await Promise.all([
    listProjectMembers(orgId, projectId),
    Label.find({ projectId, organizationId: orgId }).sort({ name: 1 }),
  ]);
  return {
    ...serializeProject(project),
    members,
    labels: labels.map((label) => ({ id: label.id, name: label.name, color: label.color })),
  };
}

export async function updateProject(
  orgId: string,
  projectId: string,
  userId: string,
  role: Role,
  actorName: string,
  input: {
    name?: string;
    description?: string;
    status?: 'active' | 'completed' | 'archived';
    startDate?: string | null;
    dueDate?: string | null;
  },
) {
  const project = await assertProjectAccess(orgId, projectId, userId, role);
  if (input.name) project.name = input.name.trim();
  if (input.description !== undefined) project.description = input.description;
  if (input.status) project.status = input.status;
  if (input.startDate !== undefined) project.startDate = input.startDate ? new Date(input.startDate) : null;
  if (input.dueDate !== undefined) project.dueDate = input.dueDate ? new Date(input.dueDate) : null;
  await project.save();
  await recordActivity({
    organizationId: orgId,
    projectId: project.id,
    actorId: userId,
    actorName,
    type: 'project.updated',
    text: `${actorName} updated project "${project.name}"`,
  });
  await cacheDel(`dash:${orgId}`);
  return serializeProject(project);
}

export async function deleteProject(orgId: string, projectId: string, userId: string, role: Role) {
  const project = await assertProjectAccess(orgId, projectId, userId, role);
  project.deletedAt = new Date();
  await project.save();
  await cacheDel(`dash:${orgId}`);
}

async function listProjectMembers(orgId: string, projectId: string) {
  const rows = await ProjectMember.find({ projectId, organizationId: orgId }).populate('userId', 'name email');
  return rows.map((row) => {
    const user = row.userId as unknown as { _id: unknown; name: string; email: string };
    return { userId: String(user._id), name: user.name, email: user.email };
  });
}

export async function addProjectMember(orgId: string, projectId: string, actor: Actor, email: string) {
  await assertProjectAccess(orgId, projectId, actor.id, actor.role);
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) throw new ApiError(404, 'No user with that email');

  const inOrg = await OrganizationMember.findOne({ organizationId: orgId, userId: user._id });
  if (!inOrg) throw new ApiError(400, 'That person is not in this organization');

  await ProjectMember.updateOne(
    { projectId, userId: user._id },
    { $setOnInsert: { organizationId: orgId, projectId, userId: user._id } },
    { upsert: true },
  );

  await recordActivity({
    organizationId: orgId,
    projectId,
    actorId: actor.id,
    actorName: actor.name,
    type: 'project.member',
    text: `${actor.name} added ${user.name} to the project`,
  });

  return { userId: user.id, name: user.name, email: user.email };
}

export async function removeProjectMember(
  orgId: string,
  projectId: string,
  actor: Actor,
  userId: string,
) {
  await assertProjectAccess(orgId, projectId, actor.id, actor.role);
  await ProjectMember.deleteOne({ projectId, userId, organizationId: orgId });
}

export async function addLabel(
  orgId: string,
  projectId: string,
  userId: string,
  role: Role,
  input: { name: string; color?: string },
) {
  await assertProjectAccess(orgId, projectId, userId, role);
  const name = input.name.trim();
  const existing = await Label.findOne({ projectId, organizationId: orgId, name });
  if (existing) return { id: existing.id, name: existing.name, color: existing.color };

  const label = await Label.create({
    organizationId: orgId,
    projectId,
    name,
    color: input.color || '#0f6e56',
  });
  return { id: label.id, name: label.name, color: label.color };
}
