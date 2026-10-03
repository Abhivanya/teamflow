import { Schema, model } from 'mongoose';

const projectSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: '', maxlength: 2000 },
    status: { type: String, enum: ['active', 'completed', 'archived'], default: 'active' },
    startDate: { type: Date, default: null },
    dueDate: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

projectSchema.index({ organizationId: 1, deletedAt: 1, status: 1 });

export const Project = model('Project', projectSchema);
