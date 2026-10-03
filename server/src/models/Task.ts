import { Schema, model } from 'mongoose';

export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] as const;
export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

const taskSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    description: { type: String, default: '', maxlength: 8000 },
    status: { type: String, enum: TASK_STATUSES, default: 'TODO' },
    priority: { type: String, enum: TASK_PRIORITIES, default: 'MEDIUM' },
    assigneeId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reporterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    dueDate: { type: Date, default: null },
    labels: [{ type: String, trim: true }],
    position: { type: Number, default: 1024 },
    dueReminderSent: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

taskSchema.index({ organizationId: 1, projectId: 1, deletedAt: 1, status: 1, position: 1 });
taskSchema.index({ organizationId: 1, deletedAt: 1, dueDate: 1 });

export const Task = model('Task', taskSchema);
