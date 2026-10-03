import { Schema, model } from 'mongoose';

const labelSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    name: { type: String, required: true, trim: true, maxlength: 30 },
    color: { type: String, default: '#0f6e56' },
  },
  { timestamps: true },
);

labelSchema.index({ projectId: 1, name: 1 }, { unique: true });

export const Label = model('Label', labelSchema);
