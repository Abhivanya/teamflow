import type { Role } from './types';

const PERMISSIONS = {
  'organization.read': ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'],
  'organization.update': ['OWNER', 'ADMIN'],
  'member.invite': ['OWNER', 'ADMIN'],
  'member.remove': ['OWNER', 'ADMIN'],
  'member.update': ['OWNER', 'ADMIN'],
  'project.create': ['OWNER', 'ADMIN', 'MANAGER'],
  'project.update': ['OWNER', 'ADMIN', 'MANAGER'],
  'project.delete': ['OWNER', 'ADMIN'],
  'task.create': ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER'],
  'task.update': ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER'],
  'task.delete': ['OWNER', 'ADMIN', 'MANAGER'],
  'comment.create': ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER'],
} as const;

export type UiPermission = keyof typeof PERMISSIONS;

export function can(role: Role | undefined, permission: UiPermission) {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}
