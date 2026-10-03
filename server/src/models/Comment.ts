import { Schema, model } from 'mongoose';

const commentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, maxlength: 4000 },
    parentId: { type: Schema.Types.ObjectId, ref: 'Comment', default: null },
  },
  { timestamps: true },
);

commentSchema.index({ taskId: 1, createdAt: 1 });

export const Comment = model('Comment', commentSchema);
