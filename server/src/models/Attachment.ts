import { Schema, model } from 'mongoose';

const attachmentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    originalName: { type: String, required: true },
    storedName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
  },
  { timestamps: true },
);

attachmentSchema.index({ taskId: 1 });

export const Attachment = model('Attachment', attachmentSchema);
