import { Schema, model } from 'mongoose';

const activitySchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null },
    taskId: { type: Schema.Types.ObjectId, ref: 'Task', default: null },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    actorName: { type: String, required: true },
    type: { type: String, required: true },
    text: { type: String, required: true },
  },
  { timestamps: true },
);

activitySchema.index({ organizationId: 1, createdAt: -1 });
activitySchema.index({ taskId: 1, createdAt: -1 });

export const Activity = model('Activity', activitySchema);
