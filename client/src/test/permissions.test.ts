import { describe, expect, it } from 'vitest';
import { can } from '../lib/permissions';

describe('ui permissions', () => {
  it('hides task creation from viewers', () => {
    expect(can('VIEWER', 'task.create')).toBe(false);
    expect(can('MEMBER', 'task.create')).toBe(true);
    expect(can(undefined, 'project.create')).toBe(false);
  });
});
