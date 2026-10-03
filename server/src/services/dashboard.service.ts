import { Types } from 'mongoose';
import { cacheGet, cacheSet } from '../config/redis';
import { Activity } from '../models/Activity';
import { Project } from '../models/Project';
import { Task } from '../models/Task';

export async function getDashboard(orgId: string) {
  const cached = await cacheGet<Record<string, unknown>>(`dash:${orgId}`);
  if (cached) return { ...cached, cached: true };

  const orgObjectId = new Types.ObjectId(orgId);
  const projectFilter = { organizationId: orgId, deletedAt: null };
  const taskFilter = { organizationId: orgObjectId, deletedAt: null };
  const now = new Date();
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const [
    totalProjects,
    activeProjects,
    completedProjects,
    openTasks,
    overdueTasks,
    byStatus,
    byPriority,
    recentActivity,
    memberActivity,
    projects,
  ] = await Promise.all([
    Project.countDocuments(projectFilter),
    Project.countDocuments({ ...projectFilter, status: 'active' }),
    Project.countDocuments({ ...projectFilter, status: 'completed' }),
    Task.countDocuments({ ...taskFilter, status: { $ne: 'DONE' } }),
    Task.countDocuments({
      ...taskFilter,
      status: { $ne: 'DONE' },
      dueDate: { $lt: now, $ne: null },
    }),
    Task.aggregate([{ $match: taskFilter }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Task.aggregate([{ $match: taskFilter }, { $group: { _id: '$priority', count: { $sum: 1 } } }]),
    Activity.find({ organizationId: orgId }).sort({ createdAt: -1 }).limit(8),
    Activity.aggregate([
      { $match: { organizationId: orgObjectId, createdAt: { $gte: twoWeeksAgo } } },
      { $group: { _id: '$actorName', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 6 },
    ]),
    Project.find({ ...projectFilter, status: { $ne: 'archived' } }).sort({ updatedAt: -1 }).limit(6),
  ]);

  const progress = await Promise.all(
    projects.map(async (project) => {
      const [total, done] = await Promise.all([
        Task.countDocuments({ projectId: project._id, organizationId: orgId, deletedAt: null }),
        Task.countDocuments({ projectId: project._id, organizationId: orgId, deletedAt: null, status: 'DONE' }),
      ]);
      return {
        id: project.id,
        name: project.name,
        total,
        done,
        percent: total ? Math.round((done / total) * 100) : 0,
      };
    }),
  );

  const data = {
    totalProjects,
    activeProjects,
    completedProjects,
    openTasks,
    overdueTasks,
    tasksByStatus: byStatus.map((row) => ({ status: row._id as string, count: row.count as number })),
    tasksByPriority: byPriority.map((row) => ({ priority: row._id as string, count: row.count as number })),
    memberActivity: memberActivity.map((row) => ({ name: row._id as string, count: row.count as number })),
    projectProgress: progress,
    recentActivity: recentActivity.map((item) => ({
      id: item.id,
      text: item.text,
      type: item.type,
      createdAt: item.createdAt,
    })),
  };

  await cacheSet(`dash:${orgId}`, data, 30);
  return { ...data, cached: false };
}
