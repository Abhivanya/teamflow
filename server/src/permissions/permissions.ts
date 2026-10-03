export const ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'] as const;
export type Role = (typeof ROLES)[number];

// One map, used by middleware. Role checks should not be copied into controllers.
export const PERMISSIONS = {
  'organization.read': ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'],
  'organization.update': ['OWNER', 'ADMIN'],
  'member.invite': ['OWNER', 'ADMIN'],
  'member.remove': ['OWNER', 'ADMIN'],
  'member.update': ['OWNER', 'ADMIN'],
  'project.create': ['OWNER', 'ADMIN', 'MANAGER'],
  'project.update': ['OWNER', 'ADMIN', 'MANAGER'],
  'project.delete': ['OWNER', 'ADMIN'],
  'project.member.add': ['OWNER', 'ADMIN', 'MANAGER'],
  'task.create': ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER'],
  'task.update': ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER'],
  'task.delete': ['OWNER', 'ADMIN', 'MANAGER'],
  'task.assign': ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER'],
  'comment.create': ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER'],
  'comment.update': ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER'],
  'comment.delete': ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER'],
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission) {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}
