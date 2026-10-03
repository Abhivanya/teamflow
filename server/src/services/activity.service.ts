import { Activity } from '../models/Activity';
import { emitToProject } from '../sockets/io';

type Entry = {
  organizationId: string;
  actorId: string;
  actorName: string;
  projectId?: string | null;
  taskId?: string | null;
  type: string;
  text: string;
};

export async function recordActivity(entry: Entry) {
  await Activity.create({
    organizationId: entry.organizationId,
    projectId: entry.projectId ?? null,
    taskId: entry.taskId ?? null,
    actorId: entry.actorId,
    actorName: entry.actorName,
    type: entry.type,
    text: entry.text,
  });

  if (entry.projectId) {
    emitToProject(entry.projectId, 'task:changed', {
      taskId: entry.taskId ?? null,
      type: entry.type,
    });
  }
}
