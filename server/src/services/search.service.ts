import { OrganizationMember } from '../models/OrganizationMember';
import { Project } from '../models/Project';
import { ProjectMember } from '../models/ProjectMember';
import { Task } from '../models/Task';
import type { Role } from '../permissions/permissions';
import { escapeRegex } from '../utils/tokens';

export async function searchOrg(orgId: string, userId: string, role: Role, q: string) {
  const term = q.trim();
  if (term.length < 2) return { projects: [], tasks: [], members: [] };

  const regex = new RegExp(escapeRegex(term), 'i');
  let projectFilter: Record<string, unknown> = {
    organizationId: orgId,
    deletedAt: null,
    name: regex,
  };

  if (role !== 'OWNER' && role !== 'ADMIN') {
    const memberships = await ProjectMember.find({ organizationId: orgId, userId }).select('projectId');
    projectFilter = { ...projectFilter, _id: { $in: memberships.map((row) => row.projectId) } };
  }

  const projects = await Project.find(projectFilter).limit(6);

  const taskFilter: Record<string, unknown> = {
    organizationId: orgId,
    deletedAt: null,
    title: regex,
  };

  // A member can search tasks on their projects even when the project name
  // itself does not match.
  if (role !== 'OWNER' && role !== 'ADMIN') {
    const memberships = await ProjectMember.find({ organizationId: orgId, userId }).select('projectId');
    taskFilter.projectId = { $in: memberships.map((row) => row.projectId) };
  }

  const [tasks, members] = await Promise.all([
    Task.find(taskFilter).limit(8),
    OrganizationMember.find({ organizationId: orgId }).populate('userId', 'name email'),
  ]);

  const people = members
    .map((member) => {
      const user = member.userId as unknown as { _id: unknown; name: string; email: string };
      return { userId: String(user._id), name: user.name, email: user.email, role: member.role };
    })
    .filter((member) => regex.test(member.name) || regex.test(member.email))
    .slice(0, 6);

  return {
    projects: projects.map((project) => ({ id: project.id, name: project.name, status: project.status })),
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      projectId: String(task.projectId),
    })),
    members: people,
  };
}
