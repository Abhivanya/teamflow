import { describe, expect, it } from 'vitest';
import { can } from '../src/permissions/permissions';

describe('permissions', () => {
  it('lets a member create a task and blocks a viewer', () => {
    expect(can('MEMBER', 'task.create')).toBe(true);
    expect(can('VIEWER', 'task.create')).toBe(false);
    expect(can('VIEWER', 'organization.read')).toBe(true);
  });

  it('keeps org settings with owners and admins', () => {
    expect(can('ADMIN', 'organization.update')).toBe(true);
    expect(can('MANAGER', 'organization.update')).toBe(false);
    expect(can('MANAGER', 'project.create')).toBe(true);
  });
});
