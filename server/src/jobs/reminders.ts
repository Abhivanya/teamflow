import { Task } from '../models/Task';
import { createNotification } from '../services/notification.service';
import { logger } from '../config/logger';

export async function sendDueReminders() {
  const soon = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const tasks = await Task.find({
    deletedAt: null,
    dueReminderSent: false,
    assigneeId: { $ne: null },
    dueDate: { $gte: new Date(), $lte: soon },
    status: { $ne: 'DONE' },
  }).limit(100);

  for (const task of tasks) {
    // Flag first so a retry does not send a second reminder for the same due date.
    const updated = await Task.updateOne(
      { _id: task._id, dueReminderSent: false },
      { dueReminderSent: true },
    );
    if (updated.modifiedCount !== 1) continue;

    await createNotification({
      userId: String(task.assigneeId),
      organizationId: String(task.organizationId),
      type: 'due',
      title: 'Task due soon',
      body: `"${task.title}" is due within 24 hours.`,
      link: `/projects/${task.projectId}?task=${task.id}`,
    });
  }

  if (tasks.length) logger.info({ count: tasks.length }, 'due reminders sent');
}
