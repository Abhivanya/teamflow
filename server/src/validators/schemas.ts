import { z } from 'zod';
import { ROLES } from '../permissions/permissions';
import { TASK_PRIORITIES, TASK_STATUSES } from '../models/Task';

const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').nullable().optional();

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(120),
  password: z.string().min(8).max(72),
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(72),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
});

export const emailOnlySchema = z.object({
  email: z.string().trim().email(),
});

export const resetSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(8).max(72),
});

export const tokenSchema = z.object({
  token: z.string().min(20),
});

export const orgSchema = z.object({
  name: z.string().trim().min(2).max(80),
});

export const inviteSchema = z.object({
  email: z.string().trim().email(),
  role: z.enum(ROLES).exclude(['OWNER']),
});

export const roleSchema = z.object({
  role: z.enum(['ADMIN', 'MANAGER', 'MEMBER', 'VIEWER']),
});

export const projectSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional(),
  startDate: dateField,
  dueDate: dateField,
});

export const projectPatchSchema = projectSchema.partial().extend({
  status: z.enum(['active', 'completed', 'archived']).optional(),
});

export const memberEmailSchema = z.object({
  email: z.string().trim().email(),
});

export const labelSchema = z.object({
  name: z.string().trim().min(1).max(30),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const taskSchema = z.object({
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().max(8000).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: dateField,
  labels: z.array(z.string().trim().min(1).max(30)).max(8).optional(),
});

export const taskPatchSchema = taskSchema.partial().extend({
  position: z.number().optional(),
  updatedAt: z.string().datetime().optional(),
});

export const commentSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  parentId: z.string().nullable().optional(),
});

export const commentPatchSchema = z.object({
  body: z.string().trim().min(1).max(4000),
});
